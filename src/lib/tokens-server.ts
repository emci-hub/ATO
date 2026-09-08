import { supabase } from '@/lib/supabase';
import {
  parseTokenResult,
  type TokenResult,
  type TokenSpendReason,
} from '@/lib/tokens';

export async function earnTokens(reason: 'check_in' | 'game_round'): Promise<TokenResult> {
  const { data, error } = await supabase.rpc('earn_tokens', { p_reason: reason });
  if (error) throw error;
  return parseTokenResult(data);
}

export async function spendTokens(reason: TokenSpendReason): Promise<TokenResult> {
  const { data, error } = await supabase.rpc('spend_tokens', { p_reason: reason });
  if (error) throw error;
  return parseTokenResult(data);
}

/** Fire-and-forget earn. Never fail the calling write. */
export function earnTokensQuiet(reason: 'check_in' | 'game_round'): void {
  void earnTokens(reason).catch((err) => {
    console.log('[tokens] earn error:', err);
  });
}

/**
 * Trait-system redesign §7 — dedicated RPC (wave45), not earn_tokens: this
 * has a "once ever" idempotency shape, not the once-per-local-day shape
 * earn_tokens is built around.
 *
 * round_complete's earn call (+13/round) is deliberately NOT here yet — its
 * RPC ships once real round-tracking state exists to validate a round
 * number against (see wave45_trait_redesign_tokens.sql's header comment);
 * an RPC trusting a client-supplied round number with nothing real to check
 * it against would be an unbounded token mint, caught in review before it
 * shipped.
 */
export async function claimIntakeComplete(): Promise<TokenResult> {
  const { data, error } = await supabase.rpc('claim_intake_complete');
  if (error) throw error;
  return parseTokenResult(data);
}
