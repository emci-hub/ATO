import { QUESTIONS_BANK } from './bank';
import { QUESTIONS_BATCH_SIZE } from './types';
import type { QuestionDraft } from './types';

/** Deterministic batch when Gemini is off. Same locked examples as the prompt. */
export function composeLocalQuestionBatch(): QuestionDraft[] {
  return QUESTIONS_BANK.slice(0, QUESTIONS_BATCH_SIZE).map((row) => ({
    axis: row.axis,
    prompt: row.prompt,
    options: row.options.map((opt) => ({ ...opt })),
  }));
}
