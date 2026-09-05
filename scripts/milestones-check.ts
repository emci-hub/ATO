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

import { MILESTONE_DEFS, checkMilestones } from '../src/lib/milestones';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

assert.equal(MILESTONE_DEFS.length, 4);
assert.deepEqual(
  MILESTONE_DEFS.map((d) => d.threshold),
  [12, 24, 36, 48],
);
assert.ok(MILESTONE_DEFS.every((d) => d.metric === 'bankTotalProgress'));
assert.equal(new Set(MILESTONE_DEFS.map((d) => d.id)).size, MILESTONE_DEFS.length);
ok('MILESTONE_DEFS has 4 unique bankTotalProgress entries at 12/24/36/48');

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
  2,
  'checkMilestones is called exactly twice: once in the backfill effect, once in refreshAfterAnswer',
);
ok('intake-sweep.tsx wires through the shared checkMilestones/persistCelebratedMilestones helpers');

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
