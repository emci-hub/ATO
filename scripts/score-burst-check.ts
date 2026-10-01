/**
 * Mini-game result celebration checks. Run: npm run check:score-burst
 *
 *   1. Strong = a new record, or Silver / Gold. Bronze and a plain pass are not.
 *   2. The count-up starts at 0, never overshoots, rises monotonically and
 *      lands exactly on the final score (0 stays 0, negatives clamp to 0).
 *   3. Confetti pieces: the right count, fanned upward, deterministic for a
 *      seeded rng, every field in a sane range.
 *   4. Wiring: the Play sheet renders ScoreBurst from the finished round,
 *      motion off (reduced motion / Effects not Full) skips the animation,
 *      and no confetti/count-up dependency was added (reanimated only).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { MEDALS } from '../src/play/game-records';
import {
  CONFETTI_COUNT,
  COUNT_UP_MS,
  confettiPieces,
  countUpValue,
  isStrongResult,
} from '../src/play/score-burst-model';

const ROOT = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let passed = 0;
const ok = (msg: string) => {
  passed += 1;
  console.log(`  ✓ ${msg}`);
};

/* ---------------------------------------------------------------- 1 --- */
{
  assert.equal(isStrongResult({ medal: null, newRecord: false }), false, 'a plain pass is not strong');
  assert.equal(isStrongResult({ medal: 'bronze', newRecord: false }), false, 'bronze is not strong');
  assert.equal(isStrongResult({ medal: 'silver', newRecord: false }), true, 'silver is strong');
  assert.equal(isStrongResult({ medal: 'gold', newRecord: false }), true, 'gold is strong');
  assert.equal(isStrongResult({ medal: null, newRecord: true }), true, 'a new record is strong');
  assert.equal(isStrongResult({ medal: 'bronze', newRecord: true }), true, 'a new record beats a bronze');
  for (const m of MEDALS) assert.equal(typeof isStrongResult({ medal: m, newRecord: false }), 'boolean');
}
ok('strong result = new record or Silver/Gold; bronze and a plain pass are not');

/* ---------------------------------------------------------------- 2 --- */
{
  for (const target of [1, 7, 95, 480, 12345]) {
    assert.equal(countUpValue(target, 0), 0, `${target}: starts at 0`);
    assert.equal(countUpValue(target, COUNT_UP_MS), target, `${target}: lands on the score`);
    assert.equal(countUpValue(target, COUNT_UP_MS * 5), target, `${target}: stays on the score`);
    let prev = -1;
    for (let t = 0; t <= COUNT_UP_MS; t += 30) {
      const v = countUpValue(target, t);
      assert.ok(v >= prev, `${target}: never goes backwards (t=${t})`);
      assert.ok(v <= target, `${target}: never overshoots (t=${t})`);
      prev = v;
    }
    assert.ok(countUpValue(target, COUNT_UP_MS / 2) > 0 || target < 2, `${target}: moves before the end`);
  }
  assert.equal(countUpValue(0, 300), 0, 'a 0 score stays 0');
  assert.equal(countUpValue(-5, 300), 0, 'a negative score clamps to 0');
  assert.equal(countUpValue(100, -50), 0, 'before the start it shows 0');
}
ok('count-up: starts at 0, monotonic, never overshoots, lands exactly on the score');

/* ---------------------------------------------------------------- 3 --- */
{
  let s = 12345;
  const seeded = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  const a = confettiPieces(CONFETTI_COUNT, seeded);
  s = 12345;
  const b = confettiPieces(CONFETTI_COUNT, seeded);
  assert.equal(a.length, CONFETTI_COUNT, 'the burst has CONFETTI_COUNT pieces');
  assert.deepEqual(a, b, 'a seeded rng gives the same burst');
  for (const p of a) {
    assert.ok(p.angle < 0 && p.angle > -Math.PI, 'fanned upward');
    assert.ok(p.dist >= 70 && p.dist <= 150, 'distance in range');
    assert.ok(p.duration >= 650 && p.duration <= 1100, 'duration short (a burst, not a rain)');
    assert.ok(p.delay >= 0 && p.delay <= 120, 'near-simultaneous start');
    assert.ok(p.color >= 0 && p.color <= 4, 'palette index');
    assert.ok(p.size >= 6 && p.size <= 10, 'size');
  }
  assert.ok(CONFETTI_COUNT <= 24, 'a small burst, safe on a phone');
}
ok('confetti: 18 pieces, fanned upward, deterministic, short');

/* ---------------------------------------------------------------- 4 --- */
{
  const burst = read('src/play/score-burst.tsx');
  assert.ok(burst.includes("from 'react-native-reanimated'"), 'the burst is built on reanimated');
  assert.ok(burst.includes('if (!play) {') && burst.includes('animate && fresh'), 'no animation when motion is off or already celebrated');
  assert.ok(burst.includes('accessibilityLabel={`${score} points'), 'screen readers hear the final score, not the count');
  const sheets = read('src/play/pet-sheets.tsx');
  assert.ok(/<ScoreBurst[^>]*animate=\{!still\}/.test(sheets), 'the Play sheet animates only when motion is allowed');
  const screen = read('src/play/pet-screen.tsx');
  assert.ok(screen.includes('setLastRound({ key: roundClaim.current.key, score: r.score, strong: isStrongResult(r) })'), 'a counted round feeds the burst');
  assert.ok(screen.includes('still={reduceMotion || fxQuality') , 'still = reduced motion or Effects not Full');
  const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string> };
  const bad = Object.keys(pkg.dependencies).filter((d) => /confetti|count-?up|countup/i.test(d));
  assert.deepEqual(bad, [], 'no confetti / count-up dependency was added');
}
ok('wiring: ScoreBurst on the Play sheet, motion-gated, accessible, no new dependency');

console.log(`\ncheck:score-burst — ${passed} groups passed.`);
