import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { fetchChecks } from '@/lib/checks';
import { onChecksChanged } from '@/lib/checks-events';
import { useMeContext } from '@/lib/me-context';
import { useSession } from '@/hooks/use-session';
import { growthState, type GrowthState } from '@/lib/growth';

/**
 * Live growth state for the current user. check_count is derived from the
 * checks table each render (the app has no stored check_count — it's the count
 * of all-time Checks per the plan). Presence is a pure function of that count
 * (monotonic). Depth is a live function of `me.facts.length` and can drop
 * back to 0 if the last fact is deleted.
 */
export function useGrowth() {
  const { session } = useSession();
  const { me } = useMeContext();
  const userId = session?.user.id;
  const [checkCount, setCheckCount] = useState(0);

  const load = useCallback(async () => {
    if (!userId) {
      setCheckCount(0);
      return;
    }
    try {
      const checks = await fetchChecks(userId);
      setCheckCount(checks.length);
    } catch {
      // keep last known count
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  // Refetch on app foreground so a check logged elsewhere (or a reinstall)
  // updates the tiers without a manual refresh.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') load();
    });
    const unsub = onChecksChanged(load);
    return () => {
      sub.remove();
      unsub();
    };
  }, [load]);

  const state: GrowthState = useMemo(
    () => growthState(me, checkCount),
    [me, checkCount],
  );

  return { state };
}
