import { supabase } from '@/lib/supabase';
import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';
import type { TraitTrack, TraitTrackKind } from '@/lib/trait-stability';

function parseTrack(raw: {
  axis: string;
  track: string;
  value: unknown;
  stability: unknown;
  answer_count: unknown;
  last_touched: unknown;
  last_depth_at: unknown;
}): TraitTrack | null {
  if (!(TRAIT_AXES as readonly string[]).includes(raw.axis)) return null;
  if (raw.track !== 'report' && raw.track !== 'game') return null;
  const value = typeof raw.value === 'number' ? raw.value : Number(raw.value);
  const stability = typeof raw.stability === 'number' ? raw.stability : Number(raw.stability);
  const answerCount =
    typeof raw.answer_count === 'number' ? raw.answer_count : Number(raw.answer_count);
  if (!Number.isFinite(value) || !Number.isFinite(stability) || !Number.isFinite(answerCount)) {
    return null;
  }
  return {
    axis: raw.axis as TraitAxis,
    track: raw.track as TraitTrackKind,
    value,
    stability,
    answerCount,
    lastTouched: typeof raw.last_touched === 'string' ? raw.last_touched : '',
    lastDepthAt: typeof raw.last_depth_at === 'string' ? raw.last_depth_at : null,
  };
}

/** Validates raw trait_tracks rows (from a table read or the home_bootstrap RPC). */
export function parseTraitTrackRows(rows: readonly unknown[]): TraitTrack[] {
  const out: TraitTrack[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const parsed = parseTrack(row as Parameters<typeof parseTrack>[0]);
    if (parsed) out.push(parsed);
  }
  return out;
}

export async function fetchTraitTracks(userId: string): Promise<TraitTrack[]> {
  const { data, error } = await supabase
    .from('trait_tracks')
    .select('axis, track, value, stability, answer_count, last_touched, last_depth_at')
    .eq('user_id', userId);
  if (error) throw error;
  const out: TraitTrack[] = [];
  for (const row of data ?? []) {
    const parsed = parseTrack(row);
    if (parsed) out.push(parsed);
  }
  return out;
}

/**
 * Phase 4 — narrow value-only update for SECONDARY-axis evidence. Updates
 * ONLY `value`; deliberately does not touch stability/answer_count/
 * last_touched/last_depth_at directly, so a secondary write cannot move
 * `effectiveStability`/`isProfileSettled` on its own. (It can still have a
 * small, delayed, indirect effect: a later PRIMARY answer on the same axis
 * computes its own agreement against this nudged `value` — intended, and
 * still never an immediate effect.) No-op (silent) if the row does not
 * exist yet — same fail-open convention as the rest of this module; a
 * primary answer creates the row first.
 */
export async function updateTraitTrackValueOnly(
  userId: string,
  axis: TraitAxis,
  track: TraitTrackKind,
  value: number,
): Promise<void> {
  const { error } = await supabase
    .from('trait_tracks')
    .update({ value })
    .eq('user_id', userId)
    .eq('axis', axis)
    .eq('track', track);
  if (error) throw error;
}

export async function stampAxisDepth(userId: string, axis: TraitAxis): Promise<void> {
  const { error } = await supabase
    .from('trait_tracks')
    .update({ last_depth_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('axis', axis);
  if (error) throw error;
}

export async function upsertTraitTracks(userId: string, rows: readonly TraitTrack[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from('trait_tracks').upsert(
    rows.map((row) => ({
      user_id: userId,
      axis: row.axis,
      track: row.track,
      value: row.value,
      stability: row.stability,
      answer_count: row.answerCount,
      last_touched: row.lastTouched || new Date().toISOString(),
      last_depth_at: row.lastDepthAt,
    })),
    { onConflict: 'user_id,axis,track' },
  );
  if (error) throw error;
}
