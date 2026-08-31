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
