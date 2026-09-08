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
import { pickQuestionGrounding } from './context';
import { buildQuestionsPrompt } from './prompt';
import { tieredAxisCounts } from './tiered-axis-plan';
import { fillAxisCountsChunked, type ChunkedGenerateDeps } from './chunked-generate';
import type { QuestionDraft } from './types';
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
}

/**
 * Runs one tiered (25-question) ongoing round, grounded in the completed
 * profile (`tracks`) and a recent moment/fact (`history`, via the existing
 * `pickQuestionGrounding`) — §3 layer 3, the strongest repeat-prevention
 * lever: a question genuinely about the specific person, not just avoiding
 * a blacklist.
 */
export async function composeOngoingRound(
  me: OngoingRoundMe,
  history: readonly CheckHistory[],
  tracks: readonly TraitTrack[],
  deps: ComposeOngoingRoundDeps,
): Promise<QuestionDraft[]> {
  const grounding = pickQuestionGrounding(me, history as CheckHistory[]);
  const recentText = await deps.fetchRecentTexts();

  return fillAxisCountsChunked(tieredAxisCounts(), recentText, {
    generateBatch: deps.generateBatch,
    saveItems: deps.saveItems,
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
}
