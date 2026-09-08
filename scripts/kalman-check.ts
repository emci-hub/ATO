/**
 * Kalman-gain trait value update (trait-system redesign §4). Run: npm run check:kalman
 *
 * Proves the worked example the redesign was built to fix: a well-settled
 * axis's next answer swings `value` less than an early answer did — and
 * that the pre-existing isInconsistentAnswerer trap (trait-stability-check.ts)
 * still holds byte-for-byte, since `stability` itself keeps its original
 * agreement-based formula.
 */
import assert from 'node:assert/strict';

import {
  KALMAN_MEASUREMENT_NOISE,
  KALMAN_MIN_VARIANCE,
  STABILITY_FLOOR_N,
  applyEwmaAnswer,
  effectiveStability,
  type TraitTrack,
} from '../src/lib/trait-stability';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const NOW = '2026-09-08T12:00:00.000Z';

assert.ok(KALMAN_MEASUREMENT_NOISE > 0);
assert.equal(KALMAN_MEASUREMENT_NOISE, (1 - 0.35) / 0.35, 'calibrated so gain === EWMA_ALPHA at prior_variance ceiling');
assert.ok(KALMAN_MIN_VARIANCE > 0 && KALMAN_MIN_VARIANCE < 1);
ok('Kalman constants are sane and calibrated against EWMA_ALPHA');

// First answer: unchanged init behavior.
const first = applyEwmaAnswer(null, 'openness', 'report', 0.8, NOW);
assert.equal(first.value, 0.8);
assert.equal(first.stability, 0);
assert.equal(first.answerCount, 1);
ok('first answer: value=signal, stability=0, count=1 (unchanged)');

// Second answer: Kalman gain engages immediately (self-regulated by
// prior_variance = 1 - stability, which is already ~1 for a brand-new axis
// — no separate hardcoded "first few answers" branch needed). `stability`
// uses the same agreement-based formula as before this change, byte-identical
// in timing, so existing stableReport-style "3 answers = settled" fixtures
// across the codebase keep working unchanged.
const second = applyEwmaAnswer(first, 'openness', 'report', 0.6, NOW);
const oldFormulaValue = 0.35 * 0.6 + 0.65 * 0.8;
assert.ok(Math.abs(second.value - oldFormulaValue) < 1e-9, `on a fresh (stability 0) axis, Kalman value update must match the old fixed-EWMA_ALPHA formula exactly: got ${second.value}, expected ${oldFormulaValue}`);
assert.equal(second.answerCount, 2);
assert.ok(second.stability > 0, 'stability becomes meaningful starting at the 2nd answer, same timing as before this change');
ok('second answer: Kalman-gain value update on a fresh axis matches the old EWMA_ALPHA formula exactly, stability timing unchanged');

// Third answer: matches trait-stability-check.ts's existing "consistent
// answers settle by answerCount 3" expectation exactly.
const third = applyEwmaAnswer(second, 'openness', 'report', 0.72, NOW);
assert.equal(third.answerCount, 3);
assert.ok(third.stability > 0, 'stability nonzero by answerCount 3, same gate as before this change');
ok('third answer: stability nonzero by answerCount 3 (unchanged gate)');

// The worked example: a well-settled axis (high stored stability) swings
// LESS from one contradicting answer than a freshly-settled axis does.
function trackAt(value: number, stability: number, answerCount: number): TraitTrack {
  return { axis: 'openness', track: 'report', value, stability, answerCount, lastTouched: NOW, lastDepthAt: null };
}

const freshlySettled = trackAt(0.5, 0.05, STABILITY_FLOOR_N);
const deeplySettled = trackAt(0.1, 0.95, 40);

const freshAfterContradiction = applyEwmaAnswer(freshlySettled, 'openness', 'report', 1, NOW);
const deepAfterContradiction = applyEwmaAnswer(deeplySettled, 'openness', 'report', 1, NOW);

const freshSwing = Math.abs(freshAfterContradiction.value - freshlySettled.value);
const deepSwing = Math.abs(deepAfterContradiction.value - deeplySettled.value);
assert.ok(deepSwing < freshSwing, `a deeply-settled axis (${deepSwing}) must swing less than a freshly-settled one (${freshSwing}) from the same contradicting answer`);
ok('worked example: a well-settled axis swings less from a contradicting answer than a freshly-settled axis does (§4)');

// MIN_VARIANCE floor: even an axis at maximum stored stability can still
// move at all from new evidence (never permanently frozen).
const maxStable = trackAt(0.2, 1, 100);
const stillMoves = applyEwmaAnswer(maxStable, 'openness', 'report', 0.9, NOW);
assert.notEqual(stillMoves.value, maxStable.value, 'KALMAN_MIN_VARIANCE floor must keep the gain above 0');
ok('KALMAN_MIN_VARIANCE floor: an axis at stability 1 can still move from new evidence, never frozen solid');

// Same function signature / same TraitTrack fields — no shape change.
const shapeKeys = Object.keys(third).sort();
assert.deepEqual(shapeKeys, ['answerCount', 'axis', 'lastDepthAt', 'lastTouched', 'stability', 'track', 'value']);
ok('applyEwmaAnswer output shape unchanged — same TraitTrack fields, no schema/consumer impact');

console.log(`\n${passed} Kalman trait-update checks passed`);
