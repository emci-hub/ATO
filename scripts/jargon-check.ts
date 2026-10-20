/**
 * Jargon guard — keyword list + fallback, no model. Run: npm run check:jargon
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  JARGON_FALLBACK_READ,
  JARGON_FALLBACK_DO,
  JARGON_FALLBACK_TALK,
  applyJargonFallback,
  jargonReviewTerms,
  matchingJargonTerm,
} from '../src/lib/voice/jargon';
import {
  DEFAULT_VOICE_PRESET,
  VOICE_PRESET_PREVIEWS,
  voicePresetOf,
} from '../src/lib/voice/preset';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

assert.equal(matchingJargonTerm('Logged. Quiet hold.'), null);
assert.equal(matchingJargonTerm('You are an introvert at heart.'), 'introvert');
assert.equal(matchingJargonTerm("That's who you are."), "that's who you are");
ok('jargon verdicts are flagged and clean copy is left');

// Context, not keywords (emci 2026-10-20). Each pair uses the same term: once as discussion, reported speech,
// a figure or a description (passes), once as a verdict about the reader or a real person (fails). Class numbers
// are the five in clinical.ts `labelVerdictHit`.
const JARGON_PAIRS: [pass: string, fail: string, term: string][] = [
  ['Introverts need quiet after a party.', 'You are an introvert.', 'introvert'],
  ['Even extroverts hide in the bathroom at weddings.', "You're so extroverted at dinner parties.", 'extrovert'],
  ['An ambivert is somebody who changes with the room.', 'As an ambivert, you switch rooms fast.', 'ambivert'],
  ['Narcissism is a word people overuse.', 'Your boss is a narcissist.', 'narcissist'],
  ['She called him a narcissist and left the party.', 'He is clearly a narcissist.', 'narcissist'],
  ['My cat is a narcissist about the good chair.', 'My ex is a narcissist.', 'narcissist'],
  ['Gaslit by the thermostat again, it said 21 and felt like 15.', 'You gaslight people into splitting the bill.', 'gaslight'],
  ['Love languages are a pop idea about how people show care.', 'Your love language is gifts.', 'love language'],
  ['Coping mechanisms are a whole aisle in the bookstore.', 'Your coping mechanism is memes.', 'coping mechanism'],
  ['The inner child chapter was the funniest in the book.', "That's your inner child talking.", 'inner child'],
  ['This is not a diagnosis, just a Tuesday.', 'You were diagnosed years ago.', 'diagnosed'],
  ['You are an early riser and it shows.', "That's who you are.", "that's who you are"],
  ['He talks about himself nonstop at dinner.', 'People like you are narcissistic about dinners.', 'narcissist'],
];
for (const [pass, fail] of JARGON_PAIRS) {
  assert.equal(matchingJargonTerm(pass), null, `contextual use passes: "${pass}" (hit: ${matchingJargonTerm(pass)})`);
  assert.ok(matchingJargonTerm(fail), `a verdict fails: "${fail}"`);
}
// The returned term still names what matched.
assert.equal(matchingJargonTerm('Your love language is gifts.'), 'love language');
assert.equal(matchingJargonTerm('You are an introvert.'), 'introvert');
// Stored / hand-written copy: mentions without a verdict are listed for a human, not failed.
assert.deepEqual(jargonReviewTerms('Introverts need quiet after a party.'), ['introvert']);
assert.deepEqual(jargonReviewTerms('You are an introvert.'), [], 'a verdict is already a failure, not a review item');
assert.deepEqual(jargonReviewTerms('Logged. Quiet hold.'), []);
ok(`jargon in context: ${JARGON_PAIRS.length} pass/fail pairs (discussion / reported speech / figure vs verdict)`);

const swapped = applyJargonFallback({
  read: 'You are an introvert.',
  do: 'After you make coffee, text one person.',
  nudge: 'Your introverted side showed up.',
});
assert.equal(swapped.read, JARGON_FALLBACK_READ);
assert.equal(swapped.do, 'After you make coffee, text one person.');
assert.equal(swapped.nudge, null);
assert.ok(JARGON_FALLBACK_DO.length > 0);
assert.ok(JARGON_FALLBACK_TALK.length > 0);
ok('flagged Read/Nudge swap to fallback; clean Do stays');

assert.equal(voicePresetOf(null), DEFAULT_VOICE_PRESET);
assert.equal(voicePresetOf('parent'), 'parent');
assert.equal(voicePresetOf('nope'), DEFAULT_VOICE_PRESET);
ok('unknown preset falls back to close_friend');

assert.equal(VOICE_PRESET_PREVIEWS.neutral, 'Three days logged. Steady pattern so far.');
assert.equal(VOICE_PRESET_PREVIEWS.close_friend, "Three days in — that's actually something.");
assert.equal(
  VOICE_PRESET_PREVIEWS.hyperactive_friend,
  "THREE DAYS?! Okay you're actually doing this.",
);
assert.equal(VOICE_PRESET_PREVIEWS.parent, 'Three days. Good. Keep going.');
assert.equal(
  VOICE_PRESET_PREVIEWS.motivational_coach,
  "Three days down. You're building something real here.",
);
// The unmounted "Sage's voice" picker was deleted with Sage (2026-10-14);
// the previews stay static local copy.
assert.ok(!existsSync(resolve(root, 'src/components/voice-preset-picker.tsx')), 'the Sage voice picker is deleted');
ok('voice_preset previews are static local copy; the Sage voice picker is gone');

assert.ok(!existsSync(resolve(root, 'src/app/voice/sage.txt')), 'sage.txt stays deleted');
const voiceRef = read('src/app/voice/voice-reference.txt');
assert.doesNotMatch(voiceRef, /supportive coach/i);
assert.doesNotMatch(voiceRef, /You are Sage/i);
assert.doesNotMatch(voiceRef, /\bSage\b/, 'voice reference never names Sage');
assert.doesNotMatch(voiceRef, /Crisis card/i, 'voice reference never names the removed crisis card');
assert.match(voiceRef, /Twice now you've gone with the option that actually interests you/);
assert.match(voiceRef, /After you make coffee, text the one person you've been meaning to/);
ok('voice-reference.txt is behavior + few-shots, not a role noun');

// The card/Talk prompt builders went with the voice provider lane (2026-09-14).
// The surviving prompt builders carry the same preset guide.
const insightPrompt = read('src/lib/insight/generate-insight.ts');
assert.doesNotMatch(insightPrompt, /You are Sage, the coach/);
ok('surviving prompt builders carry the preset and drop the coach role line');

assert.match(read('src/lib/voice/quota-server.ts'), /log_jargon_guard/);
ok('jargon fires log to ai_usage without incrementing quota in the client helper');

// The crisis system was removed 2026-10-14; the static helpline row replaced it.
assert.ok(!existsSync(resolve(root, 'src/lib/crisis/copy.ts')), 'crisis copy stays deleted');
assert.doesNotMatch(read('src/components/helpline-row.tsx'), /JARGON_FALLBACK/);
ok('the crisis copy is gone and the static helpline row carries no jargon fallback');

console.log(`\nAll ${passed} jargon checks passed.`);
