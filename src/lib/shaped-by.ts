/**
 * "What shapes this" — the plain answer to "why does it say that about me?".
 * Pure. Given a set of traits, says for each one what it is called in plain
 * words, which way this person leans on it, and whether that read is settled.
 *
 * Used behind a small tap-to-open row on a category card, on the identity card
 * and on each trait in the full profile. It is deliberately NOT on screen by
 * default: the card says what it says, and the working is one tap away for
 * anyone who wants it.
 *
 * Never an internal trait name and never a number: the label is the short
 * everyday name (AXIS_SHORT_NAME) and the lean is a quote from AXIS_POLES —
 * something a person on that side would say.
 */
import { AXIS_POLE_NAME, AXIS_POLES, AXIS_SHORT_NAME } from '@/lib/axis-poles';
import { CATEGORY_DEFS } from '@/lib/categories';
import { CORE_AXES, MODIFIER_AXES, THIRD_AXES } from '@/lib/legends64/classify';
import { isAxisSettled, trackFor, type TraitTrack } from '@/lib/trait-stability';
import type { TraitAxis, TraitLean } from '@/lib/traits';

export const SHAPED_BY_LABEL = 'What shapes this';
export const SHAPED_BY_NOT_ANSWERED = 'Not answered yet.';
export const SHAPED_BY_SETTLING = 'still settling';
export const SHAPED_BY_MIDDLE = 'In between so far.';
/** Before the word for the reader's own end: “You lean Adventurous”. */
export const YOUR_SIDE_LEAD = 'You lean';

export const IDENTITY_RECIPE_LABEL = 'How this name is made';
export const IDENTITY_RECIPE_LEDE =
  'Every word comes from three traits. A word locks in once all three are settled.';

/** How far from the middle before a lean is named at all. */
const LEAN_MARGIN = 0.05;

export interface ShapedByRow {
  axis: TraitAxis;
  /** Plain-words name of the trait. */
  label: string;
  lean: TraitLean | null;
  /** The word for the end they lean to ("Adventurous"), or null without a lean. */
  poleName: string | null;
  /**
   * With a lean: what their side sounds like, WITHOUT quote marks (the screen
   * adds them). Without one: a plain "not answered" / "in between".
   */
  line: string;
  settled: boolean;
}

export function shapedByRow(axis: TraitAxis, tracks: readonly TraitTrack[], now: Date = new Date()): ShapedByRow {
  const row = trackFor(tracks, axis, 'report');
  const label = AXIS_SHORT_NAME[axis];
  if (!row || row.answerCount < 1 || !Number.isFinite(row.value)) {
    return { axis, label, lean: null, poleName: null, line: SHAPED_BY_NOT_ANSWERED, settled: false };
  }
  const settled = isAxisSettled(row, now);
  if (Math.abs(row.value - 0.5) < LEAN_MARGIN) {
    return { axis, label, lean: null, poleName: null, line: SHAPED_BY_MIDDLE, settled };
  }
  const lean: TraitLean = row.value >= 0.5 ? 'high' : 'low';
  return { axis, label, lean, poleName: AXIS_POLE_NAME[axis][lean], line: AXIS_POLES[axis][lean], settled };
}

export function shapedByRows(axes: readonly TraitAxis[], tracks: readonly TraitTrack[]): ShapedByRow[] {
  return axes.map((axis) => shapedByRow(axis, tracks));
}

/** Names of the categories a trait feeds, in catalog order. */
export function categoriesForAxis(axis: TraitAxis): string[] {
  return CATEGORY_DEFS.filter((def) => def.axes.includes(axis)).map((def) => def.name);
}

/** "Part of: Steadiness, Structure." / "" */
export function showsUpInLine(axis: TraitAxis): string {
  const names = categoriesForAxis(axis);
  if (names.length === 0) return '';
  const list = names.join(', ');
  return `Part of: ${list}.`;
}

/**
 * The identity name's parts and the traits behind each: the describing word
 * (modifier axes), the role (core axes) and, for the three-word styles, the
 * extra word (Growth x Composure x Playfulness, name styles v2).
 */
export function identityRecipe(tracks: readonly TraitTrack[]): {
  first: ShapedByRow[];
  second: ShapedByRow[];
  third: ShapedByRow[];
} {
  return {
    first: shapedByRows(MODIFIER_AXES, tracks),
    second: shapedByRows(CORE_AXES, tracks),
    third: shapedByRows(THIRD_AXES, tracks),
  };
}
