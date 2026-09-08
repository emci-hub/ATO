/**
 * RCI — the re-roll trigger (trait-system redesign §5). Run: npm run check:rci
 */
import assert from 'node:assert/strict';

import { KALMAN_MIN_VARIANCE, applyEwmaAnswer } from '../src/lib/trait-stability';
import {
  RCI_MIN_VARIANCE,
  RCI_RELIABLE_CHANGE_THRESHOLD,
  hasReliableChange,
  isReliableChange,
  reliableChangeIndex,
  snapshotFromTracks,
  type TraitSnapshot,
} from '../src/lib/rci';
import type { TraitTrack } from '../src/lib/trait-stability';
import { TRAIT_AXES } from '../src/lib/traits';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const NOW = new Date('2026-09-08T12:00:00.000Z');

assert.equal(RCI_RELIABLE_CHANGE_THRESHOLD, 1.65, 'the plan\'s standard clinical cutoff');
assert.notEqual(
  RCI_MIN_VARIANCE,
  KALMAN_MIN_VARIANCE,
  'RCI must use its own variance floor, not reuse the Kalman value-update floor — they protect against different failures',
);
ok('RCI constants are correct and deliberately decoupled from the Kalman value-update floor');

// --- §5 worked example 1: normal day-to-day fluctuation should NOT trigger ---
{
  const rciAtStability = (stability: number) => reliableChangeIndex(0.78, 0.72, stability);
  assert.ok(isReliableChange(rciAtStability(0.8)) === false, 'small drift at stability 0.8 must not trigger');
  assert.ok(isReliableChange(rciAtStability(0.95)) === false, 'small drift even at very high stability must not trigger');
  ok('worked example 1: small drift (0.72 -> 0.78) while stability stays high never crosses the cutoff');
}

{
  // Dynamic simulation, not just two hand-picked stability points: a real
  // drift-then-RE-SETTLE sequence (0.72 -> 0.75 -> 0.78, then many more
  // consistent 0.78 answers pushing stability toward its realistic
  // ceiling) must never cross the cutoff at ANY point along the way. This
  // is exactly the case a first floor guess (0.001) failed on — it
  // satisfied worked example 2 in isolation but let THIS trajectory cross
  // 1.65 once stability climbed high enough that the floor dominated.
  // Repeated-but-not-identical answers converge to the asymptotic ceiling
  // slowly (residual Kalman-smoothing gap keeps agreement just under 1 at
  // every step) — probed empirically at ~300 answers to actually enter the
  // floor-dominated regime (stability > 0.999), not guessed.
  const snapshotValue = 0.72;
  const answers = [0.72, 0.75, 0.78, ...Array(300).fill(0.78)];
  let row: TraitTrack | null = null;
  let maxAbsRci = 0;
  for (const signal of answers) {
    row = applyEwmaAnswer(row, 'openness', 'report', signal, NOW.toISOString());
    const rci = reliableChangeIndex(row.value, snapshotValue, row.stability);
    maxAbsRci = Math.max(maxAbsRci, Math.abs(rci));
    assert.ok(
      !isReliableChange(rci),
      `drift-then-resettle must never trigger, even at very high stability (value=${row.value.toFixed(4)}, stability=${row.stability.toFixed(4)}, RCI=${rci.toFixed(4)})`,
    );
  }
  assert.ok(row!.stability > 0.999, 'the simulation must actually reach the floor-dominated regime, or this proves nothing about it');
  // The asymptotic ceiling for this exact scenario is RCI=1.5 (delta 0.06 /
  // sqrt(RCI_MIN_VARIANCE)=0.04) — pin it, not just "under the cutoff", so a
  // future floor change that silently erodes the margin gets caught here.
  assert.ok(maxAbsRci > 1.4 && maxAbsRci < 1.65, `max |RCI| should converge near the known asymptote of 1.5, got ${maxAbsRci}`);
  ok(`worked example 1 (dynamic, full trajectory including the floor-dominated high-stability regime): never crosses the cutoff, max |RCI| seen = ${maxAbsRci.toFixed(3)} (asymptote 1.5)`);
}

