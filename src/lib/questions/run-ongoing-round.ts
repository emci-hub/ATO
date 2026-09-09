import type { TraitTrack } from '@/lib/trait-stability';
import type { CheckHistory } from '@/lib/voice/types';

import { generateOngoingRoundBatch } from './generate';
import { addToBankPool, fetchBankCandidates, recordBankUsage } from './bank-pool';
import { fetchRecentTexts } from './fetch-recent-texts';
import { composeOngoingRound, type OngoingRoundMe } from './ongoing-round';
import { saveOngoingRoundBatch } from './store';
import type { QuestionPackRow } from './types';

/**
 * Real wiring for `composeOngoingRound` (T-03, core loop redesign §2/§3) —
 * composes one 25-question tiered round and persists it as a single
 * `question_packs` row via `saveOngoingRoundBatch`/`insert_ongoing_round_pack`
 * (wave50).
 *
 * `composeOngoingRound`'s own `saveItems` hook is deliberately a no-op here,
 * not a per-chunk DB write: `insert_ongoing_round_pack` creates exactly one
 * new pack per call, so calling it once per chunk (mirroring the pure
 * module's incremental-save contract, built for a future per-item save path
 * that doesn't exist) would create several partial packs instead of one
 * 25-item round. The real save happens exactly once, after
 * `composeOngoingRound` resolves with the full array.
 *
 * Known, accepted gap: if generation throws partway through (e.g. an
 * `addToBankPool` RPC failure on a later chunk), nothing from that attempt
 * lands in this user's own `question_items` — a retry starts a fresh round
 * from scratch. The blast radius is smaller than it looks, though: every
 * chunk already calls `addToBankPool` (writing into the shared
 * `question_bank_pool`) BEFORE this no-op `saveItems` runs, so any
 * AI-generated content from earlier, successful chunks is not actually
 * lost — it's sitting in the shared pool with `times_served=0` and gets
 * drawn bank-first (least-served) on the very next attempt, by this user or
 * anyone else. What's genuinely re-spent on retry is the AI call for
 * whichever chunk actually failed, not the whole round.
 */
export async function runOngoingRound(
  me: OngoingRoundMe,
  history: readonly CheckHistory[],
  tracks: readonly TraitTrack[],
): Promise<QuestionPackRow> {
  const drafts = await composeOngoingRound(me, history, tracks, {
    generateBatch: generateOngoingRoundBatch,
    saveItems: async () => {},
    fetchRecentTexts,
    fetchBankCandidates,
    recordBankUsage,
    addToBankPool,
  });
  return saveOngoingRoundBatch(drafts);
}
