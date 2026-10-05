/**
 * Progressive unlock (trait-system redesign §6; staged intake 2026-10-02).
 * Run: npm run check:progressive-unlock
 *
 * Stage is the lowest per-trait answer count (intake-stage.ts). Sage opens at
 * set 2 (or 25 of the old intake), Legends and the full profile at set 3 (or
 * the old 50) — so nobody who had an unlock loses it.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  COMING_LATER_LINE,
  INTAKE_REVEAL_MILESTONE_ID,
  INTAKE_REVEAL_SEEN_ID,
  INTAKE_UNLOCKED,
  LEGENDS_UNLOCK_STAGE,
  NEXT_ROUND_UNLOCKS,
  SAGE_UNLOCK_STAGE,
  UNLOCK_COPY_REVIEWED,
  legendsUnlocked,
  roundCompleteBody,
  roundStandingLine,
  sageUnlocked,
  unlockCopyClean,
} from '../src/lib/questions/progressive-unlock';
import { LEGACY_INTAKE_AXIS_COUNTS, PROMPT_REWORDS, QUESTIONS_BANK } from '../src/lib/questions/bank';
import {
  currentIntakeSet,
  finishedLegacyIntake,
  hasOptionalLegacyQuestions,
  intakeStage,
  legacyIntakeExclusions,
  reachedFullProfile,
} from '../src/lib/questions/intake-stage';
import { STAGED_INTAKE_COPY_REVIEWED } from '../src/lib/questions/staged-intake-copy';
import { isFullProfileDone } from '../src/lib/full-profile-gate';
import { MILESTONE_DEFS } from '../src/lib/milestones';
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

assert.equal(SAGE_UNLOCK_STAGE, 2);
assert.equal(LEGENDS_UNLOCK_STAGE, 3);
ok('Sage opens at set 2, Legends at set 3 (the full profile)');

function track(axis: string, answerCount: number): TraitTrack {
  return {
    axis: axis as TraitTrack['axis'],
    track: 'report',
    value: 0.5,
    stability: 0.5,
    answerCount,
    lastTouched: '2026-09-08T12:00:00.000Z',
    lastDepthAt: null,
  };
}
/** Round-robin answers, set by set: n = 16 is exactly set 1, 32 set 2, 48 all. */
function tracksAfterAnswers(n: number): TraitTrack[] {
  const counts = new Map<string, number>(TRAIT_AXES.map((axis) => [axis, 0]));
  for (let i = 0; i < n; i += 1) {
    const axis = TRAIT_AXES[i % TRAIT_AXES.length];
    counts.set(axis, (counts.get(axis) ?? 0) + 1);
  }
  return TRAIT_AXES.filter((axis) => (counts.get(axis) ?? 0) > 0).map((axis) => track(axis, counts.get(axis)!));
}
/** The shape an account that finished the OLD tiered 50 has. */
const oldFifty = TRAIT_AXES.map((axis) => track(axis, LEGACY_INTAKE_AXIS_COUNTS[axis]));

assert.equal(intakeStage([]), 0);
assert.equal(intakeStage(tracksAfterAnswers(15)), 0, 'one trait still without an answer');
assert.equal(intakeStage(tracksAfterAnswers(16)), 1, 'set 1 done');
assert.equal(intakeStage(tracksAfterAnswers(31)), 1);
assert.equal(intakeStage(tracksAfterAnswers(32)), 2, 'set 2 done');
assert.equal(intakeStage(tracksAfterAnswers(48)), 3, 'all 48');
assert.equal(intakeStage(tracksAfterAnswers(80)), 3, 'capped at 3');
assert.deepEqual(currentIntakeSet(tracksAfterAnswers(20)), { set: 2, answered: 4, size: 16 });
assert.equal(currentIntakeSet(tracksAfterAnswers(48)), null);
// A lopsided account: 6 on one trait, nothing on another, is still at stage 0.
assert.equal(intakeStage([track('openness', 6)]), 0);
ok('stage = lowest per-trait count (0..3); set progress counts traits already past the set');

