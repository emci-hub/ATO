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
