/**
 * MILESTONE_DEFS / checkMilestones, plus source assertions that
 * intake-sweep.tsx's backfill (T-04) and post-answer check (T-05) wire
 * through the shared checkMilestones/persistCelebratedMilestones — no
 * duplicated inline threshold logic, and the backfill pass never fires the
 * onMilestoneCrossed placeholder. Run: npm run check:milestones
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { bankQuestionCount } from '../src/lib/questions/local';
import { MILESTONE_DEFS, checkMilestones } from '../src/lib/milestones';
import { TRAIT_AXES } from '../src/lib/traits';
import { containsFrameworkTerm } from '../src/lib/voice/framework-fence';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const bankTotalDefs = MILESTONE_DEFS.filter((d) => d.metric === 'bankTotalProgress');
assert.equal(bankTotalDefs.length, 4);
assert.deepEqual(
  bankTotalDefs.map((d) => d.threshold),
  [12, 24, 36, 48],
);
assert.equal(new Set(MILESTONE_DEFS.map((d) => d.id)).size, MILESTONE_DEFS.length);
ok('MILESTONE_DEFS has 4 unique bankTotalProgress entries at 12/24/36/48');

// profile_50 stays on profile_percent (settledCount-based) — a meaningful
// mid-point milestone on its own, even though profile_percent can't reach
// 100 from bank answers alone (settledCount needs near-perfect stability).
const profilePercentDefs = MILESTONE_DEFS.filter((d) => d.metric === 'profile_percent');
assert.equal(profilePercentDefs.length, 1);
assert.deepEqual(
  profilePercentDefs.map((d) => d.id),
  ['profile_50'],
);
assert.equal(profilePercentDefs[0]!.threshold, 50);
assert.ok(
  !containsFrameworkTerm(profilePercentDefs[0]!.title) && !containsFrameworkTerm(profilePercentDefs[0]!.body),
  'profile_percent copy hits the framework fence',
);
ok('MILESTONE_DEFS has profile_50 on profile_percent at threshold 50, fence-clean');

assert.deepEqual(checkMilestones('profile_percent', 49.9, []), []);
assert.deepEqual(
  checkMilestones('profile_percent', 50, []).map((d) => d.id),
  ['profile_50'],
);
ok('checkMilestones works unchanged for the profile_percent metric (no new mechanic needed)');

// profile_100 moved to bank_percent — answered/total bank questions, which
// genuinely reaches 100 once every bank question is answered, unlike
// profile_percent (capped well under 100 by settledCount's stability gate).
const bankPercentDefs = MILESTONE_DEFS.filter((d) => d.metric === 'bank_percent');
assert.equal(bankPercentDefs.length, 1);
assert.deepEqual(
  bankPercentDefs.map((d) => d.id),
  ['profile_100'],
);
assert.equal(bankPercentDefs[0]!.threshold, 100);
assert.ok(
  !containsFrameworkTerm(bankPercentDefs[0]!.title) && !containsFrameworkTerm(bankPercentDefs[0]!.body),
  'bank_percent copy hits the framework fence',
);
ok('MILESTONE_DEFS has profile_100 on bank_percent at threshold 100, fence-clean');

assert.deepEqual(checkMilestones('bank_percent', 99.9, []), []);
assert.deepEqual(
  checkMilestones('bank_percent', 100, []).map((d) => d.id),
  ['profile_100'],
);
ok('checkMilestones works unchanged for the bank_percent metric (no new mechanic needed)');

const axisCompleteDefs = MILESTONE_DEFS.filter((d) => d.metric.startsWith('axisComplete:'));
assert.equal(axisCompleteDefs.length, TRAIT_AXES.length);
assert.deepEqual(
  new Set(axisCompleteDefs.map((d) => d.metric)),
  new Set(TRAIT_AXES.map((axis) => `axisComplete:${axis}`)),
);
for (const axis of TRAIT_AXES) {
  const def = axisCompleteDefs.find((d) => d.metric === `axisComplete:${axis}`);
  assert.ok(def, `no per-axis milestone def for ${axis}`);
  assert.equal(def!.id, `axis_complete_${axis}`);
  assert.equal(def!.threshold, bankQuestionCount([axis]));
  assert.ok(
    def!.threshold > 0,
    `axis ${axis} has a 0-question bank, so its milestone would be unconditionally already-crossed`,
  );
  assert.ok(def!.title.length > 0 && def!.body.length > 0);
  assert.ok(
    !containsFrameworkTerm(def!.title) && !containsFrameworkTerm(def!.body),
    `axis-complete copy for ${axis} hits the framework fence: "${def!.title}" / "${def!.body}"`,
  );
}
ok(`MILESTONE_DEFS has one axisComplete entry per axis (${TRAIT_AXES.length}), threshold = that axis's bank size, fence-clean`);

const firstAxis = TRAIT_AXES[0];
assert.deepEqual(
  checkMilestones(`axisComplete:${firstAxis}`, bankQuestionCount([firstAxis]), []).map((d) => d.id),
  [`axis_complete_${firstAxis}`],
);
assert.deepEqual(checkMilestones(`axisComplete:${firstAxis}`, bankQuestionCount([firstAxis]) - 1, []), []);
ok('checkMilestones works unchanged for a per-axis metric (no new mechanic needed)');

assert.deepEqual(checkMilestones('bankTotalProgress', 0, []), []);
ok('below every threshold crosses nothing');

assert.deepEqual(
  checkMilestones('bankTotalProgress', 24, []).map((d) => d.id),
  ['answers_12', 'answers_24'],
);
ok('crossing 24 with nothing celebrated returns 12 and 24');

assert.deepEqual(
  checkMilestones('bankTotalProgress', 24, ['answers_12']).map((d) => d.id),
  ['answers_24'],
);
ok('already-celebrated ids are excluded');

assert.deepEqual(
  checkMilestones('bankTotalProgress', 48, ['answers_12', 'answers_24', 'answers_36', 'answers_48']),
  [],
);
ok('fully celebrated returns nothing even at max value');

const celebratedIds = ['answers_12'];
checkMilestones('bankTotalProgress', 48, celebratedIds);
assert.deepEqual(celebratedIds, ['answers_12']);
ok('checkMilestones does not mutate celebratedIds');

// Backfill scenario (T-04): an existing user who already answered 30 bank
// questions before this feature shipped should silently catch up on 12/24,
// with 36/48 still ahead of them.
assert.deepEqual(
  checkMilestones('bankTotalProgress', 30, []).map((d) => d.id),
  ['answers_12', 'answers_24'],
);
ok('backfill scenario: 30 answered, nothing celebrated yet, catches up to 12 and 24');

// --- Source assertions: intake-sweep.tsx wiring (T-04/T-05) ---
const intakeSweepSrc = readFileSync(
  resolve(__dirname, '../src/app/(tabs)/intake-sweep.tsx'),
  'utf8',
);

assert.ok(
  intakeSweepSrc.includes("import { checkMilestones, type MilestoneDef } from '@/lib/milestones';"),
  'intake-sweep.tsx imports checkMilestones from the shared module, not a duplicated version',
);
assert.ok(
  intakeSweepSrc.includes("import { persistCelebratedMilestones } from '@/lib/me';"),
  'intake-sweep.tsx imports persistCelebratedMilestones from the shared module',
);
assert.equal(
  (intakeSweepSrc.match(/checkMilestones\(/g) ?? []).length,
  3,
  'checkMilestones should be called exactly 3 times, file-wide, once per metric ' +
    '(bankTotalProgress, profile_percent, bank_percent)',
);
assert.equal(
  (intakeSweepSrc.match(/crossedMilestonesFor\(/g) ?? []).length,
  3,
  'crossedMilestonesFor should be defined once and called from both the backfill effect and ' +
    'refreshAfterAnswer (3 occurrences total: 1 definition + 2 call sites)',
);

const crossedMilestonesForStart = intakeSweepSrc.indexOf('function crossedMilestonesFor(');
const crossedMilestonesForEnd = intakeSweepSrc.indexOf('export default function IntakeSweepTabScreen');
assert.ok(
  crossedMilestonesForStart > -1 && crossedMilestonesForEnd > crossedMilestonesForStart,
  'expected anchors around crossedMilestonesFor were not found in intake-sweep.tsx — did it move or get renamed?',
);
const crossedMilestonesForBody = intakeSweepSrc.slice(crossedMilestonesForStart, crossedMilestonesForEnd);
assert.equal(
  (crossedMilestonesForBody.match(/checkMilestones\(/g) ?? []).length,
  3,
  'all 3 checkMilestones calls (bankTotalProgress, profile_percent, bank_percent) must live ' +
    'inside crossedMilestonesFor, not duplicated at each call site',
);
assert.ok(
  /settledCount\(\s*tracks\s*\)\s*\/\s*TRAIT_AXES\.length/.test(crossedMilestonesForBody),
  'profile_percent must be computed as the settled-axis ratio via settledCount, at the same call ' +
    'site bankTotalProgress already runs at — not a separately duplicated computation',
);
assert.ok(
  crossedMilestonesForBody.includes("checkMilestones('bank_percent'"),
  'bank_percent must be checked in crossedMilestonesFor alongside the other metrics',
);
assert.ok(
  /answered\s*\/\s*total\)\s*\*\s*100/.test(crossedMilestonesForBody),
  'bank_percent must be computed as answered/total bank questions ×100, not a duplicated formula ' +
    '(this is the metric that should actually reach 100, unlike profile_percent)',
);
ok('intake-sweep.tsx wires through the shared checkMilestones/persistCelebratedMilestones/crossedMilestonesFor helpers');

const backfillEffectStart = intakeSweepSrc.indexOf('backfilledRef.current = true;');
const backfillEffectEnd = intakeSweepSrc.indexOf('}, [userId, me, tracksReady, tracks, refresh]);');
assert.ok(
  backfillEffectStart > -1 && backfillEffectEnd > backfillEffectStart,
  'expected anchors around the backfill effect body were not found in intake-sweep.tsx — did it move or get renamed?',
);
const backfillEffectBody = intakeSweepSrc.slice(backfillEffectStart, backfillEffectEnd);
assert.ok(
  !backfillEffectBody.includes('onMilestoneCrossed'),
  'the backfill effect (T-04) must never call the toast placeholder — it is silent by design',
);
ok('backfill effect never calls onMilestoneCrossed (silent by design)');

const refreshAfterAnswerStart = intakeSweepSrc.indexOf('const refreshAfterAnswer = useCallback(async () => {');
const refreshAfterAnswerEnd = intakeSweepSrc.indexOf(
  '}, [refresh, loadTracks, userId, me, onMilestoneCrossed]);',
);
assert.ok(
  refreshAfterAnswerStart > -1 && refreshAfterAnswerEnd > refreshAfterAnswerStart,
  'expected anchors around refreshAfterAnswer were not found in intake-sweep.tsx — did it move or get renamed?',
);
const refreshAfterAnswerBody = intakeSweepSrc.slice(refreshAfterAnswerStart, refreshAfterAnswerEnd);
assert.ok(
  refreshAfterAnswerBody.includes('onMilestoneCrossed(def)'),
  'refreshAfterAnswer (T-05) must call the toast placeholder for each newly-crossed def — removing this call should fail the suite',
);
ok('refreshAfterAnswer calls onMilestoneCrossed for newly-crossed defs');

// --- Source assertions: MilestoneToast wiring (T-06) ---
assert.ok(
  intakeSweepSrc.includes("import { MilestoneToast } from '@/components/milestone-toast';"),
  'intake-sweep.tsx imports the real MilestoneToast component',
);
assert.ok(
  !intakeSweepSrc.includes("console.log('[milestones] crossed'"),
  'the T-06 console.log placeholder for crossed milestones should be gone once the real toast is wired',
);
assert.ok(
  intakeSweepSrc.includes('setToastQueue((queue) => [...queue, def]);'),
  'onMilestoneCrossed enqueues the crossed def rather than showing it directly, so two crossings in one pass cannot clobber each other',
);
assert.ok(
  /<MilestoneToast[\s\S]*?title=\{activeToast\.title\}[\s\S]*?body=\{activeToast\.body\}[\s\S]*?\/>/.test(
    intakeSweepSrc,
  ),
  'MilestoneToast is rendered with the active queued def\'s title/body, not hardcoded copy',
);
ok('MilestoneToast is wired into onMilestoneCrossed via a queue, not hardcoded');

assert.ok(
  /<MilestoneToast[\s\S]*?key=\{activeToast\.id\}/.test(intakeSweepSrc),
  'MilestoneToast must be keyed on activeToast.id — without a key, React reuses the same instance ' +
    'across queued toasts and the second one never replays its fade-in effect',
);
ok('MilestoneToast is keyed on activeToast.id so each queued toast remounts and replays its fade');

const milestoneToastSrc = readFileSync(resolve(__dirname, '../src/components/milestone-toast.tsx'), 'utf8');
assert.ok(
  MILESTONE_DEFS.every((def) => !milestoneToastSrc.includes(def.title) && !milestoneToastSrc.includes(def.body)),
  'MilestoneToast must not hardcode any MILESTONE_DEFS title or body — they must stay props',
);
assert.ok(
  /title:\s*string/.test(milestoneToastSrc) && /body:\s*string/.test(milestoneToastSrc),
  'MilestoneToast\'s prop type must declare title and body as string props',
);
ok('MilestoneToast takes title/body as props, no hardcoded MILESTONE_DEFS copy');

console.log(`\n${passed} milestones checks passed.`);
