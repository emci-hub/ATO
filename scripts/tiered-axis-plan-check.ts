/**
 * Tiered axis-priority allocation (§2 of the trait-system redesign plan).
 * Run: npm run check:tiered-axis-plan
 */
import assert from 'node:assert/strict';

import { AXIS_TIER_COUNTS, TIERED_ROUND_SIZE, roundAxisCounts, tieredAxisCounts } from '../src/lib/questions/tiered-axis-plan';
import { STABILITY_FLOOR_N, type TraitTrack } from '../src/lib/trait-stability';
import { TRAIT_AXES, type TraitAxis } from '../src/lib/traits';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

assert.equal(TIERED_ROUND_SIZE, 25, 'a tiered round is 25 questions (§2: 6 + 3 + 6 + 10)');
ok('TIERED_ROUND_SIZE is 25');

for (const axis of TRAIT_AXES) {
  assert.ok(axis in AXIS_TIER_COUNTS, `AXIS_TIER_COUNTS missing coverage for ${axis}`);
}
assert.equal(Object.keys(AXIS_TIER_COUNTS).length, TRAIT_AXES.length, 'no stray axes beyond TRAIT_AXES');
ok('every currently-defined axis has a tier count, and only those axes');

const TIER_1 = ['conscientiousness', 'extraversion'] as const;
const TIER_2 = ['openness'] as const;
const TIER_3 = ['agreeableness', 'conflict_assertiveness', 'relatedness'] as const;
const TIER_4 = TRAIT_AXES.filter(
  (axis) => !([...TIER_1, ...TIER_2, ...TIER_3] as readonly string[]).includes(axis),
);

for (const axis of TIER_1) assert.equal(AXIS_TIER_COUNTS[axis], 3, `${axis} (tier 1) should be 3`);
for (const axis of TIER_2) assert.equal(AXIS_TIER_COUNTS[axis], 3, `${axis} (tier 2) should be 3`);
for (const axis of TIER_3) assert.equal(AXIS_TIER_COUNTS[axis], 2, `${axis} (tier 3) should be 2`);
for (const axis of TIER_4) assert.equal(AXIS_TIER_COUNTS[axis], 1, `${axis} (tier 4) should be 1`);
assert.equal(TIER_4.length, 10, 'tier 4 has exactly 10 axes');
ok('tier-by-tier counts match §2 exactly: 2x3 + 1x3 + 3x2 + 10x1 = 25');

const counts = tieredAxisCounts();
assert.deepEqual(counts, AXIS_TIER_COUNTS, 'tieredAxisCounts() returns the same values as AXIS_TIER_COUNTS');
(counts as Record<string, number>).openness = 999;
assert.notEqual(AXIS_TIER_COUNTS.openness, 999, 'tieredAxisCounts() returns a fresh copy, not a live reference');
ok('tieredAxisCounts() returns a fresh, mutation-safe copy');

// --- roundAxisCounts: lagging axes first (2026-10-01) ---
// The frozen intake leaves each axis on AXIS_TIER_COUNTS x2 answers: 6/6/6,
// 4/4/4 and ten axes on 2 — one short of the 3-answer floor, with no third
// bank question for any of them. The first round is what settles them.
const trackAt = (axis: TraitAxis, answerCount: number): TraitTrack => ({
  axis,
  track: 'report',
  value: 0.5,
  stability: 0,
  answerCount,
  lastTouched: '2026-10-01T00:00:00.000Z',
  lastDepthAt: null,
});
const afterIntake = TRAIT_AXES.map((axis) => trackAt(axis, AXIS_TIER_COUNTS[axis] * 2));
const roundOne = roundAxisCounts(afterIntake);
const total = (counts: Partial<Record<TraitAxis, number>>) =>
  Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0);

assert.equal(total(roundOne), TIERED_ROUND_SIZE, 'round 1 is still exactly 25 questions');
for (const axis of TIER_4) {
  assert.equal(roundOne[axis], 2, `${axis} (2 intake answers) gets 2 in round 1`);
  assert.ok(AXIS_TIER_COUNTS[axis] * 2 + (roundOne[axis] ?? 0) >= STABILITY_FLOOR_N, `${axis} reaches the floor in round 1`);
}
assert.equal(
  [...TIER_1, ...TIER_2, ...TIER_3].reduce((sum, axis) => sum + (roundOne[axis] ?? 0), 0),
  5,
  'the six axes already past the floor share the remaining 5 (the fixed plan gave them 15)',
);
assert.deepEqual(
  Object.keys(roundOne).slice(0, TIER_4.length),
  [...TIER_4],
  'lagging axes come first in key order, so they are served first',
);
assert.ok(Object.values(roundOne).every((n) => (n ?? 0) > 0), 'an axis with nothing this round is left out, not listed at 0');
ok('roundAxisCounts after the 50: ten lagging axes get 2 each and come first, the other six share 5, total 25');

const everyAxisAtFloor = TRAIT_AXES.map((axis) => trackAt(axis, STABILITY_FLOOR_N));
assert.deepEqual(roundAxisCounts(everyAxisAtFloor), AXIS_TIER_COUNTS, 'at the floor everywhere, a round is the plain tiered plan');
assert.deepEqual(roundAxisCounts(TRAIT_AXES.map((axis) => trackAt(axis, 9))), AXIS_TIER_COUNTS);
ok('roundAxisCounts falls back to the tiered plan once every axis has 3 answers');

// More gap than one round can close (no answers at all): still exactly 25,
// spread least-answered first, never more than the floor on one axis.
const fromNothing = roundAxisCounts([]);
assert.equal(total(fromNothing), TIERED_ROUND_SIZE);
assert.ok(Object.values(fromNothing).every((n) => (n ?? 0) <= STABILITY_FLOOR_N));
assert.equal(Object.keys(fromNothing).length, TRAIT_AXES.length, 'every axis gets at least one before any gets a second');
// A game-track row is not a report answer and must not hide a lagging axis.
const gameOnly = everyAxisAtFloor.map((row) => (row.axis === 'playfulness' ? { ...row, track: 'game' as const } : row));
assert.equal(Object.keys(roundAxisCounts(gameOnly))[0], 'playfulness', 'an axis with only game-track answers is lagging, and first');
ok('roundAxisCounts handles a gap bigger than a round, and ignores the game track');

console.log(`\n${passed} tiered-axis-plan checks passed`);
