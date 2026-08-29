/**
 * You-tab trait bands. Run: npm run check:trait-bands
 *
 * Phrase endpoints only. Reads traitStateFromRow. No gap-copy for null axes.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  TRAIT_BANDS_LABEL,
  TRAIT_BAND_PHRASES,
  bandPhrasesClean,
  filledTraitBands,
} from '../src/lib/trait-bands';
import { TRAIT_AXES, emptyTraitState, mergeTraitWrite } from '../src/lib/traits';
import { containsFrameworkTerm } from '../src/lib/voice/framework-fence';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

assert.equal(Object.keys(TRAIT_BAND_PHRASES).length, TRAIT_AXES.length);
assert.equal(TRAIT_BAND_PHRASES.openness.low, 'sticks with what works');
assert.equal(TRAIT_BAND_PHRASES.openness.high, 'goes for the untried option');
assert.equal(TRAIT_BAND_PHRASES.conscientiousness.low, 'keeps plans loose');
assert.equal(TRAIT_BAND_PHRASES.conscientiousness.high, 'sees a plan through');
assert.equal(TRAIT_BAND_PHRASES.extraversion.low, 'leans toward quiet time');
assert.equal(TRAIT_BAND_PHRASES.extraversion.high, 'leans toward people around');
assert.equal(TRAIT_BAND_PHRASES.agreeableness.low, 'holds their ground');
assert.equal(TRAIT_BAND_PHRASES.agreeableness.high, 'goes along to keep it easy');
assert.equal(TRAIT_BAND_PHRASES.steadiness.low, 'feels a bad day longer');
assert.equal(TRAIT_BAND_PHRASES.steadiness.high, 'shakes it off quickly');
ok('all 15 axes have phrases; OCEAN matches the locked wording');

for (const axis of TRAIT_AXES) {
  const { low, high } = TRAIT_BAND_PHRASES[axis];
  assert.equal(containsFrameworkTerm(low), false, low);
  assert.equal(containsFrameworkTerm(high), false, high);
  assert.doesNotMatch(low, /\d|%|percent/i);
  assert.doesNotMatch(high, /\d|%|percent/i);
  assert.doesNotMatch(low, new RegExp(axis, 'i'));
  assert.doesNotMatch(high, new RegExp(axis, 'i'));
}
assert.equal(bandPhrasesClean(), true);
ok('band phrases name no framework, axis, number, or percent');

assert.deepEqual(filledTraitBands(emptyTraitState().values), []);
const damped = mergeTraitWrite(emptyTraitState(), { openness: 0.8 }, 'self_game', ['openness']);
const bands = filledTraitBands(damped.values);
assert.equal(bands.length, 1);
assert.equal(bands[0]?.axis, 'openness');
assert.equal(bands[0]?.value, damped.values.openness);
assert.notEqual(bands[0]?.value, 0.8);
ok('null axes stay hidden; filled bands read the damped mergeTraitWrite number');

const you = read('src/app/(tabs)/you.tsx');
const fold = read('src/components/trait-bands-fold.tsx');
const intakeIdx = you.indexOf('<IntakeSettings');
const bandsIdx = you.indexOf('<TraitBandsFold');
assert.ok(intakeIdx >= 0 && bandsIdx > intakeIdx);
assert.match(fold, /SettingsFold title=\{TRAIT_BANDS_LABEL\}/);
assert.doesNotMatch(fold, /defaultOpen/);
assert.doesNotMatch(fold, /%|percent|openness|Extraversion/);
assert.doesNotMatch(fold, /accessibilityValue/);
assert.equal(TRAIT_BANDS_LABEL.includes('%'), false);
ok('fold sits next to identity chips, collapsed, with no number or trait-name copy');

console.log(`\n${passed} trait-band checks passed`);
