import { supabase } from '@/lib/supabase';
import type { TraitAxis } from '@/lib/traits';
import {
  spendAtoTokensLegendReroll,
  spendAtoTokensQuestionReroll,
} from '@/lib/ato-tokens-server';
import type { AtoTokenResult } from '@/lib/ato-tokens';
import { splitArchetypeCode } from '@/lib/legends64/archetypes';
import { generateLegendStory } from '@/lib/legends64/generate-story';
import { saveGeneration } from '@/lib/legends64/store';

import { fetchBankCandidates } from './bank-pool';
import type { QuestionItemRow, QuestionOption } from './types';

/**
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

export interface RerollItemUpdate {
  id: string;
  axis: TraitAxis;
  prompt: string;
  options: QuestionOption[];
}

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

function parseRerollItemResult(data: unknown): RerollItemUpdate | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;
  const id = typeof row.id === 'string' ? row.id : null;
  const axis = typeof row.axis === 'string' ? row.axis : null;
  const prompt = typeof row.prompt === 'string' ? row.prompt : null;
  const options = Array.isArray(row.options) ? (row.options as QuestionOption[]) : null;
  if (!id || !axis || !prompt || !options) return null;
  return { id, axis: axis as TraitAxis, prompt, options };
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

/** question_items rows already used by the same pack (including the item being rerolled) — the reroll RPC never repeats one of these on the same axis within a round. */
async function fetchPackBankItemIds(packId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('question_items')
    .select('question_bank_item_id')
    .eq('pack_id', packId)
    .not('question_bank_item_id', 'is', null);
  if (error) throw error;
  return new Set(
    (data ?? []).map((row) => (row as { question_bank_item_id: string }).question_bank_item_id),
  );
}

/**
 * Question reroll — ongoing-round items only (Infinite Questions rows carry
 * no question_bank_item_id and reroll_question_item rejects them). Mirrors
 * the effect RPC's own exclusion set (permanent per-user exclusions AND
 * every bank item already used elsewhere in this same pack) before spending
 * — a precheck that only matched the permanent-exclusion half let a sparse
 * axis spend the token and then have the RPC find nothing (found in
 * review). The RPC still re-derives its own pick atomically rather than
 * trusting this read, so a rare race where the candidate disappears between
 * the two calls still fails safely (spent, no swap) instead of reusing a
 * stale id.
 */
export async function rerollQuestionItem(
  item: Pick<QuestionItemRow, 'id' | 'axis' | 'packId'>,
): Promise<{ result: AtoTokenResult; item: RerollItemUpdate | null }> {
  const [candidates, packBankIds] = await Promise.all([
    fetchBankCandidates(item.axis, 8),
    fetchPackBankItemIds(item.packId),
  ]);
  const hasCandidate = candidates.some((candidate) => !packBankIds.has(candidate.id));
  if (!hasCandidate) {
    return { result: { ok: false, balance: 0, reason: 'no_candidates' }, item: null };
  }

  const result = await trySpend(() => spendAtoTokensQuestionReroll(item.id));
  if (!result.ok) return { result, item: null };

  const { data, error } = await supabase.rpc('reroll_question_item', { p_item_id: item.id });
  if (error) {
    console.log('[reroll] question reroll effect error:', error);
    return { result, item: null };
  }
  return { result, item: parseRerollItemResult(data) };
}

