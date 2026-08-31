/**
 * Per-axis EWMA tracks. Self-report and gut-call never mix.
 * Completeness is stability-weighted, not a raw fill count.
 */
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';
import {
  TRAIT_AXES,
  isDirectTraitSource,
  type TraitAxis,
  type TraitSource,
} from '@/lib/traits';

export const EWMA_ALPHA = 0.35;
export const STABILITY_FLOOR_N = 3;
export const DECAY_GRACE_DAYS = 60;
export const DECAY_HALF_LIFE_DAYS = 90;
export const DEPTH_COOLDOWN_HOURS = 48;
/** After one undo on an axis, the next pending tap on that axis has no undo. */
export const UNDO_SAME_AXIS_REPEAT_CAP = 1;
export const TITLE_MIN_STABLE = 2;
export const TITLE_STABLE_MIN = 0.4;

export type TraitTrackKind = 'report' | 'game';

export interface TraitTrack {
  axis: TraitAxis;
  track: TraitTrackKind;
  value: number;
  stability: number;
  answerCount: number;
  lastTouched: string;
  lastDepthAt: string | null;
}

export function trackKindForSource(source: TraitSource): TraitTrackKind {
  return source === 'self_game' ? 'game' : 'report';
}

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function emptyTrack(axis: TraitAxis, track: TraitTrackKind): TraitTrack {
  return {
    axis,
    track,
    value: 0,
    stability: 0,
    answerCount: 0,
    lastTouched: '',
    lastDepthAt: null,
  };
}

/**
 * Blend a new sample into a track. Never overwrites.
 * First answer lands as the value with stability 0 (not yet meaningful).
 */
export function applyEwmaAnswer(
  current: TraitTrack | null,
  axis: TraitAxis,
  track: TraitTrackKind,
  sample: number,
  nowIso: string,
): TraitTrack {
  const signal = clamp01(sample);
  if (!current || current.answerCount <= 0) {
    return {
      axis,
      track,
      value: signal,
      stability: 0,
      answerCount: 1,
      lastTouched: nowIso,
      lastDepthAt: current?.lastDepthAt ?? null,
    };
  }
  const delta = Math.abs(signal - current.value);
  const agreement = 1 - clamp01(delta / 0.5);
  const value = clamp01(EWMA_ALPHA * signal + (1 - EWMA_ALPHA) * current.value);
  const stability = clamp01(EWMA_ALPHA * agreement + (1 - EWMA_ALPHA) * current.stability);
  return {
    axis,
    track,
    value,
    stability,
    answerCount: current.answerCount + 1,
    lastTouched: nowIso,
    lastDepthAt: current.lastDepthAt,
  };
}

export function daysIdle(lastTouchedIso: string, now: Date = new Date()): number {
  if (!lastTouchedIso) return 0;
  const at = new Date(lastTouchedIso);
  if (Number.isNaN(at.getTime())) return 0;
  return Math.max(0, (now.getTime() - at.getTime()) / 86_400_000);
}

/** After 60 idle days, half-life of 90 days. Applied at read, not write. */
export function decayedStability(
  stability: number,
  lastTouchedIso: string,
  now: Date = new Date(),
): number {
  const idle = daysIdle(lastTouchedIso, now);
  if (idle <= DECAY_GRACE_DAYS) return clamp01(stability);
  const extra = idle - DECAY_GRACE_DAYS;
  return clamp01(stability * 0.5 ** (extra / DECAY_HALF_LIFE_DAYS));
}

export function effectiveStability(row: TraitTrack | null, now: Date = new Date()): number {
  if (!row || row.answerCount < STABILITY_FLOOR_N) return 0;
  return decayedStability(row.stability, row.lastTouched, now);
}

export function isStableForTitle(row: TraitTrack | null, now: Date = new Date()): boolean {
  return effectiveStability(row, now) >= TITLE_STABLE_MIN;
}

export function reportTracks(rows: readonly TraitTrack[]): TraitTrack[] {
  return rows.filter((row) => row.track === 'report');
}

export function gameTracks(rows: readonly TraitTrack[]): TraitTrack[] {
  return rows.filter((row) => row.track === 'game');
}

export function trackFor(
  rows: readonly TraitTrack[],
  axis: TraitAxis,
  track: TraitTrackKind,
): TraitTrack | null {
  return rows.find((row) => row.axis === axis && row.track === track) ?? null;
}

/**
 * Sum of effective report-track stability across every currently-defined axis.
 * Gut-call never counts. Below the answer-count floor an axis contributes 0.
 */
export function settledScore(rows: readonly TraitTrack[], now: Date = new Date()): number {
  let sum = 0;
  for (const axis of TRAIT_AXES) {
    sum += effectiveStability(trackFor(rows, axis, 'report'), now);
  }
  return sum;
}

export function settledCount(rows: readonly TraitTrack[], now: Date = new Date()): number {
  return Math.round(settledScore(rows, now));
}

/**
 * Original thin floor was 6 of 15 settled. Stay a fraction of the live
 * inventory so a 17th axis does not need a new literal.
 */
export const THIN_PROFILE_RATIO = 6 / 15;

export function isThinProfile(
  settled: number,
  axisTotal: number = TRAIT_AXES.length,
): boolean {
  return axisTotal > 0 && settled / axisTotal < THIN_PROFILE_RATIO;
}

export const SETTLED_LABEL_SUFFIX = `of ${TRAIT_AXES.length} settled`;

export function settledAxisLabel(rows: readonly TraitTrack[], now: Date = new Date()): string {
  return `${settledCount(rows, now)} ${SETTLED_LABEL_SUFFIX}`;
}

export function depthReady(
  lastDepthAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!lastDepthAt) return true;
  const at = new Date(lastDepthAt);
  if (Number.isNaN(at.getTime())) return true;
  return now.getTime() - at.getTime() >= DEPTH_COOLDOWN_HOURS * 3_600_000;
}

export function markDepthSpent(row: TraitTrack, nowIso: string): TraitTrack {
  return { ...row, lastDepthAt: nowIso };
}

export function shouldWriteReportTrack(
  currentSource: TraitSource | undefined,
  incomingSource: Exclude<TraitSource, 'self_confirm'>,
): boolean {
  if (incomingSource === 'self_game') return false;
  if (isDirectTraitSource(currentSource) && !isDirectTraitSource(incomingSource)) return false;
  return true;
}

export function titleFingerprint(rows: readonly TraitTrack[], now: Date = new Date()): string {
  return TRAIT_AXES
    .map((axis) => {
      const row = trackFor(rows, axis, 'report');
      if (!isStableForTitle(row, now) || !row) return null;
      return `${axis}:${row.value.toFixed(2)}:${effectiveStability(row, now).toFixed(2)}`;
    })
    .filter((part): part is string => part != null)
    .join('|');
}

export function stableReportAxes(rows: readonly TraitTrack[], now: Date = new Date()): TraitAxis[] {
  return TRAIT_AXES.filter((axis) => isStableForTitle(trackFor(rows, axis, 'report'), now));
}

export function stabilityCopyClean(): boolean {
  return !containsFrameworkTerm(`How settled · ${SETTLED_LABEL_SUFFIX}`);
}
