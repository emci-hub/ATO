/**
 * Reliable Change Index — the re-roll trigger (trait-system redesign §5).
 * Comparison/trigger tool only: does NOT update any trait value itself, and
 * consumes the stability §4's Kalman update already produces (`effectiveStability`)
 * rather than tracking a separate variance field.
 *
 * RCI = (current_value - snapshot_value) / standard_error, where
 * standard_error is derived from CURRENT stability the same way T-01's
 * Kalman gain derives prior_variance (`1 - stability`, sqrt'd — the
 * classical RCI/SEM convention) — same size of movement counts as "real
 * change" differently depending on how well-established the axis already
 * is, exactly as the plan specifies.
 *
 * `RCI_MIN_VARIANCE` is deliberately its OWN constant, NOT a reuse of
 * `KALMAN_MIN_VARIANCE` from trait-stability.ts, even though both are a
 * "variance floor on `1 - stability`." They protect against different
 * failures: `KALMAN_MIN_VARIANCE` (0.05) guarantees a trait VALUE can never
 * get permanently stuck — a real product requirement verified by
 * `check:kalman`, and lowering it would risk reopening that. RCI has no such
 * requirement; it only needs to tell real change apart from noise. Reusing
 * 0.05 caps standard_error at sqrt(0.05)=0.224, which caps RCI at roughly
 * delta/0.224 for ANY axis no matter how consistently it's been answered —
 * for the plan's own §5 worked example (a sustained flip from 0.30 to
 * 0.68, delta 0.38, at realistically-achievable high stability) that caps
 * RCI at ~1.7, a hair over the 1.65 cutoff rather than the clearly
 * unambiguous ~9.5 the plan describes — a fragile margin that would flip
 * back under 1.65 from a trivial rounding difference.
 *
 * `RCI_MIN_VARIANCE = 0.0016` is not a guess — it's the unique floor value
 * that makes BOTH of the plan's own §5 worked examples literally true at
 * once, solved directly from its numbers: example 1's drift (0.06) must
 * stay under the 1.65 cutoff (`0.06 / sqrt(V) <= 1.65` => `V >= 0.00132`);
 * example 2's sustained flip (delta 0.38) must read "around 9.5"
 * (`0.38 / sqrt(V) ~= 9.5` => `V ~= 0.0016`). 0.0016 satisfies both
 * (`0.06/sqrt(0.0016) = 1.5`, under the cutoff; `0.38/sqrt(0.0016) = 9.5`,
 * exactly matching). A first pass used 0.001 without solving for both
 * examples simultaneously — reviewer caught that it satisfied only example
 * 2, and a dynamic `applyEwmaAnswer` simulation of example 1 (an axis that
 * genuinely re-settles after drifting) crossed the cutoff at 0.001, which
 * the plan explicitly says should never happen.
 */
import { effectiveStability, trackFor, type TraitTrack } from '@/lib/trait-stability';
import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';

export const RCI_RELIABLE_CHANGE_THRESHOLD = 1.65;
export const RCI_MIN_VARIANCE = 0.0016;

export interface AxisSnapshot {
  value: number;
  stability: number;
}

/** Value + stability per axis at the moment of the last roll (§7's snapshot storage). */
export type TraitSnapshot = Partial<Record<TraitAxis, AxisSnapshot>>;

function standardErrorFor(stability: number): number {
  const priorVariance = Math.max(RCI_MIN_VARIANCE, 1 - stability);
  return Math.sqrt(priorVariance);
}

/**
 * RCI for one axis. `currentStability` should be `effectiveStability`
 * (decay-aware), not the raw stored field, so a since-decayed axis reads as
 * less confident here too — consistent with how confidence is read
 * everywhere else in this codebase (Legends, Sage Title, Explore all read
 * `effectiveStability` the same way). This carries one known, ACCEPTED
 * consequence rather than a bug: `effectiveStability` decays only at READ
 * time, so an axis that's been idle long enough to decay, then answered
 * once, jumps back to its raw stored stability immediately — which can move
 * RCI from below the cutoff to above it without the trait VALUE itself
 * having moved much. This is the same "decay resets on next answer"
 * property `effectiveStability` already has everywhere else it's used;
 * special-casing RCI to ignore it would make RCI inconsistent with how
 * confidence reads everywhere else in the app, a larger change than this
 * phase's scope.
 */
export function reliableChangeIndex(
  currentValue: number,
  snapshotValue: number,
  currentStability: number,
): number {
  return (currentValue - snapshotValue) / standardErrorFor(currentStability);
}

export function isReliableChange(rci: number): boolean {
  return Math.abs(rci) > RCI_RELIABLE_CHANGE_THRESHOLD;
}

/**
 * A snapshot of every currently-answered axis's value + stability, for
 * storing at roll time. `stability` is captured per §5's spec ("a stored
 * snapshot of each axis's value and stability") but deliberately NOT read
 * back by `reliableChangeIndex`/`hasReliableChange` below — the plan is
 * explicit that standard_error derives from CURRENT stability, not the
 * snapshot's — so it exists for future display/debugging use, not as an
 * RCI input.
 */
export function snapshotFromTracks(tracks: readonly TraitTrack[], now: Date = new Date()): TraitSnapshot {
  const out: TraitSnapshot = {};
  for (const axis of TRAIT_AXES) {
    const row = trackFor(tracks, axis, 'report');
    if (!row) continue;
    out[axis] = { value: row.value, stability: effectiveStability(row, now) };
  }
  return out;
}

/**
 * True once ANY axis has reliably changed since `snapshot` — the roll
 * re-trigger condition (§7's `try_roll`). An axis missing from `snapshot`
 * (answered for the first time since the last roll) has nothing to compare
 * against yet and is skipped, not treated as a change.
 */
export function hasReliableChange(
  tracks: readonly TraitTrack[],
  snapshot: TraitSnapshot,
  now: Date = new Date(),
): boolean {
  for (const axis of TRAIT_AXES) {
    const snap = snapshot[axis];
    if (!snap) continue;
    const row = trackFor(tracks, axis, 'report');
    if (!row) continue;
    const rci = reliableChangeIndex(row.value, snap.value, effectiveStability(row, now));
    if (isReliableChange(rci)) return true;
  }
  return false;
}
