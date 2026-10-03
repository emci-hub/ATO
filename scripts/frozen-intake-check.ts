/**
 * The intake: 48 = exactly 3 per trait, asked as 3 sets of 16 (staged intake,
 * emci 2026-10-02). Run: npm run check:frozen-intake
 *
 * A required, not optional, gate: fails on purpose if TRAIT_AXES ever grows
 * (a 17th axis) without regenerating the intake. Also proves the move from
 * the tiered 50 lost nothing: every old intake question is either still in
 * the intake or in ROUND_ONLY_BANK, and the old per-trait shape is recorded
 * for the old-50 rule.
 */
import assert from 'node:assert/strict';

import {
  LEGACY_INTAKE_AXIS_COUNTS,
  LEGACY_INTAKE_PROMPTS,
  QUESTIONS_BANK,
  ROUND_ONLY_BANK,
} from '../src/lib/questions/bank';
import { INTAKE_SET_SIZE, INTAKE_SETS, INTAKE_TOTAL, LEGACY_INTAKE_TOTAL } from '../src/lib/questions/intake-stage';
import { questionDraftGuardHit } from '../src/lib/questions/guards';
import { STABILITY_FLOOR_N } from '../src/lib/trait-stability';
import { TRAIT_AXES } from '../src/lib/traits';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

assert.equal(INTAKE_SETS, STABILITY_FLOOR_N, 'three sets = the three answers a trait needs to settle');
assert.equal(INTAKE_SET_SIZE, TRAIT_AXES.length, 'a set is one question per trait');
assert.equal(INTAKE_TOTAL, 48);
assert.equal(QUESTIONS_BANK.length, INTAKE_TOTAL, 'the intake is 48 questions');
ok('the intake is 48: 3 sets of 16, three answers per trait');

const perAxis = new Map<string, number>();
for (const row of QUESTIONS_BANK) perAxis.set(row.axis, (perAxis.get(row.axis) ?? 0) + 1);
for (const axis of TRAIT_AXES) {
  assert.equal(perAxis.get(axis), INTAKE_SETS, `${axis} should have exactly ${INTAKE_SETS} intake questions`);
}
assert.equal(perAxis.size, TRAIT_AXES.length, 'no stray axes in the intake beyond TRAIT_AXES');
ok('every trait has exactly 3 — this check fails on purpose if TRAIT_AXES grows without regenerating the intake');

// Nothing deleted: every old intake question is still served somewhere.
assert.equal(LEGACY_INTAKE_PROMPTS.length, LEGACY_INTAKE_TOTAL);
assert.equal(LEGACY_INTAKE_TOTAL, 50);
const kept = new Set([...QUESTIONS_BANK, ...ROUND_ONLY_BANK].map((row) => row.prompt));
for (const row of LEGACY_INTAKE_PROMPTS) assert.ok(kept.has(row.prompt), `old intake question lost: ${row.prompt}`);
for (const axis of TRAIT_AXES) {
  assert.equal(
    LEGACY_INTAKE_PROMPTS.filter((row) => row.axis === axis).length,
    LEGACY_INTAKE_AXIS_COUNTS[axis],
    `${axis}: old prompt list matches the old count`,
  );
}
assert.equal(ROUND_ONLY_BANK.length, 12 + 10, 'the 12 moved extras + the 10 original wordings');
ok('nothing deleted: all 50 old intake questions are in the intake or ROUND_ONLY_BANK; the old shape is recorded');

// The first draft of every trait is unchanged from the old intake (the few-shot quotes).
for (const axis of TRAIT_AXES) {
  const first = QUESTIONS_BANK.find((row) => row.axis === axis)!;
  const oldFirst = LEGACY_INTAKE_PROMPTS.find((row) => row.axis === axis)!;
  assert.equal(first.prompt, oldFirst.prompt, `${axis}: first entry must not move`);
}
ok('every trait keeps its original first question');

// Every question measures something and clears the guard.
for (const row of [...QUESTIONS_BANK, ...ROUND_ONLY_BANK]) {
  assert.ok(row.options.length >= 2 && row.options.length <= 3, `2-3 options: ${row.prompt}`);
  assert.ok(new Set(row.options.map((opt) => opt.value)).size >= 2, `options must differ: ${row.prompt}`);
  for (const opt of row.options) assert.ok([0.2, 0.5, 0.8].includes(opt.value), `value on the 0.2/0.5/0.8 scale: ${row.prompt}`);
  assert.equal(questionDraftGuardHit(row), null, `guard hit: ${row.prompt}`);
}
ok('every intake and round-only question has 2-3 differing options on the 0.2/0.5/0.8 scale and clears the guard');

// The ten restored questions have a middle option (red-team: 2-option items are blunt).
const restoredAxes = TRAIT_AXES.filter((axis) => LEGACY_INTAKE_AXIS_COUNTS[axis] === 2);
assert.equal(restoredAxes.length, 10);
for (const axis of restoredAxes) {
  const third = QUESTIONS_BANK.filter((row) => row.axis === axis)[2]!;
  assert.equal(third.options.length, 3, `${axis}: restored third question has a middle option`);
  assert.ok(third.options.some((opt) => opt.value === 0.5), `${axis}: middle option is 0.5`);
}
ok('the ten restored third questions each have three options with a 0.5 middle');

console.log(`\n${passed} frozen-intake checks passed`);
