import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { Href, router } from 'expo-router';
import * as Notifications from 'expo-notifications';

import { fetchChecks } from '@/lib/checks';
import { onChecksChanged } from '@/lib/checks-events';
import { useMeContext } from '@/lib/me-context';
import { useSession } from '@/hooks/use-session';
import { useGrowth } from '@/hooks/use-growth';
import { pathFromNotificationData } from '@/lib/push-copy';
import { maybeAskNotificationPermission, syncPushSchedule } from '@/lib/push';
import { onTodayCardChanged } from '@/lib/today-card-events';

function openPushPath(url: string) {
  router.push(url as Href);
}

/**
 * Lives only on the authed stack. Asks for notification permission exactly
 * once after the first Check, then keeps local schedules in sync. A "no"
 * does nothing else.
 */
export function PushRuntime() {
  const { session } = useSession();
  const { me } = useMeContext();
  const { state } = useGrowth();
  const userId = session?.user.id;
  const asking = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!userId || !me) return;
    if (asking.current) return;

    asking.current = true;
    maybeAskNotificationPermission(state.checkCount)
      .catch(() => {})
      .finally(() => {
        asking.current = false;
      });
  }, [userId, me, state.checkCount]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!userId || !me) return;

    let active = true;
    async function sync() {
      try {
        const checks = await fetchChecks(userId!);
        if (!active) return;
        await syncPushSchedule({ checks, timeZone: me!.timezone || 'UTC' });
      } catch (err) {
        console.log('[push] sync skipped:', err);
      }
    }

    sync();
    const unsubChecks = onChecksChanged(sync);
    const unsubCard = onTodayCardChanged(sync);
    const app = AppState.addEventListener('change', (next) => {
      if (next === 'active') sync();
    });
    return () => {
      active = false;
      unsubChecks();
      unsubCard();
      app.remove();
    };
  }, [userId, me]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const seen = new Set<string>();
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const id = response.notification.request.identifier;
      if (seen.has(id)) return;
      seen.add(id);
      const url = pathFromNotificationData(response.notification.request.content.data);
      if (url) openPushPath(url);
      Notifications.clearLastNotificationResponse();
    });
    return () => sub.remove();
  }, []);

  return null;
}
