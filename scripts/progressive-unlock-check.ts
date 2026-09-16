/**
 * Progressive unlock (trait-system redesign §6). Run: npm run check:progressive-unlock
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  LEGENDS_UNLOCK_THRESHOLD,
  SAGE_UNLOCK_THRESHOLD,
  legendsUnlocked,
  sageUnlocked,
} from '../src/lib/questions/progressive-unlock';
import { QUESTIONS_BANK } from '../src/lib/questions/bank';
import { bankTotalProgress } from '../src/lib/questions/local';
import { TRAIT_AXES } from '../src/lib/traits';
import {
  applyCountOnlyAnswer,
  applyEwmaAnswer,
  shouldWriteReportTrack,
  type TraitTrack,
} from '../src/lib/trait-stability';

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

// --- Regression: the optional scenario phase must not strand the unlock ----
// The optional 8-screen phase writes all 16 axes as `self_scenario` (direct).
// Every frozen-intake answer is `self_situation` (inferred), which
// `shouldWriteReportTrack` correctly refuses to blend into a direct axis. It
// used to be dropped outright, so `answerCount` never moved and Legends was
// unreachable for anyone who took that phase. It is now recorded count-only.
const seededAt = '2026-09-08T12:00:00.000Z';
const answeredAt = '2026-09-11T12:00:00.000Z';

const scenarioSeeded = new Map<string, TraitTrack>();
for (const axis of TRAIT_AXES) {
  scenarioSeeded.set(axis, applyEwmaAnswer(null, axis, 'report', 0.7, seededAt));
}
assert.equal(
  shouldWriteReportTrack('self_scenario', 'self_situation'),
  false,
  'intake answers are still refused the value blend on a direct axis',
);
ok('direct-beats-inferred still blocks the value blend (rule unchanged)');

const afterIntake = new Map(scenarioSeeded);
for (const row of QUESTIONS_BANK) {
  const prev = afterIntake.get(row.axis) ?? null;
  afterIntake.set(row.axis, applyCountOnlyAnswer(prev, row.axis, answeredAt, 0.7));
}
const intakeTracks = [...afterIntake.values()];

assert.equal(
  bankTotalProgress(intakeTracks).answered,
  50,
  'all 50 intake answers count even when every axis was scenario-seeded',
);
assert.equal(sageUnlocked(intakeTracks), true, 'Sage unlocks after a scenario-seeded intake');
assert.equal(legendsUnlocked(intakeTracks), true, 'Legends unlocks after a scenario-seeded intake');
ok('scenario phase + all 50 intake answers reaches 50 and unlocks Sage and Legends');

for (const axis of TRAIT_AXES) {
  const before = scenarioSeeded.get(axis)!;
  const after = afterIntake.get(axis)!;
  assert.equal(after.value, before.value, `${axis}: count-only never moves the value`);
  assert.equal(after.stability, before.stability, `${axis}: count-only never moves stability`);
  assert.ok(after.answerCount > before.answerCount, `${axis}: the answer was recorded`);
}
ok('count-only bumps answerCount only — value and stability are byte-identical');

// The bug this replaces: dropping the answer left every axis at the single
// scenario write, i.e. 16 of 50, permanently short of both thresholds.
const droppedInstead = [...scenarioSeeded.values()];
assert.equal(bankTotalProgress(droppedInstead).answered, 16);
assert.equal(legendsUnlocked(droppedInstead), false);
ok('the old drop-the-answer behaviour stranded the count at 16 of 50');

// The assertions above prove the arithmetic. These prove the wiring in
// me.ts — the branch that was actually the bug — since `collectAnswers` and
// `persistMergedTraits` are private and me.ts pulls in Supabase at import.
// Same source-assertion convention wave19-check.ts already uses.
const meSource = readFileSync(resolve(__dirname, '../src/lib/me.ts'), 'utf8');

assert.match(
  meSource,
  /if \(!shouldWriteReportTrack\(current\.sources\[axis\], source\)\) \{[\s\S]{0,320}?if \(source !== 'self_situation'\) continue;[\s\S]{0,160}?countOnly: true/,
  'collectAnswers records a blocked self_situation answer instead of dropping it',
);
ok('collectAnswers emits countOnly for a blocked intake answer (wiring)');

assert.match(
  meSource,
  /if \(answer\.countOnly\) \{[\s\S]{0,400}?applyCountOnlyAnswer\([\s\S]{0,120}?continue;/,
  'persistMergedTraits routes countOnly answers past the EWMA value blend',
);
assert.ok(
  meSource.indexOf('if (answer.countOnly)') < meSource.indexOf('const next = applyEwmaAnswer('),
  'the countOnly branch returns before applyEwmaAnswer can blend the value',
);
ok('persistMergedTraits skips the value blend for countOnly answers (wiring)');

console.log(`\n${passed} progressive-unlock checks passed`);
