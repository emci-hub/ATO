import { useCallback, useEffect, useState } from 'react';

import type { LineReaction } from '@/lib/daily-line/pick';
import { resolveTodayLine, setLineReaction, type TodayLine } from '@/lib/daily-line/state';
import type { TraitTrack } from '@/lib/trait-stability';

/**
 * Today's written line for Home. A local read and a pure pick — no network and
 * no model call, so it is allowed to run on mount (`check:no-auto-ai` is about
 * generation; this generates nothing).
 *
 * Waits for `ready` so the pick is made from the real profile rather than an
 * empty one. If the profile could not be loaded (`persist: false`) a line is
 * still shown, but it is not stored as the day's line.
 */
export function useTodayLine(input: {
  userId: string | undefined;
  ymd: string | undefined;
  tracks: readonly TraitTrack[];
  ready: boolean;
  persist: boolean;
}) {
  const { userId, ymd, tracks, ready, persist } = input;
  const [today, setToday] = useState<TodayLine | null>(null);

  useEffect(() => {
    if (!userId || !ymd || !ready) return;
    let cancelled = false;
    resolveTodayLine({ userId, ymd, tracks, persist })
      .then((next) => {
        if (!cancelled) setToday(next);
      })
      .catch((err) => {
        console.log('[daily-line] resolve error:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, ymd, tracks, ready, persist]);

  // An account switch must not leave the previous account's line on screen.
  useEffect(() => {
    setToday(null);
  }, [userId]);

  const react = useCallback(
    async (reaction: LineReaction) => {
      if (!userId || !ymd) return;
      const saved = await setLineReaction(userId, ymd, reaction);
      setToday((prev) => (prev ? { ...prev, reaction: saved } : prev));
    },
    [userId, ymd],
  );

  return { today, react };
}
