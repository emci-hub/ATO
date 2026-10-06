/**
 * Server calls for the fixed question bank (wave85). The rules live in
 * bank-sets.ts (pure, testable under Node); this file only talks to Supabase.
 */
import { supabase } from '@/lib/supabase';
import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';

import { bankProgressFrom, type BankProgress } from './bank-sets';

export async function fetchBankProgress(): Promise<BankProgress> {
  const { data, error } = await supabase.rpc('bank_answered');
  if (error) throw error;
  const row = (data ?? {}) as { ids?: unknown; fresh_starts?: unknown };
  const ids = Array.isArray(row.ids) ? row.ids.filter((id): id is string => typeof id === 'string') : [];
  return bankProgressFrom(ids, typeof row.fresh_starts === 'number' ? row.fresh_starts : 0);
}

/** The open set, or a new one. Returns the pack id. */
export async function serveBankSet(): Promise<string> {
  const { data, error } = await supabase.rpc('serve_bank_set');
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('serve_bank_set returned no set');
  return data;
}

export async function serveBankRetest(axis: TraitAxis, count: number): Promise<string> {
  const { data, error } = await supabase.rpc('serve_bank_retest', { p_axis: axis, p_count: count });
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('serve_bank_retest returned no pack');
  return data;
}

export async function fetchTraitFlags(): Promise<Set<TraitAxis>> {
  const { data, error } = await supabase.from('trait_flags').select('axis');
  if (error) throw error;
  const axes = new Set<TraitAxis>();
  for (const row of (data ?? []) as { axis: string }[]) {
    if ((TRAIT_AXES as readonly string[]).includes(row.axis)) axes.add(row.axis as TraitAxis);
  }
  return axes;
}

/** "This isn't me". A flag only: writes nothing to the trait. */
export async function setTraitFlag(axis: TraitAxis, on: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_trait_flag', { p_axis: axis, p_on: on });
  if (error) throw error;
}

export async function startFresh(): Promise<void> {
  const { error } = await supabase.rpc('start_fresh');
  if (error) throw error;
}

export interface ProfileSnapshot {
  id: string;
  createdAt: string;
  values: Partial<Record<TraitAxis, number | null>>;
}

export async function fetchProfileSnapshots(): Promise<ProfileSnapshot[]> {
  const { data, error } = await supabase
    .from('trait_profile_snapshots')
    .select('id, created_at, profile')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as { id: string; created_at: string; profile: { values?: Record<string, unknown> } }[]).map(
    (row) => {
      const values: Partial<Record<TraitAxis, number | null>> = {};
      for (const axis of TRAIT_AXES) {
        const v = row.profile?.values?.[axis];
        values[axis] = typeof v === 'number' ? v : null;
      }
      return { id: row.id, createdAt: row.created_at, values };
    },
  );
}

/** Pre-launch test tool: answers every remaining question on this account. */
export async function devFillBank(): Promise<number> {
  const { data, error } = await supabase.rpc('dev_fill_bank');
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}
