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

export async function logPhraseGuard(flag: string): Promise<void> {
  const trimmed = flag.trim();
  if (!trimmed) return;
  const { error } = await supabase.rpc('log_phrase_guard', { p_flag: trimmed });
  if (error) console.log('[phrase] log error:', error.message);
}

/**
 * Server-side claim. RLS blocks client writes to ai_usage; this RPC is the
 * only increment path, keyed on auth.uid().
 */
export async function claimAiCall(callType: 'sage' | 'explore' = 'sage'): Promise<QuotaDecision> {
  const { data, error } = await supabase.rpc('claim_ai_call', { p_call_type: callType });
  if (error) throw error;
  return decisionFromClaim(data);
}

export async function claimQuestionsBatch(): Promise<QuotaDecision> {
  const { data, error } = await supabase.rpc('claim_questions_batch');
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
    supabase
      .from('app_config')
      .select('ai_daily_cap, ai_monthly_cap, questions_daily_cap')
      .eq('id', 1)
      .single(),
    supabase.from('ai_usage').select('day, calls, by_type').gte('day', monthStart).lte('day', today),
  ]);

  if (configRes.error) throw configRes.error;
  if (rowsRes.error) throw rowsRes.error;

  const dailyCap = Number(configRes.data?.ai_daily_cap) || 20;
  const monthlyCap = Number(configRes.data?.ai_monthly_cap) || 200;
  const questionsCap = Number(configRes.data?.questions_daily_cap) || 3;
  const rows = rowsRes.data ?? [];
  const todayRow = rows.find((row) => utcDayKey(String(row.day)) === today);
  const daily = todayRow?.calls ?? 0;
  const monthly = rows.reduce((sum, row) => sum + Number(row.calls ?? 0), 0);
  const byType =
    todayRow?.by_type && typeof todayRow.by_type === 'object' && !Array.isArray(todayRow.by_type)
      ? Object.fromEntries(
          Object.entries(todayRow.by_type as Record<string, unknown>).map(([key, value]) => [
            key,
            Number(value) || 0,
          ]),
        )
      : {};
  const questionsDaily = byType.questions ?? 0;

  return { daily, dailyCap, monthly, monthlyCap, byType, questionsDaily, questionsCap };
}
