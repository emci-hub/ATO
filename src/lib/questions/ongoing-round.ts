/**
 * Post-Full-Profile ongoing question loop (§3 point 4 of the trait-system
 * redesign plan). After the 50-question intake completes, generation keeps
 * running the same tiered axis-priority allocation (§2), grounded in the
 * completed profile and recent answers, instead of a second fixed batch.
 * Reuses the existing Infinite Questions grounding mechanism
 * (`pickQuestionGrounding`) rather than inventing a new one, and the T-03
 * chunked generator rather than a single call, since a 25-question round
 * can't fit in one `generateQuestionBatch` call.
 *
 * Pure/testable — no Supabase import; the caller injects deps the same way
 * `composeCategoryBatch`/`fillAxisCountsChunked` already do.
 */
import type { BankCandidate } from './bank-pool';
import { pickQuestionGrounding } from './context';
import { buildQuestionsPrompt } from './prompt';
import { tieredAxisCounts } from './tiered-axis-plan';
import { fillAxisCountsChunked, isNearDuplicate, type ChunkedGenerateDeps } from './chunked-generate';
import type { QuestionDraft } from './types';
import type { TraitAxis } from '@/lib/traits';
import type { TraitTrack } from '@/lib/trait-stability';
import type { CheckHistory, TalkStyle } from '@/lib/voice/types';

export interface OngoingRoundMe {
  name: string;
  talk_style: TalkStyle;
  voice_preset: string;
  sage_knows: unknown;
  facts?: string[] | null;
}

export interface ComposeOngoingRoundDeps {
  generateBatch: ChunkedGenerateDeps['generateBatch'];
  saveItems: ChunkedGenerateDeps['saveItems'];
  /** Bounded (~25-30 question) recent-text window (§3 layer 1) — exact/near-duplicate exclusion. */
  fetchRecentTexts: () => Promise<string[]>;
  /**
   * Bank-first fill (§2): least-served question_bank_pool candidates for
   * `axis`, excluding this user's permanent reroll exclusions. Real impl:
   * bank-pool.ts's `fetchBankCandidates`. Injected (not imported directly)
   * to keep this module Supabase-free/pure, same as `generateBatch`/`saveItems`.
   */
  fetchBankCandidates: (axis: TraitAxis, count: number) => Promise<BankCandidate[]>;
  /** Bumps times_served for drawn bank items — informational only. Real impl: bank-pool.ts's `recordBankUsage`. */
  recordBankUsage: (ids: readonly string[]) => Promise<void>;
  /**
   * Writes freshly AI-generated drafts into the shared bank pool before
   * they're saved as this user's round items, mutating each draft with its
   * new `bankItemId` (§2 Q9 — every ongoing-round item always references a
   * bank row). Real impl: bank-pool.ts's `addToBankPool`.
   */
  addToBankPool: (drafts: QuestionDraft[]) => Promise<void>;
}

interface FillFromBankResult {
  drafts: QuestionDraft[];
  /** Axis counts still unmet after the bank draw — fed to the AI fallback. */
  remaining: Partial<Record<TraitAxis, number>>;
  /** `recentText` plus every bank-drafted prompt, so the AI fallback never repeats a bank pick from this same round. */
  excludeText: string[];
}

/**
 * Bank-first step (§2): for each axis in `target`, draws up to that many
 * least-served candidates, skipping any that are a near-duplicate of
 * something already in `recentText` (same `isNearDuplicate` the AI-fallback
 * path uses). Whatever a given axis comes up short on is left in `remaining`
 * for `fillAxisCountsChunked` to fill via AI. Bumps `times_served` for every
 * bank item actually used (non-fatal on failure — informational only).
 */
async function fillFromBank(
  target: Partial<Record<TraitAxis, number>>,
  recentText: readonly string[],
  deps: Pick<ComposeOngoingRoundDeps, 'fetchBankCandidates' | 'recordBankUsage'>,
): Promise<FillFromBankResult> {
  const drafts: QuestionDraft[] = [];
  const remaining: Partial<Record<TraitAxis, number>> = {};
  const usedIds: string[] = [];
  const excludeText = [...recentText];

  for (const [axis, count] of Object.entries(target) as [TraitAxis, number][]) {
    if (!count) continue;
    const candidates = await deps.fetchBankCandidates(axis, count);
    const picked: BankCandidate[] = [];
    for (const candidate of candidates) {
      if (picked.length >= count) break;
      if (isNearDuplicate(candidate.draft.prompt, excludeText)) continue;
      picked.push(candidate);
    }
    for (const candidate of picked) {
      const draft: QuestionDraft = { ...candidate.draft, bankItemId: candidate.id };
      drafts.push(draft);
      excludeText.push(draft.prompt);
      usedIds.push(candidate.id);
    }
    const left = count - picked.length;
    if (left > 0) remaining[axis] = left;
  }

  if (usedIds.length > 0) {
    await deps.recordBankUsage(usedIds).catch((err) => {
      console.log('[questions] recordBankUsage error:', err);
    });
  }

  return { drafts, remaining, excludeText };
}

/**
 * Runs one tiered (25-question) ongoing round, grounded in the completed
 * profile (`tracks`) and a recent moment/fact (`history`, via the existing
 * `pickQuestionGrounding`) — §3 layer 3, the strongest repeat-prevention
 * lever: a question genuinely about the specific person, not just avoiding
 * a blacklist.
 *
 * Bank-first, AI-fallback (§2): `fillFromBank` draws whatever the shared
 * question_bank_pool already has for each axis's tiered target; only the
 * shortfall goes to `fillAxisCountsChunked`'s AI generation, which now also
 * writes every fresh draft back into the bank pool (`addToBankPool`) before
 * saving it as this user's item, so every returned draft — bank-drawn or
 * freshly generated — carries a `bankItemId`.
 */
export async function composeOngoingRound(
  me: OngoingRoundMe,
  history: readonly CheckHistory[],
  tracks: readonly TraitTrack[],
  deps: ComposeOngoingRoundDeps,
): Promise<QuestionDraft[]> {
  const grounding = pickQuestionGrounding(me, history as CheckHistory[]);
  const recentText = await deps.fetchRecentTexts();

  const { drafts: bankDrafts, remaining, excludeText } = await fillFromBank(
    tieredAxisCounts(),
    recentText,
    deps,
  );
  if (bankDrafts.length > 0) {
    await deps.saveItems(bankDrafts);
  }

  const aiDrafts = await fillAxisCountsChunked(remaining, excludeText, {
    generateBatch: deps.generateBatch,
    saveItems: async (drafts) => {
      await deps.addToBankPool(drafts as QuestionDraft[]);
      await deps.saveItems(drafts);
    },
    buildPrompt: (axisCounts, count, excludeText) =>
      buildQuestionsPrompt({
        me,
        grounding,
        tracks,
        count,
        axisCounts,
        excludeText,
      }),
  });

  return [...bankDrafts, ...aiDrafts];
}
