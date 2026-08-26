import { supabase } from '@/lib/supabase';

import { decisionFromClaim, type QuotaDecision } from './quota';

/**
 * Server-side claim. RLS blocks client writes to ai_usage; this RPC is the
 * only increment path, keyed on auth.uid().
 */
export async function claimAiCall(): Promise<QuotaDecision> {
  const { data, error } = await supabase.rpc('claim_ai_call');
  if (error) throw error;
  return decisionFromClaim(data);
}
