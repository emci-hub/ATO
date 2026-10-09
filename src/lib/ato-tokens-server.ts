import { supabase } from '@/lib/supabase';
import { parseAtoTokenResult, type AiTokenKind, type AtoTokenResult } from '@/lib/ato-tokens';

/** +15 (wave92; was +21), once ever, for finishing the intake (48 = 3 per trait, or the old 50). */
export async function claimFullProfileComplete(): Promise<AtoTokenResult> {
  const { data, error } = await supabase.rpc('claim_full_profile_complete');
  if (error) throw error;
  return parseAtoTokenResult(data);
}

/**
 * +5 (wave92; was +21), once per finished round. Server verifies completion itself (every
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

/** wave81: the server's "already paid two rounds today" refusal. */
export const ROUND_PAYOUT_CAP_ERRCODE = 'P0042';

/**
 * Fire-and-forget claim. Never fail the calling write (mirrors earnTokensQuiet).
 * `onSettled` runs once the server has answered either way: `paid` is whether
 * the +21 is in the balance (fresh or already), `fresh` whether this call is
 * the one that paid it, so the caller knows to refresh the balance, and
 * `capped` whether the server refused it for the daily cap (wave81).
 */
export function claimOngoingRoundCompleteQuiet(
  packId: string,
  onSettled?: (outcome: { paid: boolean; fresh: boolean; capped: boolean }) => void,
): void {
  void claimOngoingRoundComplete(packId)
    .then((result) => {
      onSettled?.({ paid: result.ok, fresh: result.ok && !result.already, capped: false });
    })
    .catch((err) => {
      const capped = (err as { code?: unknown } | null)?.code === ROUND_PAYOUT_CAP_ERRCODE;
      if (!capped) console.log('[ato-tokens] claim ongoing round complete error:', err);
      onSettled?.({ paid: false, fresh: false, capped });
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
 * Fire-and-forget +21 for finishing the 48-question intake (or the old 50). Safe to call every
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

/** The daily check-in (wave92): +5, every 7th +10, once per local day. */
export async function claimDailyCheckin(): Promise<{ ok: boolean; already: boolean; delta: number; balance: number; weekCount: number }> {
  const { data, error } = await supabase.rpc('claim_daily_checkin');
  if (error) throw error;
  const row = (data ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    ok: row.ok === true,
    already: row.already === true,
    delta: num(row.delta),
    balance: num(row.balance),
    weekCount: num(row.week_count),
  };
}

/** Has this account checked in today (local day), and how many check-ins so far. */
export async function fetchCheckinStatus(localToday: string): Promise<{ checkedIn: boolean; total: number } | null> {
  try {
    const { data, error } = await supabase
      .from('ato_token_events')
      .select('local_day')
      .eq('reason', 'daily_checkin')
      .order('created_at', { ascending: false })
      .limit(400);
    if (error || !Array.isArray(data)) return null;
    const days = data.map((row) => (row as { local_day?: unknown }).local_day);
    return { checkedIn: days.includes(localToday), total: days.length };
  } catch {
    return null;
  }
}

/** Give back an AI view's tokens when the call failed after it was charged
 * (server: once a day per feature, within 15 minutes of the charge). */
export async function refundAiTokens(kind: AiTokenKind): Promise<void> {
  try {
    await supabase.rpc('refund_ai_tokens', { p_kind: kind });
  } catch {
    // Best effort; the claim already capped the cost.
  }
}

/** Dev (root only, server-checked): clear today's AI counters for root or a named handle. */
export async function devResetAiLimits(handle: string | null): Promise<{ ok: boolean; handle: string | null }> {
  const { data, error } = await supabase.rpc('dev_reset_ai_limits', { p_handle: handle });
  if (error) throw error;
  const row = (data ?? {}) as Record<string, unknown>;
  return { ok: row.ok === true, handle: typeof row.handle === 'string' ? row.handle : null };
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
