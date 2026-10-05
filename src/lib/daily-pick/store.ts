/**
 * Today's Pick storage. The phone keeps its own copy (instant Home, works
 * offline and before wave82 is applied); the server is the record. An answer
 * that could not be saved is marked unsynced and sent again next time.
 * No model call anywhere here.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';
import { answerDailyPick } from '@/lib/trait-checkpoint';

import type { DailyPick } from './bank';

export const DAILY_PICK_STATE_KEY = 'ato.daily-pick.v1';

interface LocalAnswer {
  pickId: string;
  optionIndex: number;
  synced: boolean;
}

interface LocalState {
  userId: string;
  answers: Record<string, LocalAnswer>;
}

async function loadState(userId: string): Promise<LocalState> {
  try {
    const raw = await AsyncStorage.getItem(DAILY_PICK_STATE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<LocalState> | null) : null;
    if (!parsed || parsed.userId !== userId || typeof parsed.answers !== 'object' || !parsed.answers) {
      return { userId, answers: {} };
    }
    return { userId, answers: parsed.answers as Record<string, LocalAnswer> };
  } catch {
    return { userId, answers: {} };
  }
}

async function saveState(state: LocalState): Promise<void> {
  // Keep the last 120 days, like the daily line history.
  const keep = Object.keys(state.answers).sort().slice(-120);
  const answers: Record<string, LocalAnswer> = {};
  for (const ymd of keep) answers[ymd] = state.answers[ymd]!;
  try {
    await AsyncStorage.setItem(DAILY_PICK_STATE_KEY, JSON.stringify({ userId: state.userId, answers }));
  } catch (err) {
    console.log('[daily-pick] save error:', err);
  }
}

/** Today's answer, from the phone first, then the server (a reinstall). */
export async function loadTodayAnswer(userId: string, ymd: string, pick: DailyPick): Promise<number | null> {
  const state = await loadState(userId);
  const local = state.answers[ymd];
  if (local && local.pickId === pick.id) {
    if (!local.synced) void sendAnswer(userId, ymd, pick, local.optionIndex);
    return local.optionIndex;
  }
  try {
    const { data, error } = await supabase
      .from('daily_pick_answers')
      .select('pick_id, option_index')
      .eq('user_id', userId)
      .eq('ymd', ymd)
      .maybeSingle();
    if (error || !data || data.pick_id !== pick.id) return null;
    state.answers[ymd] = { pickId: pick.id, optionIndex: data.option_index, synced: true };
    await saveState(state);
    return data.option_index;
  } catch {
    return null;
  }
}

/**
 * Saves the answer on the phone at once, then on the server. Resolves with
 * whether it reached the server; a miss is retried on the next load.
 */
export async function saveTodayAnswer(
  userId: string,
  ymd: string,
  pick: DailyPick,
  optionIndex: number,
): Promise<boolean> {
  const state = await loadState(userId);
  if (state.answers[ymd]) return state.answers[ymd]!.synced; // one answer a day
  state.answers[ymd] = { pickId: pick.id, optionIndex, synced: false };
  await saveState(state);
  return sendAnswer(userId, ymd, pick, optionIndex);
}

async function sendAnswer(userId: string, ymd: string, pick: DailyPick, optionIndex: number): Promise<boolean> {
  try {
    await answerDailyPick(ymd, pick.id, optionIndex);
    const state = await loadState(userId);
    const entry = state.answers[ymd];
    if (entry) {
      entry.synced = true;
      await saveState(state);
    }
    return true;
  } catch (err) {
    console.log('[daily-pick] answer not saved yet:', err);
    return false;
  }
}

export interface PickSplit {
  /** Share of that day's answers for each option, 0..1, rounded to 5%. */
  shares: [number, number];
}

/**
 * How everyone split on this day's pick. Null under 20 answers that day, for
 * someone who hasn't answered, or when it can't be read. The server rounds to
 * 5% so one new answer in a small group can't be read back.
 */
export async function fetchPickSplit(pickId: string, ymd: string): Promise<PickSplit | null> {
  try {
    const { data, error } = await supabase.rpc('daily_pick_split', { p_pick_id: pickId, p_ymd: ymd });
    if (error || !data || typeof data !== 'object') return null;
    const row = data as { shares?: unknown };
    const shares = Array.isArray(row.shares) ? row.shares.map(Number) : [];
    if (shares.length !== 2 || shares.some((n) => !Number.isFinite(n))) return null;
    return { shares: [shares[0]! / 100, shares[1]! / 100] };
  } catch {
    return null;
  }
}
