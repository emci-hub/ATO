/**
 * The phone's copy of the daily-insights state: today's 🎯 pick, its history
 * and the "Did it" streak. Local only (no Supabase table in v1), so a
 * reinstall or a second phone starts the streak at 0.
 *
 * ONE key, owner inside the payload (same as daily-pick / daily-line): a
 * payload for another account is ignored. `clearLocalAccountData` is
 * deny-by-default for `ato.*`, so sign-out and Reset account wipe it.
 * Every read-then-write goes through `inQueue` so a double tap can't race.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { resolveTryToday, type PickTryTodayInput } from './pick-try-today';
import { isDoneToday, markDone, parseStore } from './streak';
import type { DailyInsightsStore, TryTodayPick } from './types';

export const DAILY_INSIGHTS_STATE_KEY = 'ato.daily-insights.v1';

let queue: Promise<unknown> = Promise.resolve();
function inQueue<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work);
  queue = next.catch(() => {});
  return next;
}

async function load(userId: string): Promise<DailyInsightsStore> {
  try {
    return parseStore(await AsyncStorage.getItem(DAILY_INSIGHTS_STATE_KEY), userId);
  } catch {
    return parseStore(null, userId);
  }
}

async function save(store: DailyInsightsStore): Promise<void> {
  try {
    await AsyncStorage.setItem(DAILY_INSIGHTS_STATE_KEY, JSON.stringify(store));
  } catch (err) {
    console.log('[daily-insights] save skipped:', err);
  }
}

/** Today's 🎯 pick (the stored one wins for the day) plus the streak. */
export function loadTryToday(
  userId: string,
  input: Omit<PickTryTodayInput, 'history' | 'userId'>,
): Promise<{ pick: TryTodayPick | null; store: DailyInsightsStore }> {
  return inQueue(async () => {
    const current = await load(userId);
    const next = resolveTryToday(current, input);
    if (next.changed) await save(next.store);
    return { pick: next.pick, store: next.store };
  });
}

/** "Did it ✓" — once per day; a second tap changes nothing. */
export function markTryTodayDone(userId: string, dateKey: string): Promise<DailyInsightsStore> {
  return inQueue(async () => {
    const current = await load(userId);
    if (isDoneToday(current.streak, dateKey)) return current;
    const next = { ...current, streak: markDone(current.streak, dateKey) };
    await save(next);
    return next;
  });
}
