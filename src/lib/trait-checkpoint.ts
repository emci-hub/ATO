/**
 * The trait checkpoint (wave79, emci 2026-10-03): the ONLY way the app writes
 * trait scores. The phone says what happened; the server checks it and does
 * the scoring (EWMA, direct-over-inferred, history) in one transaction.
 *
 *   answerIntakeQuestion  one of the 48 intake questions, by its text — must
 *                         be that trait's next intake question
 *   answerRoundItem       one round question, by its question_items id (marks
 *                         it answered AND scores it, atomically)
 *   answerBankItem        one question from the fixed bank (wave85), by its
 *                         question_items id; the value comes from the server's
 *                         question_bank row. In a retest pack it REPLACES the
 *                         earlier answer and the trait is recomputed
 *   setTraitDirect        a tap / setting / ranking / either-or pick: moves
 *                         the value, never counts as an answer
 *   recordGamePick        the gut-call game: 0.2 or 0.8, game track
 *   confirmTraitSources   "still fits": source becomes self_confirm
 *   stampAxisDepth        the depth-dive timestamp
 *   applyDevTraitPreset   dev "Jump this account" (pre-launch only)
 *   answerDailyPick       Today's Pick (wave82): counts as an answer only on a
 *                         trait whose 3 intake answers are done, else moves
 *                         the value like a tap
 *
 * No client code may write trait_tracks, trait_history or the me trait
 * columns directly (check:trait-checkpoint). Step 2 (wave80) revokes those
 * grants once every phone runs this code.
 */
import { supabase } from '@/lib/supabase';
import type { TraitAxis, TraitSource } from '@/lib/traits';

/** The me row the RPCs return. Typed by the caller (me.ts owns `Me`). */
export type MeRowJson = Record<string, unknown>;

async function call(name: string, args: Record<string, unknown>): Promise<MeRowJson> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  if (!data || typeof data !== 'object') throw new Error(`${name} returned no account`);
  return data as MeRowJson;
}

export function answerIntakeQuestion(prompt: string, optionIndex: number): Promise<MeRowJson> {
  return call('answer_intake_question', { p_prompt: prompt, p_option_index: optionIndex });
}

export interface DailyPickResult {
  optionIndex: number;
  /** True when it counted as a real answer (the trait's intake was done). */
  counted: boolean;
  /** True when this day was already answered (the first answer stands). */
  already: boolean;
}

export async function answerDailyPick(ymd: string, pickId: string, optionIndex: number): Promise<DailyPickResult> {
  const { data, error } = await supabase.rpc('answer_daily_pick', {
    p_ymd: ymd,
    p_pick_id: pickId,
    p_option_index: optionIndex,
  });
  if (error) throw error;
  const row = (data ?? {}) as { option_index?: unknown; counted?: unknown; already?: unknown };
  return {
    optionIndex: typeof row.option_index === 'number' ? row.option_index : optionIndex,
    counted: row.counted === true,
    already: row.already === true,
  };
}

export function answerRoundItem(itemId: string, optionIndex: number): Promise<MeRowJson> {
  return call('answer_round_item', { p_item_id: itemId, p_option_index: optionIndex });
}

export function answerBankItem(itemId: string, optionIndex: number): Promise<MeRowJson> {
  return call('answer_bank_item', { p_item_id: itemId, p_option_index: optionIndex });
}

export type DirectTraitSource = Extract<TraitSource, 'self_tap' | 'self_settings' | 'self_scenario'>;

export function setTraitDirect(axis: TraitAxis, value: number, source: DirectTraitSource): Promise<MeRowJson> {
  return call('set_trait_direct', { p_axis: axis, p_value: value, p_source: source });
}

export function recordGamePick(axis: TraitAxis, value: 0.2 | 0.8): Promise<MeRowJson> {
  return call('record_game_pick', { p_axis: axis, p_value: value });
}

export function confirmTraitSources(axes: readonly TraitAxis[]): Promise<MeRowJson> {
  return call('confirm_trait_sources', { p_axes: [...axes] });
}

export async function stampAxisDepth(axis: TraitAxis): Promise<void> {
  const { error } = await supabase.rpc('stamp_axis_depth', { p_axis: axis });
  if (error) throw error;
}

export interface DevTraitPreset {
  values: Partial<Record<TraitAxis, number | null>>;
  sources: Partial<Record<TraitAxis, string>>;
  touched: Partial<Record<TraitAxis, string>>;
  tracks: {
    axis: TraitAxis;
    track: 'report' | 'game';
    value: number;
    stability: number;
    answer_count: number;
    last_touched: string | null;
    last_depth_at: string | null;
  }[];
  /** Written only for root (the server checks). */
  history: { axis: TraitAxis; value: number; source: TraitSource }[];
}

export async function applyDevTraitPreset(preset: DevTraitPreset): Promise<void> {
  const { error } = await supabase.rpc('apply_dev_trait_preset', {
    p_values: preset.values,
    p_sources: preset.sources,
    p_touched: preset.touched,
    p_tracks: preset.tracks,
    p_history: preset.history,
  });
  if (error) throw error;
}
