/**
 * Jargon guard — keyword list + fallback, no model. Run: npm run check:jargon
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  JARGON_FALLBACK_READ,
  JARGON_FALLBACK_DO,
  JARGON_FALLBACK_TALK,
  applyJargonFallback,
  matchingJargonTerm,
} from '../src/lib/voice/jargon';
import { DEFAULT_VOICE_PRESET, voicePresetOf } from '../src/lib/voice/preset';

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
ok('keyword list flags jargon and leaves clean copy');

const swapped = applyJargonFallback({
  read: 'You are an introvert.',
  do: 'After you make coffee, text one person.',
  nudge: 'Your attachment style showed up.',
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

const sage = read('src/app/voice/sage.txt');
assert.doesNotMatch(sage, /supportive coach/i);
assert.doesNotMatch(sage, /You are Sage/i);
assert.match(sage, /Twice now you've gone with the option that actually interests you/);
assert.match(sage, /After you make coffee, text the one person you've been meaning to/);
ok('sage.txt is behavior + few-shots, not a role noun');

const prompt = read('src/lib/voice/providers/prompt.ts');
assert.doesNotMatch(prompt, /You are Sage, the coach/);
assert.match(prompt, /VOICE_PRESET_GUIDE/);
ok('generate prompt carries the preset and drops the coach role line');

const talk = read('src/lib/voice/talk.ts');
const router = read('src/lib/voice/router.ts');
assert.match(talk, /logJargonHit/);
assert.match(router, /logJargonHit/);
assert.match(read('src/lib/voice/quota-server.ts'), /log_jargon_guard/);
ok('jargon fires log to ai_usage without incrementing quota in the client helper');

const crisis = read('src/lib/crisis/copy.ts');
assert.doesNotMatch(crisis, /JARGON_FALLBACK/);
ok('crisis copy is untouched');

console.log(`\nAll ${passed} jargon checks passed.`);
