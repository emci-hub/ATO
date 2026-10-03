/**
 * The ONE place that decides how many questions each trait gets in an ongoing
 * round — authored (bank pool) or AI-written alike. Pure/testable, no
 * Supabase import. (File name kept from the tiered plan it replaced, so the
 * import paths across the app did not have to move.)
 *
 * Adaptive, in the spirit of computerized adaptive testing, simplified
 * (staged intake, emci 2026-10-02): a round of 16 goes first to the traits
 * whose read is weakest, and is otherwise spread evenly.
 *
 *   1. unsettled — under 3 answers: filled up to 3
 *   2. mixed     — 3+ answers that pulled two ways (`isAxisMixed`), or the
 *                  inconsistent-answerer trap: 2
 *   3. decaying  — idle past DECAY_GRACE_DAYS (60), so its stability is
 *                  fading: 2
 *   4. leftover slots go one at a time to the traits that have waited longest
 *      since their last answer, so a settled trait still gets an occasional
 *      refresh and real change is noticed.
 *
 * No trait ever gets more than MAX_PER_TRAIT_PER_ROUND (3) in one round, so
 * one round can never skew a person's mix, and the round is always exactly
 * ONGOING_ROUND_SIZE. A fully settled, recent profile gets 1 per trait.
 *
 * The old tiered table (3/3/3, 2/2/2, 1x10 = 25, ranked by archetype usage)
 * is gone: every trait needs the same 3 answers, so tiers only slowed ten
 * traits down (docs/archive/TRAIT_SYSTEM_REDESIGN_PLAN.md §2).
 */
import {
  DECAY_GRACE_DAYS,
  isAxisMixed,
  isInconsistentAnswerer,
  STABILITY_FLOOR_N,
  trackFor,
  type TraitTrack,
} from '@/lib/trait-stability';
import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';

/** One question per trait when nothing needs extra attention. */
export const ONGOING_ROUND_SIZE = TRAIT_AXES.length;
/** Anti-skew cap: no trait gets more than this in one round. */
export const MAX_PER_TRAIT_PER_ROUND = 3;
/** What a mixed or decaying trait gets before leftovers are dealt. */
export const RECHECK_PER_ROUND = 2;

export type TraitNeed = 'unsettled' | 'mixed' | 'decaying' | 'refresh';

const NEED_RANK: Record<TraitNeed, number> = { unsettled: 0, mixed: 1, decaying: 2, refresh: 3 };

export interface TraitNeedRow {
  axis: TraitAxis;
  need: TraitNeed;
  /** Slots this trait asks for before leftovers (0 for refresh). */
  want: number;
  answered: number;
  /** Days since the last answer; Infinity when never answered. */
  idleDays: number;
}

function idleDaysOf(row: TraitTrack | null, now: Date): number {
  if (!row?.lastTouched) return Number.POSITIVE_INFINITY;
  const at = new Date(row.lastTouched).getTime();
  if (!Number.isFinite(at)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (now.getTime() - at) / 86_400_000);
}

/** Why a trait is (or is not) asking for extra questions. */
export function traitNeed(
  tracks: readonly TraitTrack[],
  axis: TraitAxis,
  now: Date = new Date(),
): TraitNeedRow {
  const row = trackFor(tracks, axis, 'report');
  const answered = row ? Math.max(0, row.answerCount) : 0;
  const idleDays = idleDaysOf(row, now);
  if (answered < STABILITY_FLOOR_N) {
    return { axis, need: 'unsettled', want: STABILITY_FLOOR_N - answered, answered, idleDays };
  }
  if (isAxisMixed(row) || isInconsistentAnswerer(row)) {
    return { axis, need: 'mixed', want: RECHECK_PER_ROUND, answered, idleDays };
  }
  if (idleDays > DECAY_GRACE_DAYS) {
    return { axis, need: 'decaying', want: RECHECK_PER_ROUND, answered, idleDays };
  }
  return { axis, need: 'refresh', want: 0, answered, idleDays };
}

