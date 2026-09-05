/**
 * Inconsistent-answerer floor on effectiveStability. Run: npm run check:trait-stability
 *
 * An axis where every answer disagrees with the running EWMA by >= 0.5 holds
 * `stability` at exactly 0 forever (0 is a fixed point of the EWMA recurrence
 * at zero agreement) — effectiveStability floors that case once answerCount
 * reaches STABILITY_FLOOR_OVERRIDE_N, so the axis can eventually settle.
 */
import assert from 'node:assert/strict';

import {
  STABILITY_FLOOR_N,
  STABILITY_FLOOR_OVERRIDE_N,
  STABILITY_INCONSISTENT_FLOOR,
  applyEwmaAnswer,
  directEvidenceCountFor,
  effectiveStability,
  isInconsistentAnswerer,
  isProfileSettled,
  nudgedSecondaryValue,
  totalEvidenceCountFor,
  trackFor,
  type TraitTrack,
} from '../src/lib/trait-stability';
import { contradictedAxesFrom, hasContradictedAnswers } from '../src/lib/trait-history';
import { TRAIT_AXES } from '../src/lib/traits';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const NOW = new Date('2026-09-04T12:00:00.000Z');

function answerMany(signals: number[]): TraitTrack | null {
  let row: TraitTrack | null = null;
  for (const signal of signals) {
    row = applyEwmaAnswer(row, 'openness', 'report', signal, NOW.toISOString());
  }
  return row;
}

/**
 * The worst-case adversarial answerer: each new answer is whichever extreme
 * (0 or 1) is furthest from the *current* EWMA value. Since
 * max(v, 1-v) >= 0.5 for every v in [0,1], this guarantees delta >= 0.5 (so
 * agreement, and therefore the stability update, is exactly 0) on every
 * single step, by construction — unlike a fixed alternating pattern (e.g.
 * 0.9/0.1), whose delta shrinks below 0.5 once the EWMA value converges
 * toward the middle and would eventually clear the gate on its own.
 */
function answerAdversarially(count: number): TraitTrack | null {
  let row: TraitTrack | null = null;
  for (let i = 0; i < count; i += 1) {
    const current = row?.value ?? 0;
    const signal = current <= 0.5 ? 1 : 0;
    row = applyEwmaAnswer(row, 'openness', 'report', signal, NOW.toISOString());
  }
  return row;
}

// Scenario A — consistent answerer: settles normally by answerCount 3, floor
// threshold is well above STABILITY_FLOOR_N so it never engages here.
assert.ok(STABILITY_FLOOR_OVERRIDE_N > STABILITY_FLOOR_N);
const consistent = answerMany([0.8, 0.75, 0.82]);
assert.equal(consistent?.answerCount, 3);
assert.ok(effectiveStability(consistent, NOW) > 0);
ok('consistent answers settle by answerCount 3, unaffected by the floor');

// Scenario C — the trap: every sample flips >= 0.5 away from the running
// EWMA, so agreement is 0 every time and raw stability is stuck at exactly 0
// no matter how many times the axis is answered.
const trapped = answerAdversarially(STABILITY_FLOOR_OVERRIDE_N - 1);
assert.equal(trapped?.answerCount, STABILITY_FLOOR_OVERRIDE_N - 1);
assert.equal(trapped?.stability, 0, 'raw stability stays at exactly 0 under maximal disagreement');
assert.equal(effectiveStability(trapped, NOW), 0, 'below the override threshold, still locked');
ok('inconsistent answers under the override threshold stay locked (no floor yet)');

const trappedAtFloor = answerAdversarially(STABILITY_FLOOR_OVERRIDE_N);
assert.equal(trappedAtFloor?.answerCount, STABILITY_FLOOR_OVERRIDE_N);
assert.equal(trappedAtFloor?.stability, 0);
assert.equal(
  effectiveStability(trappedAtFloor, NOW),
  STABILITY_INCONSISTENT_FLOOR,
  'answerCount reaching the override floors effectiveStability instead of returning raw 0',
);
ok(`axis settles once answerCount reaches STABILITY_FLOOR_OVERRIDE_N (${STABILITY_FLOOR_OVERRIDE_N})`);

