/**
 * What this phone remembers about the daily line: which line each day got, the
 * "That's me / Not me" tap, and the lines already promised to upcoming morning
 * pushes.
 *
 * THE PHONE'S COPY. The shared record is the database (wave77, see sync.ts);
 * this copy is what Home paints from, so the line is instant and works offline.
 * It is wiped with every other `ato.*` key on sign-out and account deletion
 * (`clearLocalAccountData` is deny-by-default). The owner travels inside the
 * payload, same as the cached insight, so one account can never read another's.
 *
 * ONE WRITER AT A TIME. Home (resolve + reaction) and the push scheduler (plan)
 * both read, wait, then write the same key, and on a cold start they run
 * together. Every function that writes goes through `inQueue`, so a later
 * write always starts from the earlier one's result instead of overwriting it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { TraitTrack } from '@/lib/trait-stability';

import { dailyLineById, registerPoolLines, resetPoolLines, type DailyLine, type LineSource } from './bank';
import {
  NO_REPEAT_DAYS,
  clearLeans,
  daysApart,
  isStarterLine,
  lineStreak,
  pickDailyLine,
  type LineDay,
  type LineReaction,
} from './pick';

export const DAILY_LINE_STATE_KEY = 'ato.daily-line.v1';
/** Enough for the 60-day no-repeat window with room to spare. */
export const DAILY_LINE_HISTORY_CAP = 120;

export interface DailyLineState {
  userId: string;
  /** Days the line was actually opened on Home. The streak counts these. */
  days: LineDay[];
  /**
   * ymd -> line id for mornings a push was scheduled for. A morning that went
   * by unopened stays here until it leaves the no-repeat window, so a line
   * that was pushed but never opened still does not come back early.
   */
  planned: Record<string, string>;
}

function emptyState(userId: string): DailyLineState {
  return { userId, days: [], planned: {} };
}

let queue: Promise<unknown> = Promise.resolve();
function inQueue<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work);
  queue = next.catch(() => {});
  return next;
}

// --- the pool cache -----------------------------------------------------------
// The lines fetched from `daily_line_pool` (new authored rows, and this
// account's own AI lines), kept so the picker has them on the next cold start
// without waiting for the network. Owner-stamped like everything else here.

export const DAILY_LINE_POOL_CACHE_KEY = 'ato.daily-line-pool.v1';
/** When the pool was last fetched; sync.ts uses it to decide whether to refetch. */
export interface PoolCache {
  userId: string;
  fetchedAt: number;
  rows: { tag: string; text: string; source: LineSource }[];
}