assert.equal(sageUnlocked([]), false);
assert.equal(sageUnlocked(tracksAfterAnswers(31)), false, 'set 2 not done: Sage locked');
assert.equal(sageUnlocked(tracksAfterAnswers(32)), true, 'set 2 done: Sage unlocks');
assert.equal(legendsUnlocked(tracksAfterAnswers(47)), false, '47: Legends still locked');
assert.equal(legendsUnlocked(tracksAfterAnswers(48)), true, '48: Legends unlocks');
assert.equal(isFullProfileDone(tracksAfterAnswers(47), true), false);
assert.equal(isFullProfileDone(tracksAfterAnswers(48), true), true);
assert.equal(isFullProfileDone(tracksAfterAnswers(48), false), false, 'not ready reads as locked');
ok('Sage at set 2, Legends and the full profile at all 48 — never before');

// Old accounts: the old 50 keeps everything open.
assert.equal(intakeStage(oldFifty), 2, 'the old 50 left ten traits at 2');
assert.equal(finishedLegacyIntake(oldFifty), true);
assert.equal(reachedFullProfile(oldFifty), true);
assert.equal(isFullProfileDone(oldFifty, true), true, 'an old-50 account keeps Home, Explore and rounds');
assert.equal(sageUnlocked(oldFifty), true);
assert.equal(legendsUnlocked(oldFifty), true);
assert.equal(hasOptionalLegacyQuestions(oldFifty), true, 'its restored third questions are offered, optional');
assert.equal(hasOptionalLegacyQuestions(tracksAfterAnswers(48)), false);
const oneShortOfOld = oldFifty.map((row) => (row.axis === 'playfulness' ? track('playfulness', 1) : row));
assert.equal(finishedLegacyIntake(oneShortOfOld), false, '49 of the old 50 is not the old 50');
ok('an account that finished the old 50 keeps every unlock and is offered its third questions as optional');

// Moved extras: excluded from rounds exactly for accounts that answered them.
{
  const excluded = legacyIntakeExclusions(oldFifty);
  // Each excluded old question also carries its 2026-10-05 wording (the pool row now uses it).
  const newWordings = new Set(Object.values(PROMPT_REWORDS));
  const oldOnes = excluded.filter((p) => !newWordings.has(p));
  assert.equal(oldOnes.length, 12, 'all 12 moved extras were answered by an old-50 account');
  for (const p of oldOnes) if (PROMPT_REWORDS[p]) assert.ok(excluded.includes(PROMPT_REWORDS[p]!), `new wording also excluded: ${p}`);
  assert.deepEqual(legacyIntakeExclusions(tracksAfterAnswers(48)), [], 'a new account answered none of them');
  const partial = legacyIntakeExclusions([track('openness', 4)]);
  assert.equal(partial.filter((p) => !newWordings.has(p)).length, 1, 'answered 4 on openness in the old intake: only the 4th old draft is excluded');
  for (const prompt of excluded) assert.ok(!QUESTIONS_BANK.some((d) => d.prompt === prompt), 'never an intake prompt');
}
ok('rounds skip a moved extra only for the accounts that already answered it in the old intake');

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
  48,
  'all 48 intake answers count even when every axis was scenario-seeded',
);
assert.equal(sageUnlocked(intakeTracks), true, 'Sage unlocks after a scenario-seeded intake');
assert.equal(legendsUnlocked(intakeTracks), true, 'Legends unlocks after a scenario-seeded intake');
ok('scenario phase + all 48 intake answers reaches 48 and unlocks Sage and Legends');

for (const axis of TRAIT_AXES) {
  const before = scenarioSeeded.get(axis)!;
  const after = afterIntake.get(axis)!;
  assert.equal(after.value, before.value, `${axis}: count-only never moves the value`);
  assert.equal(after.stability, before.stability, `${axis}: count-only never moves stability`);
  assert.ok(after.answerCount > before.answerCount, `${axis}: the answer was recorded`);
}
ok('count-only bumps answerCount only — value and stability are byte-identical');

// The bug this replaces: dropping the answer left every axis at the single
// scenario write, i.e. 16 of 48, permanently short of the full profile.
const droppedInstead = [...scenarioSeeded.values()];
assert.equal(bankTotalProgress(droppedInstead).answered, 16);
assert.equal(legendsUnlocked(droppedInstead), false);
ok('the old drop-the-answer behaviour stranded the count at 16 of 48');

