/**
 * You-tab fill-later for skipped optional trait screens.
 * Run: npm run check:optional-intake
 *
 * Standing section after trait bands. Additive null-axis writes only.
 * Does not claim the weekly Ask slot.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  OPTIONAL_INTAKE_TOTAL,
  emptyTraitState,
  emptyTraitValues,
  mergeTraitWrite,
  optionalFillWrite,
  unansweredOptionalScreens,
  writeForOptionalScreen,
} from '../src/lib/traits';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

const blankInput = {
  sliderValues: {} as Record<string, number>,
  closeId: null as string | null,
  disagreeId: null as string | null,
};

assert.deepEqual(unansweredOptionalScreens(emptyTraitValues()), [0, 1, 2, 3, 4, 5, 6, 7]);
assert.equal(OPTIONAL_INTAKE_TOTAL, 8);
ok('all 8 optional screens are unanswered when every axis is null');

const you = read('src/app/(tabs)/you.tsx');
const fillUi = read('src/components/optional-intake.tsx');
const bandsFold = read('src/components/trait-bands-fold.tsx');
const bandsIdx = you.indexOf('<TraitBandsFold');
const fillIdx = you.indexOf('<OptionalIntakeFill');
assert.ok(bandsIdx >= 0, 'You mounts TraitBandsFold');
assert.ok(fillIdx > bandsIdx, 'fill section is after TraitBandsFold');
assert.equal(you.slice(bandsIdx, fillIdx).includes('<RunningUpdateLine'), false);
assert.match(you, /from '@\/components\/optional-intake'/);
assert.match(fillUi, /export function OptionalIntakeFill/);
assert.match(fillUi, /<OptionalStep/);
assert.match(fillUi, /Want to add a bit more\?/);
assert.match(bandsFold, /if \(bands\.length === 0\) return null/);
assert.doesNotMatch(bandsFold, /Want to add a bit more/);
ok('section sits on You directly after TraitBandsFold and still renders when every band is null');

const gamed = mergeTraitWrite(emptyTraitState(), { openness: 0.8 }, 'self_game', ['openness']);
const naive = writeForOptionalScreen({
  screen: 0,
  ...blankInput,
  sliderValues: { openness: 0 },
});
assert.ok(naive);
const naiveMerged = mergeTraitWrite(gamed, naive.incoming, naive.source, naive.allowed);
assert.equal(naiveMerged.sources.openness, 'self_slider');
assert.notEqual(naiveMerged.values.openness, gamed.values.openness);
const guardedSlider = optionalFillWrite(gamed.values, {
  screen: 0,
  ...blankInput,
  sliderValues: { openness: 0 },
});
assert.equal(guardedSlider, null);
assert.ok(!unansweredOptionalScreens(gamed.values).includes(0));
ok('slider fill does not overwrite an axis that already has a non-null value from another source');

const closeFilled = mergeTraitWrite(
  emptyTraitState(),
  { attachment_anxiety: 0.2, attachment_avoidance: 0.2 },
  'self_situation',
  ['attachment_anxiety', 'attachment_avoidance'],
);
assert.equal(
  optionalFillWrite(closeFilled.values, {
    screen: 5,
    ...blankInput,
    closeId: 'want_and_pull',
  }),
  null,
);
ok('close-pattern fill is a no-op when both attachment axes already have values');

assert.match(fillUi, /optionalFillWrite/);
assert.match(fillUi, /updateTraits/);
assert.doesNotMatch(fillUi, /recordRanking|recordScenario|recordSageKnowsCorrection/);
assert.doesNotMatch(fillUi, /applyRankingWeek|applyScenarioWeek|applyCompletenessWeek/);
assert.doesNotMatch(fillUi, /self_game|self_tap/);
const fillFn = fillUi.slice(fillUi.indexOf('export function OptionalIntakeFill'));
assert.doesNotMatch(fillFn, /claimAiCall|sage_knows|you_slot|week_slot/);
ok('fill path uses updateTraits / optionalFillWrite; does not claim the weekly Ask slot');

console.log(`\n${passed} optional-intake checks passed`);
