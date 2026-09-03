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

assert.deepEqual(unansweredOptionalScreens(emptyTraitValues()), [0, 1, 2, 3, 4, 5, 6, 7]);
assert.equal(OPTIONAL_INTAKE_TOTAL, 8);
ok('all 8 optional screens are unanswered when every axis is null');

const questionsTab = read('src/app/(tabs)/intake-sweep.tsx');
const fillUi = read('src/components/optional-intake.tsx');
const bandsFold = read('src/components/trait-bands-fold.tsx');
assert.ok(questionsTab.indexOf('<OptionalIntakeFill') >= 0, 'Questions mounts OptionalIntakeFill');
assert.match(questionsTab, /from '@\/components\/optional-intake'/);
assert.match(fillUi, /export function OptionalIntakeFill/);
assert.match(fillUi, /<OptionalStep/);
assert.match(fillUi, /Want to add a bit more\?/);
assert.match(bandsFold, /if \(bands\.length === 0\) return null/);
assert.doesNotMatch(bandsFold, /Want to add a bit more/);
ok('fill-later sits on the Questions tab and still renders when every band is null');

const directOpenness = mergeTraitWrite(emptyTraitState(), { openness: 0.8 }, 'self_tap', ['openness']);
const scenarioWrite = writeForOptionalScreen({ screen: 0, optionId: 'new_thing' });
assert.ok(scenarioWrite);
assert.equal(scenarioWrite.source, 'self_scenario');
ok('scenario write is self_scenario — direct, not damped toward 0.5 like an inferred write would be');

assert.ok(unansweredOptionalScreens(directOpenness.values).includes(0));
const guardedFill = optionalFillWrite(directOpenness.values, { screen: 0, optionId: 'new_thing' });
assert.deepEqual(guardedFill?.incoming, { conscientiousness: 0.2 });
assert.equal(guardedFill?.source, 'self_scenario');
ok(
  'fill only writes the still-null axis (conscientiousness) when openness is already answered — ' +
    'the null-axis guard in optionalFillWrite protects the answered axis, not source priority',
);

const fullyFilled = mergeTraitWrite(directOpenness, guardedFill!.incoming, guardedFill!.source, guardedFill!.allowed);
assert.equal(fullyFilled.values.openness, 0.8);
assert.equal(fullyFilled.sources.openness, 'self_tap');
assert.ok(!unansweredOptionalScreens(fullyFilled.values).includes(0));
ok('screen 0 clears from unanswered once both axes are filled; the already-answered axis is untouched');

const closeFilled = mergeTraitWrite(
  emptyTraitState(),
  { attachment_anxiety: 0.2, attachment_avoidance: 0.2 },
  'self_scenario',
  ['attachment_anxiety', 'attachment_avoidance'],
);
assert.equal(
  optionalFillWrite(closeFilled.values, { screen: 5, optionId: 'kind_of_relief' }),
  null,
);
ok('attachment screen fill is a no-op when both axes already have values');

assert.match(fillUi, /optionalFillWrite/);
assert.match(fillUi, /updateTraits/);
assert.doesNotMatch(fillUi, /recordRanking|recordScenario|recordSageKnowsCorrection/);
assert.doesNotMatch(fillUi, /applyRankingWeek|applyScenarioWeek|applyCompletenessWeek/);
assert.doesNotMatch(fillUi, /self_game|self_tap/);
const fillFn = fillUi.slice(fillUi.indexOf('export function OptionalIntakeFill'));
assert.doesNotMatch(fillFn, /claimAiCall|sage_knows|you_slot|week_slot/);
ok('fill path uses updateTraits / optionalFillWrite; does not claim the weekly Ask slot');

console.log(`\n${passed} optional-intake checks passed`);
