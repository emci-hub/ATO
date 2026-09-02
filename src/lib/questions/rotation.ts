import type { TraitAxis } from '@/lib/traits';

import { QUESTIONS_BATCH_SIZE } from './types';
import type { QuestionDraft, QuestionItemRow, QuestionPackRow } from './types';

/** Soft memory — last 2–3 asked axes, not a round-robin through the live inventory. */
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

/**
 * Prefer axes not in the last 2–3. Overlap is allowed if the batch would
 * otherwise shrink. `priority` (deferred-unanswered axes) leads the batch in
 * the given order, before recency is considered; empty priority preserves
 * today's behavior exactly.
 */
export function preferFreshAxes(
  drafts: QuestionDraft[],
  recent: TraitAxis[],
  priority: readonly TraitAxis[] = [],
): QuestionDraft[] {
  const avoid = new Set(recent.slice(-QUESTIONS_AXIS_MEMORY));
  const prioritySet = new Set(priority);
  const prioritized: QuestionDraft[] = [];
  for (const axis of priority) {
    const match = drafts.find((draft) => draft.axis === axis);
    if (match) prioritized.push(match);
  }
  const rest = drafts.filter((draft) => !prioritySet.has(draft.axis));
  const fresh = rest.filter((draft) => !avoid.has(draft.axis));
  const overlap = rest.filter((draft) => avoid.has(draft.axis));
  const seen = new Set<TraitAxis>();
  const out: QuestionDraft[] = [];
  for (const draft of [...prioritized, ...fresh, ...overlap]) {
    if (seen.has(draft.axis)) continue;
    seen.add(draft.axis);
    out.push(draft);
    if (out.length >= QUESTIONS_BATCH_SIZE) break;
  }
  return out;
}
