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

/** -10, capped 1/day. Called by src/lib/questions/reroll.ts's rerollLegend. */
export async function spendAtoTokensLegendReroll(): Promise<AtoTokenResult> {
  const { data, error } = await supabase.rpc('spend_ato_tokens_legend_reroll');
  if (error) throw error;
  return parseAtoTokenResult(data);
}

/** -1, capped 1/day per category. Currency-only — no caller right now; the old category_question_items reroll that used this was removed with the rest of the old Categorize Q&A system (core loop redesign §3). A reroll for the new category_statements system would reuse this RPC (not yet built). */
export async function spendAtoTokensCategoryReroll(categoryId: string): Promise<AtoTokenResult> {
  const { data, error } = await supabase.rpc('spend_ato_tokens_category_reroll', {
    p_category_id: categoryId,
  });
  if (error) throw error;
  return parseAtoTokenResult(data);
}

/** -1, capped 1/day per question slot. Called by src/lib/questions/reroll.ts's rerollQuestionItem. */
export async function spendAtoTokensQuestionReroll(questionItemId: string): Promise<AtoTokenResult> {
  const { data, error } = await supabase.rpc('spend_ato_tokens_question_reroll', {
    p_question_item_id: questionItemId,
  });
  if (error) throw error;
  return parseAtoTokenResult(data);
}

/**
 * Fire-and-forget +21 for finishing the 50-question intake. Safe to call every
 * time the Questions screen sees a finished profile: the server pays once ever
 * (unique index) and answers `already` after that, so this also back-pays an
 * account that finished before the call existed. `onPaid` runs only on a fresh
 * payout, so the caller can refresh the balance. Never fails the caller.
 */
export function claimFullProfileCompleteQuiet(onPaid?: () => void): void {
  void claimFullProfileComplete()
    .then((result) => {
      if (result.ok && !result.already) onPaid?.();
    })
    .catch((err) => {
      console.log('[ato-tokens] claim full profile complete error:', err);
    });
}

export type AtoTokenEvent = { id: string; delta: number; reason: string; created_at: string };

/** The caller's own recent ledger rows, newest first (RLS: owner select only). */
export async function fetchAtoTokenEvents(limit = 5): Promise<AtoTokenEvent[]> {
  const { data, error } = await supabase
    .from('ato_token_events')
    .select('id, delta, reason, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AtoTokenEvent[];
}
