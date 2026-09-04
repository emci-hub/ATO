import { trackFor, type TraitTrack } from '@/lib/trait-stability';
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
    category: draft.category,
    prompt: draft.prompt,
    options: draft.options.map((opt) => ({ ...opt })),
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

/**
 * One item per axis, all TRAIT_AXES. Distinct from the 5-item rotation.
 * Each axis shows the draft its own answer count points at, so a second pass
 * over an axis is a different question. Empty `tracks` = the locked draft
 * everywhere, which is what a brand-new profile gets.
 *
 * NOTE: `IntakeSweep` filters this through `unansweredSweep`, which drops any
 * axis that already holds a trait value — so in practice the sweep fills each
 * axis once and the later variants are delivered by the rotating pool above
 * it. Passing tracks here keeps the two surfaces consistent (and covers an
 * axis whose value was cleared but whose track survives).
 */
export function composeLocalSweep(tracks: readonly TraitTrack[] = []): QuestionDraft[] {
  const out: QuestionDraft[] = [];
  for (const axis of TRAIT_AXES) {
    const draft = bankDraftFor(axis, axisVariant(tracks, axis));
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
