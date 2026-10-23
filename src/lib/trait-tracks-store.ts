import { supabase } from '@/lib/supabase';
import type { ScoreSample, TraitTrack, TraitTrackKind } from '@/lib/trait-stability';
import { TRAIT_AXES, isTraitSource, type TraitAxis, type TraitSource } from '@/lib/traits';

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

export function traitSourcesFrom(raw: unknown): Partial<Record<TraitAxis, TraitSource>> {
  const sources: Partial<Record<TraitAxis, TraitSource>> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return sources;
  const record = raw as Record<string, unknown>;
  for (const axis of TRAIT_AXES) {
    const source = record[axis];
    if (isTraitSource(source)) sources[axis] = source;
  }
  return sources;
}

function sampleFrom(row: { value: unknown; weight?: unknown }): ScoreSample | null {
  const value = typeof row.value === 'number' ? row.value : Number(row.value);
  if (!Number.isFinite(value)) return null;
  const weight = typeof row.weight === 'number' ? row.weight : Number(row.weight);
  if (Number.isFinite(weight) && weight > 0 && weight !== 1) return { value, weight };
  return value;
}

/** Raw answer samples per axis, oldest first. Empty when the log could not be read. */
export async function fetchTraitAnswerSamples(
  userId: string,
): Promise<Partial<Record<TraitAxis, ScoreSample[]>>> {
  // Weight arrived in wave117. A database that does not have the column yet
  // still returns the values, each counted as one answer.
  let data: { axis: string; value: unknown; weight?: unknown }[] | null = null;
  const withWeight = await supabase
    .from('trait_answers')
    .select('axis, value, weight')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (withWeight.error) {
    const plain = await supabase
      .from('trait_answers')
      .select('axis, value')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (plain.error) {
      console.log('[traits] answer log skipped:', plain.error);
      return {};
    }
    data = plain.data;
  } else {
    data = withWeight.data;
  }
  const out: Partial<Record<TraitAxis, ScoreSample[]>> = {};
  for (const row of data ?? []) {
    if (!(TRAIT_AXES as readonly string[]).includes(row.axis)) continue;
    const sample = sampleFrom(row);
    if (sample == null) continue;
    const axis = row.axis as TraitAxis;
    const list = out[axis] ?? [];
    list.push(sample);
    out[axis] = list;
  }
  return out;
}

export function attachAnswerSamples(
  tracks: readonly TraitTrack[],
  samples: Partial<Record<TraitAxis, readonly ScoreSample[]>>,
): TraitTrack[] {
  return tracks.map((row) => {
    if (row.track !== 'report') return row;
    const answers = samples[row.axis];
    if (!answers || answers.length === 0) return row;
    return { ...row, answerSamples: answers };
  });
}

export async function fetchTraitTracks(userId: string): Promise<TraitTrack[]> {
  const [tracksRes, samples] = await Promise.all([
    supabase
      .from('trait_tracks')
      .select('axis, track, value, stability, answer_count, last_touched, last_depth_at')
      .eq('user_id', userId),
    fetchTraitAnswerSamples(userId),
  ]);
  if (tracksRes.error) throw tracksRes.error;
  const out: TraitTrack[] = [];
  for (const row of tracksRes.data ?? []) {
    const parsed = parseTrack(row);
    if (parsed) out.push(parsed);
  }
  return attachAnswerSamples(out, samples);
}

/*
 * No writers here (wave79, 2026-10-03). Trait tracks are written only by the
 * server checkpoint (lib/trait-checkpoint.ts). The old upsertTraitTracks /
 * updateTraitTrackValueOnly / stampAxisDepth wrote from the phone and are
 * gone; check:trait-checkpoint keeps them gone.
 */
