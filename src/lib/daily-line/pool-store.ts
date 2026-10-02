/**
 * Daily lines in the database (wave77) — the server half, mirroring
 * questions/bank-pool.ts. Every write is an RPC; the tables themselves are
 * select-only under RLS (authored rows for everyone, AI rows for their owner,
 * day rows for their owner).
 *
 * Callers treat all of this as best-effort: the phone keeps its own copy, so a
 * failed call (offline, or wave77 not applied yet) costs nothing but the sync.
 */
import { supabase } from '@/lib/supabase';

import type { LineSource } from './bank';
import type { LineDay, LineReaction } from './pick';

export interface PoolRow {
  tag: string;
  text: string;
  source: LineSource;
}

/** High enough for the authored bank plus one account's AI lines (capped at 300). */
const POOL_FETCH_LIMIT = 3000;

/** Every line this account may see: the shared authored rows and its own AI rows. */
export async function fetchPoolRows(): Promise<PoolRow[]> {
  const { data, error } = await supabase
    .from('daily_line_pool')
    .select('lean_key, line, source')
    .limit(POOL_FETCH_LIMIT);
  if (error) throw error;
  const out: PoolRow[] = [];
  for (const raw of (data ?? []) as Record<string, unknown>[]) {
    if (typeof raw.lean_key !== 'string' || typeof raw.line !== 'string') continue;
    if (raw.source !== 'authored' && raw.source !== 'ai') continue;
    out.push({ tag: raw.lean_key, text: raw.line, source: raw.source });
  }
  return out;
}

/** This account's recorded days on or after `sinceYmd`, any order. */
export async function fetchRemoteDays(userId: string, sinceYmd: string): Promise<LineDay[]> {
  const { data, error } = await supabase
    .from('daily_line_days')
    .select('ymd, line_key, reaction')
    .eq('user_id', userId)
    .gte('ymd', sinceYmd);
  if (error) throw error;
  const out: LineDay[] = [];
  for (const raw of (data ?? []) as Record<string, unknown>[]) {
    if (typeof raw.ymd !== 'string' || typeof raw.line_key !== 'string') continue;
    const reaction = raw.reaction === 'me' || raw.reaction === 'not_me' ? raw.reaction : undefined;
    out.push({ ymd: raw.ymd, id: raw.line_key, ...(reaction ? { reaction } : {}) });
  }
  return out;
}

/**
 * Records the day's line. The first write of the day wins on the server, and
 * what comes back is the line that is actually stored — which is how a second
 * phone learns it should show the first phone's line.
 */
export async function recordDailyLineRemote(ymd: string, lineKey: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('record_daily_line', { p_ymd: ymd, p_line_key: lineKey });
  if (error) throw error;
  return typeof data === 'string' ? data : null;
}

/** False when the server has no row for that day yet, so there was nothing to put the tap on. */
export async function reactDailyLineRemote(ymd: string, reaction: LineReaction | null): Promise<boolean> {
  const { data, error } = await supabase.rpc('react_daily_line', { p_ymd: ymd, p_reaction: reaction });
  if (error) throw error;
  return data === true;
}

/** Saves AI-written lines as rows only this account can read. Returns how many were new. */
export async function addToLinePool(items: readonly { tag: string; text: string }[]): Promise<number> {
  if (items.length === 0) return 0;
  const { data, error } = await supabase.rpc('insert_daily_line_pool_items', {
    p_items: items.map((item) => ({ lean_key: item.tag, line: item.text })),
  });
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}

/** Dev reset: removes this account's own recorded days. */
export async function clearMyDailyLinesRemote(): Promise<number> {
  const { data, error } = await supabase.rpc('clear_my_daily_lines');
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}
