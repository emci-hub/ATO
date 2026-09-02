import type { TraitAxis } from '@/lib/traits';
import { TRAIT_AXES } from '@/lib/traits';

import { QUESTIONS_BANK } from './bank';
import { keepGuardedDrafts } from './guards';
import { preferFreshAxes } from './rotation';
import { QUESTIONS_BATCH_SIZE } from './types';
import type { QuestionDraft } from './types';

export const QUESTIONS_SWEEP_SIZE = TRAIT_AXES.length;

/**
 * UNREVIEWED — same discipline as crisis card copy.
 * Flip to true only after emci signs off the full-axis set.
 */
export const INTAKE_SWEEP_COPY_REVIEWED = false;

export function bankByAxis(): Map<TraitAxis, QuestionDraft> {
  const map = new Map<TraitAxis, QuestionDraft>();
  for (const row of QUESTIONS_BANK) {
    if (!map.has(row.axis)) map.set(row.axis, row);
  }
  return map;
}

/** Deterministic batch when Gemini is off. Same locked examples as the prompt. */
export function composeLocalQuestionBatch(
  recentAxes: TraitAxis[] = [],
  priorityAxes: readonly TraitAxis[] = [],
): QuestionDraft[] {
  const byAxis = bankByAxis();
  const out: QuestionDraft[] = [];
  const seen = new Set<TraitAxis>();
  const push = (draft: QuestionDraft | undefined) => {
    if (!draft || seen.has(draft.axis)) return;
    seen.add(draft.axis);
    out.push({ ...draft, options: draft.options.map((opt) => ({ ...opt })) });
  };
  for (const axis of priorityAxes) {
    push(byAxis.get(axis));
    if (out.length >= QUESTIONS_BATCH_SIZE) return out;
  }
  const copies = QUESTIONS_BANK.filter((row) => !seen.has(row.axis)).map((row) => ({
    axis: row.axis,
    prompt: row.prompt,
    options: row.options.map((opt) => ({ ...opt })),
  }));
  for (const draft of preferFreshAxes(copies, recentAxes)) {
    push(draft);
    if (out.length >= QUESTIONS_BATCH_SIZE) break;
  }
  return out;
}

/** One item per axis, all TRAIT_AXES. Distinct from the 5-item rotation. */
export function composeLocalSweep(): QuestionDraft[] {
  const byAxis = bankByAxis();
  const out: QuestionDraft[] = [];
  for (const axis of TRAIT_AXES) {
    const row = byAxis.get(axis);
    if (!row) continue;
    out.push({
      axis: row.axis,
      prompt: row.prompt,
      options: row.options.map((opt) => ({ ...opt })),
    });
  }
  return keepGuardedDrafts(out).kept;
}

export function unansweredSweep(
  drafts: readonly QuestionDraft[],
  answered: ReadonlySet<TraitAxis>,
): QuestionDraft[] {
  return drafts.filter((draft) => !answered.has(draft.axis));
}
