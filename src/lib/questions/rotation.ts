import type { TraitAxis } from '@/lib/traits';

import { QUESTIONS_BATCH_SIZE } from './types';
import type { QuestionDraft, QuestionItemRow, QuestionPackRow } from './types';

/** Soft memory — last 2–3 asked axes, not a round-robin through all 15. */
export const QUESTIONS_AXIS_MEMORY = 3;

export function isOpenQuestionItem(item: QuestionItemRow): boolean {
  return item.answeredOption == null && item.skippedAt == null;
}

export function recentAskedAxes(
  pack: QuestionPackRow | null,
  n = QUESTIONS_AXIS_MEMORY,
): TraitAxis[] {
  if (!pack) return [];
  return pack.items
    .filter((item) => !isOpenQuestionItem(item))
    .sort((a, b) => a.sortIndex - b.sortIndex)
    .map((item) => item.axis)
    .slice(-n);
}

/** Prefer axes not in the last 2–3. Overlap is allowed if the batch would otherwise shrink. */
export function preferFreshAxes(drafts: QuestionDraft[], recent: TraitAxis[]): QuestionDraft[] {
  const avoid = new Set(recent.slice(-QUESTIONS_AXIS_MEMORY));
  const fresh = drafts.filter((draft) => !avoid.has(draft.axis));
  const overlap = drafts.filter((draft) => avoid.has(draft.axis));
  const seen = new Set<TraitAxis>();
  const out: QuestionDraft[] = [];
  for (const draft of [...fresh, ...overlap]) {
    if (seen.has(draft.axis)) continue;
    seen.add(draft.axis);
    out.push(draft);
    if (out.length >= QUESTIONS_BATCH_SIZE) break;
  }
  return out;
}
