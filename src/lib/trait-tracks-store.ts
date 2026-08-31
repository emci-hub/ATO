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
