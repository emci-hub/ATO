import AsyncStorage from '@react-native-async-storage/async-storage';

import type { TraitTrack } from '@/lib/trait-stability';
import type { CheckHistory } from '@/lib/voice/types';

import { addToBankPool, fetchBankPoolDepth } from './bank-pool';
import { fillAxisCountsChunked, totalCount } from './chunked-generate';
import { pickQuestionGrounding } from './context';
import { fetchRecentTexts } from './fetch-recent-texts';
import { generateOngoingRoundBatch } from './generate';
import type { OngoingRoundMe } from './ongoing-round';
import { axesBelowReserve } from './prewarm';
import { buildQuestionsPrompt } from './prompt';

/**
 * Real wiring for the bank-pool prewarm (see prewarm.ts for why this exists
 * and how the per-axis reserve target is derived).
 *
 * Deliberately NOT a `composeOngoingRound` call: prewarm generates into the
 * SHARED `question_bank_pool` only (`addToBankPool`) and creates no
 * `question_packs`/`question_items` rows for anyone. The questions it writes
 * become candidates for every user's next bank-first draw, including other
 * users' — which is the point, and is also why a pass triggered by one
 * person is not wasted work if they never play another round.
 *
 * Fire-and-forget by design: every failure path here is swallowed and
 * logged. A prewarm that does not run costs latency on some future round
 * (the existing AI-fallback still covers it); a prewarm that throws into a
 * caller would break a round the user is actually looking at.
 */

const COOLDOWN_KEY = 'ato.questions.prewarm-at.v1';
/**
 * Minimum gap between prewarm passes ON THIS DEVICE. The real cost control
 * is `PREWARM_MAX_QUESTIONS` (prewarm.ts), which bounds a single pass; this
 * bounds how often passes happen at all, so a user who starts and abandons
 * several rounds in a row cannot chain background generations.
 */
export const PREWARM_COOLDOWN_MS = 6 * 60 * 60 * 1000;

/**
 * In-process guard. Round-start and round-load can both land in the same
 * session, and `AsyncStorage` is async — two passes could otherwise both
 * read a stale timestamp and start before either writes. Module-scope on
 * purpose: one app process, one prewarm at a time.
 */
let inFlight = false;

async function offCooldown(now: number): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(COOLDOWN_KEY);
    const last = raw ? Number(raw) : 0;
    return !Number.isFinite(last) || now - last >= PREWARM_COOLDOWN_MS;
  } catch {
    // A readable cooldown is a nice-to-have, not a correctness requirement —
    // storage failing must not permanently disable prewarm.
    return true;
  }
}

/**
 * Tops the shared bank pool up if this user's per-axis depth has fallen
 * below the reserve. Safe to call unconditionally after a round is composed
 * or loaded — it no-ops when in flight, on cooldown, or already deep enough,
 * and never throws.
 *
 * Known, accepted gap: the cooldown is per-device, so two different users
 * hitting the threshold at the same moment can both generate for the same
 * short axis. That duplicates spend but cannot corrupt anything —
 * `insert_bank_pool_items` upserts on the unique `prompt`, so a genuinely
 * identical question collapses to one row, and non-identical ones are both
 * real additions to a pool that was short anyway. A cross-user guard would
 * need a server-side lock; that is deliberately not built until the traffic
 * exists to justify it.
 */
export async function prewarmBankPool(
  me: OngoingRoundMe,
  history: readonly CheckHistory[],
  tracks: readonly TraitTrack[],
): Promise<void> {
  if (inFlight) return;
  inFlight = true;
  try {
    const now = Date.now();
    if (!(await offCooldown(now))) return;

    const depth = await fetchBankPoolDepth();
    const wanted = axesBelowReserve(depth);
    if (totalCount(wanted) === 0) return;

    // Stamp BEFORE generating, not after: a pass that starts and then fails
    // halfway has still spent AI calls, and must not be retried immediately
    // by the next round-start.
    await AsyncStorage.setItem(COOLDOWN_KEY, String(now)).catch(() => {});

    const grounding = pickQuestionGrounding(me, history as CheckHistory[]);
    const recentText = await fetchRecentTexts();

    await fillAxisCountsChunked(wanted, recentText, {
      generateBatch: generateOngoingRoundBatch,
      // The only persistence prewarm does. No per-user rows are written.
      saveItems: async (drafts) => {
        await addToBankPool(drafts as Parameters<typeof addToBankPool>[0]);
      },
      buildPrompt: (axisCounts, count, excludeText) =>
        buildQuestionsPrompt({ me, grounding, tracks, count, axisCounts, excludeText }),
    });
  } catch (err) {
    console.log('[questions] prewarm error:', err);
  } finally {
    inFlight = false;
  }
}
