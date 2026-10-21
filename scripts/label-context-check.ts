/**
 * Labels in context, for everyone (emci 2026-10-20). "My boss is a narcissist" is not an
 * automatic pass: it can assert an unsupported diagnosis about a real person. The five classes:
 *   1 discussion of a term                 PASS
 *   2 quotation / attributed speech         PASS
 *   3 clearly fictional / figurative / joke PASS
 *   4 description of behaviour              PASS
 *   5 verdict / diagnosis about a real or addressed person   FAIL
 * Run: npm run check:label-context
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { labelVerdictHit, readerLabelHit, thirdPartyLabelHit } from '../src/lib/voice/clinical';
import { jargonReviewTerms, matchingJargonTerm } from '../src/lib/voice/jargon';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
assert.equal(pkg.scripts['check:label-context'], 'tsx ./scripts/label-context-check.ts');
ok('wired as check:label-context');

const CLASSES: Record<string, { expect: 'pass' | 'fail'; lines: string[] }> = {
  '1 discussion of a term': {
    expect: 'pass',
    lines: [
      'Narcissism is a word people overuse.',
      'The book on gaslighting sat unread on the shelf.',
      'Introverts need quiet after a party, and nobody should apologise for it.',
      'Love languages are a pop idea about how people show care.',
      'Bipolar is also a word people use for the weather.',
      'Coping mechanisms are a whole aisle in the bookstore.',
    ],
  },
  '2 quotation / attributed speech': {
    expect: 'pass',
    lines: [
      'She called him a narcissist and left the party.',
      'My mom thinks my boss is a narcissist.',
      'He told me she was clearly bipolar, then asked for the Wi-Fi password.',
    ],
  },
  '3 fictional / figurative / joke': {
    expect: 'pass',
    lines: [
      'My cat is a narcissist about the good chair.',
      'The group chat needs therapy.',
      'Gaslit by the thermostat again: it said 21 and felt like 15.',
      'A toxic workplace finally let you leave on time.',
      'Bipolar weather, so you packed two jackets.',
      'The ADHD-friendly timer helps the whole office.',
      'Trauma-bonded by a bad haircut, you both laughed.',
    ],
  },
  '4 description of behaviour': {
    expect: 'pass',
    lines: [
      'He talks about himself nonstop at dinner.',
      'She answers every message within a minute and never asks a question back.',
      'You are an early riser and it shows.',
      'You may feel needy when the chat goes quiet.',
      'Your boss moved the deadline three times without telling anyone.',
    ],
  },
  '5 verdict about a real or addressed person': {
    expect: 'fail',
    lines: [
      'You are a narcissist.',
      'Your boss is a narcissist.',
      'My boss is a narcissist.',
      'Your ex is clearly a psychopath.',
      'People like you are needy.',
      'You have ADHD.',
      'That is so bipolar of you.',
      'She is clearly bipolar.',
      "He's such a narcissist.",
      'My roommate has ADHD, obviously.',
      'You were diagnosed with anxiety years ago.',
      'This could be a diagnosis.',
      // A named speaker does not launder a verdict aimed at the reader; "apparently" names no one.
      'You sound like a narcissist.',
      'Your therapist said you are a narcissist.',
      'Your ex said you are a narcissist, which says more about your ex.',
      'Apparently you are a narcissist.',
      'Apparently the new manager is a gaslighter.',
    ],
  },
};

for (const [name, { expect, lines }] of Object.entries(CLASSES)) {
  for (const line of lines) {
    const hit = labelVerdictHit(line);
    if (expect === 'pass') assert.equal(hit, null, `${name} must pass: "${line}" (hit: ${hit})`);
    else assert.ok(hit, `${name} must fail: "${line}"`);
  }
  ok(`class ${name}: ${lines.length} lines ${expect}`);
}

// Same word, with and without a verdict, through the jargon guard (generated output) as well.
const JARGON_CLASSES: [pass: string, fail: string][] = [
  ['Narcissism is a word people overuse.', 'You are a narcissist.'],
  ['She called him a narcissist.', 'He is a narcissist.'],
  ['My cat is a narcissist.', 'My boss is a narcissist.'],
  ['Gaslit by the thermostat.', 'You gaslight people.'],
  ['Introverts need quiet.', "You're an introvert."],
  ['She called him a narcissist.', 'You sound like a narcissist.'],
  ['The group chat needs therapy.', 'Your therapist said you are a narcissist.'],
];
for (const [pass, fail] of JARGON_CLASSES) {
  assert.equal(matchingJargonTerm(pass), null, `jargon passes: "${pass}"`);
  assert.ok(matchingJargonTerm(fail), `jargon fails: "${fail}"`);
}
ok(`jargon guard agrees: ${JARGON_CLASSES.length} pairs`);

// readerLabelHit stays the strict reader rule: reported speech is only exempted by labelVerdictHit.
assert.ok(readerLabelHit('Your ex said you are a narcissist.'), 'readerLabelHit stays strict');
assert.ok(labelVerdictHit('Your ex said you are a narcissist.'), 'reported speech aimed at the reader is still a verdict');
assert.equal(labelVerdictHit('She called him a narcissist.'), null, 'the context layer lets third-person reported speech through');
assert.equal(thirdPartyLabelHit('Narcissism is a word people overuse.'), null);
assert.ok(thirdPartyLabelHit('Your boss is a narcissist.'));
ok('readerLabelHit strict; labelVerdictHit adds third persons and reported speech');

// "People say you are ..." is the writer's own verdict in disguise: not exempt.
assert.ok(labelVerdictHit('People say you are a narcissist.'), 'a generic speaker is not an attribution');
ok('a generic speaker ("people say") is not reported speech');

// Stored copy: a watched word with no verdict is listed for review, never a failure.
assert.deepEqual(jargonReviewTerms('Love languages are a pop idea.'), ['love language']);
assert.deepEqual(jargonReviewTerms('Your love language is gifts.'), []);
ok('stored copy: mentions are review items, verdicts are failures');

// KNOWN LIMITS, pinned so a change is noticed. These are what a regex cannot tell apart; each takes
// the safe side stated in the file comments of clinical.ts / jargon.ts.
assert.ok(labelVerdictHit('My ex is a narcissist, said the plant.') === null, 'known limit: any speaker verb exempts the sentence, even a joke one');
assert.equal(labelVerdictHit('Dave is a narcissist.'), null, 'known limit: a bare name is not seen (a pet has a name too)');
assert.ok(labelVerdictHit('My ex is a narcissist, and the plant agrees.'), 'known limit: a human-role joke is flagged, the safe side');
ok('known limits pinned: reported-speech exemption, bare names, human-role jokes');

console.log(`\n${passed} label-context checks passed`);
