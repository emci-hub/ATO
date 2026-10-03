import { answerIntakeQuestion } from '@/lib/trait-checkpoint';
import type { TraitTrack } from '@/lib/trait-stability';

import type { QuestionDraft, QuestionOption } from './types';

/**
 * Answer one intake question (a local `QuestionDraft` from bank.ts) through
 * the server checkpoint (wave79 `answer_intake_question`). The phone sends the
 * question's text and the option's position; the server checks that it is one
 * of the 48, that the option exists and that it is that trait's NEXT intake
 * question, then does the scoring. A refused answer throws, so the pager's
 * retry/error path shows it.
 *
 * Secondary-axis nudges (Phase 4) are gone with the client-side writes: no
 * intake question carries `secondaryAxes` (bank.ts), and round questions never
 * stored them, so nothing used that path.
 *
 * `tracks` is kept in the signature for the callers; the server reads its own.
 */
export async function applyQuestionAnswer(
  userId: string,
  draft: QuestionDraft,
  option: QuestionOption,
  tracks: readonly TraitTrack[],
): Promise<void> {
  void userId;
  void tracks;
  const optionIndex = draft.options.findIndex(
    (row) => row.text === option.text && row.value === option.value,
  );
  if (optionIndex < 0) throw new Error('That option is not part of this question');
  await answerIntakeQuestion(draft.prompt, optionIndex);
}
