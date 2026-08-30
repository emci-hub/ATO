/**
 * UI/bug bundle: 8-ball, usage phrasing, You-tab name once, crisis fold.
 * Run: npm run check:ui-bundle
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { EIGHT_BALL_ANSWERS, eightBallRollMs, pickEightBallFlashes, rollEightBall } from '../src/lib/sage-eight-ball';
import { formatSageUsage, QUOTA_EMPTY_MESSAGE } from '../src/lib/voice/quota';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

const banned = /\bAI\b|tokens/i;

assert.ok(EIGHT_BALL_ANSWERS.length >= 20);
assert.equal(new Set(EIGHT_BALL_ANSWERS).size, EIGHT_BALL_ANSWERS.length);
for (const answer of EIGHT_BALL_ANSWERS) {
  assert.doesNotMatch(answer, banned);
}
ok('8-ball has a fixed unique set with no AI/tokens copy');

const rolled = new Set<string>();
let prev: string | null = null;
for (let i = 0; i < 80; i += 1) {
  const next = rollEightBall(prev);
  assert.ok((EIGHT_BALL_ANSWERS as readonly string[]).includes(next));
  rolled.add(next);
  prev = next;
}
assert.ok(rolled.size >= 8);
ok('rolls stay inside the fixed set and do not get stuck on one line');

assert.ok(eightBallRollMs() > 1500 && eightBallRollMs() <= 2500);
const landed = rollEightBall('Yes.');
const flashes = pickEightBallFlashes(landed, 'Yes.');
assert.equal(flashes.length, 6);
for (const line of flashes) {
  assert.ok((EIGHT_BALL_ANSWERS as readonly string[]).includes(line));
  assert.notEqual(line, landed);
  assert.notEqual(line, 'Yes.');
}
ok('slot reel flashes other answers and finishes in under 2.5s');

const sage = read('src/app/(tabs)/sage.tsx');
assert.match(sage, /SageEightBall/);
assert.match(sage, /SageUsageLine/);
assert.match(sage, /styles\.sageToys/);
assert.match(sage, /styles\.chatColumn/);
assert.match(sage, /COMPOSER_REST_PAD/);
assert.doesNotMatch(sage, /routeVoiceCard/);
assert.match(sage, /useKeyboardLift/);
assert.match(sage, /visualViewport/);
assert.match(sage, /scrollToEnd/);
assert.match(sage, /keyboardOpen/);
assert.match(sage, /measureInWindow/);
assert.match(sage, /paddingBottom: keyboardLift/);
assert.match(sage, /keyboardFallbackLift/);
assert.doesNotMatch(sage, /enabled=\{false\}/);
assert.doesNotMatch(sage, /useSafeAreaInsets/);
ok('Sage mounts the 8-ball above chat and does not import the card router');
ok('Sage composer lifts with the keyboard and scrolls the latest message into view');

const eightBallUi = read('src/components/sage-eight-ball.tsx');
assert.match(eightBallUi, /accessibilityState=\{\{ expanded: open \}\}/);
assert.match(eightBallUi, /Ask again/);
assert.doesNotMatch(eightBallUi, /if \(!open && answer == null\) roll/);
assert.match(eightBallUi, /fontSize: 18/);
assert.match(eightBallUi, /SageOrb/);
assert.doesNotMatch(eightBallUi, /from 'react-native-svg'/);
assert.match(eightBallUi, /withSequence/);
assert.match(eightBallUi, /pickEightBallFlashes/);
assert.match(eightBallUi, /rollingRef/);
assert.match(eightBallUi, /reduceMotion/);
assert.match(eightBallUi, /disabled=\{rolling\}/);
assert.doesNotMatch(eightBallUi, /from '@\/lib\/kenney/);
assert.doesNotMatch(eightBallUi, /numeric-8-circle/);
ok('8-ball is collapsible, readable when open, and uses an original orb (Views, not SVG / Kenney / toy 8-ball)');
ok('8-ball slot-rolls with a tap lock-out and skips the reel when reduceMotion is on');

assert.equal(formatSageUsage(6, 20, 'today'), '6 of 20 today');
assert.equal(formatSageUsage(12, 200, 'this month'), '12 of 200 this month');
assert.doesNotMatch(formatSageUsage(6, 20, 'today'), banned);
assert.doesNotMatch(formatSageUsage(0, 20, 'today'), banned);
assert.doesNotMatch(QUOTA_EMPTY_MESSAGE, banned);
ok('usage copy is "X of [limit]" with no AI/tokens words');

const usageUi = read('src/components/sage-usage.tsx');
assert.match(usageUi, /Sage today/);
assert.match(usageUi, /formatSageUsage\(usage\.daily, usage\.dailyCap, 'today'\)/);
assert.doesNotMatch(usageUi, banned);
assert.match(read('src/components/settings-fold.tsx'), /defaultOpen = false/);
assert.doesNotMatch(usageUi, /defaultOpen=\{true\}/);
const quotaServer = read('src/lib/voice/quota-server.ts');
assert.match(quotaServer, /Read-only usage[\s\S]*Does not increment/);
assert.match(quotaServer, /export async function fetchSageUsage/);
const fetchFn = quotaServer.slice(quotaServer.indexOf('export async function fetchSageUsage'));
assert.doesNotMatch(fetchFn, /claim_ai_call/);
ok('You-tab usage fold is collapsed by default and reads without claiming');

const creditsUi = read('src/components/kenney-credits-card.tsx');
assert.match(creditsUi, /SettingsFold title="Credits"/);
assert.doesNotMatch(creditsUi, /defaultOpen=\{true\}/);
ok('Credits uses the same collapsed SettingsFold as Sage today');

const you = read('src/app/(tabs)/you.tsx');
assert.doesNotMatch(you, /\{me\.name\}/);
assert.doesNotMatch(you, /profileCard/);
assert.match(you, /<SharePoster/);
const weeksIdx = you.indexOf('<ThemedText type="smallBold">Weeks</ThemedText>');
const crisisIdx = you.indexOf('<CrisisRegionPicker');
const bandsIdx = you.indexOf('<TraitBandsFold');
const usageIdx = you.indexOf('<SageUsageFold');
const creditsIdx = you.indexOf('<KenneyCreditsCard');
assert.ok(weeksIdx >= 0 && crisisIdx > weeksIdx && bandsIdx > crisisIdx);
assert.ok(usageIdx > crisisIdx && creditsIdx > usageIdx);
ok('You shows the name once on the poster; crisis sits after Weeks, before trait bands, above usage and credits');

const picker = read('src/components/crisis-region-picker.tsx');
assert.match(picker, /SettingsFold title="If you need someone now"/);
assert.match(picker, /Passive Settings reference/);
assert.doesNotMatch(picker, /CrisisCard/);
const crisisCard = read('src/components/crisis-card.tsx');
assert.match(crisisCard, /I'm okay, keep going/);
assert.match(crisisCard, /setCrisisActive/);
ok('Settings crisis line is a collapsible reference; Talk crisis card is untouched');

console.log(`\n${passed} checks passed`);
