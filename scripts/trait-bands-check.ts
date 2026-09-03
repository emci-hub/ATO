/**
 * Trait bands. Run: npm run check:trait-bands
 *
 * Phrase endpoints only; value reads the report-track EWMA (fallback me), so
 * the band matches Full Profile for the same axis. No gap-copy for null axes.
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
import { applyEwmaAnswer } from '../src/lib/trait-stability';
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
ok('all currently-defined axes have phrases; OCEAN matches the locked wording');

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

assert.deepEqual(filledTraitBands(emptyTraitState().values, []), []);

// Report-track-first: a self_situation answer damps the me column toward 0.5,
// but the report EWMA keeps the raw signal. The band must read the report
// track (matching Full Profile / Categories / Title / Story), not the damped
// me column.
const situation = mergeTraitWrite(
  emptyTraitState(),
  { extraversion: 0.8 },
  'self_situation',
  ['extraversion'],
);
const reportTrack = applyEwmaAnswer(null, 'extraversion', 'report', 0.8, '2026-09-03T00:00:00.000Z');
const unified = filledTraitBands(situation.values, [reportTrack]);
assert.equal(unified.length, 1);
assert.equal(unified[0]?.axis, 'extraversion');
assert.equal(unified[0]?.value, 0.8);
assert.notEqual(unified[0]?.value, situation.values.extraversion);
ok('band reads the report-track EWMA, not the damped me column');

// Fallback: no report track → raw me column. self_game writes the game track
// (never the report), so the band still falls back to the damped me value.
const game = mergeTraitWrite(emptyTraitState(), { openness: 0.8 }, 'self_game', ['openness']);
const gameBands = filledTraitBands(game.values, []);
assert.equal(gameBands.length, 1);
assert.equal(gameBands[0]?.axis, 'openness');
assert.equal(gameBands[0]?.value, game.values.openness);
assert.notEqual(gameBands[0]?.value, 0.8);
ok('no report track → band falls back to the me column (game writes stay on the game track)');

const explore = read('src/app/(tabs)/explore.tsx');
const fold = read('src/components/trait-bands-fold.tsx');
const intakeIdx = explore.indexOf('<IntakeSettings');
const bandsIdx = explore.indexOf('<TraitBandsFold');
assert.ok(intakeIdx >= 0 && bandsIdx > intakeIdx);
assert.match(explore, /<TraitBandsFold me=\{me\} tracks=\{tracks\} \/>/);
assert.match(fold, /filledTraitBands\(me, tracks\)/);
assert.match(fold, /SettingsFold title=\{TRAIT_BANDS_LABEL\}/);
assert.doesNotMatch(fold, /defaultOpen/);
assert.doesNotMatch(fold, /%|percent|openness|Extraversion/);
assert.doesNotMatch(fold, /accessibilityValue/);
assert.equal(TRAIT_BANDS_LABEL.includes('%'), false);
ok('fold passes report tracks through and stays collapsed with no number or trait-name copy');

console.log(`\n${passed} trait-band checks passed`);
