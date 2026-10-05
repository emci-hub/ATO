/**
 * Post-Full-Profile ongoing question loop (§3 point 4 of the trait-system
 * redesign plan). After the intake completes, every round of 16 is allocated
 * per trait by `allocateRound` (tiered-axis-plan.ts) — the one adaptive rule
 * for bank AND AI questions — grounded in the completed profile and recent
 * answers.
 * Reuses the existing Infinite Questions grounding mechanism
 * (`pickQuestionGrounding`) rather than inventing a new one, and the T-03
 * chunked generator rather than a single call, since a 25-question round
 * can't fit in one `generateQuestionBatch` call.
 *
 * The AI is only ever asked for the per-trait gap the bank left, and a draft
 * tagged to a trait with no slot left is dropped (chunked-generate.ts), so
 * neither path can skew a person's mix.
 *
 * Pure/testable — no Supabase import; the caller injects deps the same way
 * `composeCategoryBatch`/`fillAxisCountsChunked` already do.
 */
import type { BankCandidate } from './bank-pool';
import { pickQuestionGrounding } from './context';
import { buildQuestionsPrompt } from './prompt';
import { legacyIntakeExclusions } from './intake-stage';
import { allocateRound, ONGOING_ROUND_SIZE, topUpAllocation } from './tiered-axis-plan';
import {
  fillAxisCountsChunked,
  isNearDuplicate,
  subtractKept,
  totalCount,
  type ChunkedGenerateDeps,
} from './chunked-generate';
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
  /** The voice gate, applied to AI drafts and to pool rows alike. Real impl: question-voice.ts `generatedQuestionFailure`. */
  rejectDraft?: ChunkedGenerateDeps['rejectDraft'];
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
  deps: Pick<ComposeOngoingRoundDeps, 'fetchBankCandidates' | 'recordBankUsage' | 'rejectDraft'>,
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
      // Older AI pool rows predate the voice gate; the same gate applies here.
      if (deps.rejectDraft?.(candidate.draft, excludeText)) continue;
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
 * Runs one adaptive (16-question) ongoing round, grounded in the completed
 * profile (`tracks`) and a recent moment/fact (`history`, via the existing
 * `pickQuestionGrounding`) — §3 layer 3, the strongest repeat-prevention
 * lever: a question genuinely about the specific person, not just avoiding
 * a blacklist.
 *
 * Bank-first, AI-fallback (§2): `fillFromBank` draws whatever the shared
 * question_bank_pool already has for each trait's `allocateRound` target; only the
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
  // Plus the old-intake questions this account already answered on the phone
  // (they left the intake 2026-10-02 and are now servable round questions).
  const recentText = [...(await deps.fetchRecentTexts()), ...legacyIntakeExclusions(tracks)];

  const plan = allocateRound(tracks);
  const { drafts: bankDrafts, remaining, excludeText } = await fillFromBank(
    // Weakest reads first (unsettled, mixed, decaying), then longest-waiting.
    plan,
    recentText,
    deps,
  );
  if (bankDrafts.length > 0) {
    await deps.saveItems(bankDrafts);
  }

  const aiDrafts = await fillAxisCountsChunked(remaining, excludeText, {
    generateBatch: deps.generateBatch,
    rejectDraft: deps.rejectDraft,
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

  // Bank-fallback pass: fillAxisCountsChunked gives up on a per-chunk
  // shortfall after MAX_SHORTFALL_RETRIES (deliberately just 1, to stay
  // inside the client's 25s round-start timeout — see chunked-generate.ts).
  // Rather than silently shipping the round short, make one more pass at the
  // shared bank pool for whatever axes are still unmet — the bank already
  // has content sitting there from other users' rounds, so this costs no
  // extra AI call and no extra latency budget.
  const stillMissing = subtractKept(remaining, aiDrafts);
  let fallbackDrafts: QuestionDraft[] = [];
  if (totalCount(stillMissing) > 0) {
    const aiExcludeText = [...excludeText, ...aiDrafts.map((d) => d.prompt)];
    const fallback = await fillFromBank(stillMissing, aiExcludeText, deps);
    fallbackDrafts = fallback.drafts;
    if (fallbackDrafts.length > 0) {
      await deps.saveItems(fallbackDrafts);
    }
    // The bank can also come up empty for a thin axis — narrows the gap
    // (AI shortfall alone) rather than closing it. Log so a short round is
    // at least diagnosable, since nothing else surfaces this to the caller.
    if (totalCount(fallback.remaining) > 0) {
      console.log('[questions] ongoing round still short after bank fallback:', fallback.remaining);
    }
    // Last resort, no extra AI call: move the missing slots to other traits
    // that still have room under the per-trait cap, in the same priority
    // order, from the bank. A round is always ONGOING_ROUND_SIZE or it is not
    // saved (run-ongoing-round.ts), because the +21 claim needs a full round.
    const sofar = [...bankDrafts, ...aiDrafts, ...fallbackDrafts];
    const short = ONGOING_ROUND_SIZE - sofar.length;
    if (short > 0) {
      const have: Partial<Record<TraitAxis, number>> = {};
      for (const draft of sofar) have[draft.axis] = (have[draft.axis] ?? 0) + 1;
      const exhausted = new Set(Object.keys(fallback.remaining) as TraitAxis[]);
      const topUp = topUpAllocation(have, short, tracks, exhausted);
      const topExclude = [...aiExcludeText, ...fallbackDrafts.map((d) => d.prompt)];
      const extra = await fillFromBank(topUp, topExclude, deps);
      if (extra.drafts.length > 0) {
        await deps.saveItems(extra.drafts);
        fallbackDrafts = [...fallbackDrafts, ...extra.drafts];
      }
    }
  }

  return [...bankDrafts, ...aiDrafts, ...fallbackDrafts];
}
