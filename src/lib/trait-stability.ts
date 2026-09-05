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
  type TraitValues,
} from '@/lib/traits';

export const EWMA_ALPHA = 0.35;
export const STABILITY_FLOOR_N = 3;
/**
 * Inconsistent-answerer floor. An axis where every sample disagrees with the
 * running EWMA by >= 0.5 holds `stability` at exactly 0 forever (the EWMA
 * recurrence has 0 as a fixed point at zero agreement) — no amount of
 * re-answering clears it. Once answerCount reaches this threshold,
 * `effectiveStability` floors the result to STABILITY_INCONSISTENT_FLOOR
 * instead of returning the (possibly still-zero) raw value, so the axis can
 * eventually settle. Read-side only: the stored `stability` value and the
 * EWMA math in `applyEwmaAnswer` are untouched.
 */
export const STABILITY_FLOOR_OVERRIDE_N = 8;
export const STABILITY_INCONSISTENT_FLOOR = 0.05;
export const DECAY_GRACE_DAYS = 60;
export const DECAY_HALF_LIFE_DAYS = 90;
export const DEPTH_COOLDOWN_HOURS = 48;
/** After one undo on an axis, the next pending tap on that axis has no undo. */
export const UNDO_SAME_AXIS_REPEAT_CAP = 1;
export const TITLE_MIN_STABLE = 2;
export const TITLE_STABLE_MIN = 0.4;

export type TraitTrackKind = 'report' | 'game';

/**
 * Lightweight replay of a single trait write, for `evidenceHistory` below.
 * Deliberately its own minimal shape rather than importing `TraitHistoryRow`
 * from trait-history.ts, which already imports `TraitTrack` from this file —
 * importing back would be circular.
 */
export interface EvidenceEntry {
  value: number;
  source: string;
  createdAt: string;
}

export interface TraitTrack {
  axis: TraitAxis;
  track: TraitTrackKind;
  value: number;
  stability: number;
  answerCount: number;
  lastTouched: string;
  lastDepthAt: string | null;
  /**
   * Multi-axis question engine fields (additive, not persisted to
   * `trait_tracks` — no schema change). Absent on every track today, which
   * correctly means "no secondary-axis evidence exists yet" (Phase 4, the
   * multi-axis scoring-apply loop, hasn't shipped) — `directEvidenceCountFor`
   * / `totalEvidenceCountFor` below both read as `answerCount` until then.
   */
  directEvidenceCount?: number;
  totalEvidenceCount?: number;
  /**
   * Per-write replay for this axis+track, attached read-side from the
   * existing `trait_history` table (see `attachEvidenceHistory` in
   * trait-history.ts) — reuses data that already exists, no schema change.
   */
  evidenceHistory?: readonly EvidenceEntry[];
}

/**
 * Direct-evidence count for an axis: explicit once Phase 4 sets it, else
 * `answerCount` — every write today is direct evidence, since no
 * secondary-axis evidence exists yet.
 */
export function directEvidenceCountFor(row: TraitTrack): number {
  return row.directEvidenceCount ?? row.answerCount;
}

/**
 * Total-evidence count (primary + secondary) for an axis. Equal to
 * `directEvidenceCountFor` today, same reason.
 */
export function totalEvidenceCountFor(row: TraitTrack): number {
  return row.totalEvidenceCount ?? row.answerCount;
}

/**
 * Phase 4 — the weight-scaled nudge for a SECONDARY-axis write. Pure, no
 * stability/answerCount/lastTouched involved at all — callers must persist
 * only the returned `value`, never route this through `applyEwmaAnswer`
 * (which would read the damped-toward-current value as high agreement and
 * incorrectly inflate stability from weak evidence). `current: null` means
 * the axis has no track yet — the nudge is the raw signal, still inert with
 * respect to confidence since stability/answerCount are never touched here.
 */
export function nudgedSecondaryValue(
  current: number | null,
  signal: number,
  weight: number,
): number {
  const w = clamp01(weight);
  const s = clamp01(signal);
  if (current == null) return s;
  return clamp01(current + w * (s - current));
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
  const decayed = decayedStability(row.stability, row.lastTouched, now);
  if (row.answerCount >= STABILITY_FLOOR_OVERRIDE_N) {
    return Math.max(decayed, STABILITY_INCONSISTENT_FLOOR);
  }
  return decayed;
}

/**
 * Phase 6 — tells apart "this axis is genuinely stuck in the
 * inconsistent-answering trap" from "reads similarly low/decayed for an
 * ordinary reason" (natural time-decay of an axis that was actually answered
 * consistently). The two can produce an IDENTICAL `effectiveStability` read
 * (both floor to `STABILITY_INCONSISTENT_FLOOR` once `answerCount` reaches
 * `STABILITY_FLOOR_OVERRIDE_N`) — this checks the RAW stored `stability`
 * directly (never `decayedStability`, which can only ever shrink an already
 *-low value further and so can never change this verdict — there is no
 * decay path back above the floor once raw stability is below it). Raw
 * `stability` near 0 is what actually carries the agreement signal: a
 * genuinely inconsistent answerer keeps it pinned near 0 regardless of time
 * (0 is a fixed point of the EWMA recurrence at zero agreement — see
 * `STABILITY_FLOOR_OVERRIDE_N` above), while a naturally-decayed axis has a
 * HIGH raw `stability` (built from a consistent history) that only reads
 * low after `decayedStability` ages it down at READ time — decay alone can
 * never make this function return true.
 *
 * Named for what it detects, not for whether the floor happens to be
 * active on a given read (a naturally-decayed axis, once idle long enough,
 * IS floored by `effectiveStability` too — this function still correctly
 * reads false for it, since it was never the inconsistent-answering trap).
 */
