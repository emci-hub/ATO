import { trackFor, type TraitTrack } from '@/lib/trait-stability';
import type { TraitAxis } from '@/lib/traits';
import { TRAIT_AXES } from '@/lib/traits';

import { QUESTIONS_BANK } from './bank';
import { preferFreshAxes } from './rotation';
import { QUESTIONS_BATCH_SIZE } from './types';
import type { QuestionDraft } from './types';

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
    category: draft.category,
    prompt: draft.prompt,
    options: draft.options.map((opt) => ({ ...opt })),
    primaryAxes: draft.primaryAxes?.map((row) => ({ ...row })),
    secondaryAxes: draft.secondaryAxes?.map((row) => ({ ...row })),
    excludedAxes: draft.excludedAxes ? [...draft.excludedAxes] : undefined,
    redundancyTags: draft.redundancyTags ? [...draft.redundancyTags] : undefined,
  };
}

/**
 * One draft for an axis, wrapping by `variant` so any index is safe. Variant 0
 * is the axis's original locked draft.
 */
export function bankDraftFor(axis: TraitAxis, variant = 0): QuestionDraft | null {
  const list = bankByAxis().get(axis);
  if (!list || list.length === 0) return null;
  const index = ((variant % list.length) + list.length) % list.length;
  return copyDraft(list[index]!);
}

/**
 * Which bank draft an axis should show next: its report-track `answerCount`.
 *
 * 0 answers -> draft 1, 1 answer -> draft 2, 2 answers -> draft 3, and
 * `bankDraftFor` wraps from there. So a person working through Questions over
 * repeat passes sees three DIFFERENT questions on an axis and can actually
 * reach the `answerCount >= 3` that `effectiveStability` needs, instead of
 * being shown draft 1 forever.
 *
 * Report track only — gut-call (`self_game`) never counts toward settled, so
 * it must not advance the question either. An axis with no track reads 0.
 */
export function axisVariant(tracks: readonly TraitTrack[], axis: TraitAxis): number {
  const row = trackFor(tracks, axis, 'report');
  return row ? Math.max(0, row.answerCount) : 0;
}

/** Variant 0 of every axis — the one-per-axis view used to seed rotation. */
export function bankLeadDrafts(): QuestionDraft[] {
  const out: QuestionDraft[] = [];
  for (const axis of TRAIT_AXES) {
    const draft = bankDraftFor(axis);
    if (draft) out.push(draft);
  }
  return out;
}

/**
 * Deterministic batch when Gemini is off. Which axes appear is unchanged; the
 * draft shown for each axis is now chosen by that axis's own answer count, so
 * a repeat batch on the same axis asks something new. Empty `tracks` reads as
 * "nothing answered" and yields the locked draft for every axis.
 */
export function composeLocalQuestionBatch(
  recentAxes: TraitAxis[] = [],
  priorityAxes: readonly TraitAxis[] = [],
  tracks: readonly TraitTrack[] = [],
): QuestionDraft[] {
  const out: QuestionDraft[] = [];
  const seen = new Set<TraitAxis>();
  const push = (axis: TraitAxis) => {
    if (seen.has(axis)) return;
    const draft = bankDraftFor(axis, axisVariant(tracks, axis));
    if (!draft) return;
    seen.add(axis);
    out.push(draft);
  };
  for (const axis of priorityAxes) {
    push(axis);
    if (out.length >= QUESTIONS_BATCH_SIZE) return out;
  }
  // One draft per axis before rotation: `preferFreshAxes` dedupes by axis, so
  // feeding it all three variants of an axis would spend slots it then drops.
  // Rotation only decides WHICH axes lead; `push` decides which draft.
  const copies = bankLeadDrafts().filter((row) => !seen.has(row.axis));
  for (const draft of preferFreshAxes(copies, recentAxes)) {
    push(draft.axis);
    if (out.length >= QUESTIONS_BATCH_SIZE) break;
  }
  return out;
}

export type BankItemState = 'answered' | 'current' | 'locked';

export interface BankProgressItem {
  axis: TraitAxis;
  /** 0-based index within this axis's bank list — matches `bankDraftFor`'s variant. */
  variant: number;
  draft: QuestionDraft;
  state: BankItemState;
}

/**
 * All bank drafts for one axis with a sequential-unlock state, derived from
 * `axisVariant` (the axis's own answer count) — no separate persisted
 * "which exact question was answered" state exists, so order is the only
 * thing that keeps this accurate: draft 0 must be answered before 1 unlocks,
 * 1 before 2, matching how `bankDraftFor`/rotation already serve them.
 */
export function bankProgressForAxis(
  axis: TraitAxis,
  tracks: readonly TraitTrack[],
): BankProgressItem[] {
  const list = bankByAxis().get(axis) ?? [];
  const answeredCount = Math.min(axisVariant(tracks, axis), list.length);
  return list.map((draft, index) => ({
    axis,
    variant: index,
    draft,
    state: index < answeredCount ? 'answered' : index === answeredCount ? 'current' : 'locked',
  }));
}

/** Concatenated `bankProgressForAxis` for a set of axes, in axis order. */
export function bankProgressForAxes(
  axes: readonly TraitAxis[],
  tracks: readonly TraitTrack[],
): BankProgressItem[] {
  return axes.flatMap((axis) => bankProgressForAxis(axis, tracks));
}

/** Total bank drafts covering a set of axes (e.g. a category's question count). */
export function bankQuestionCount(axes: readonly TraitAxis[]): number {
  const map = bankByAxis();
  return axes.reduce((sum, axis) => sum + (map.get(axis)?.length ?? 0), 0);
}

/** "N of 50 answered" across the whole bank, every axis (frozen intake, §3). */
export function bankTotalProgress(tracks: readonly TraitTrack[]): {
  answered: number;
  total: number;
} {
  const map = bankByAxis();
  let answered = 0;
  let total = 0;
  for (const axis of TRAIT_AXES) {
    const list = map.get(axis) ?? [];
    total += list.length;
    answered += Math.min(axisVariant(tracks, axis), list.length);
  }
  return { answered, total };
}
