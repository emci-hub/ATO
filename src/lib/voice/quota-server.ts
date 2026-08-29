import { supabase } from '@/lib/supabase';

import {
  decisionFromClaim,
  type QuotaDecision,
  type SageUsageSnapshot,
} from './quota';

export async function logJargonGuard(flag: string): Promise<void> {
  const trimmed = flag.trim();
  if (!trimmed) return;
  const { error } = await supabase.rpc('log_jargon_guard', { p_flag: trimmed });
  if (error) console.log('[jargon] log error:', error.message);
}

/**
 * Server-side claim. RLS blocks client writes to ai_usage; this RPC is the
 * only increment path, keyed on auth.uid().
 */
export async function claimAiCall(): Promise<QuotaDecision> {
  const { data, error } = await supabase.rpc('claim_ai_call');
  if (error) throw error;
  return decisionFromClaim(data);
}

function utcDayKey(value: string): string {
  return String(value).slice(0, 10);
}

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function utcMonthStart(): string {
  return `${new Date().toISOString().slice(0, 7)}-01`;
}

/**
 * Read-only usage for the signed-in person. Does not increment the cap.
 * Daily window matches claim_ai_call (UTC calendar day).
 */
export async function fetchSageUsage(): Promise<SageUsageSnapshot> {
  const today = utcToday();
  const monthStart = utcMonthStart();

  const [configRes, rowsRes] = await Promise.all([
    supabase.from('app_config').select('ai_daily_cap, ai_monthly_cap').eq('id', 1).single(),
    supabase.from('ai_usage').select('day, calls').gte('day', monthStart).lte('day', today),
  ]);

  if (configRes.error) throw configRes.error;
  if (rowsRes.error) throw rowsRes.error;

  const dailyCap = Number(configRes.data?.ai_daily_cap) || 20;
  const monthlyCap = Number(configRes.data?.ai_monthly_cap) || 200;
  const rows = rowsRes.data ?? [];
  const daily =
    rows.find((row) => utcDayKey(String(row.day)) === today)?.calls ?? 0;
  const monthly = rows.reduce((sum, row) => sum + Number(row.calls ?? 0), 0);

  return { daily, dailyCap, monthly, monthlyCap };
}
