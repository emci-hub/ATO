/**
 * Progressive unlock (trait-system redesign §6). Run: npm run check:progressive-unlock
 */
import assert from 'node:assert/strict';

import {
  LEGENDS_UNLOCK_THRESHOLD,
  SAGE_UNLOCK_THRESHOLD,
  legendsUnlocked,
  sageUnlocked,
} from '../src/lib/questions/progressive-unlock';
import { QUESTIONS_BANK } from '../src/lib/questions/bank';
import { TRAIT_AXES } from '../src/lib/traits';
import type { TraitTrack } from '../src/lib/trait-stability';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

assert.equal(SAGE_UNLOCK_THRESHOLD, 25);
assert.equal(LEGENDS_UNLOCK_THRESHOLD, 50);
assert.equal(LEGENDS_UNLOCK_THRESHOLD, QUESTIONS_BANK.length, 'Legends unlocks at exactly the full frozen intake size');
ok('thresholds match §6 exactly (25 for Sage, 50 for Legends)');

/** N answers total, spread across the first axes in TRAIT_AXES order (capping each axis at its own bank size). */
function tracksWithTotalAnswered(n: number): TraitTrack[] {
  const perAxis = new Map<string, number>();
  for (const row of QUESTIONS_BANK) perAxis.set(row.axis, (perAxis.get(row.axis) ?? 0) + 1);
  const out: TraitTrack[] = [];
  let remaining = n;
  for (const axis of TRAIT_AXES) {
    if (remaining <= 0) break;
    const cap = perAxis.get(axis) ?? 0;
    const count = Math.min(cap, remaining);
    if (count <= 0) continue;
    out.push({
      axis,
      track: 'report',
      value: 0.5,
      stability: 0.5,
      answerCount: count,
      lastTouched: '2026-09-08T12:00:00.000Z',
      lastDepthAt: null,
    });
    remaining -= count;
  }
  return out;
}

assert.equal(sageUnlocked([]), false, 'no answers: Sage locked');
assert.equal(sageUnlocked(tracksWithTotalAnswered(24)), false, '24 answered: Sage still locked');
assert.equal(sageUnlocked(tracksWithTotalAnswered(25)), true, '25 answered: Sage unlocks');
assert.equal(sageUnlocked(tracksWithTotalAnswered(49)), true, '49 answered: Sage stays unlocked');
ok('sageUnlocked crosses exactly at 25, never re-locks with more answers');

assert.equal(legendsUnlocked(tracksWithTotalAnswered(49)), false, '49 answered: Legends still locked');
assert.equal(legendsUnlocked(tracksWithTotalAnswered(50)), true, '50 answered: Legends unlocks');
ok('legendsUnlocked crosses exactly at 50 (the full frozen intake), not before');

// Legends' new gate is reachable by the tiered intake alone — the whole
// point of retargeting off isProfileSettled (which 10 of 16 axes, at only 2
// intake answers each, could never satisfy on intake completion alone).
const fullIntake = tracksWithTotalAnswered(50);
const totalAnswered = fullIntake.reduce((sum, row) => sum + row.answerCount, 0);
assert.equal(totalAnswered, 50);
assert.equal(legendsUnlocked(fullIntake), true, 'completing the full frozen intake unlocks Legends, unconditionally');
ok('completing all 50 intake questions unlocks Legends regardless of per-axis stability floors');

console.log(`\n${passed} progressive-unlock checks passed`);
