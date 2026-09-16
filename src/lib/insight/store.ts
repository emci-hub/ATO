/**
 * Daily insight storage (Home/Explore/Insight restructure, T-H1, wave69).
 * One live insight per (user, ymd) — a fresh generation supersedes the prior
 * current row via insert_daily_insight's own logic, so history is a byproduct
 * of generation rather than a separate write path. Mirrors
 * category-statements/store.ts.
 */
import { supabase } from '@/lib/supabase';

import type { DailyInsightDraft } from './generate-insight';

export interface DailyInsight {
  id: string;
  day: number;
  ymd: string;
  theme: string;
  title: string;
  reflection: string;
  tryToday: string;
  watchFor: string;
  createdAt: string;
  supersededAt: string | null;
}

const COLUMNS =
  'id, day, ymd, theme, title, reflection, try_today, watch_for, created_at, superseded_at';

function parseRow(row: Record<string, unknown>): DailyInsight | null {
  const id = typeof row.id === 'string' ? row.id : null;
  const day = typeof row.day === 'number' ? row.day : null;
  const ymd = typeof row.ymd === 'string' ? row.ymd : null;
  const theme = typeof row.theme === 'string' ? row.theme : null;
  const title = typeof row.title === 'string' ? row.title : null;
  const reflection = typeof row.reflection === 'string' ? row.reflection : null;
  const tryToday = typeof row.try_today === 'string' ? row.try_today : null;
  const watchFor = typeof row.watch_for === 'string' ? row.watch_for : null;
  const createdAt = typeof row.created_at === 'string' ? row.created_at : null;
  if (!id || day == null || !ymd || !theme || !title || !reflection || !tryToday || !watchFor || !createdAt) {
    return null;
  }
  return {
    id,
    day,
    ymd,
    theme,
    title,
    reflection,
    tryToday,
    watchFor,
    createdAt,
    supersededAt: typeof row.superseded_at === 'string' ? row.superseded_at : null,
  };
}

/** Writes a fresh insight, superseding today's prior one. All-or-nothing (single RPC call). */
export async function saveInsight(
  draft: DailyInsightDraft,
  day: number,
  ymd: string,
): Promise<void> {
  const { error } = await supabase.rpc('insert_daily_insight', {
    p_day: day,
    p_ymd: ymd,
    p_theme: draft.theme,
    p_title: draft.title,
    p_reflection: draft.reflection,
    p_try_today: draft.tryToday,
    p_watch_for: draft.watchFor,
  });
  if (error) throw error;
}

/** The live insight for one day, or null if none has been generated yet. */
export async function fetchTodayInsight(userId: string, ymd: string): Promise<DailyInsight | null> {
  const { data, error } = await supabase
    .from('daily_insights')
    .select(COLUMNS)
    .eq('user_id', userId)
    .eq('ymd', ymd)
    .is('superseded_at', null)
    .maybeSingle();
  if (error) throw error;
  return data ? parseRow(data as Record<string, unknown>) : null;
}

/** Past insights, newest first — includes superseded rows, so a reroll keeps both. */
export async function fetchInsightHistory(userId: string, limit = 50): Promise<DailyInsight[]> {
  const { data, error } = await supabase
    .from('daily_insights')
    .select(COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[])
    .map(parseRow)
    .filter((row): row is DailyInsight => row != null);
}
