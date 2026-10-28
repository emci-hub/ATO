/**
 * Keeps the phone's daily-line copy and the database (wave77) in step.
 *
 * The phone's copy (state.ts) is what Home paints from, so the line is instant
 * and works offline. The database is the shared record: it is what survives a
 * reinstall, what a second phone reads, and where new authored lines arrive from. Same split as the insight: a local paint-fast
 * copy in front of a server source of truth.
 *
 * Everything here is best-effort. A failed or slow call (offline, or wave77 not
 * applied yet) leaves the phone working from its own copy.
 */
import { addDaysYmd } from '@/lib/local-date';
import { withTimeout } from '@/lib/timeout';
import type { TraitTrack } from '@/lib/trait-stability';

import { dailyLineById } from './bank';
import { NO_REPEAT_DAYS, type LineReaction } from './pick';
import {
  fetchPoolRows,
  fetchRemoteDays,
  reactDailyLineRemote,
  recordDailyLineRemote,
} from './pool-store';
import {
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
