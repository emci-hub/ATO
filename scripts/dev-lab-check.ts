/**
 * Dev Tools Hub gates + simulator math. Run: npm run check:dev-lab
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  DEV_LAB_GAPS,
  DEV_LAB_PATTERNS,
  DEV_LAB_STREAKS,
  buildSimHistory,
  demoTraitState,
  simulateGapWindow,
} from '../src/lib/dev-lab';
import { matchingFrameworkTerms, containsFrameworkTerm } from '../src/lib/voice/framework-fence';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

const layout = read('src/app/_layout.tsx');
const intent = read('src/app/+native-intent.ts');
const hub = read('src/app/dev-lab.tsx');

assert.match(layout, /<Stack\.Protected guard=\{__DEV__\}>[\s\S]*name="dev-lab"/);
const tabsDecl = layout.indexOf('name="(tabs)"');
const hubDecl = layout.indexOf('name="dev-lab"');
assert.ok(tabsDecl > 0 && hubDecl > tabsDecl, 'dev-lab must not be the Stack cold-start screen');
assert.match(hub, /if \(!__DEV__\)/);
assert.match(hub, /Redirect href="\/"/);
assert.doesNotMatch(hub, /Dev only/);
assert.match(intent, /voice\|dev\)-lab/);
ok('dev-lab is a __DEV__ route behind Stack.Protected, not a production screen');

assert.deepEqual([...DEV_LAB_STREAKS], [0, 1, 2, 3, 4, 7]);
assert.deepEqual([...DEV_LAB_GAPS], [1, 2, 3, 7]);
assert.ok(DEV_LAB_PATTERNS.some((row) => row.id === 'two-skips'));
ok('simulator exposes streak, pattern, and gap controls');

const history = buildSimHistory(7, ['done', 'skipped', 'done', 'skipped']);
assert.equal(history.length, 7);
assert.equal(history.filter((row) => row.status === 'done').length, 5);
assert.equal(history[history.length - 1].status, 'skipped');
ok('streak pads dones in front of the recent log/skip pattern');

const stillOpen = simulateGapWindow({ checkCount: 4, gapDays: 3, todayYmd: '2026-08-28' });
assert.equal(stillOpen.closedMissed.length, 0);
assert.deepEqual(
  stillOpen.open.map((slot) => slot.offset),
  [2, 1, 0],
);
ok('3 days since last Check: yesterday and 2-days-ago are still in the window');

const beyond = simulateGapWindow({ checkCount: 4, gapDays: 7, todayYmd: '2026-08-28' });
assert.deepEqual(
  beyond.closedMissed.map((slot) => slot.offset),
  [3, 4, 5, 6],
);
assert.deepEqual(
  beyond.open.map((slot) => slot.offset),
  [2, 1, 0],
);
ok('7 days since last Check: days 3–6 are closed; today + 2 back stay open');

const demo = demoTraitState();
assert.equal(demo.sources.openness, 'self_slider');
assert.equal(demo.sources.extraversion, 'self_grid');
assert.equal(demo.sources.steadiness, 'self_slider');
assert.equal(demo.sources.conflict_cooperativeness, 'self_situation');
ok('demo trait row shows slider-sticky O/C vs grid E/A');

assert.deepEqual(matchingFrameworkTerms('Your INFJ side is showing.'), ['INFJ']);
assert.ok(containsFrameworkTerm('attachment style'));
assert.ok(containsFrameworkTerm('growth mindset'));
assert.equal(containsFrameworkTerm('autonomy'), false);
assert.equal(containsFrameworkTerm('competence'), false);
assert.equal(containsFrameworkTerm('relatedness'), false);
assert.equal(matchingFrameworkTerms('After you make coffee, write one line.').length, 0);
ok('fence tester reports the banned term that matched');

assert.match(hub, /fetchSageUsage/);
assert.match(hub, /matchingFrameworkTerms/);
assert.match(hub, /routeVoiceCard/);
assert.match(hub, /listPendingAccessRequests/);
assert.match(hub, /approveAccessRequest/);
assert.match(hub, /denyAccessRequest/);
ok('hub sections call the live fence, usage snapshot, card router, and access review');

console.log(`\ndev-lab-check: ${passed}/${passed} passed`);
