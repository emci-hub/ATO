import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { Href, router } from 'expo-router';
import * as Notifications from 'expo-notifications';

import { onChecksChanged } from '@/lib/checks-events';
import { useMeContext } from '@/lib/me-context';
import { useSession } from '@/hooks/use-session';
import { pathFromNotificationData } from '@/lib/push-copy';
import { resyncPushForUser } from '@/lib/push';
import { onDailyInsightChanged } from '@/lib/insight/events';

function openPushPath(url: string) {
  router.push(url as Href);
}

/**
 * Lives only on the authed stack. Keeps local schedules in sync. It never asks
 * for notification permission: the ask is a sheet on Insights after the first
 * insight loads (`notification-ask-sheet.tsx`). A "no" does nothing else.
 */
export function PushRuntime() {
  const { session } = useSession();
  const { me } = useMeContext();
  const userId = session?.user.id;

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!userId || !me) return;

    let active = true;
    async function sync() {
      try {
        if (!active) return;
        await resyncPushForUser(me!);
      } catch (err) {
        console.log('[push] sync skipped:', err);
      }
    }

    sync();
    const unsubChecks = onChecksChanged(sync);
    const unsubInsight = onDailyInsightChanged(sync);
    const app = AppState.addEventListener('change', (next) => {
      if (next === 'active') sync();
    });
    return () => {
      active = false;
      unsubChecks();
      unsubInsight();
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
