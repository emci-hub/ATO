import { spendAtoTokensLegendReroll } from '@/lib/ato-tokens-server';
import type { AtoTokenResult } from '@/lib/ato-tokens';
import { splitArchetypeCode } from '@/lib/legends64/archetypes';
import { generateLegendStory } from '@/lib/legends64/generate-story';
import { saveGeneration } from '@/lib/legends64/store';

/**
 * QUESTION REROLL REMOVED 2026-10-06 (fixed question bank, wave85): it swapped
 * a round question for another from the shared AI pool, which no longer
 * exists. Sets are drawn at random from the fixed bank, so there is nothing to
 * swap to. The server RPCs (reroll_question_item, the question_reroll spend)
 * are untouched. Only the parked legend reroll remains here.
 *
 * ATO tokens reroll — spendAtoTokensLegendReroll/QuestionReroll
 * (ato-tokens-server.ts) already move the currency; this module is the
 * caller that pairs each spend with what it actually rerolls. Category
 * reroll (spendAtoTokensCategoryReroll) has no caller here right now — the
 * old category_question_items reroll was removed with the rest of the old
 * Categorize Q&A system (core loop redesign §3); a reroll for the new
 * category_statements system is separate, not-yet-built scope (§5/§6/T-10).
 *
 * Order matters for every "generate a replacement" surface: whatever can
 * fail (finding a bank candidate, an AI call) runs BEFORE the spend, same
 * as SageInsightSpend's "never charge for a reroll that can't happen." The
 * one gap this can't close: a failure in the final persist step (network
 * drop between the spend landing and the effect RPC) still leaves the day's
 * reroll spent with nothing to show for it — accepted given the price (1
 * ATO token for question, 10 for legend) and how rarely a same-session DB
 * write fails right after a same-session read succeeded.
 */

/**
 * Every spend RPC (wave51) raises a Postgres exception (errcode P0040) for
 * insufficient balance rather than returning `{ok:false}` — only the
 * daily-cap case does that. The UI already gates the reroll button on a
 * client-side balance check, so this only matters for the rare race where
 * the balance changes between render and tap; without this, that race threw
 * past the "already rerolled today" vs "not enough tokens" copy entirely
 * and landed on a generic catch-all message (found in review).
 */
async function trySpend(spend: () => Promise<AtoTokenResult>): Promise<AtoTokenResult> {
  try {
    return await spend();
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === 'P0040') {
      return { ok: false, balance: 0, reason: 'insufficient' };
    }
    throw err;
  }
}

export interface LegendRerollResult {
  result: AtoTokenResult;
  story: string | null;
  /** id of the newly-saved legend_generations row, so the caller can exclude it from the archive fold (which otherwise duplicates the currently-shown story). */
  generationId: string | null;
}

/**
 * Legend reroll (core loop redesign §4, new 64-archetype system). Order is
 * the OPPOSITE of a naive "charge then generate": generate the replacement
 * story FIRST (claim_legend_story_generation's quota check is inside
 * generateLegendStory), and only spend the 10 ATO tokens once that story
 * actually exists — mirrors rerollQuestionItem/rerollCategoryItem's own
 * "never charge for a reroll that can't happen" rule (see this file's top
 * docstring) exactly, for the same reason: a quota-exhausted or failed AI
 * call must never cost the user a token.
 */
export async function rerollLegend(archetypeCode: string): Promise<LegendRerollResult> {
  const split = splitArchetypeCode(archetypeCode);
  if (!split) {
    return { result: { ok: false, balance: 0, reason: 'invalid_code' }, story: null, generationId: null };
  }

  const generation = await generateLegendStory(split.core, split.modifier);
  if (generation.kind !== 'ok') {
    return {
      result: { ok: false, balance: 0, reason: generation.kind === 'quota' ? 'quota' : 'generation_failed' },
      story: null,
      generationId: null,
    };
  }

  const result = await trySpend(spendAtoTokensLegendReroll);
  if (!result.ok) return { result, story: null, generationId: null };

  const generationId = await saveGeneration(archetypeCode, generation.story);
  return { result, story: generation.story, generationId };
}
