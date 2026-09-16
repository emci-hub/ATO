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

// The Sage tab's chat layout assertions (keyboard lift, composer padding,
// scroll-to-end, the 8-ball and usage line) went with Talk's backend on
// 2026-09-14 — the tab is now an inert placeholder with no composer. Restore
// them when Talk is rebuilt.
// The 8-ball was Talk-only UI and was deleted with the lane, along with the
// composer/keyboard-lift assertions above it. Nothing here asserts a Sage
// layout any more; the quota formatting below is shared and still live.

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
// PARKED (ISOLATION_PLAN §7 Card F, 2026-09-15): the poster, the voice fold,
// the crisis-region picker, Sage usage and credits are all off You, so there
// is no longer an ordering to assert. What still holds — and is the reason
// these two lines survive — is that You never renders the account name or the
// profile card itself. Each component's own behaviour is covered elsewhere.
assert.doesNotMatch(you, /<SharePoster/);
assert.doesNotMatch(you, /SettingsFold title="How Sage sounds"/);
ok('You is parked down to its account controls: no poster, no profile card, no name on screen');

const picker = read('src/components/crisis-region-picker.tsx');
assert.match(picker, /SettingsFold title="If you need someone now"/);
assert.match(picker, /Passive Settings reference/);
assert.doesNotMatch(picker, /CrisisCard/);
const crisisCard = read('src/components/crisis-card.tsx');
assert.match(crisisCard, /I'm okay, keep going/);
assert.match(crisisCard, /setCrisisActive/);
ok('Settings crisis line is a collapsible reference; Talk crisis card is untouched');

console.log(`\n${passed} checks passed`);
