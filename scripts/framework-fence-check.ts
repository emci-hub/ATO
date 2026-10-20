/**
 * Framework fence (rule D6, emci 2026-10-20): a psychology framework, theory or
 * test may be NAMED and explained; a result handed to the reader, an "ATO
 * measures it" claim, a validity / official-test claim, an implied diagnosis or a
 * trademark affiliation fails. Every rule has a failing and a passing form.
 * Run: npm run check:framework-fence
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { poleCopyClean } from '../src/lib/axis-poles';
import { atoTokenCopyClean } from '../src/lib/ato-tokens';
import { categoryBandCopyClean } from '../src/lib/category-bands';
import { categoryCopyClean } from '../src/lib/categories';
import { tokenCopyClean } from '../src/lib/tokens';
import { bandPhrasesClean } from '../src/lib/trait-bands';
import {
  containsFrameworkTerm,
  frameworkMentions,
  matchingFrameworkTerms,
  sanitizeFacts,
} from '../src/lib/voice/framework-fence';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
assert.equal(pkg.scripts['check:framework-fence'], 'tsx ./scripts/framework-fence-check.ts');
ok('wired as check:framework-fence');

function pairs(label: string, rows: [pass: string, fail: string][]) {
  for (const [pass, fail] of rows) {
    assert.equal(containsFrameworkTerm(pass), false, `${label}: must pass: "${pass}" (hit: ${matchingFrameworkTerms(pass).join(', ')})`);
    assert.equal(containsFrameworkTerm(fail), true, `${label}: must fail: "${fail}"`);
  }
  ok(`${label}: ${rows.length} pass/fail pairs`);
}

// 1. A result handed to a person, same framework each time.
pairs('framework results vs explanation', [
  ['The Big Five is a model psychologists use; ATO is not that test.', 'Your Big Five score says you plan ahead.'],
  ['MBTI sorts people into 16 types; ATO does not use it.', 'Your MBTI type is INTJ.'],
  ['Attachment theory is about how people bond as children.', 'Your attachment style explains the texting.'],
  ['Growth mindset is the idea that skills can be trained.', 'You have a growth mindset.'],
  ['Locus of control describes who a person thinks steers events.', 'Your locus of control is external.'],
  ['Neuroticism is one of the Big Five trait names.', 'You scored high in neuroticism.'],
  ['Self-efficacy is the belief that you can pull a task off.', 'You scored low in self-efficacy.'],
  ['The Thomas-Kilmann model names five conflict modes.', 'Your TKI score shows you avoid conflict.'],
]);

// 2. Claims that ATO runs a framework, or that it is an official / validated assessment.
pairs('ATO and validity claims', [
  ['ATO does not measure the Big Five.', 'ATO measures the Big Five.'],
  ['ATO does not score neuroticism.', 'ATO scores neuroticism, not a diagnosis.'],
  ['Attachment style is a model psychologists use; ATO is not that test.', 'Here is your attachment style: anxious.'],
  ['Attachment style is a model psychologists use; ATO is not that test.', 'Attachment style: anxious.'],
  ['Attachment style: a model psychologists use to describe early bonds.', 'Your attachment style is anxious.'],
  ['This is not a clinically validated test.', 'This is a clinically validated test.'],
  ['These questions are not an official assessment.', 'Here is your official test result.'],
  ['ATO is not based on Myers-Briggs.', 'ATO is based on Myers-Briggs.'],
  ['A certified test center closes at five.', 'Take the validated assessment inside ATO.'],
]);

// 3. Type codes: a bare code or one handed to a person fails; explained, it passes.
pairs('type codes', [
  ['MBTI sorts people into 16 types such as INTJ; it is a model, not a diagnosis.', 'Your INFJ side is showing.'],
  ['INFP is one of the MBTI types psychologists argue about.', "You're an INFP, honestly."],
  ['Some people on the MBTI test come out as ENFP.', 'Just ENFP things.'],
  ['Myers-Briggs types such as ESTJ are a pop-psychology model.', 'I am an INFJ'],
]);
assert.deepEqual(matchingFrameworkTerms('Your INFJ side is showing.'), ['INFJ'], 'the matcher names the code');
assert.deepEqual(matchingFrameworkTerms('A bare INTJ line.'), ['INTJ']);
ok('the matcher reports the code or the rule that fired');

// 4. Narrow branding rule: a trademark as the reader's result, what ATO measures, or an affiliation.
pairs('trademark branding', [
  ['16Personalities is a free quiz some people compare notes on.', 'Your 16Personalities result is in.'],
  ['Myers-Briggs is a test some people take at work.', 'ATO is the official Myers-Briggs partner.'],
  ['MBTI is a trademark of someone else; we have no link to it.', 'ATO is endorsed by the MBTI people.'],
  ['People argue about MBTI online.', 'ATO uses MBTI to score you.'],
]);

// 5. A diagnosis implied from a framework.
pairs('diagnosis from a framework', [
  ['Attachment disorder is a clinical term; ATO does not diagnose it.', 'Your attachment theory profile is a diagnosis of anxiety.'],
]);

// 6. The old blanket ban on everyday words is gone.
for (const ordinary of [
  'A competitive streak runs in the family.',
  'Compromising photos leaked at the party.',
  'We swam in the ocean.',
  'A collaborative doc and an accommodating host.',
  'The ECR was a rubber stamp at the office.',
  'A tipi at the campsite.',
]) {
  assert.equal(containsFrameworkTerm(ordinary), false, `ordinary words pass: "${ordinary}"`);
}
ok('ocean / competitive / collaborative / compromising / accommodating are ordinary words again');

// 7. Negation passes the claim rules but never hands out a type code.
assert.equal(containsFrameworkTerm('ATO never claims to be a clinically validated or official test.'), false);
assert.equal(containsFrameworkTerm("You're not an INFJ."), true, 'denying a type still hands one out');
ok('a negated claim passes; a negated type code still fails');

// 8. Mentions are diagnostics only.
assert.deepEqual(frameworkMentions('The Big Five and attachment theory are models.'), ['big five', 'attachment theory']);
assert.deepEqual(frameworkMentions('A competitive streak.'), []);
ok('frameworkMentions lists names without judging them');

// 9. Teach-Sage facts keep the old behaviour for what is a claim.
assert.deepEqual(sanitizeFacts(['I am an INFJ', 'I finish work at four']), ['I finish work at four']);
assert.deepEqual(sanitizeFacts(['I read about the Big Five once']), ['I read about the Big Five once']);
assert.deepEqual(sanitizeFacts('nope'), []);
ok('sanitizeFacts drops a handed-out type, keeps a plain mention');

// 10. Call sites: the stored copy that already guards itself with the fence keeps passing.
assert.equal(poleCopyClean(), true);
assert.equal(bandPhrasesClean(), true);
assert.equal(categoryBandCopyClean(), true);
assert.equal(categoryCopyClean(), true);
assert.equal(tokenCopyClean(), true);
assert.equal(atoTokenCopyClean(), true);
ok('stored copy lists (poles, bands, categories, tokens) still pass their own fence');

console.log(`\n${passed} framework-fence checks passed`);
