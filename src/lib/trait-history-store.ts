import { supabase } from '@/lib/supabase';
import { TRAIT_AXES } from '@/lib/traits';
import { isTraitSource, type TraitAxis } from '@/lib/traits';
import type { TraitHistoryRow } from '@/lib/trait-history';

// No writer here (wave79, 2026-10-03): history rows are written only by the
// server checkpoint (lib/trait-checkpoint.ts).

/** `sinceIso` bounds the read to rows written from then on (the "your week" card). */
export async function fetchTraitHistory(userId: string, sinceIso?: string): Promise<TraitHistoryRow[]> {
  let query = supabase
    .from('trait_history')
    .select('id, axis, value, source, created_at')
    .eq('user_id', userId);
  if (sinceIso) query = query.gte('created_at', sinceIso);
  const { data, error } = await query.order('created_at', { ascending: true });
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
