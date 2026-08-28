import { localYmd } from '@/lib/local-date';
import { supabase } from '@/lib/supabase';
import type { CheckHistory, CheckStatus, VoiceCard, VoiceSource } from '@/lib/voice/types';

export interface Check {
  id: string;
  user_id: string;
  day: number;
  /** Calendar date this Check is for (YYYY-MM-DD). */
  logged_on: string;
  /** Null after the row rolls out of the 7-day Read/Do keep window. */
  read_text: string | null;
  do_text: string | null;
  /** Home-only Nudge. Null when empty, gated, or pruned with Read/Do. */
  nudge_text: string | null;
  source: VoiceSource;
  status: CheckStatus;
  created_at: string;
}

export async function fetchChecks(userId: string): Promise<Check[]> {
  const { data, error } = await supabase
    .from('checks')
    .select('*')
    .eq('user_id', userId)
    .order('day', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Check[];
}

/**
 * Talk only sends the last few Checks into the prompt (`streakSummary` in
 * prompt.ts). Sage used to call `fetchChecks` (every row, all-time) on tab
 * mount — that raced the history query and grew with every logged day.
 * Count is a head request; recent rows are newest-first then reversed.
 */
export const TALK_RECENT_CHECKS = 5;

export async function fetchTalkHistory(userId: string): Promise<{
  checkCount: number;
  checks: Check[];
}> {
  const [countRes, rowsRes] = await Promise.all([
    supabase.from('checks').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase
      .from('checks')
      .select('*')
      .eq('user_id', userId)
      .order('day', { ascending: false })
      .limit(TALK_RECENT_CHECKS),
  ]);

  if (countRes.error) throw countRes.error;
  if (rowsRes.error) throw rowsRes.error;

  const checks = ([...(rowsRes.data ?? [])] as Check[]).reverse();
  return { checkCount: countRes.count ?? checks.length, checks };
}

/** The router's view of a user's check history, oldest first. */
export function checksToHistory(checks: Check[]): CheckHistory[] {
  return checks.map((check) => ({
    day: check.day,
    status: check.status,
    read: check.read_text ?? undefined,
    do: check.do_text ?? undefined,
    nudge: check.nudge_text ?? undefined,
    source: check.source,
  }));
}

export function checkLoggedOnYmd(check: Pick<Check, 'logged_on' | 'created_at'>, timeZone: string): string {
  if (check.logged_on) return check.logged_on;
  return localYmd(new Date(check.created_at), timeZone);
}

export interface RecordCheckInput {
  day: number;
  /** YYYY-MM-DD this Check is for, in the user's timezone. */
  loggedOn: string;
  card: VoiceCard;
  source: VoiceSource;
  status: CheckStatus;
}

function messageForCheckError(error: { message?: string; code?: string }): string {
  const raw = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase();
  if (raw.includes('check_window') || raw.includes('p0017')) {
    return 'That day has closed. You can log today or up to 2 days back.';
  }
  if (raw.includes('already_logged_on') || raw.includes('p0019') || raw.includes('23505')) {
    return 'Already logged for that day.';
  }
  if (raw.includes('day_mismatch') || raw.includes('p0018')) {
    return 'That card doesn\u2019t match the day you\u2019re logging.';
  }
  return 'Couldn\u2019t save your check. Try again.';
}

export async function recordCheck(_userId: string, input: RecordCheckInput): Promise<Check> {
  const { data, error } = await supabase.rpc('record_check', {
    p_day: input.day,
    p_logged_on: input.loggedOn,
    p_read_text: input.card.read,
    p_do_text: input.card.do,
    p_source: input.source,
    p_status: input.status,
    p_nudge_text: input.card.nudge?.trim() ? input.card.nudge.trim() : null,
  });

  if (error) {
    const wrapped = new Error(messageForCheckError(error));
    (wrapped as Error & { cause?: unknown }).cause = error;
    throw wrapped;
  }

  const row = (Array.isArray(data) ? data[0] : data) as Check | null;
  if (!row) {
    throw new Error('Couldn\u2019t save your check. Try again.');
  }
  return row;
}