// The floor must never write back into the stored row — only the read-side
// effectiveStability computation changes. Decay math and future EWMA updates
// must operate on the real (still-zero) stored stability.
assert.equal(trappedAtFloor?.stability, 0, 'stored stability is untouched by the floor');
ok('floor is read-side only; stored stability/EWMA math is unmodified');

// isProfileSettled: every other axis instantly settled (3 consistent
// answers), the trapped axis only clears the gate once it reaches the floor.
function otherRows(): TraitTrack[] {
  return TRAIT_AXES.filter((axis) => axis !== 'openness').map((axis) => ({
    axis,
    track: 'report' as const,
    value: 0.5,
    stability: 0.5,
    answerCount: 3,
    lastTouched: NOW.toISOString(),
    lastDepthAt: null,
  }));
}
const beforeFloor = [...otherRows(), trapped!];
assert.equal(isProfileSettled(beforeFloor, NOW), false, 'trapped axis blocks the whole profile');
const afterFloor = [...otherRows(), trappedAtFloor!];
assert.equal(isProfileSettled(afterFloor, NOW), true, 'floor unblocks the whole profile once reached');
ok('isProfileSettled unblocks once the trapped axis clears the floor, and only then');

// Game track never counts, floor included — same rule as before the change.
const gameOnly = trackFor(
  [{ ...trappedAtFloor!, track: 'game' }],
  'openness',
  'report',
);
assert.equal(gameOnly, null);
ok('game track is still excluded from effectiveStability lookups, floor included');

// Phase 4 — secondary-axis evidence must never move stability/answerCount,
// so effectiveStability/isProfileSettled cannot be influenced by it.
assert.equal(nudgedSecondaryValue(null, 0.8, 0.35), 0.8, 'no current value: nudge is the raw signal');
assert.equal(nudgedSecondaryValue(0.5, 0.8, 1), 0.8, 'weight 1 behaves like a full pull toward signal');
assert.equal(nudgedSecondaryValue(0.5, 0.8, 0), 0.5, 'weight 0 leaves the value untouched');
const halfPull = nudgedSecondaryValue(0.5, 0.8, 0.5);
assert.ok(halfPull > 0.5 && halfPull < 0.8, 'weight 0.5 is a partial pull, strictly between current and signal');
ok('nudgedSecondaryValue: pure weight-scaled pull, matches weight 0/0.5/1 boundary cases');

// Genuinely settled (not floor-blocked on both sides trivially) so the
// before/after comparison actually proves something.
const alreadySettled: TraitTrack = {
  axis: 'openness',
  track: 'report',
  value: 0.5,
  stability: 0.9,
  answerCount: STABILITY_FLOOR_N,
  lastTouched: NOW.toISOString(),
  lastDepthAt: null,
};
const beforeSecondary = [...otherRows(), alreadySettled];
assert.equal(isProfileSettled(beforeSecondary, NOW), true, 'sanity: axis is genuinely settled before the secondary write');
const stabilityBefore = effectiveStability(alreadySettled, NOW);
const nudged = nudgedSecondaryValue(alreadySettled.value, 0.9, 0.35);
const afterSecondary: TraitTrack = { ...alreadySettled, value: nudged };
assert.notEqual(afterSecondary.value, alreadySettled.value, 'value actually moved');
assert.equal(afterSecondary.stability, alreadySettled.stability, 'stability untouched by a secondary-only write');
assert.equal(afterSecondary.answerCount, alreadySettled.answerCount, 'answerCount untouched by a secondary-only write');
assert.equal(
  effectiveStability(afterSecondary, NOW),
  stabilityBefore,
  'effectiveStability reads numerically identical before/after a secondary-only value nudge',
);
const afterRows = [...otherRows(), afterSecondary];
assert.equal(
  isProfileSettled(afterRows, NOW),
  true,
  'isProfileSettled stays true (unaffected) after a secondary-only value nudge',
);
ok('secondary-axis evidence moves value but cannot move stability/answerCount/effectiveStability/isProfileSettled');

