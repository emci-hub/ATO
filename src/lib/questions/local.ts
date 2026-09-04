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

/**
 * Every bank draft for each axis, in bank order — NOT first-wins. Callers pick
 * a variant with `bankDraftFor`; nothing here silently drops content.
 */
export function bankByAxis(): Map<TraitAxis, QuestionDraft[]> {
  const map = new Map<TraitAxis, QuestionDraft[]>();
  for (const row of QUESTIONS_BANK) {
    const list = map.get(row.axis);
    if (list) list.push(row);
    else map.set(row.axis, [row]);
  }
  return map;
}

function copyDraft(draft: QuestionDraft): QuestionDraft {
  return {
    axis: draft.axis,
    prompt: draft.prompt,
    options: draft.options.map((opt) => ({ ...opt })),
  };
}

/**
 * One draft for an axis, wrapping by `variant` so any index is safe. Variant 0
 * is the axis's original locked draft, so every existing caller keeps today's
 * behaviour exactly.
 *
 * NOTE: no caller passes variant > 0 yet, so drafts 2 and 3 of each axis are
 * reachable through this API but not yet served. Wiring a selector needs
 * per-axis `answerCount` (from trait tracks) so a repeat pass asks a different
 * question — that is what would let the static bank alone settle an axis.
 */
export function bankDraftFor(axis: TraitAxis, variant = 0): QuestionDraft | null {
  const list = bankByAxis().get(axis);
  if (!list || list.length === 0) return null;
  const index = ((variant % list.length) + list.length) % list.length;
  return copyDraft(list[index]!);
}

/** Variant 0 of every axis — the one-per-axis view older callers expect. */
export function bankLeadDrafts(): QuestionDraft[] {
  const out: QuestionDraft[] = [];
  for (const axis of TRAIT_AXES) {
    const draft = bankDraftFor(axis);
    if (draft) out.push(draft);
  }
  return out;
}

/** Deterministic batch when Gemini is off. Same locked examples as the prompt. */
export function composeLocalQuestionBatch(
  recentAxes: TraitAxis[] = [],
  priorityAxes: readonly TraitAxis[] = [],
  variant = 0,
): QuestionDraft[] {
  const out: QuestionDraft[] = [];
  const seen = new Set<TraitAxis>();
  const push = (draft: QuestionDraft | null | undefined) => {
    if (!draft || seen.has(draft.axis)) return;
    seen.add(draft.axis);
    out.push(draft);
  };
  for (const axis of priorityAxes) {
    push(bankDraftFor(axis, variant));
    if (out.length >= QUESTIONS_BATCH_SIZE) return out;
  }
  // One draft per axis before rotation: `preferFreshAxes` dedupes by axis, so
  // feeding it all three variants of an axis would spend slots it then drops.
  const copies = bankLeadDrafts().filter((row) => !seen.has(row.axis));
  for (const draft of preferFreshAxes(copies, recentAxes)) {
    push(bankDraftFor(draft.axis, variant));
    if (out.length >= QUESTIONS_BATCH_SIZE) break;
  }
  return out;
}

/**
 * One item per axis, all TRAIT_AXES. Distinct from the 5-item rotation.
 * `variant` wraps per axis; 0 keeps the original locked draft everywhere.
 */
export function composeLocalSweep(variant = 0): QuestionDraft[] {
  const out: QuestionDraft[] = [];
  for (const axis of TRAIT_AXES) {
    const draft = bankDraftFor(axis, variant);
    if (draft) out.push(draft);
  }
  return keepGuardedDrafts(out).kept;
}

export function unansweredSweep(
  drafts: readonly QuestionDraft[],
  answered: ReadonlySet<TraitAxis>,
): QuestionDraft[] {
  return drafts.filter((draft) => !answered.has(draft.axis));
}
