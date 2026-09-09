import { supabase } from '@/lib/supabase';
import { parseAtoTokenResult, type AtoTokenResult } from '@/lib/ato-tokens';

/** +21, once ever. Fires at the same Q50 crossing as Legends' unlock celebration. */
export async function claimFullProfileComplete(): Promise<AtoTokenResult> {
  const { data, error } = await supabase.rpc('claim_full_profile_complete');
  if (error) throw error;
  return parseAtoTokenResult(data);
}

/**
 * +21, once per finished round. Server verifies completion itself (every
 * question_items row in the pack is answered) — the caller does not need to
 * prove anything, just pass the pack id.
 */
export async function claimOngoingRoundComplete(packId: string): Promise<AtoTokenResult> {
  const { data, error } = await supabase.rpc('claim_ongoing_round_complete', {
    p_pack_id: packId,
  });
  if (error) throw error;
  return parseAtoTokenResult(data);
}

/** Fire-and-forget claim. Never fail the calling write (mirrors earnTokensQuiet). */
export function claimOngoingRoundCompleteQuiet(packId: string): void {
  void claimOngoingRoundComplete(packId).catch((err) => {
    console.log('[ato-tokens] claim ongoing round complete error:', err);
  });
}

/** -10, capped 1/day. No reroll UI calls this yet — plumbing for a future Legends reroll card. */
export async function spendAtoTokensLegendReroll(): Promise<AtoTokenResult> {
  const { data, error } = await supabase.rpc('spend_ato_tokens_legend_reroll');
  if (error) throw error;
  return parseAtoTokenResult(data);
}

/** -1, capped 1/day per category. No reroll UI calls this yet — plumbing for a future Categorize reroll card. */
export async function spendAtoTokensCategoryReroll(categoryId: string): Promise<AtoTokenResult> {
  const { data, error } = await supabase.rpc('spend_ato_tokens_category_reroll', {
    p_category_id: categoryId,
  });
  if (error) throw error;
  return parseAtoTokenResult(data);
}

/** -1, capped 1/day per question slot. No reroll.ts caller yet — this is the plumbing it will call. */
export async function spendAtoTokensQuestionReroll(questionItemId: string): Promise<AtoTokenResult> {
  const { data, error } = await supabase.rpc('spend_ato_tokens_question_reroll', {
    p_question_item_id: questionItemId,
  });
  if (error) throw error;
  return parseAtoTokenResult(data);
}