assert.equal(directEvidenceCountFor(alreadySettled), alreadySettled.answerCount, 'directEvidenceCountFor defaults to answerCount');
assert.equal(totalEvidenceCountFor(alreadySettled), alreadySettled.answerCount, 'totalEvidenceCountFor defaults to answerCount too — equal until Phase 4 content actually differentiates them');
ok('directEvidenceCountFor/totalEvidenceCountFor both default to answerCount, unchanged behavior');

// --- Phase 6, T-01: isInconsistentAnswerer tells the trap apart from natural decay ---
const genuinelyFloored: TraitTrack = {
  axis: 'openness',
  track: 'report',
  value: 0.5,
  stability: 0, // worst-case: every answer disagreed, agreement pinned at 0
  answerCount: STABILITY_FLOOR_OVERRIDE_N,
  lastTouched: NOW.toISOString(), // no decay involved at all
  lastDepthAt: null,
};
const naturallyDecayed: TraitTrack = {
  axis: 'openness',
  track: 'report',
  value: 0.5,
  stability: 0.8, // built from a genuinely consistent answering history
  answerCount: STABILITY_FLOOR_OVERRIDE_N,
  lastTouched: new Date(NOW.getTime() - 500 * 86_400_000).toISOString(), // 500 idle days
  lastDepthAt: null,
};
assert.equal(
  effectiveStability(genuinelyFloored, NOW),
  effectiveStability(naturallyDecayed, NOW),
  'sanity: both fixtures read the SAME effectiveStability (both floor to STABILITY_INCONSISTENT_FLOOR)',
);
assert.equal(isInconsistentAnswerer(genuinelyFloored), true, 'genuinely inconsistent answering reads true');
assert.equal(isInconsistentAnswerer(naturallyDecayed), false, 'a naturally-decayed-but-consistent axis reads false, even though effectiveStability floors it too');
assert.equal(
  isInconsistentAnswerer({ ...genuinelyFloored, answerCount: STABILITY_FLOOR_OVERRIDE_N - 1 }),
  false,
  'below the override threshold, isInconsistentAnswerer is always false regardless of stability',
);
ok('isInconsistentAnswerer distinguishes the trap from natural decay, even when effectiveStability reads identically');