/** Every trait's need, weakest read first (the order a round serves them). */
export function traitNeeds(tracks: readonly TraitTrack[], now: Date = new Date()): TraitNeedRow[] {
  // Explicit index tie-break: Hermes' Array.sort is not guaranteed stable.
  return TRAIT_AXES.map((axis, index) => ({ ...traitNeed(tracks, axis, now), index }))
    .sort(
      (a, b) =>
        NEED_RANK[a.need] - NEED_RANK[b.need] ||
        a.answered - b.answered ||
        b.idleDays - a.idleDays ||
        a.index - b.index,
    )
    .map(({ index: _index, ...row }) => row);
}

/**
 * The per-trait allocation for one round. Keys are inserted weakest-read
 * first, and callers walk the map in key order, so the traits that need it
 * most are also served (and generated) first. Traits that get nothing are
 * left out. Totals exactly `size` (capped at 3 x traits).
 */
export function allocateRound(
  tracks: readonly TraitTrack[],
  now: Date = new Date(),
  size: number = ONGOING_ROUND_SIZE,
): Partial<Record<TraitAxis, number>> {
  const needs = traitNeeds(tracks, now);
  const counts = new Map<TraitAxis, number>();
  let left = Math.max(0, Math.min(size, MAX_PER_TRAIT_PER_ROUND * needs.length));
  const give = (axis: TraitAxis) => {
    counts.set(axis, (counts.get(axis) ?? 0) + 1);
    left -= 1;
  };

  // Needs first, breadth before depth: everyone who needs something gets one
  // before anyone gets a second.
  for (let pass = 1; pass <= MAX_PER_TRAIT_PER_ROUND && left > 0; pass += 1) {
    for (const row of needs) {
      if (left === 0) break;
      if (Math.min(row.want, MAX_PER_TRAIT_PER_ROUND) >= pass) give(row.axis);
    }
  }

  // Leftovers, one at a time: to the trait with the fewest so far this round,
  // and among those the one that has waited longest — so a refresh reaches
  // every trait before anyone gets a second, and spreads evenly under the cap.
  const waits = TRAIT_AXES.map((axis, index) => ({
    axis,
    index,
    idle: idleDaysOf(trackFor(tracks, axis, 'report'), now),
  }));
  while (left > 0) {
    const pick = waits
      .filter(({ axis }) => (counts.get(axis) ?? 0) < MAX_PER_TRAIT_PER_ROUND)
      .sort(
        (a, b) =>
          (counts.get(a.axis) ?? 0) - (counts.get(b.axis) ?? 0) ||
          b.idle - a.idle ||
          a.index - b.index,
      )[0];
    if (!pick) break;
    give(pick.axis);
  }

  // Serve order: weakest read first, then longest-waiting.
  const out: Partial<Record<TraitAxis, number>> = {};
  for (const row of needs) {
    const n = counts.get(row.axis);
    if (n) out[row.axis] = n;
  }
  return out;
}

/**
 * Extra slots to bring a short round back up to size, on traits that still
 * have room under the cap, in the same priority order. Used when the bank and
 * the AI both came up short for the traits the plan asked for.
 */
export function topUpAllocation(
  have: Partial<Record<TraitAxis, number>>,
  short: number,
  tracks: readonly TraitTrack[],
  exhausted: ReadonlySet<TraitAxis>,
  now: Date = new Date(),
): Partial<Record<TraitAxis, number>> {
  const out: Partial<Record<TraitAxis, number>> = {};
  let left = Math.max(0, short);
  const order = traitNeeds(tracks, now).map((row) => row.axis);
  while (left > 0) {
    let gave = false;
    for (const axis of order) {
      if (left === 0) break;
      if (exhausted.has(axis)) continue;
      const used = (have[axis] ?? 0) + (out[axis] ?? 0);
      if (used >= MAX_PER_TRAIT_PER_ROUND) continue;
      out[axis] = (out[axis] ?? 0) + 1;
      left -= 1;
      gave = true;
    }
    if (!gave) break;
  }
  return out;
}