async function readPoolCache(userId: string): Promise<PoolCache | null> {
  try {
    const raw = await AsyncStorage.getItem(DAILY_LINE_POOL_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PoolCache> | null;
    if (!parsed || parsed.userId !== userId || !Array.isArray(parsed.rows)) return null;
    const rows = parsed.rows.filter(
      (row) =>
        !!row &&
        typeof row.tag === 'string' &&
        typeof row.text === 'string' &&
        (row.source === 'authored' || row.source === 'ai'),
    );
    return { userId, fetchedAt: typeof parsed.fetchedAt === 'number' ? parsed.fetchedAt : 0, rows };
  } catch {
    return null;
  }
}

let hydratedFor: string | null = null;
/**
 * Bumped on sign-out. Work that started for one account (a slow server pull)
 * checks it before writing, so it cannot land on the next account's data.
 */
let generation = 0;

export function dailyLineGeneration(): number {
  return generation;
}

/**
 * Registers the cached pool lines with the picker, once per account per app
 * run. Every entry point below calls it first, so a pick never runs against
 * the shipped bank alone when the phone already knows more lines.
 */
async function hydratePool(userId: string): Promise<void> {
  if (hydratedFor === userId) return;
  // Always start from the shipped bank: whatever is registered belongs to
  // whoever was here before (or to nobody).
  resetPoolLines();
  hydratedFor = userId;
  const startedIn = generation;
  const cache = await readPoolCache(userId);
  // Signed out while reading: the next account must not inherit these lines.
  if (startedIn !== generation) return;
  if (cache) registerPoolLines(cache.rows);
}

/**
 * Replaces the cache with a fresh fetch and registers the lines. This
 * account's AI lines that the server did not return are KEPT: a line saved
 * while offline is still this account's line, and dropping it would change a
 * day that already showed it.
 */
export function savePoolCache(
  userId: string,
  fetched: PoolCache['rows'],
  startedIn: number,
  now: number = Date.now(),
): Promise<void> {
  return inQueue(async () => {
    if (startedIn !== generation) return;
    await hydratePool(userId);
    const previous = await readPoolCache(userId);
    const have = new Set(fetched.map((row) => row.text));
    const keptAi = (previous?.rows ?? []).filter((row) => row.source === 'ai' && !have.has(row.text));
    const rows = [...fetched, ...keptAi];
    registerPoolLines(rows);
    try {
      await AsyncStorage.setItem(DAILY_LINE_POOL_CACHE_KEY, JSON.stringify({ userId, fetchedAt: now, rows }));
    } catch (err) {
      console.log('[daily-line] pool cache save skipped:', err);
    }
  });
}

/** Adds lines to the cache without a refetch (AI lines just written for this account). */
export function appendPoolCache(userId: string, rows: PoolCache['rows']): Promise<void> {
  return inQueue(async () => {
    await hydratePool(userId);
    registerPoolLines(rows);
    const cache = (await readPoolCache(userId)) ?? { userId, fetchedAt: 0, rows: [] };
    const seen = new Set(cache.rows.map((row) => row.text));
    const merged = [...cache.rows, ...rows.filter((row) => !seen.has(row.text))];
    try {
      await AsyncStorage.setItem(
        DAILY_LINE_POOL_CACHE_KEY,
        JSON.stringify({ userId, fetchedAt: cache.fetchedAt, rows: merged }),
      );
    } catch (err) {
      console.log('[daily-line] pool cache append skipped:', err);
    }
  });
}

export async function poolCacheAge(userId: string, now: number = Date.now()): Promise<number> {
  const cache = await readPoolCache(userId);
  return cache ? now - cache.fetchedAt : Number.POSITIVE_INFINITY;
}

/**
 * Folds the server's days into the phone's. The server is the shared record:
 * a day it has that the phone lacks is added (this is what restores history
 * after a reinstall), and for a day both have, the server's line wins (another
 * phone on the same account got there first). A reaction made on this phone
 * and not yet on the server is kept.
 */
export function mergeRemoteDays(
  userId: string,
  remote: readonly LineDay[],
  todayYmd: string,
  startedIn: number,
): Promise<void> {
  return inQueue(async () => {
    if (remote.length === 0 || startedIn !== generation) return;
    const state = await loadDailyLineState(userId);
    const byYmd = new Map(state.days.map((day) => [day.ymd, day]));
    for (const day of remote) {
      const local = byYmd.get(day.ymd);
      const reaction = day.reaction ?? (local && local.id === day.id ? local.reaction : undefined);
      byYmd.set(day.ymd, { ymd: day.ymd, id: day.id, ...(reaction ? { reaction } : {}) });
    }
    const planned = { ...state.planned };
    for (const day of remote) delete planned[day.ymd];
    await saveDailyLineState({ userId, days: [...byYmd.values()], planned }, todayYmd);
  });
}

export async function loadDailyLineState(userId: string): Promise<DailyLineState> {
  try {
    const raw = await AsyncStorage.getItem(DAILY_LINE_STATE_KEY);
    if (!raw) return emptyState(userId);
    const parsed = JSON.parse(raw) as Partial<DailyLineState> | null;
    if (!parsed || parsed.userId !== userId || !Array.isArray(parsed.days)) return emptyState(userId);
    const days = parsed.days.filter(
      (day): day is LineDay => !!day && typeof day.ymd === 'string' && typeof day.id === 'string',
    );
    const planned: Record<string, string> = {};
    if (parsed.planned && typeof parsed.planned === 'object') {
      for (const [ymd, id] of Object.entries(parsed.planned)) {
        if (typeof id === 'string') planned[ymd] = id;
      }
    }
    return { userId, days, planned };
  } catch {
    return emptyState(userId);
  }
}

async function saveDailyLineState(state: DailyLineState, todayYmd: string): Promise<void> {
  const days = [...state.days].sort((a, b) => (a.ymd < b.ymd ? -1 : 1)).slice(-DAILY_LINE_HISTORY_CAP);
  const planned: Record<string, string> = {};
  for (const [ymd, id] of Object.entries(state.planned)) {
    // Upcoming mornings are kept; past ones only while they can still block a repeat.
    if (ymd >= todayYmd || daysApart(ymd, todayYmd) <= NO_REPEAT_DAYS) planned[ymd] = id;
  }
  try {
    await AsyncStorage.setItem(DAILY_LINE_STATE_KEY, JSON.stringify({ userId: state.userId, days, planned }));
  } catch (err) {
    console.log('[daily-line] save skipped:', err);
  }
}

export function clearDailyLineState(): Promise<void> {
  return inQueue(async () => {
    await AsyncStorage.removeItem(DAILY_LINE_STATE_KEY).catch(() => {});
  });
}

/** Sign-out and account deletion: drop the previous account's registered lines. */
export function forgetDailyLineAccount(): void {
  generation += 1;
  hydratedFor = null;
  resetPoolLines();
}

export interface TodayLine {
  line: DailyLine;
  reaction: LineReaction | null;
  streak: number;
}

/** Everything shown or pushed, for the no-repeat window and the variety rule. */
function historyOf(state: DailyLineState, exceptYmd?: string): LineDay[] {
  const shown = new Set(state.days.map((day) => day.ymd));
  const planned = Object.entries(state.planned)
    .filter(([ymd]) => !shown.has(ymd) && ymd !== exceptYmd)
    .map(([ymd, id]) => ({ ymd, id }));
  return [...state.days, ...planned];
}

/**
 * Today's line. The first call of the day picks and stores it, so the line
 * stays put for the rest of the day even if the profile moves. A line already
 * planned for this morning's push is the one that is used, so the push and
 * Home always say the same thing.
 *
 * `persist: false` is for the moment Home could not load the profile: show
 * something, but do not let a guess become the day's line.
 */
export function resolveTodayLine(input: {
  userId: string;
  ymd: string;
  tracks: readonly TraitTrack[];
  persist?: boolean;
}): Promise<TodayLine> {
  const { userId, ymd, tracks, persist = true } = input;
  return inQueue(async () => {
    await hydratePool(userId);
    const state = await loadDailyLineState(userId);
    const stored = state.days.find((day) => day.ymd === ymd);
    const storedLine = stored ? dailyLineById(stored.id) : null;
    if (stored && storedLine) {
      return { line: storedLine, reaction: stored.reaction ?? null, streak: lineStreak(state.days, ymd) };
    }

    const plannedLine = state.planned[ymd] ? dailyLineById(state.planned[ymd]!) : null;
    const line =
      plannedLine ??
      pickDailyLine({ userId, ymd, leans: clearLeans(tracks), history: historyOf(state, ymd) });

    if (!persist) return { line, reaction: null, streak: lineStreak(state.days, ymd) };

    const days = [...state.days.filter((day) => day.ymd !== ymd), { ymd, id: line.id }];
    const planned = { ...state.planned };
    delete planned[ymd]; // it is a shown day now
    await saveDailyLineState({ userId, days, planned }, ymd);
    return { line, reaction: null, streak: lineStreak(days, ymd) };
  });
}

/** Stores the tap. Tapping the same answer again clears it. */
export function setLineReaction(
  userId: string,
  ymd: string,
  reaction: LineReaction,
): Promise<LineReaction | null> {
  return inQueue(async () => {
    const state = await loadDailyLineState(userId);
    const day = state.days.find((d) => d.ymd === ymd);
    if (!day) return null;
    const next = day.reaction === reaction ? undefined : reaction;
    const days = state.days.map((d) =>
      d.ymd === ymd ? { ymd: d.ymd, id: d.id, ...(next ? { reaction: next } : {}) } : d,
    );
    await saveDailyLineState({ ...state, days }, ymd);
    return next ?? null;
  });
}

/**
 * Picks (or re-reads) the line for each upcoming morning and remembers it, so
 * the push that fires on that morning and the Home card that day agree.
 *
 * A morning already planned keeps its line, with one exception: a general
 * starter line planned for a FUTURE day is replaced once the profile has a
 * clear lean. Today's planned line is never replaced — its push may already
 * have fired.
 */
export function planUpcomingLines(input: {
  userId: string;
  todayYmd: string;
  ymds: readonly string[];
  tracks: readonly TraitTrack[];
}): Promise<{ ymd: string; line: DailyLine }[]> {
  const { userId, todayYmd, ymds, tracks } = input;
  return inQueue(async () => {
    await hydratePool(userId);
    const state = await loadDailyLineState(userId);
    const leans = clearLeans(tracks);
    const working: DailyLineState = { ...state, planned: { ...state.planned } };
    const out: { ymd: string; line: DailyLine }[] = [];
    for (const ymd of ymds) {
      const shown = working.days.find((day) => day.ymd === ymd);
      const kept = dailyLineById(shown?.id ?? working.planned[ymd] ?? '');
      const replaceable =
        kept != null && !shown && ymd > todayYmd && isStarterLine(kept) && leans.length > 0;
      const line =
        kept && !replaceable
          ? kept
          : pickDailyLine({ userId, ymd, leans, history: historyOf(working, ymd) });
      if (!shown) working.planned[ymd] = line.id;
      out.push({ ymd, line });
    }
    await saveDailyLineState(working, todayYmd);
    return out;
  });
}