// --- Phase 6, T-02: hasContradictedAnswers reads raw evidenceHistory ------
const t0 = NOW.toISOString();
const tOld = new Date(NOW.getTime() - 500 * 86_400_000).toISOString();
const tMid = new Date(NOW.getTime() - 250 * 86_400_000).toISOString();
assert.equal(hasContradictedAnswers([]), false, 'zero entries (normal unanswered) never reads contradicted');
assert.equal(
  hasContradictedAnswers([{ value: 0.8, source: 'self_situation', createdAt: t0 }]),
  false,
  'a single entry never reads contradicted',
);
assert.equal(
  hasContradictedAnswers([
    { value: 0.8, source: 'self_situation', createdAt: tOld },
    { value: 0.75, source: 'self_situation', createdAt: tMid },
    { value: 0.7, source: 'self_situation', createdAt: t0 },
  ]),
  false,
  'gradual drift (small consecutive deltas) does not read as contradiction',
);
assert.equal(
  hasContradictedAnswers([
    { value: 0.9, source: 'self_situation', createdAt: tOld },
    { value: 0.1, source: 'self_situation', createdAt: t0 },
  ]),
  true,
  'a genuine swing between consecutive answers reads as contradiction',
);
assert.equal(
  hasContradictedAnswers([
    // Deliberately out of chronological order — the function must sort
    // defensively rather than trust caller order.
    { value: 0.1, source: 'self_situation', createdAt: t0 },
    { value: 0.9, source: 'self_situation', createdAt: tOld },
  ]),
  true,
  'out-of-order input is sorted defensively before detecting a swing',
);
assert.equal(
  hasContradictedAnswers([
    { value: 0.5, source: 'self_situation', createdAt: tOld },
    { value: 0.52, source: 'self_situation', createdAt: t0 },
  ]),
  false,
  'an old-but-internally-consistent axis (large time gap, small value gap) is never a false positive — orthogonal to decay',
);
// Boundary: delta === threshold exactly (0.9 - 0.4 subtracts cleanly to 0.5
// in IEEE-754) must read as contradicted, matching the >= in the function.
assert.equal(
  hasContradictedAnswers([
    { value: 0.9, source: 'self_situation', createdAt: tOld },
    { value: 0.4, source: 'self_situation', createdAt: t0 },
  ]),
  true,
  'a delta exactly at the threshold reads as contradicted (>=, not >)',
);
// An unparseable createdAt is dropped rather than crashing or misordering —
// only 2 valid entries remain here, with no swing between them.
assert.equal(
  hasContradictedAnswers([
    { value: 0.9, source: 'self_situation', createdAt: 'not-a-date' },
    { value: 0.5, source: 'self_situation', createdAt: tOld },
    { value: 0.52, source: 'self_situation', createdAt: t0 },
  ]),
  false,
  'an entry with an unparseable createdAt is dropped rather than corrupting the sort',
);
ok('hasContradictedAnswers detects genuine same-axis swings, ignores drift/single-answer/old-but-consistent/malformed-date cases');

// --- Phase 6, T-04: contradictedAxesFrom (the real trait_history consumer) ---
const t04History = [
  // openness: genuine report-track swing.
  { id: 'h1', axis: 'openness' as const, value: 0.9, source: 'self_situation' as const, createdAt: tOld },
  { id: 'h2', axis: 'openness' as const, value: 0.1, source: 'self_situation' as const, createdAt: t0 },
  // conscientiousness: report-track drift only, never contradicted.
  { id: 'h3', axis: 'conscientiousness' as const, value: 0.6, source: 'self_situation' as const, createdAt: tOld },
  { id: 'h4', axis: 'conscientiousness' as const, value: 0.65, source: 'self_situation' as const, createdAt: t0 },
  // extraversion: two CONSISTENT report-track answers with a self_game
  // outlier sandwiched between them. If the report-track filter were
  // accidentally dropped, this WOULD flag (0.9 -> 0.1 -> 0.92 swings past
  // threshold against the outlier); with the filter correctly applied, only
  // the two consistent report rows remain (delta 0.02) — not a case the
  // threshold alone would have excluded, so this genuinely exercises the
  // filter rather than coincidentally passing either way.
  { id: 'h5', axis: 'extraversion' as const, value: 0.9, source: 'self_situation' as const, createdAt: tOld },
  { id: 'h6', axis: 'extraversion' as const, value: 0.1, source: 'self_game' as const, createdAt: tMid },
  { id: 'h7', axis: 'extraversion' as const, value: 0.92, source: 'self_situation' as const, createdAt: t0 },
];
assert.deepEqual(
  contradictedAxesFrom(t04History),
  ['openness'],
  'contradictedAxesFrom flags only the genuinely swinging report-track axis, in TRAIT_AXES order, correctly excluding a self_game outlier that would otherwise create a false-positive swing',
);
assert.deepEqual(contradictedAxesFrom([]), [], 'no history at all yields no contradicted axes');
ok('contradictedAxesFrom (T-04) correctly wires hasContradictedAnswers to real trait_history rows, report-track only');

console.log(`\n${passed} trait-stability floor checks passed`);
