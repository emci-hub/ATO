/**
 * Frozen 50-question intake coverage (trait-system redesign §3). Run: npm run check:frozen-intake
 *
 * A required, not optional, gate per the plan: fails on purpose if TRAIT_AXES
 * ever grows (a 17th axis) without regenerating this frozen set.
 */
import assert from 'node:assert/strict';

import { QUESTIONS_BANK } from '../src/lib/questions/bank';
import { AXIS_TIER_COUNTS, TIERED_ROUND_SIZE } from '../src/lib/questions/tiered-axis-plan';
import { TRAIT_AXES } from '../src/lib/traits';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

assert.equal(QUESTIONS_BANK.length, TIERED_ROUND_SIZE * 2, 'frozen intake is 2 tiered rounds worth of questions (50)');
ok('frozen intake totals 50 questions (2 x 25-question tiered rounds)');

const perAxis = new Map<string, number>();
for (const row of QUESTIONS_BANK) perAxis.set(row.axis, (perAxis.get(row.axis) ?? 0) + 1);

for (const axis of TRAIT_AXES) {
  assert.ok(perAxis.has(axis), `frozen intake missing coverage for ${axis}`);
  assert.equal(
    perAxis.get(axis),
    AXIS_TIER_COUNTS[axis] * 2,
    `${axis} should have exactly ${AXIS_TIER_COUNTS[axis] * 2} frozen questions (its tier count x 2 rounds)`,
  );
}
assert.equal(perAxis.size, TRAIT_AXES.length, 'no stray axes in the frozen intake beyond TRAIT_AXES');
ok('every currently-defined axis is covered at exactly its tiered count x2 — this check fails on purpose if TRAIT_AXES grows without regenerating the intake');

console.log(`\n${passed} frozen-intake checks passed`);
