/**
 * The spectrum sliders on Insights (PHASE-09): the three strongest clear leans,
 * each as a position on its axis between two poles. Pure maths, so a check can
 * pin it. Neither pole is "good" or "bad": the labels are the axis's own pole
 * names. The confidence band is derived from stability (no interval is stored):
 * the less settled an axis, the wider its band.
 */
import { AXIS_POLE_NAME, AXIS_SHORT_NAME } from '@/lib/axis-poles';
import { clearLeans } from '@/lib/daily-line/pick';
import { effectiveStability, trackFor, type TraitTrack } from '@/lib/trait-stability';
import type { TraitAxis } from '@/lib/traits';

export const SPECTRUM_COUNT = 3;
/** The band never gets narrower than this (a settled axis is still an estimate). */
export const BAND_MIN_HALF = 0.04;
/** ...or wider than this (an unsettled axis is not "everywhere"). */
export const BAND_MAX_HALF = 0.3;

export interface SpectrumRow {
  axis: TraitAxis;
  name: string;
  lowLabel: string;
  highLabel: string;
  /** 0..1 along the axis (0 = low pole). */
  value: number;
  /** The band's edges, 0..1, clamped. */
  bandLow: number;
  bandHigh: number;
  /** What VoiceOver says. */
  spoken: string;
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

export function bandHalfWidth(stability: number): number {
  const s = Number.isFinite(stability) ? clamp01(stability) : 0;
  return Math.min(BAND_MAX_HALF, Math.max(BAND_MIN_HALF, (1 - s) * BAND_MAX_HALF));
}

/** "Leans Adventurous, fairly clear" in words, never a number. */
export function spokenSpectrum(name: string, lowLabel: string, highLabel: string, value: number, stability: number): string {
  const side = value >= 0.5 ? highLabel : lowLabel;
  const strength = Math.abs(value - 0.5);
  const how = strength >= 0.3 ? 'strongly' : strength >= 0.2 ? 'clearly' : 'a little';
  const confidence = stability >= 0.7 ? 'well settled' : stability >= 0.4 ? 'fairly clear' : 'still settling';
  return `${name}: leans ${how} toward ${side}, between ${lowLabel} and ${highLabel}. Confidence: ${confidence}.`;
}

/**
 * The strongest clear leans first (distance from the middle), ties in
 * TRAIT_AXES order (the stable sort over `clearLeans`' own order).
 */
export function spectrumRows(tracks: readonly TraitTrack[], now: Date = new Date()): SpectrumRow[] {
  const leans = [...clearLeans(tracks, now)].sort((a, b) => b.strength - a.strength).slice(0, SPECTRUM_COUNT);
  const rows: SpectrumRow[] = [];
  for (const lean of leans) {
    const row = trackFor(tracks, lean.axis, 'report');
    if (!row) continue;
    const value = clamp01(row.value);
    const stability = effectiveStability(row, now);
    const half = bandHalfWidth(stability);
    const { low, high } = AXIS_POLE_NAME[lean.axis];
    rows.push({
      axis: lean.axis,
      name: AXIS_SHORT_NAME[lean.axis],
      lowLabel: low,
      highLabel: high,
      value,
      bandLow: clamp01(value - half),
      bandHigh: clamp01(value + half),
      spoken: spokenSpectrum(AXIS_SHORT_NAME[lean.axis], low, high, value, stability),
    });
  }
  return rows;
}
