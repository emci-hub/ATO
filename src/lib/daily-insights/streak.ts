/**
 * "Did it ✓" streak + the stored payload's shape. Pure (no AsyncStorage) so
 * Node checks can pin it. Day math is YYYY-MM-DD only (addDaysYmd /
 * daysBetweenYmd) — never `new Date(ymd)` in local time.
 *
 * Gentle by design: a broken streak just reads 0 and the 🔥 line hides.
 */
import { daysBetweenYmd } from '@/lib/local-date';

import type { DailyInsightsStore, StreakState } from './types';

export const STREAK_DATES_CAP = 60;

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function emptyStreak(): StreakState {
  return { version: 1, doneDates: [], current: 0, best: 0, lastDone: null };
}

export function emptyStore(userId: string): DailyInsightsStore {
  return { version: 1, userId, streak: emptyStreak(), history: [], picks: {} };
}

/**
 * Marks `dateKey` done. Idempotent per day. A `lastDone` later than today (the
 * timezone moved back) counts as today: no double count, no negative gap.
 */
export function markDone(state: StreakState, dateKey: string): StreakState {
  if (!YMD.test(dateKey)) return state;
  if (state.doneDates.includes(dateKey)) return state;
  if (state.lastDone && daysBetweenYmd(state.lastDone, dateKey) <= 0) return state;
  const gap = state.lastDone ? daysBetweenYmd(state.lastDone, dateKey) : null;
  const current = gap === 1 ? state.current + 1 : 1;
  const doneDates = [...new Set([...state.doneDates, dateKey])].sort().slice(-STREAK_DATES_CAP);
  return { version: 1, doneDates, current, best: Math.max(state.best, current), lastDone: dateKey };
}

/** Days in a row as of `todayKey`. Survives until the end of the next day. */
export function currentStreak(state: StreakState, todayKey: string): number {
  if (!state.lastDone) return 0;
  const gap = daysBetweenYmd(state.lastDone, todayKey);
  if (gap <= 1) return state.current;
  return 0;
}

/** Done for `todayKey` (a future lastDone counts as today). */
export function isDoneToday(state: StreakState, todayKey: string): boolean {
  if (state.doneDates.includes(todayKey)) return true;
  return !!state.lastDone && daysBetweenYmd(state.lastDone, todayKey) < 0;
}

function parseStreak(raw: unknown): StreakState {
  if (!raw || typeof raw !== 'object') return emptyStreak();
  const row = raw as Partial<StreakState>;
  if (row.version !== 1) return emptyStreak();
  const doneDates = Array.isArray(row.doneDates)
    ? [...new Set(row.doneDates.filter((d): d is string => typeof d === 'string' && YMD.test(d)))]
        .sort()
        .slice(-STREAK_DATES_CAP)
    : [];
  const num = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0);
  const lastDone = typeof row.lastDone === 'string' && YMD.test(row.lastDone) ? row.lastDone : null;
  const current = num(row.current);
  return { version: 1, doneDates, current, best: Math.max(num(row.best), current), lastDone };
}

/**
 * Reads a stored payload. Corrupt JSON, an unknown version or another
 * account's payload all start fresh. Never throws.
 */
export function parseStore(raw: string | null | undefined, userId: string): DailyInsightsStore {
  if (!raw) return emptyStore(userId);
  try {
    const parsed = JSON.parse(raw) as Partial<DailyInsightsStore> | null;
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1 || parsed.userId !== userId) {
      return emptyStore(userId);
    }
    const history = Array.isArray(parsed.history)
      ? parsed.history.filter(
          (row): row is { dateKey: string; id: string } =>
            !!row && typeof row.dateKey === 'string' && YMD.test(row.dateKey) && typeof row.id === 'string',
        )
      : [];
    const picks: Record<string, string> = {};
    if (parsed.picks && typeof parsed.picks === 'object' && !Array.isArray(parsed.picks)) {
      for (const [key, id] of Object.entries(parsed.picks)) {
        if (YMD.test(key) && typeof id === 'string') picks[key] = id;
      }
    }
    return { version: 1, userId, streak: parseStreak(parsed.streak), history: history.slice(-14), picks };
  } catch {
    return emptyStore(userId);
  }
}
