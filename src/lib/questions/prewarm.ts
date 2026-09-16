/**
 * Bank-pool prewarm — top the shared question_bank_pool up AHEAD of demand,
 * so composing an ongoing round draws entirely from the bank and never makes
 * the user wait on a sequential chain of AI calls.
 *
 * Why this exists: `composeOngoingRound` is bank-first, AI-fallback. The
 * fallback works, but it runs INSIDE the user's round-start, synchronously,
 * against a 40s timeout (src/components/questions-fold.tsx) — and
 * `MAX_SHORTFALL_RETRIES` was already cut from 2 to 1 because that budget
 * was too tight (chunked-generate.ts). Prewarm moves that generation off the
 * critical path: the round the user is waiting on is served from the bank,
 * and the refill for the NEXT round happens afterwards, in the background,
 * with nobody watching.
 *
 * "Ahead of demand" is measured per-axis, not as a flat pool size, because
 * the pool is consumed per-axis: a round needs exactly `AXIS_TIER_COUNTS`
 * questions of each axis (tiered-axis-plan.ts), so an axis with 1/round
 * demand and an axis with 3/round demand need different absolute depths to
 * cover the same number of rounds. `RESERVE_ROUNDS` is therefore expressed
 * in ROUNDS of cover, and the per-axis target falls out of the tier plan.
 *
 * Note the shared pool is not a queue and does not drain: serving a question
 * only bumps `times_served`, it removes nothing. What actually runs out is
 * one USER's supply of questions they have not already seen — which is what
 * `bank_pool_depth` (wave68) measures, and what this module reads.
 *
 * The threshold half of this module is pure/testable (no Supabase import) in
 * the same shape as tiered-axis-plan.ts; only `prewarmBankPool` at the
 * bottom touches the network.
 */
import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';

import { AXIS_TIER_COUNTS } from './tiered-axis-plan';
import { CHUNK_SIZE } from './chunked-generate';

/**
 * How many future rounds of cover the pool should hold for a given user
 * before prewarm considers an axis short. Three: one round in hand, plus two
 * of slack so a single failed or skipped prewarm pass still can't push the
 * next round onto the synchronous AI path.
 */
export const RESERVE_ROUNDS = 3;

/**
 * Ceiling on how many questions one prewarm pass will generate, across all
 * axes. Each `CHUNK_SIZE` questions is one sequential `ai-generate` call
 * billed to this user's quota (`claim_ai_call`), so an uncapped pass on a
 * cold pool would quietly spend far more than a round does. Capped at two
 * chunks: a deep shortfall converges over consecutive rounds instead of
 * being closed in one expensive burst.
 */
export const PREWARM_MAX_QUESTIONS = CHUNK_SIZE * 2;

/** Per-axis depth the pool should hold: that axis's per-round demand × the reserve. */
export function reserveTargetFor(axis: TraitAxis): number {
  return AXIS_TIER_COUNTS[axis] * RESERVE_ROUNDS;
}

/**
 * Axis counts to generate to bring every short axis back up to its reserve
 * target, given a depth map from `bank_pool_depth`.
 *
 * An axis MISSING from `depth` is treated as 0, not skipped — the RPC only
 * returns axes that have at least one usable row, so a genuinely exhausted
 * axis arrives as an absence and must still register as short. This is the
 * case that matters most, so getting it backwards would defeat the feature.
 *
 * Shortfalls are filled deepest-first and stop at `PREWARM_MAX_QUESTIONS`,
 * so a capped pass always spends its budget on the axis closest to running
 * out rather than on whichever axis happens to sort first.
 */
export function axesBelowReserve(
  depth: Partial<Record<TraitAxis, number>>,
  max: number = PREWARM_MAX_QUESTIONS,
): Partial<Record<TraitAxis, number>> {
  const shortfalls = TRAIT_AXES.map((axis) => ({
    axis,
    short: reserveTargetFor(axis) - (depth[axis] ?? 0),
  }))
    .filter((row) => row.short > 0)
    .sort((a, b) => b.short - a.short || TRAIT_AXES.indexOf(a.axis) - TRAIT_AXES.indexOf(b.axis));

  const out: Partial<Record<TraitAxis, number>> = {};
  let budget = Math.max(max, 0);
  for (const { axis, short } of shortfalls) {
    if (budget <= 0) break;
    const take = Math.min(short, budget);
    out[axis] = take;
    budget -= take;
  }
  return out;
}
