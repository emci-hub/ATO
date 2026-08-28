/**
 * Scenario swipe-deck. Run: npm run check:scenario
 *
 * Six extra axes, one card each, self_game, SDT independent, soft-ask.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  EXTRA_AXES,
  emptyTraitState,
  emptyTraitValues,
  mergeTraitWrite,
  type TraitValues,
} from '../src/lib/traits';
import {
  applyCompletenessWeek,
  applyGameInviteWeek,
  applyRankingWeek,
  applySageKnowsDismiss,
  emptySageKnowsState,
  sageKnowsWeekKey,
} from '../src/lib/sage-knows';
import {
  SCENARIO_DECK,
  SCENARIO_HIGH,
  SCENARIO_LOW,
  applyScenarioWrite,
  pickScenarioAxis,
  resolveScenario,
} from '../src/lib/scenario';
import { containsFrameworkTerm } from '../src/lib/voice/framework-fence';
import { SCENARIO_LABEL, SCENARIO_LEDE } from '../src/lib/sage-copy';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

const TZ = 'America/Denver';
const NOW = new Date('2026-08-28T18:00:00.000Z');
const WEEK = sageKnowsWeekKey('2026-08-28');

function extraGap(over: Partial<TraitValues> = {}): TraitValues {
  const values = emptyTraitValues();
  return { ...values, ...over };
}

assert.deepEqual(Object.keys(SCENARIO_DECK).sort(), [...EXTRA_AXES].sort());
for (const axis of EXTRA_AXES) {
  const def = SCENARIO_DECK[axis];
  assert.equal(def.axis, axis);
  assert.equal(def.high.pole, 'high');
  assert.equal(def.low.pole, 'low');
  assert.equal(def.high.value, SCENARIO_HIGH);
  assert.equal(def.low.value, SCENARIO_LOW);
  assert.equal(containsFrameworkTerm(def.setup), false, def.setup);
  assert.equal(containsFrameworkTerm(def.high.label), false, def.high.label);
  assert.equal(containsFrameworkTerm(def.low.label), false, def.low.label);
}
ok('six one-axis cards; two poles; no framework terms');

const afterAutonomy = applyScenarioWrite(emptyTraitState(), 'autonomy', 'high', NOW.toISOString());
assert.equal(afterAutonomy.values.autonomy, SCENARIO_HIGH);
assert.equal(afterAutonomy.sources.autonomy, 'self_game');
assert.equal(afterAutonomy.values.competence, null);
assert.equal(afterAutonomy.values.relatedness, null);
assert.equal(afterAutonomy.sources.competence, undefined);
assert.equal(afterAutonomy.sources.relatedness, undefined);
const afterCompetence = applyScenarioWrite(afterAutonomy, 'competence', 'low', NOW.toISOString());
assert.equal(afterCompetence.values.autonomy, SCENARIO_HIGH);
assert.equal(afterCompetence.values.competence, SCENARIO_LOW);
assert.equal(afterCompetence.values.relatedness, null);
ok('each SDT axis writes independently; picking one does not fill the other two');

const direct = mergeTraitWrite(
  emptyTraitState(),
  { growth_mindset: 0.9 },
  'self_tap',
  ['growth_mindset'],
  '2026-07-01T00:00:00.000Z',
);
const blocked = applyScenarioWrite(direct, 'growth_mindset', 'low', NOW.toISOString());
assert.equal(blocked.values.growth_mindset, 0.9);
assert.equal(blocked.sources.growth_mindset, 'self_tap');
assert.equal(blocked.touched.growth_mindset, '2026-07-01T00:00:00.000Z');
ok('self_game cannot overwrite an existing direct-source value on the same axis');

assert.equal(pickScenarioAxis(extraGap(), null), 'autonomy');
assert.equal(pickScenarioAxis(extraGap({ autonomy: 0.8 }), 'autonomy'), 'competence');
const allExtra = extraGap();
for (const axis of EXTRA_AXES) allExtra[axis] = 0.8;
assert.equal(pickScenarioAxis(allExtra, null), null);
ok('round-robin among unfilled extra axes only');

const firstNineFilled = extraGap();
for (const axis of [
  'openness',
  'conscientiousness',
  'extraversion',
  'agreeableness',
  'steadiness',
  'attachment_anxiety',
  'attachment_avoidance',
  'conflict_assertiveness',
  'conflict_cooperativeness',
] as const) {
  firstNineFilled[axis] = 0.8;
}

const shown = resolveScenario({
  values: firstNineFilled,
  knows: emptySageKnowsState(),
  now: NOW,
  timeZone: TZ,
});
assert.ok(shown);
assert.equal(shown.axis, 'autonomy');
assert.equal(shown.def.setup.includes('Best day'), true);
ok('unfilled extra axes surface one scenario card');

assert.equal(
  resolveScenario({
    values: extraGap(),
    knows: emptySageKnowsState(),
    now: NOW,
    timeZone: TZ,
  }),
  null,
);
ok('does not stack with a live ranking prompt the same week');

assert.equal(
  resolveScenario({
    values: extraGap(),
    knows: applyRankingWeek(emptySageKnowsState(), 'openness', WEEK, 'answered'),
    now: NOW,
    timeZone: TZ,
  }),
  null,
);
assert.equal(
  resolveScenario({
    values: extraGap(),
    knows: applySageKnowsDismiss(emptySageKnowsState(), 'openness', WEEK),
    now: NOW,
    timeZone: TZ,
  }),
  null,
);
assert.equal(
  resolveScenario({
    values: extraGap(),
    knows: applyGameInviteWeek(emptySageKnowsState(), WEEK),
    now: NOW,
    timeZone: TZ,
  }),
  null,
);
assert.equal(
  resolveScenario({
    values: extraGap(),
    knows: applyCompletenessWeek(emptySageKnowsState(), WEEK),
    now: NOW,
    timeZone: TZ,
  }),
  null,
);
ok('yields if ranking, Does-Sage-know-you, a game invite, or completeness already has the week');

assert.equal(
  resolveScenario({
    values: firstNineFilled,
    knows: emptySageKnowsState(),
    now: NOW,
    timeZone: TZ,
  })?.axis,
  'autonomy',
);
ok('extra-only gaps show a scenario; first-nine gaps leave the slot to ranking');

assert.equal(SCENARIO_LABEL, 'Gut call');
assert.match(SCENARIO_LEDE, /Swipe or tap/);

const card = read('src/components/scenario-card.tsx');
const meSrc = read('src/lib/me.ts');
const homeTab = read('src/app/(tabs)/index.tsx');
const sageTab = read('src/app/(tabs)/sage.tsx');
const youTab = read('src/app/(tabs)/you.tsx');
const talkSrc = read('src/lib/voice/talk.ts');
const themeLab = read('src/app/theme-lab.tsx');
const logic = read('src/lib/scenario.ts');

assert.match(card, /Gesture|Pan/);
assert.match(meSrc, /recordScenario/);
assert.match(meSrc, /self_game/);
assert.match(homeTab, /ScenarioCard/);
assert.match(sageTab, /ScenarioCard/);
assert.match(youTab, /ScenarioCard/);
assert.doesNotMatch(talkSrc, /resolveScenario|ScenarioCard/);
assert.match(themeLab, /THEME_SCENARIO_LOCUS/);
assert.match(themeLab, /THEME_SCENARIO_AUTONOMY/);
assert.doesNotMatch(logic, /Math\.random|claimAiCall|gemini/);
assert.match(logic, /self_game/);
assert.match(read('src/lib/me.ts'), /applyScenarioWrite/);
assert.doesNotMatch(logic, /Best day at work is one where: 'I did it my way' \/ 'I nailed/);
ok('swipe surface on Home, Sage, You; never Talk; SDT is not a three-way pick');

console.log(`\n${passed} scenario checks passed`);