// --- §5 worked example 2: a real, sustained change SHOULD trigger --------
{
  // A sustained flip needs high confidence to register as reliable — at a
  // merely "high" stability (0.95) it barely clears the cutoff (thin but
  // real margin); after many more consistent answers (stability -> ~0.998,
  // achievable over "weeks" of daily answering per the plan's own framing)
  // the margin becomes the plan's own described unambiguous ~9.5, not a
  // knife-edge crossing.
  const rci95 = reliableChangeIndex(0.68, 0.3, 0.95);
  assert.ok(isReliableChange(rci95), `at stability 0.95 the sustained flip must already trigger (got RCI=${rci95})`);

  const rciVeryHigh = reliableChangeIndex(0.68, 0.3, 0.998);
  assert.ok(rciVeryHigh > 8, `at very high stability RCI must be an unambiguous multiple of the cutoff, not a thin margin (got ${rciVeryHigh})`);
  assert.ok(isReliableChange(rciVeryHigh));
  ok('worked example 2: a sustained flip (0.30 -> 0.68) at high stability triggers, and the margin grows unambiguous as more consistent answers accumulate — matches the plan\'s own ~9.5 framing');
}

// --- Realistic stability ceiling from repeated consistent answers --------
{
  // Confirms the "very high stability" branch above is actually reachable
  // through real applyEwmaAnswer calls, not just a hand-picked number.
  let row: TraitTrack | null = null;
  for (let i = 0; i < 20; i += 1) {
    row = applyEwmaAnswer(row, 'conflict_assertiveness', 'report', 0.68, NOW.toISOString());
  }
  assert.ok(row!.stability > 0.99, `20 consistent answers should push stability near its ceiling, got ${row!.stability}`);
  ok('a real applyEwmaAnswer sequence of consistent answers reaches the stability level RCI needs for an unambiguous signal');
}

// --- snapshotFromTracks / hasReliableChange wiring ------------------------
function trackAt(stability: number, value: number, answerCount = 5): TraitTrack {
  return { axis: 'openness', track: 'report', value, stability, answerCount, lastTouched: NOW.toISOString(), lastDepthAt: null };
}

{
  const before = [trackAt(0.9, 0.3)];
  const snapshot = snapshotFromTracks(before, NOW);
  assert.equal(snapshot.openness?.value, 0.3);
  assert.ok(snapshot.openness!.stability > 0);
  assert.equal(Object.keys(snapshot).length, 1, 'only axes with a report track are snapshotted');
  ok('snapshotFromTracks captures value + effectiveStability per answered axis, nothing for unanswered ones');
}

{
  const snapshot: TraitSnapshot = { openness: { value: 0.3, stability: 0.9 } };
  const unchanged = [trackAt(0.9, 0.31)];
  assert.equal(hasReliableChange(unchanged, snapshot, NOW), false, 'a tiny move must not trigger a re-roll');

  const changed = [trackAt(0.998, 0.68)];
  assert.equal(hasReliableChange(changed, snapshot, NOW), true, 'a real sustained flip must trigger a re-roll');

  const noSnapshotYet: TraitSnapshot = {};
  assert.equal(hasReliableChange(changed, noSnapshotYet, NOW), false, 'an axis with no snapshot yet has nothing to compare against — never a false trigger');
  ok('hasReliableChange: no false trigger on drift, true trigger on a real sustained change, safe with an empty/partial snapshot');
}

