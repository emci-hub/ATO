/**
 * The mini guy as the app's notification character. Run: npm run check:buddy
 *
 * Runs the real note reducer (pure), then pins the wiring: the bubble is the
 * restored pinned MilestoneToast at the tab shell, a tap makes him speak, the
 * milestone crossing check is back (in a hook, announced through him), and he
 * forgets everything on sign-out.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { BUDDY_COPY_REVIEWED, BUDDY_IDLE_LINES, nextIdleNote } from '../src/lib/buddy/idle';
import { EMPTY_BUDDY_STATE, MAX_WAITING, buddyReduce, type BuddyNote, type BuddyState } from '../src/lib/buddy/notes';
import { lineRuleViolation } from '../src/lib/daily-line/bank';
import { MILESTONE_DEFS } from '../src/lib/milestones';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

const loud = (id: string): BuddyNote => ({ id, title: id, body: '', loud: true });
const quiet = (id: string): BuddyNote => ({ id, title: id, body: '', loud: false });
const push = (state: BuddyState, note: BuddyNote) => buddyReduce(state, { type: 'push', note });

// --- the queue ----------------------------------------------------------------
let s = push(EMPTY_BUDDY_STATE, loud('a'));
assert.equal(s.showing?.id, 'a');
assert.equal(s.waiting.length, 0);
ok('a loud note pops up by itself');

s = push(EMPTY_BUDDY_STATE, quiet('q'));
assert.equal(s.showing, null);
assert.equal(s.waiting.length, 1);
s = buddyReduce(s, { type: 'tap', idle: quiet('idle') });
assert.equal(s.showing?.id, 'q');
assert.equal(s.waiting.length, 0);
ok('a quiet note waits behind the dot until he is tapped');

s = push(push(EMPTY_BUDDY_STATE, loud('a')), loud('b'));
assert.equal(s.showing?.id, 'a');
assert.equal(s.waiting.length, 1);
s = buddyReduce(s, { type: 'done' });
assert.equal(s.showing?.id, 'b');
s = buddyReduce(s, { type: 'done' });
assert.equal(s.showing, null);
ok('two loud notes are said one after the other, never on top of each other');

s = push(push(EMPTY_BUDDY_STATE, loud('a')), loud('a'));
assert.equal(s.waiting.length, 0);
s = buddyReduce(s, { type: 'done' });
assert.equal(push(s, loud('a')).showing, null);
ok('the same note is never said twice in one run');

s = EMPTY_BUDDY_STATE;
for (let i = 0; i < MAX_WAITING + 3; i += 1) s = push(s, quiet(`q${i}`));
assert.equal(s.waiting.length, MAX_WAITING);
assert.equal(s.waiting[0]!.id, 'q3');
ok(`at most ${MAX_WAITING} notes wait; the oldest makes room for newer news`);

s = buddyReduce(EMPTY_BUDDY_STATE, { type: 'tap', idle: nextIdleNote(0) });
assert.equal(s.showing?.title, BUDDY_IDLE_LINES[0]);
const again = buddyReduce(s, { type: 'tap', idle: nextIdleNote(1) });
assert.equal(again.showing?.title, BUDDY_IDLE_LINES[1]);
assert.ok(again.shownCount > s.shownCount);
assert.equal(nextIdleNote(BUDDY_IDLE_LINES.length).title, BUDDY_IDLE_LINES[0]);
ok('with nothing waiting, a tap says the next idle line, and the bubble restarts each time');

const talking = push(EMPTY_BUDDY_STATE, loud('news'));
assert.equal(buddyReduce(talking, { type: 'tap', idle: nextIdleNote(0) }), talking);
ok('a tap never cuts real news short; it is said once, so replacing it would lose it');

assert.deepEqual(buddyReduce(push(EMPTY_BUDDY_STATE, loud('a')), { type: 'reset' }), EMPTY_BUDDY_STATE);
ok('reset forgets everything');

// --- his copy -------------------------------------------------------------------
assert.equal(BUDDY_COPY_REVIEWED, false);
assert.ok(BUDDY_IDLE_LINES.length >= 10);
assert.equal(new Set(BUDDY_IDLE_LINES).size, BUDDY_IDLE_LINES.length);
for (const line of BUDDY_IDLE_LINES) {
  assert.equal(lineRuleViolation(line), null, `${lineRuleViolation(line)}: ${line}`);
  assert.ok(line.length <= 70, `too long for the bubble: ${line}`);
}
ok('his idle lines are unreviewed draft copy, short, and pass the moment-voice line rules');

for (const def of MILESTONE_DEFS.filter((d) => !d.id.startsWith('axis_complete_'))) {
  assert.doesNotMatch(def.body, /from the bank|checked in/, `old-voice milestone copy: ${def.body}`);
}
ok('the milestones he announces no longer use the old "from the bank" / "checked in" wording');

// --- wiring ---------------------------------------------------------------------
const layout = read('src/app/(tabs)/_layout.tsx');
assert.match(layout, /<NavPixel \/>[\s\S]*<BuddyBubble \/>/);
const bubble = read('src/components/buddy-bubble.tsx');
assert.match(bubble, /<MilestoneToast/);
assert.match(bubble, /onDone=\{buddyNoteDone\}/);
assert.match(bubble, /if \(!me \|\| isCrisisActive\(\)\) return null;/);
assert.match(bubble, /NAV_PIXEL_SLOT/);
ok('his bubble is the pinned MilestoneToast at the tab shell, beside him, and silent while the crisis card is up');

const pixel = read('src/components/nav-pixel.tsx');
assert.match(pixel, /if \(isCrisisActive\(\)\) return;[\s\S]*tapBuddy\(nextIdleNote\(tapCountRef\.current\)\);/);
ok('tapping him makes him speak, after the crisis guard');

const hook = read('src/hooks/use-buddy-milestones.ts');
for (const metric of ["'bankTotalProgress'", "'profile_percent'", '`axisComplete:${axis}`', "'current_streak'"]) {
  assert.ok(hook.includes(`checkMilestones(${metric}`), `the crossing check must cover ${metric}`);
}
assert.match(hook, /persistCelebratedMilestones\(userId, crossed\.map\(\(def\) => def\.id\)\)/);
assert.match(hook, /if \(!firstLook\) announce\(crossed\);/);
assert.match(hook, /if \(!userId \|\| !tracksReady \|\| tracks\.length === 0\) return;/);
assert.match(hook, /if \(def\.id\.startsWith\('axis_complete_'\)\) return false;/);
ok('milestone crossings are back: remembered on the account, silent on the first look, and trait-named ones never said');

assert.match(read('src/app/(tabs)/intake-sweep.tsx'), /useBuddyMilestones\(\{ me, tracks, tracksReady, resetKey: dataEpoch, onPersisted: refresh \}\);/);
assert.match(read('src/app/(tabs)/index.tsx'), /useBuddyStreak\(\{ me, streak: todayLine\?\.streak, onPersisted: refreshMe \}\);/);
const fold = read('src/components/questions-fold.tsx');
assert.match(fold, /pushBuddyNote\(\{\s+id: `round:\$\{holder\.pack\?\.id \?\? 'done'\}`,\s+title: ROUND_COMPLETE_TITLE,\s+body: roundCompleteBody\(tracks, paid\),/);
assert.doesNotMatch(fold, /<MilestoneToast/);
assert.match(read('src/components/full-profile-banner.tsx'), /pushBuddyNote\(\{ id: 'intake:done'/);
const identity = read('src/components/identity-card.tsx');
assert.match(identity, /pushBuddyNote\(\{ id: `identity:\$\{name\}`/);
assert.match(identity, /id: `style:\$\{skin\}`/);
ok('answers, streaks, a finished round, the 50, a locked name and a new name style all go through him');

assert.match(read('src/lib/local-account-data.ts'), /resetBuddy\(\);/);
ok('sign-out and account deletion clear whatever he was waiting to say');

for (const rel of ['src/lib/buddy/notes.ts', 'src/lib/buddy/idle.ts', 'src/components/buddy-bubble.tsx', 'src/hooks/use-buddy-milestones.ts']) {
  assert.doesNotMatch(read(rel), /generateText|ai-generate|from '@\/play|from '@\/lib\/play/, `${rel} must not call the model or import Play`);
}
ok('he never calls the model and never imports from Play');

console.log(`\n${passed}/${passed} buddy checks passed.`);
