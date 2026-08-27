import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { fetchChecks } from '@/lib/checks';
import { onChecksChanged } from '@/lib/checks-events';
import { markMilestoneCelebrated } from '@/lib/me';
import { useMeContext } from '@/lib/me-context';
import { useSession } from '@/hooks/use-session';
import {
  growthState,
  PRESENCE_MILESTONES,
  shouldCelebrateMilestone,
  type GrowthState,
} from '@/lib/growth';

/**
 * Live growth state for the current user. check_count is derived from the
 * checks table each render (the app has no stored check_count — it's the count
 * of all-time Checks per the plan). Tiers are pure functions of live counts,
 * so they only ever increase and never need reconciling.
 *
 * `celebration` exposes the pending milestone (if any) so the nav companion
 * can fire its one-time louder animation, then call `markCelebrated` to record it.
 */
export function useGrowth() {
  const { session } = useSession();
  const { me, refresh: refreshMe } = useMeContext();
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

  const celebrated = useMemo(() => {
    const raw = me?.milestones_celebrated;
    return raw && typeof raw === 'object' ? (raw as Record<string, string>) : {};
  }, [me?.milestones_celebrated]);

  /** The lowest un-celebrated presence milestone the user has crossed, if any. */
  const pendingMilestone = useMemo(() => {
    for (const milestone of PRESENCE_MILESTONES) {
      if (shouldCelebrateMilestone(state, milestone, celebrated)) return milestone;
    }
    return null;
  }, [state, celebrated]);

  /** Records the celebration so the milestone fires exactly once. */
  const markCelebrated = useCallback(async () => {
    if (!userId || pendingMilestone == null) return;
    await markMilestoneCelebrated(userId, String(pendingMilestone));
    // Refresh ME so the local celebrated map clears and the milestone won't
    // re-fire on the next render.
    await refreshMe().catch(() => {});
  }, [userId, pendingMilestone, refreshMe]);

  return { state, pendingMilestone, markCelebrated };
}
