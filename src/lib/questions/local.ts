import type { TraitAxis } from '@/lib/traits';

import { QUESTIONS_BANK } from './bank';
import { preferFreshAxes } from './rotation';
import { QUESTIONS_BATCH_SIZE } from './types';
import type { QuestionDraft } from './types';

/** Deterministic batch when Gemini is off. Same locked examples as the prompt. */
export function composeLocalQuestionBatch(recentAxes: TraitAxis[] = []): QuestionDraft[] {
  const copies = QUESTIONS_BANK.map((row) => ({
    axis: row.axis,
    prompt: row.prompt,
    options: row.options.map((opt) => ({ ...opt })),
  }));
  const rotated = preferFreshAxes(copies, recentAxes);
  return rotated.slice(0, QUESTIONS_BATCH_SIZE);
}
