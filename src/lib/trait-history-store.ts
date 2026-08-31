import { supabase } from '@/lib/supabase';
import { TRAIT_AXES } from '@/lib/traits';
import { isTraitSource, type TraitAxis, type TraitSource } from '@/lib/traits';
import type { TraitHistoryRow } from '@/lib/trait-history';

export async function insertTraitHistory(
  userId: string,
  rows: Array<{ axis: TraitAxis; value: number; source: TraitSource }>,
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from('trait_history').insert(
    rows.map((row) => ({
      user_id: userId,
      axis: row.axis,
      value: row.value,
      source: row.source,
    })),
  );
  if (error) throw error;
}

export async function fetchTraitHistory(userId: string): Promise<TraitHistoryRow[]> {
  const { data, error } = await supabase
    .from('trait_history')
    .select('id, axis, value, source, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  const out: TraitHistoryRow[] = [];
  for (const raw of data ?? []) {
    const axis = raw.axis;
    const source = raw.source;
    const value = typeof raw.value === 'number' ? raw.value : Number(raw.value);
    if (!(TRAIT_AXES as readonly string[]).includes(axis)) continue;
    if (!isTraitSource(source)) continue;
    if (!Number.isFinite(value)) continue;
    out.push({
      id: raw.id,
      axis: axis as TraitAxis,
      value,
      source,
      createdAt: raw.created_at,
    });
  }
  return out;
}