export function isInconsistentAnswerer(row: TraitTrack | null): boolean {
  return !!row && row.answerCount >= STABILITY_FLOOR_OVERRIDE_N && row.stability < STABILITY_INCONSISTENT_FLOOR;
}

export function isStableForTitle(row: TraitTrack | null, now: Date = new Date()): boolean {
  return effectiveStability(row, now) >= TITLE_STABLE_MIN;
}

export function reportTracks(rows: readonly TraitTrack[]): TraitTrack[] {
  return rows.filter((row) => row.track === 'report');
}

/**
 * The `game` track (source `self_game`, gut-call/scenario answers) is
 * INTERNAL-ONLY. It is written on every gut-call answer but never rendered as
 * a standalone number: its value surfaces only through told-vs-played
 * divergence (The Story via `sage-story-fold.tsx`, Talk via
 * `formatDivergenceNote`), and gut-call deliberately never counts toward
 * "settled"/Categories/Title (report-track only). Do not wire it into a band
 * or fold.
 */
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

/**
 * Axis to nudge toward when a profile needs more answers: the first
 * completely unanswered axis, else the least-settled report axis.
 */
export function missingAxis(
  values: TraitValues,
  tracks: readonly TraitTrack[],
): TraitAxis | null {
  for (const axis of TRAIT_AXES) {
    if (values[axis] == null) return axis;
  }
  let best: TraitAxis | null = null;
  let bestStability = Infinity;
  for (const axis of TRAIT_AXES) {
    const stability = effectiveStability(trackFor(tracks, axis, 'report'));
    if (stability < bestStability) {
      bestStability = stability;
      best = axis;
    }
  }
  return best;
}

/**
 * "Filled" is a different, weaker predicate than "settled" over the same column.
 * Filled  = report track has answerCount >= 1 (the axis has been answered at all).
 * Settled = report track has answerCount >= STABILITY_FLOOR_N (3) AND carries
 *           enough agreement to score above 0 via `effectiveStability`.
 * An axis can be filled and not settled; never settled and not filled.
 * Report track only — the game track never counts, same rule as settled.
 */
export const FILL_FLOOR_N = 1;

export function isAxisFilled(row: TraitTrack | null): boolean {
  return !!row && row.answerCount >= FILL_FLOOR_N;
}

export function filledAxes(rows: readonly TraitTrack[]): TraitAxis[] {
  return TRAIT_AXES.filter((axis) => isAxisFilled(trackFor(rows, axis, 'report')));
}

export function unfilledAxes(rows: readonly TraitTrack[]): TraitAxis[] {
  return TRAIT_AXES.filter((axis) => !isAxisFilled(trackFor(rows, axis, 'report')));
}

export function filledCount(rows: readonly TraitTrack[]): number {
  return filledAxes(rows).length;
}

export function unansweredCount(rows: readonly TraitTrack[]): number {
  return unfilledAxes(rows).length;
}

export const UNANSWERED_LABEL_SUFFIX = `of ${TRAIT_AXES.length} unanswered`;

export function unansweredAxisLabel(rows: readonly TraitTrack[]): string {
  return `${unansweredCount(rows)} ${UNANSWERED_LABEL_SUFFIX}`;
}

/** Every currently-defined axis has at least one report answer. */
export function isProfileComplete(rows: readonly TraitTrack[]): boolean {
  return TRAIT_AXES.length > 0 && filledCount(rows) >= TRAIT_AXES.length;
}

/**
 * The strictest completeness predicate, and the one every AI surface gates on.
 * True only when EVERY currently-defined axis has a report track that scores
 * above 0 through `effectiveStability` — i.e. answerCount >= STABILITY_FLOOR_N
 * (3) AND enough agreement between answers to survive decay. Gut-call never
 * counts, same rule as settled.
 *
 * Strictly stronger than both existing predicates:
 *   isProfileComplete  — one answer on each axis (no agreement requirement)
 *   !isThinProfile     — a stability SUM over 6/15 of the inventory, so a few
 *                        deep axes can clear it while others sit at zero
 * An axis answered inconsistently (every new sample >= 0.5 from its EWMA)
 * holds agreement at 0, but `effectiveStability` floors it to
 * STABILITY_INCONSISTENT_FLOOR once answerCount reaches
 * STABILITY_FLOOR_OVERRIDE_N, so that axis eventually settles too.
 */
export function isProfileSettled(
  rows: readonly TraitTrack[],
  now: Date = new Date(),
): boolean {
  // TRAIT_AXES is a non-empty const tuple, so `every` on it is never
  // vacuously true — no empty-inventory guard needed (isProfileComplete's
  // length check exists only because it compares against a count).
  return TRAIT_AXES.every((axis) => effectiveStability(trackFor(rows, axis, 'report'), now) > 0);
}

/**
 * Shown on surfaces that lock rather than degrade (Explore observations, Sage
 * Title). The surfaces that stay silent instead — the daily card and Sage chat
 * — never render this; they serve local/templated content and spend nothing.
 */
export const PROFILE_LOCKED_COPY = 'Complete your profile to unlock this';
export const PROFILE_LOCKED_CTA = 'Answer Questions';

export const FILLED_LABEL_SUFFIX = `of ${TRAIT_AXES.length} filled`;

export function filledAxisLabel(rows: readonly TraitTrack[]): string {
  return `${filledCount(rows)} ${FILLED_LABEL_SUFFIX}`;
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
