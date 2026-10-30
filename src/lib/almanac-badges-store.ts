/**
 * The local "earned in window" badge store (PHASE-11e, L3). Phone only. Starts
 * with `ato.`, so sign-out wipes it with the rest of the account's local data.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { addSeasonalBadges, earnableSeasonalBadges, parseSeasonalBadges, type SeasonalBadge } from '@/lib/badges';

import type { DayTheme } from '@/lib/almanac/resolve';

export const ALMANAC_BADGES_KEY = 'ato.almanac.badges.v1';

export async function loadSeasonalBadges(userId: string): Promise<SeasonalBadge[]> {
  try {
    return parseSeasonalBadges(await AsyncStorage.getItem(ALMANAC_BADGES_KEY), userId);
  } catch {
    return [];
  }
}

let queue: Promise<unknown> = Promise.resolve();

/** Earn today's badges after a Pick is answered. Resolves to the ones that are new. */
export function earnSeasonalBadges(userId: string, theme: DayTheme): Promise<SeasonalBadge[]> {
  const run = queue.then(async () => {
    const have = await loadSeasonalBadges(userId);
    const next = addSeasonalBadges(
      have,
      earnableSeasonalBadges({
        ymd: theme.ymd,
        seasonId: theme.season.id,
        seasonName: theme.season.name,
        eventId: theme.display.event,
        eventName: theme.winner && theme.winner.id === theme.display.event ? theme.winner.name : null,
        eventPhase: theme.display.phase,
      }),
    );
    if (next.added.length > 0) {
      try {
        await AsyncStorage.setItem(ALMANAC_BADGES_KEY, JSON.stringify({ userId, badges: next.list }));
      } catch (err) {
        console.log('[almanac-badges] write skipped:', err);
        return [];
      }
    }
    return next.added;
  });
  queue = run.catch(() => undefined);
  return run;
}
