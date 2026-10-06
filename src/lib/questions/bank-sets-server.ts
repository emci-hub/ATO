/**
 * Server calls for the fixed question bank (wave85). The rules live in
 * bank-sets.ts (pure, testable under Node); this file only talks to Supabase.
 */
import { supabase } from '@/lib/supabase';
import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';

import { parseSnapshot, type ProfileSnapshot } from '@/lib/profile-history';

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

/** Start Fresh. keepHistory (default) keeps every saved card; false wipes them. */
export async function startFresh(keepHistory = true): Promise<void> {
  const { error } = await supabase.rpc('start_fresh', { p_keep_history: keepHistory });
  if (error) throw error;
}

/** Every saved profile card, newest first (wave85/86). Wiped-history markers are dropped. */
export type { ProfileSnapshot };

export async function fetchProfileSnapshots(): Promise<ProfileSnapshot[]> {
  const { data, error } = await supabase
    .from('trait_profile_snapshots')
    .select('id, created_at, reason, profile')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as { id: string; created_at: string; reason: string; profile: unknown }[]).flatMap((row) => {
    const snap = parseSnapshot(row.id, row.created_at, row.reason, row.profile);
    return snap ? [snap] : [];
  });
}

/** This account's logged answers to bank questions: question id -> option index. */
export async function fetchMyBankAnswers(): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('trait_answers')
    .select('question_key, option_index')
    .eq('kind', 'bank');
  if (error) throw error;
  return new Map(((data ?? []) as { question_key: string; option_index: number }[]).map((r) => [r.question_key, r.option_index]));
}

/**
 * Replaces one answered bank question's answer (the server re-scores the
 * trait). Pass null as the session on the first change of a visit: the server
 * saves the Undo point first, in the same transaction, and returns the session
 * id to pass on every later change and to Undo.
 */
export async function changeBankAnswer(session: string | null, questionId: string, optionIndex: number): Promise<string> {
  const { data, error } = await supabase.rpc('change_bank_answer', {
    p_session: session,
    p_question_id: questionId,
    p_option_index: optionIndex,
  });
  if (error) throw error;
  const row = (data ?? {}) as { session?: unknown };
  if (typeof row.session !== 'string') throw new Error('change_bank_answer returned no session');
  return row.session;
}

/** Puts every answer changed in this session back, and the touched traits with them. */
export async function undoChangeSession(session: string): Promise<number> {
  const { data, error } = await supabase.rpc('undo_change_session', { p_session: session });
  if (error) throw error;
  const row = (data ?? {}) as { undone?: unknown };
  return typeof row.undone === 'number' ? row.undone : 0;
}

/** Pre-launch test tool: answers every remaining question on this account. */
export async function devFillBank(): Promise<number> {
  const { data, error } = await supabase.rpc('dev_fill_bank');
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}