// The assertions above prove the arithmetic. Since wave79 (2026-10-03) the
// wiring lives on the server: an answer on a trait a direct source owns is
// recorded count-only (applyCountOnlyAnswer), never dropped and never blended.
const checkpointSql = readFileSync(
  resolve(__dirname, '../supabase/migrations/wave79_trait_checkpoint.sql'),
  'utf8',
).replace(/\r\n/g, '\n');
assert.match(
  checkpointSql,
  /if p_mode = 'answer' and v_rejected then[\s\S]{0,900}?set answer_count = t\.answer_count \+ 1, last_touched = v_now[\s\S]{0,200}?v_new_me := v_cur;/,
  'a blocked intake answer counts and leaves the number alone',
);
ok('the server records a blocked intake answer count-only (wiring)');

assert.ok(
  checkpointSql.indexOf("if p_mode = 'answer' and v_rejected then") <
    checkpointSql.indexOf('s := public.trait_ewma_step(t.value::float8'),
  'the count-only branch comes before the EWMA step can blend the value',
);
ok('the count-only branch skips the value blend (wiring)');

// --- The unlock table (2026-10-01): one source for the reveal and the toast ---
{
  assert.equal(unlockCopyClean(), true, 'unlock copy passes the framework fence');
  assert.equal(
    UNLOCK_COPY_REVIEWED,
    STAGED_INTAKE_COPY_REVIEWED,
    'the staged-intake rewording is a draft until emci reads it',
  );
  assert.ok(
    MILESTONE_DEFS.some(
      (def) => def.id === INTAKE_REVEAL_MILESTONE_ID && def.metric === 'intakeStage' && def.threshold === 3,
    ),
    'the reveal is remembered under a real milestone id, at the full profile (set 3)',
  );
  assert.ok(
    MILESTONE_DEFS.every((def) => def.id !== INTAKE_REVEAL_SEEN_ID),
    'the seen id must not be an id the old toast queue could already have written',
  );
  const openNow = INTAKE_UNLOCKED.join(' ');
  assert.doesNotMatch(openNow, /Story|Sage|Legend/, '"Open now" must not promise Story or the two placeholders');
  assert.match(NEXT_ROUND_UNLOCKS.join(' '), /Story/, 'Story belongs to the next round');
  assert.match(COMING_LATER_LINE, /Sage and Legends/);
  // No milestone may announce a placeholder as open.
  for (const def of MILESTONE_DEFS) {
    assert.doesNotMatch(`${def.title} ${def.body}`, /Sage (is ready|unlocked)|Legends? (are ready|unlocked)|both open/i, `${def.id} announces a placeholder`);
  }
  ok('unlock table: "open now" matches the real gates, Story sits in the next round, Sage and Legends are not announced');

  const unsettled = oldFifty;
  assert.doesNotMatch(roundCompleteBody(unsettled, false), /ATO tokens/, 'an unpaid round never names the +21');
  assert.match(roundCompleteBody(unsettled, true), /^\+21 ATO tokens\. \d+ of 16 settled\./);
  assert.match(roundStandingLine(unsettled), /keep settling the rest/);
  ok('round-end toast names the +21 only when paid, and always says where the profile stands');

  const banner = readFileSync(resolve(__dirname, '../src/components/full-profile-banner.tsx'), 'utf8');
  assert.match(banner, /persistCelebratedMilestones\(userId, \[INTAKE_REVEAL_SEEN_ID\]\)/, 'seen is written to the account, not the device');
  assert.match(banner, /celebratedIds !== undefined/, 'renders nothing until me has loaded');
  assert.doesNotMatch(banner, /generateText|ai-generate/, 'the reveal never calls a model');
  const fold = readFileSync(resolve(__dirname, '../src/components/questions-fold.tsx'), 'utf8');
  // 2026-10-02 (emci): the round toast moved out of the fold. A finished round
  // is now said by the mini guy, whose bubble IS the reused MilestoneToast,
  // pinned beside him at the tab shell (components/buddy-bubble.tsx).
  assert.match(
    fold,
    /pushBuddyNote\(\{\s+id: `round:\$\{holder\.pack\?\.id \?\? 'done'\}`,\s+title: ROUND_COMPLETE_TITLE,\s+body: roundCompleteBody\(tracks, paid, capped\),/,
    'a finished round is announced through the mini guy with the same title and body',
  );
  const bubble = readFileSync(resolve(__dirname, '../src/components/buddy-bubble.tsx'), 'utf8');
  assert.match(bubble, /<MilestoneToast/, 'his bubble reuses MilestoneToast');
  ok('reveal is remembered on the account and model-free; the round toast reuses MilestoneToast, via the mini guy');
}

console.log(`\n${passed} progressive-unlock checks passed`);
