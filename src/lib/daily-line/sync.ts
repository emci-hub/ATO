/**
 * Keeps the phone's daily-line copy and the database (wave77) in step.
 *
 * The phone's copy (state.ts) is what Home paints from, so the line is instant
 * and works offline. The database is the shared record: it is what survives a
 * reinstall, what a second phone reads, and where new authored lines and this
 * account's AI lines arrive from. Same split as the insight: a local paint-fast
 * copy in front of a server source of truth.
 *
 * Everything here is best-effort. A failed or slow call (offline, or wave77 not
 * applied yet) leaves the phone working from its own copy.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { addDaysYmd } from '@/lib/local-date';
import { withTimeout } from '@/lib/timeout';
import type { TraitTrack } from '@/lib/trait-stability';

import { dailyLineById, leanTag, lineId, lineRuleViolation, type LineKey } from './bank';
import { NO_REPEAT_DAYS, type LineReaction } from './pick';
import {
  addToLinePool,
  fetchPoolRows,
  fetchRemoteDays,
  reactDailyLineRemote,
  recordDailyLineRemote,
} from './pool-store';
import {
  appendPoolCache,
  dailyLineGeneration,
  loadDailyLineState,
  mergeRemoteDays,
  poolCacheAge,
  resolveTodayLine,
  savePoolCache,
  setLineReaction,
  type TodayLine,
} from './state';

/** How long the first open of a day may wait for the server before picking locally. */
export const PULL_WAIT_MS = 2500;
/** The pool is refetched in the background when the cached copy is older than this. */
export const POOL_REFRESH_MS = 6 * 60 * 60 * 1000;

const recorded = new Set<string>();

/** Pool lines and recent days from the server, folded into the phone's copy. */
export async function pullDailyLines(userId: string, todayYmd: string): Promise<void> {
  // A pull that outlives its account (timed out, then answered after sign-out)
  // must not write: both saves below check this.
  const startedIn = dailyLineGeneration();
  const [rows, days] = await Promise.all([
    fetchPoolRows(),
    fetchRemoteDays(userId, addDaysYmd(todayYmd, -(NO_REPEAT_DAYS + 1))),
  ]);
  await savePoolCache(userId, rows, startedIn);
  await mergeRemoteDays(userId, days, todayYmd, startedIn);
}

/**
 * Today's line, with the server consulted when it matters.
 *
 * On the first open of a day the phone has no line stored for today, so it
 * asks the server first (briefly): after a reinstall, or when another phone
 * has already opened today, that is where today's line and the history are.
 * Later opens the same day read the stored line and do not wait on anything.
 */
export async function resolveTodayLineSynced(input: {
  userId: string;
  ymd: string;
  tracks: readonly TraitTrack[];
  persist: boolean;
}): Promise<TodayLine> {
  const { userId, ymd, persist } = input;
  if (persist) {
    const state = await loadDailyLineState(userId);
    const hasToday = state.days.some((day) => day.ymd === ymd);
    if (!hasToday) {
      await withTimeout(pullDailyLines(userId, ymd), PULL_WAIT_MS, 'daily-line-pull').catch((err) => {
        console.log('[daily-line] pull skipped:', err);
      });
    } else if ((await poolCacheAge(userId)) > POOL_REFRESH_MS) {
      void pullDailyLines(userId, ymd).catch((err) => {
        console.log('[daily-line] background pull skipped:', err);
      });
    }
  }

  const today = await resolveTodayLine(input);
  if (!persist) return today;
  // Once per app run per day is enough: the server keeps the first write.
  const recordKey = `${userId}|${ymd}|${today.line.id}`;
  if (recorded.has(recordKey)) return today;
  recorded.add(recordKey);

  // Tell the server. If it already had a different line for today (two phones
  // opened at once), adopt it so the next read on this phone matches.
  const startedIn = dailyLineGeneration();
  void recordDailyLineRemote(ymd, today.line.id)
    .then(async (stored) => {
      if (stored && stored !== today.line.id && dailyLineById(stored)) {
        await mergeRemoteDays(userId, [{ ymd, id: stored }], ymd, startedIn);
      }
    })
    .catch((err) => {
      // Not recorded: let the next open try again.
      recorded.delete(recordKey);
      console.log('[daily-line] record skipped:', err);
    });
  return today;
}

/** The reaction tap: stored on the phone, then sent to the server. */
export async function reactToLineSynced(
  userId: string,
  ymd: string,
  reaction: LineReaction,
): Promise<LineReaction | null> {
  const saved = await setLineReaction(userId, ymd, reaction);
  void (async () => {
    if (await reactDailyLineRemote(ymd, saved)) return;
    // The server has no row for this day yet (it was opened offline). Record
    // the day first, then the tap.
    const state = await loadDailyLineState(userId);
    const day = state.days.find((d) => d.ymd === ymd);
    if (!day) return;
    await recordDailyLineRemote(ymd, day.id);
    await reactDailyLineRemote(ymd, saved);
  })().catch((err) => {
    console.log('[daily-line] reaction sync skipped:', err);
  });
  return saved;
}

// --- AI top-up ------------------------------------------------------------------
// The questions take from the bank first and let the model write the rest. Lines
// do the same: the written bank is the base, and each loaded insight brings a
// few lines written for this one account, saved as rows only it can read.

export const DAILY_LINE_AI_LOG_KEY = 'ato.daily-line-ai-log.v1';

export interface AiLineLog {
  userId: string;
  at: string;
  kept: { tag: string; text: string }[];
  dropped: { text: string; reason: string }[];
}

export interface AiLineCandidate {
  keys: readonly LineKey[];
  text: string;
}

/**
 * Runs each model-written line through the same rules as a written one, saves
 * the survivors to the pool and the phone, and logs what happened so the Dev
 * Tools Hub can show exactly what the model returned and what was thrown out.
 */
export async function keepAiLines(userId: string, candidates: readonly AiLineCandidate[]): Promise<AiLineLog> {
  const kept: AiLineLog['kept'] = [];
  const dropped: AiLineLog['dropped'] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const text = candidate.text.trim();
    const reason =
      lineRuleViolation(text) ??
      (candidate.keys.length === 0 ? 'no trait to key it to' : null) ??
      (dailyLineById(lineId(text)) || seen.has(text) ? 'already have it' : null);
    if (reason) {
      dropped.push({ text, reason });
      continue;
    }
    seen.add(text);
    kept.push({ tag: leanTag(candidate.keys), text });
  }

  if (kept.length > 0) {
    await appendPoolCache(
      userId,
      kept.map((row) => ({ ...row, source: 'ai' as const })),
    );
    await addToLinePool(kept).catch((err) => {
      console.log('[daily-line] ai lines not saved to the pool:', err);
    });
  }

  const log: AiLineLog = { userId, at: new Date().toISOString(), kept, dropped };
  await AsyncStorage.setItem(DAILY_LINE_AI_LOG_KEY, JSON.stringify(log)).catch(() => {});
  return log;
}

export async function loadAiLineLog(userId: string): Promise<AiLineLog | null> {
  try {
    const raw = await AsyncStorage.getItem(DAILY_LINE_AI_LOG_KEY);
    const parsed = raw ? (JSON.parse(raw) as AiLineLog) : null;
    return parsed && parsed.userId === userId ? parsed : null;
  } catch {
    return null;
  }
}
