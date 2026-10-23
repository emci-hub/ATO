/**
 * "Not me" on a trait result, and the closer-legend pick.
 *
 * Still fits is the existing confirm: the source becomes `self_confirm` and
 * the number does not move. Not me is the other way. It stores one weighted
 * answer (`SELF_CORRECTION_WEIGHT`, one vote in the equal-weight score). It
 * does not set a direct source, so it is not an override lock. Later answers
 * can outvote it.
 *
 * A closer-legend pick writes that same kind of answer on each name-axis that
 * is not already on the picked side. It does not collect the legend. The
 * legend is collected only when the score itself becomes that code.
 */
import { CORE_AXES, LEGEND_HIGH_EDGE, LEGEND_LOW_EDGE, MODIFIER_AXES } from '@/lib/legends64/classify';
import { trackFor, traitScore, type TraitTrack } from '@/lib/trait-stability';
import type { TraitAxis, TraitSource } from '@/lib/traits';

/** One answer in the equal-weight score. Not a lock. */
export const SELF_CORRECTION_WEIGHT = 1;

export const CORRECTION_STILL_FITS = 'Still fits';
export const CORRECTION_NOT_ME = 'Not me';
export const CORRECTION_SOFTER = 'A bit less like that';
export const CORRECTION_OTHER = 'More the other way';
export const CORRECTION_SAVED = 'Saved as one answer. Later answers can still move this.';
export const LEGEND_NOT_ME = 'Not me';
export const LEGEND_CLOSER_LEAD = 'Pick the closer one.';

export interface SelfCorrection {
  axis: TraitAxis;
  value: number;
  weight: number;
}

function round2(n: number): number {
  return Math.round(Math.min(1, Math.max(0, n)) * 100) / 100;
}

/**
 * A nudge, not a replacement.
 * `softer` moves halfway from the current score toward 50%.
 * `other` is one answer on the opposite end (0.2 or 0.8).
 */
export function traitNudgeValue(score: number, kind: 'softer' | 'other'): number {
  if (!Number.isFinite(score)) return 0.5;
  if (kind === 'other') return score >= 0.5 ? 0.2 : 0.8;
  return round2(score + (0.5 - score) * 0.5);
}

const NAME_AXES: readonly TraitAxis[] = [...CORE_AXES, ...MODIFIER_AXES];

/**
 * One weighted answer per name-axis that is not already clearly on the
 * picked letter. Settled matches are left alone. Unknown and middle axes
 * get a nudge toward the letter (0.8 high, 0.2 low).
 */
export function legendCorrectionSamples(
  tracks: readonly TraitTrack[],
  sources: Partial<Record<TraitAxis, TraitSource | null | undefined>>,
  code: string,
): SelfCorrection[] {
  const match = /^([HL]{3})-([HL]{3})$/.exec(code);
  if (!match) return [];
  const letters = `${match[1]}${match[2]}`.split('');
  const out: SelfCorrection[] = [];
  NAME_AXES.forEach((axis, index) => {
    const letter = letters[index];
    const score = traitScore(trackFor(tracks, axis, 'report'), sources[axis] ?? null);
    if (letter === 'H' && score != null && score > LEGEND_HIGH_EDGE) return;
    if (letter === 'L' && score != null && score < LEGEND_LOW_EDGE) return;
    out.push({
      axis,
      value: letter === 'H' ? 0.8 : 0.2,
      weight: SELF_CORRECTION_WEIGHT,
    });
  });
  return out;
}
