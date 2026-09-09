import { supabase } from '@/lib/supabase';
import type { CategoryId } from '@/lib/categories';
import type { TraitTrack } from '@/lib/trait-stability';
import type { TraitAxis } from '@/lib/traits';
import type { TalkStyle } from '@/lib/voice/types';
import { logShownVariants } from '@/lib/legends/store';
import {
  spendAtoTokensCategoryReroll,
  spendAtoTokensLegendReroll,
  spendAtoTokensQuestionReroll,
} from '@/lib/ato-tokens-server';
import type { AtoTokenResult } from '@/lib/ato-tokens';

import type { CategoryBatchItemState } from './category-batch';
import { fetchAskedQuestionTexts } from './category-batch-store';
import { fetchBankCandidates } from './bank-pool';
import { generateQuestionBatch } from './generate';
import { buildQuestionsPrompt } from './prompt';
import type { QuestionItemRow, QuestionOption } from './types';

/**
 * ATO tokens reroll (wave51/wave53, T-04 core loop redesign §5). Three
 * surfaces, three effects — spendAtoTokensLegendReroll/CategoryReroll/
 * QuestionReroll (ato-tokens-server.ts) already move the currency; this
 * module is the caller that pairs each spend with what it actually rerolls.
 *
 * Order matters for the two "generate a replacement" surfaces (question,
 * category): whatever can fail (finding a bank candidate, an AI call) runs
 * BEFORE the spend, same as SageInsightSpend's "never charge for a reroll
 * that can't happen." The one gap this can't close: a failure in the final
 * persist step (network drop between the spend landing and the effect RPC)
 * still leaves the day's reroll spent with nothing to show for it — accepted
 * given the price (1 ATO token for question/category) and how rarely a
 * same-session DB write fails right after a same-session read succeeded.
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

/**
 * Legend reroll: matching (buildLegendView) is already live/stateless, and
 * every currently-shown card is already logged "seen" the moment it renders
 * (legends.tsx's load effect) — so a plain re-derive-the-whole-view reroll
 * would silently swap EVERY card, not just the one the user paid to change.
 * The caller (legends.tsx) instead computes the single replacement locally
 * via `bestVariantForFigure` (catalog + trait values it already has, no
 * network) BEFORE calling this — so a figure with no other matching variant
 * is caught for free, never charged. This function only does the two things
 * that must go over the network: spend, then persist both the old and new
 * variant as shown (logShownVariants is idempotent, so logging the new one
 * here is the same write the normal load-effect path would eventually make).
 */
export async function rerollLegend(
  userId: string,
  timezone: string,
  oldVariantId: string,
  newVariantId: string,
): Promise<AtoTokenResult> {
  const result = await trySpend(spendAtoTokensLegendReroll);
  if (!result.ok) return result;
  await logShownVariants(userId, [oldVariantId, newVariantId], timezone);
  return result;
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

export interface CategoryRerollMe {
  name: string;
  talk_style: TalkStyle;
  voice_preset: string;
}

/**
 * Category reroll — category_question_items has no bank-pool concept
 * (category-batch.ts always generates via AI), so the replacement is
 * generated first, same order as rerollQuestionItem: nothing is spent until
 * there is a real replacement in hand.
 */
export async function rerollCategoryItem(
  item: Pick<CategoryBatchItemState, 'id' | 'axis' | 'prompt'>,
  categoryId: CategoryId,
  me: CategoryRerollMe,
  tracks: readonly TraitTrack[],
): Promise<{ result: AtoTokenResult; item: RerollItemUpdate | null }> {
  const excludeText = await fetchAskedQuestionTexts();
  const prompt = buildQuestionsPrompt({
    me,
    grounding: { kind: 'none', detail: null },
    priorityAxes: [item.axis],
    tracks,
    count: 1,
    axisCounts: { [item.axis]: 1 },
    excludeText: [...excludeText, item.prompt],
  });
  const drafts = await generateQuestionBatch(prompt, 1);
  const draft = (drafts ?? []).find((d) => d.axis === item.axis) ?? null;
  if (!draft) {
    return { result: { ok: false, balance: 0, reason: 'no_draft' }, item: null };
  }

  const result = await trySpend(() => spendAtoTokensCategoryReroll(categoryId));
  if (!result.ok) return { result, item: null };

  const { data, error } = await supabase.rpc('reroll_category_batch_item', {
    p_item_id: item.id,
    p_prompt: draft.prompt,
    p_options: draft.options,
  });
  if (error) {
    console.log('[reroll] category reroll effect error:', error);
    return { result, item: null };
  }
  return { result, item: parseRerollItemResult(data) };
}
