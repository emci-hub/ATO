/**
 * 🗣️ How you argue — from the two conflict report tracks. Pure. Both must be
 * stable. Thresholds are named so emci can tune them; intervals are closed.
 */
import { reportStableValue } from '@/lib/categories';
import type { TraitTrack } from '@/lib/trait-stability';

import { conflictLineFor } from './conflict-bank';
import type { ConflictLine, ConflictStyleId } from './types';

/** Both values inside [MIDDLE_LOW, MIDDLE_HIGH] → deal maker. */
export const CONFLICT_MIDDLE_LOW = 0.4;
export const CONFLICT_MIDDLE_HIGH = 0.6;
/** Outside the middle box: ≥ this is the high side. */
export const CONFLICT_SPLIT = 0.5;

export function conflictStyleFor(assertiveness: number, cooperativeness: number): ConflictStyleId {
  const inMiddle = (v: number) => v >= CONFLICT_MIDDLE_LOW && v <= CONFLICT_MIDDLE_HIGH;
  if (inMiddle(assertiveness) && inMiddle(cooperativeness)) return 'deal_maker';
  const a = assertiveness >= CONFLICT_SPLIT;
  const c = cooperativeness >= CONFLICT_SPLIT;
  if (a && c) return 'team_fixer';
  if (a) return 'straight_shooter';
  if (c) return 'peacekeeper';
  return 'quiet_exit';
}

/**
 * The two conflict sub-scores, read-only. A thin view over the same
 * `reportStableValue` the categories use: it changes no category math.
 * Null when either track is not stable yet.
 */
export function conflictSubScores(
  tracks: readonly TraitTrack[],
  now: Date = new Date(),
): { assertiveness: number; cooperativeness: number } | null {
  const assertiveness = reportStableValue(tracks, 'conflict_assertiveness', now);
  const cooperativeness = reportStableValue(tracks, 'conflict_cooperativeness', now);
  if (assertiveness == null || cooperativeness == null) return null;
  return { assertiveness, cooperativeness };
}

export function pickConflict(tracks: readonly TraitTrack[], now: Date = new Date()): ConflictLine | null {
  const scores = conflictSubScores(tracks, now);
  if (!scores) return null;
  return conflictLineFor(conflictStyleFor(scores.assertiveness, scores.cooperativeness));
}
