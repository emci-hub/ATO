/**
 * Style rules, judged by meaning (core content policy, emci 2026-10-20:
 * docs/copy-review-rules.md). Run: npm run check:style-rules
 *
 * Each rule that used to be a blanket word ban is pinned with PAIRS: contextual
 * uses that must pass and genuinely problematic uses that must fail.
 *   - clear-voice: therapy-speak is refused at phrase level; a literal
 *     "boundaries", "journey" or a situational "you are on time" passes.
 *   - directive advice: "you should…" fails; "the clock should have been faster" passes.
 *   - filters: vague-filler applies to a task only; honest "maybe" in an
 *     observation passes; cruelty needs the reader as the target.
 */
import assert from 'node:assert/strict';

import { diveLineViolation } from '../src/lib/category-deep-dive/dive';
import { directiveAdviceViolation } from '../src/lib/voice/directive-advice';
import { filterCard, isCruelCut, isVagueDo } from '../src/lib/voice/filters';
import { tipRuleViolation, type TipField } from '../src/lib/voice/clear-voice';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

/* 1 · clear voice (stored tips) ------------------------------------------- */

const tipPass: [string, TipField][] = [
  ['When a friend walks the property boundaries with you, you tend to check the fence twice.', 'focus'],
  ['You are on time for most things, but small tasks can pile up when nothing is scheduled.', 'focus'],
  ['When the journey to work runs long, you tend to skip breakfast and feel it by noon.', 'focus'],
  ['When deadlines stack up, stress can manifest as a headache for you by Thursday.', 'focus'],
  ['The group chat is always loud, so you tend to mute it and miss the plans.', 'why'],
  ['You consider yourself warned whenever the group chat goes quiet at midnight.', 'focus'],
  ['Walk the property boundaries with a friend today, so you both know where the fence goes.', 'try'],
];
for (const [text, field] of tipPass) {
  assert.equal(tipRuleViolation(text, field), null, `contextual use passes: "${text}"`);
}
const tipFail: [string, TipField][] = [
  ['When a friend cancels, you tend to set healthy boundaries and honor your feelings.', 'focus'],
  ['You tend to lean into the discomfort when a plan falls through.', 'focus'],
  ['Your healing journey shows when you wait for a reply.', 'focus'],
  ['You always reply first when the group chat goes quiet.', 'focus'],
  ["You're a perfectionist when a friend reads your draft.", 'focus'],
  ["You're so organized when plans change that friends ask you to plan trips.", 'focus'],
  ['You tend to hold space for everyone in the group chat at midnight.', 'focus'],
  ['You might want to consider texting a friend before you decide.', 'focus'],
  ['You have ADHD when a friend texts you late at night.', 'focus'],
];
for (const [text, field] of tipFail) {
  assert.notEqual(tipRuleViolation(text, field), null, `therapy-speak or a reader label fails: "${text}"`);
}
ok('clear voice: literal boundaries / journey / "you are on time" / "manifest as" pass; therapy-speak phrases, "you always", identity labels and diagnoses fail');

/* 2 · directive advice ---------------------------------------------------- */

for (const text of [
  'The clock should have been faster than that.',
  'It should be illegal to schedule a call at 8:01.',
  'Nobody should have to reread a group chat to get the point.',
  'Somebody should tell the printer it has one job.',
]) {
  assert.equal(directiveAdviceViolation(text), null, `ordinary or joking "should" passes: "${text}"`);
}
for (const text of [
  'You should share that list with someone.',
  'You need to answer the group chat tonight.',
  'You really ought to call your mom.',
  "You'd better reply before it gets weird.",
  'Why not you start with the email?',
]) {
  assert.notEqual(directiveAdviceViolation(text), null, `an order aimed at the reader fails: "${text}"`);
}
assert.equal(diveLineViolation('You should share that list with someone, it is a good one in the end.', ''), 'advice');
assert.notEqual(diveLineViolation('The group chat should come with a warning label for a quiet morning.', ''), 'advice');
ok('directive advice: "you should / you need to" fails; "the clock should have been faster" passes (deep dive + story share it)');

/* 3 · vague Do (task text only) ------------------------------------------- */

for (const text of [
  'Text one friend back before lunch today.',
  'Try to text one friend back before lunch.',
  'Call your mom, maybe for five minutes tonight.',
]) {
  assert.equal(isVagueDo(text), false, `a concrete task passes: "${text}"`);
}
for (const text of [
  'Maybe send a nice message to a friend.',
  'Try to be calm when the group chat gets loud.',
  'Be more present when friends talk to you.',
  'Do your best to get things done today.',
]) {
  assert.equal(isVagueDo(text), true, `vague filler fails as a task: "${text}"`);
}
// An observation is not a task: honest uncertainty passes the card filter.
assert.equal(
  filterCard(
    { read: 'Maybe it is just Monday, and the inbox is behaving.', do: 'Text one friend back before lunch today.' },
    { shownCards: [], previousHadCut: false },
  ),
  null,
  'maybe in an observation passes',
);
assert.equal(
  filterCard(
    { read: 'Monday is fine, the inbox is behaving.', do: 'Maybe send a nice message to a friend.' },
    { shownCards: [], previousHadCut: false },
  ),
  'vague-do',
  'the same hedge as the task fails',
);
ok('filters: vague filler is refused for a Do only; "maybe" in an observation passes');

/* 4 · cruel verdicts need the reader as the target ------------------------ */

for (const text of [
  'Give up the third tab and the other two will get done.',
  'A useless umbrella is still an umbrella.',
  'A loser of a wifi signal ruined the call.',
  'There is no point trying to reason with the printer.',
  'The hopeless group chat has been planning since March.',
  'You failed the parking test and still found the spot.',
  'Worthless coupons, again.',
  'An idiot-proof setup still found a way.',
  'The idiot light came on, again.',
  'A stupid-simple recipe for Friday.',
]) {
  assert.equal(isCruelCut(text), false, `not aimed at the reader, passes: "${text}"`);
}
for (const text of [
  'You are a loser.',
  "You're useless.",
  "You're SO lazy about this.",
  "You're a total embarrassment at work.",
  'You suck at replying.',
  'What is wrong with you?',
  'Just give up.',
  'Give up on yourself already.',
  'You always quit.',
  'You are an idiot.',
  'What a loser you are.',
  'You failed again.',
  "You're such a moron about money.",
]) {
  assert.equal(isCruelCut(text), true, `a degrading verdict aimed at the reader fails: "${text}"`);
}
ok('filters: cruelty is target-aware ("give up the third tab" passes; "you are a loser" fails)');

console.log(`\nstyle-rules: ${passed} checks passed`);
