/**
 * Legends 64-archetype storage (core loop redesign §4, wave58). One row per
 * generation — the latest per user is "current," the rest are the archive
 * (RollHistoryFold-style, reused pattern — see roll-history-fold.tsx).
 */
import { supabase } from '@/lib/supabase';

export interface LegendGeneration {
  id: string;
  archetypeCode: string;
  story: string;
  generatedAt: string;
}

export interface LegendStoryClaimResult {
  ok: boolean;
  reason?: string;
  daily?: number;
  dailyCap?: number;
}

function parseClaimResult(data: unknown): LegendStoryClaimResult {
  if (!data || typeof data !== 'object') return { ok: false, reason: 'empty' };
  const row = data as Record<string, unknown>;
  return {
    ok: row.ok === true,
    reason: typeof row.reason === 'string' ? row.reason : undefined,
    daily: typeof row.daily === 'number' ? row.daily : undefined,
    dailyCap: typeof row.daily_cap === 'number' ? row.daily_cap : undefined,
  };
}

function parseRow(row: Record<string, unknown>): LegendGeneration | null {
  const id = typeof row.id === 'string' ? row.id : null;
  const archetypeCode = typeof row.archetype_code === 'string' ? row.archetype_code : null;
  const story = typeof row.story === 'string' ? row.story : null;
  const generatedAt = typeof row.generated_at === 'string' ? row.generated_at : null;
  if (!id || !archetypeCode || !story || !generatedAt) return null;
  return { id, archetypeCode, story, generatedAt };
}

/** Claims one legend-story generation (legend_story_generations_daily_cap/day, default 5) — call BEFORE generateLegendStory's actual generateText/ai-generate call. */
export async function claimLegendStoryGeneration(): Promise<LegendStoryClaimResult> {
  const { data, error } = await supabase.rpc('claim_legend_story_generation');
  if (error) throw error;
  return parseClaimResult(data);
}

/** Persists a story after a successful claim + generation. Caller must already hold a successful claimLegendStoryGeneration() for today. */
export async function saveGeneration(archetypeCode: string, story: string): Promise<string> {
  const { data, error } = await supabase.rpc('insert_legend_generation', {
    p_archetype_code: archetypeCode,
    p_story: story,
  });
  if (error) throw error;
  return data as string;
}

/** The user's most recent generation, or null if they've never generated one. */
export async function fetchCurrentGeneration(userId: string): Promise<LegendGeneration | null> {
  const { data, error } = await supabase
    .from('legend_generations')
    .select('id, archetype_code, story, generated_at')
    .eq('user_id', userId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? parseRow(data as Record<string, unknown>) : null;
}

/** Named constant per the plan's "adjustable, not hardcoded in multiple places" note (§6). */
export const LEGEND_HISTORY_VISIBLE_COUNT = 3;

/** Full generation history, newest first — the archive fold shows the latest LEGEND_HISTORY_VISIBLE_COUNT, the rest behind "show more." */
export async function fetchGenerationHistory(userId: string, limit = 50): Promise<LegendGeneration[]> {
  const { data, error } = await supabase
    .from('legend_generations')
    .select('id, archetype_code, story, generated_at')
    .eq('user_id', userId)
    .order('generated_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[])
    .map(parseRow)
    .filter((row): row is LegendGeneration => row != null);
}
