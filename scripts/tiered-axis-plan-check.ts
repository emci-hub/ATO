/**
 * Tiered axis-priority allocation (§2 of the trait-system redesign plan).
 * Run: npm run check:tiered-axis-plan
 */
import assert from 'node:assert/strict';

import { AXIS_TIER_COUNTS, TIERED_ROUND_SIZE, tieredAxisCounts } from '../src/lib/questions/tiered-axis-plan';
import { TRAIT_AXES } from '../src/lib/traits';

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

console.log(`\n${passed} tiered-axis-plan checks passed`);