{
  // hasReliableChange must check every axis, not just the first.
  const snapshot: TraitSnapshot = Object.fromEntries(TRAIT_AXES.map((axis) => [axis, { value: 0.5, stability: 0.9 }])) as TraitSnapshot;
  const onlyLastAxisChanged: TraitTrack[] = TRAIT_AXES.map((axis) => ({
    axis,
    track: 'report',
    value: 0.5,
    stability: 0.9,
    answerCount: 5,
    lastTouched: NOW.toISOString(),
    lastDepthAt: null,
  }));
  onlyLastAxisChanged[onlyLastAxisChanged.length - 1] = { ...onlyLastAxisChanged[onlyLastAxisChanged.length - 1]!, value: 0.68, stability: 0.998 };
  assert.equal(hasReliableChange(onlyLastAxisChanged, snapshot, NOW), true, 'a change on the LAST axis checked must still be found');
  ok('hasReliableChange scans every axis, not just the first');
}

// --- Additional coverage: negative RCI, exact boundary, decay, game track --
{
  // A DECREASE must trigger just as readily as an increase — isReliableChange
  // takes Math.abs, so the sign of the move must not matter.
  const decreaseRci = reliableChangeIndex(0.3, 0.68, 0.998);
  assert.ok(decreaseRci < 0, 'a decrease produces a negative RCI');
  assert.ok(isReliableChange(decreaseRci), 'a large negative RCI must still count as a reliable change');
  ok('isReliableChange triggers on a large DECREASE too, not just an increase (Math.abs, not a signed comparison)');
}

{
  // Exact boundary: the plan specifies |RCI| > 1.65 (strict), not >=.
  assert.equal(isReliableChange(1.65), false, 'exactly at the cutoff must NOT trigger — the plan specifies strict >');
  assert.equal(isReliableChange(-1.65), false, 'exactly at the cutoff (negative) must NOT trigger either');
  assert.equal(isReliableChange(1.6500001), true, 'a hair past the cutoff must trigger');
  ok('isReliableChange uses a strict > cutoff, matching the plan exactly at the 1.65 boundary');
}

{
  // A decayed-but-consistent axis reads as LESS confident (wider standard
  // error) than the SAME raw stability read fresh — decay must actually
  // reach reliableChangeIndex through effectiveStability, not just exist as
  // an unused parameter. Same raw stability (0.95) and same delta (0.48),
  // only `lastTouched` differs.
  const snapshot: TraitSnapshot = { openness: { value: 0.3, stability: 0.95 } };
  const freshTrack: TraitTrack = { axis: 'openness', track: 'report', value: 0.78, stability: 0.95, answerCount: 5, lastTouched: NOW.toISOString(), lastDepthAt: null };
  const idleTrack: TraitTrack = { ...freshTrack, lastTouched: '2026-01-01T00:00:00.000Z' }; // ~250 idle days at NOW
  assert.equal(hasReliableChange([freshTrack], snapshot, NOW), true, 'fresh stability 0.95 at this delta must trigger');
  assert.equal(hasReliableChange([idleTrack], snapshot, NOW), false, 'the SAME raw stability, decayed from 250 idle days, must NOT trigger — decay genuinely reaches the RCI calculation');
  ok('decayed stability (idle since 2026-01-01, read at NOW) reaches reliableChangeIndex through effectiveStability, not the raw stored field — same raw stability triggers fresh, does not decayed');
}

{
  // The game track (gut-call) must never be read for RCI, same rule as
  // everywhere else in this codebase — trackFor(..., 'report') already
  // enforces this, but RCI-specific coverage catches a regression here too.
  const gameOnlyTrack: TraitTrack = { axis: 'openness', track: 'game', value: 0.99, stability: 0.99, answerCount: 10, lastTouched: NOW.toISOString(), lastDepthAt: null };
  const snapshot: TraitSnapshot = { openness: { value: 0.3, stability: 0.9 } };
  assert.equal(hasReliableChange([gameOnlyTrack], snapshot, NOW), false, 'a game-track-only row must never be read for RCI, even with an extreme value that would obviously trigger if it were report-track');
  ok('hasReliableChange never reads the game track, even when it would otherwise obviously trigger');
}

console.log(`\n${passed} RCI checks passed`);
