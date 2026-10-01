/**
 * Tiered axis-priority allocation for the trait-system redesign (§2-3 of
 * docs/archive/TRAIT_SYSTEM_REDESIGN_PLAN.md). Pure/testable — no Supabase
 * import, same split as category-batch.ts.
 *
 * Ranked by how often each axis is already used across the app's existing
 * 12-archetype catalog: tier 1 (conscientiousness, extraversion) gets 3
 * questions/round, tier 2 (openness) gets 3, tier 3 (agreeableness,
 * conflict_assertiveness, relatedness) gets 2 each, tier 4 (the remaining 10
 * axes) gets 1 each. Total: 6 + 3 + 6 + 10 = 25 questions/round.
 *
 * `Record<TraitAxis, number>` below is checked by TypeScript against every
 * key in TRAIT_AXES — a 17th axis that doesn't get a tier assignment here
 * fails to compile, so coverage can't silently drift the way a runtime-only
 * assertion could.
 */
import { STABILITY_FLOOR_N, trackFor, type TraitTrack } from '@/lib/trait-stability';
import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';

export const AXIS_TIER_COUNTS: Record<TraitAxis, number> = {
  conscientiousness: 3,
  extraversion: 3,
  openness: 3,
  agreeableness: 2,
  conflict_assertiveness: 2,
  relatedness: 2,
  steadiness: 1,
  attachment_anxiety: 1,
  attachment_avoidance: 1,
  conflict_cooperativeness: 1,
  autonomy: 1,
  competence: 1,
  growth_mindset: 1,
  locus_of_control: 1,
  self_efficacy: 1,
  playfulness: 1,
};

export const TIERED_ROUND_SIZE = TRAIT_AXES.reduce((sum, axis) => sum + AXIS_TIER_COUNTS[axis], 0);

/** A fresh copy of the tiered axisCounts map, ready to feed buildQuestionsPrompt. */
export function tieredAxisCounts(): Partial<Record<TraitAxis, number>> {
  return { ...AXIS_TIER_COUNTS };
}

/**
 * The axis allocation for one ongoing round, given where the profile stands.
 *
 * The frozen intake leaves ten axes on 2 answers — one short of
 * STABILITY_FLOOR_N — and the bank has no third question for any of them, so
 * the first round after the 50 is what settles them. The fixed tiered plan
 * spent 15 of its 25 on the six axes that were already past the floor.
 *
 * While any axis is under the floor: each lagging axis first gets what it
 * needs to reach it, least-answered first, then the rest of the round is dealt
 * one at a time in that same order. Lagging axes are inserted first, so they
 * are also served first (callers walk this map in key order). Axes that end
 * up with nothing are left out of the map.
 *
 * Once every axis is at the floor this is exactly `tieredAxisCounts()` — the
 * steady-state plan, and the one the prewarm reserve is sized for.
 */
export function roundAxisCounts(tracks: readonly TraitTrack[]): Partial<Record<TraitAxis, number>> {
  // Explicit index tie-break: Hermes' Array.sort is not guaranteed stable.
  const order = TRAIT_AXES.map((axis, index) => ({
    axis,
    index,
    answered: trackFor(tracks, axis, 'report')?.answerCount ?? 0,
  })).sort((a, b) => a.answered - b.answered || a.index - b.index);

  if (order.every((row) => row.answered >= STABILITY_FLOOR_N)) return tieredAxisCounts();

  const counts: Partial<Record<TraitAxis, number>> = {};
  let left = TIERED_ROUND_SIZE;
  const give = (axis: TraitAxis) => {
    counts[axis] = (counts[axis] ?? 0) + 1;
    left -= 1;
  };

  let closedAGap = true;
  while (left > 0 && closedAGap) {
    closedAGap = false;
    for (const row of order) {
      if (left === 0) break;
      if (row.answered + (counts[row.axis] ?? 0) < STABILITY_FLOOR_N) {
        give(row.axis);
        closedAGap = true;
      }
    }
  }
  while (left > 0) {
    for (const row of order) {
      if (left === 0) break;
      give(row.axis);
    }
  }
  return counts;
}
