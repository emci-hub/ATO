/**
 * What Home keeps on the phone (PHASE-08). All keys start with `ato.`, so
 * `clearLocalAccountData` removes them with the rest of the account's local data.
 * Each value carries its owner, so one account never reads another's.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { snapshotValues, type AxisValues } from '@/lib/home-path';
import type { TraitTrack } from '@/lib/trait-stability';

export const HOME_LAST_SEEN_KEY = 'ato.home.last-seen.v1';
export const INSIGHTS_SEEN_KEY = 'ato.insights.seen.v1';
export const HOME_PATH_BASE_KEY = 'ato.home.path-base.v1';

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.log('[home-path-store] write skipped:', key, err);
  }
}

/** The trait values as of the last Home visit, or null on a first visit. */
export async function loadLastSeen(userId: string): Promise<AxisValues | null> {
  const stored = await readJson<{ userId: string; values: AxisValues }>(HOME_LAST_SEEN_KEY);
  return stored && stored.userId === userId ? stored.values : null;
}

export function saveLastSeen(userId: string, tracks: readonly TraitTrack[]): Promise<void> {
  return writeJson(HOME_LAST_SEEN_KEY, { userId, values: snapshotValues(tracks) });
}

/** True once today's insight was opened from Home on `ymd`. */
export async function loadInsightsSeen(userId: string, ymd: string): Promise<boolean> {
  const stored = await readJson<{ userId: string; ymd: string }>(INSIGHTS_SEEN_KEY);
  return !!stored && stored.userId === userId && stored.ymd === ymd;
}

export function markInsightsSeen(userId: string, ymd: string): Promise<void> {
  return writeJson(INSIGHTS_SEEN_KEY, { userId, ymd });
}

/**
 * The total answers the first time Home opened on `ymd`. Questions answered
 * "today" is the total now minus this. Set once per day, never moved. Calls are
 * chained so two quick first calls cannot both write.
 */
let baselineQueue: Promise<unknown> = Promise.resolve();
export function answeredBaselineFor(userId: string, ymd: string, current: number): Promise<number> {
  const run = baselineQueue.then(async () => {
    const stored = await readJson<{ userId: string; ymd: string; base: number }>(HOME_PATH_BASE_KEY);
    if (stored && stored.userId === userId && stored.ymd === ymd) return stored.base;
    await writeJson(HOME_PATH_BASE_KEY, { userId, ymd, base: current });
    return current;
  });
  baselineQueue = run.catch(() => {});
  return run;
}
