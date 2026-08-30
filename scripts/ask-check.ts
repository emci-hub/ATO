/**
 * Ask dispatcher. Run: npm run check:ask
 *
 * One pick per free week. Null when the week is spent or nothing is eligible.
 */
import assert from 'node:assert/strict';

import { resolveAsk, type ResolveAskInput } from '../src/lib/ask';
import { resolveRanking } from '../src/lib/ranking';
import {
  applyRankingWeek,
  emptySageKnowsState,
  resolveSageKnows,
  sageKnowsWeekKey,
  weekSlotTaken,
} from '../src/lib/sage-knows';
import { resolveScenario } from '../src/lib/scenario';
import {
  EXTRA_AXES,
  TRAIT_AXES,
  emptyTraitValues,
  type TraitTouched,
  type TraitValues,
} from '../src/lib/traits';
import { localYmd } from '../src/lib/local-date';
import type { CheckHistory } from '../src/lib/voice/types';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const TZ = 'America/Denver';
const NOW = new Date('2026-08-28T18:00:00.000Z');
const WEEK = sageKnowsWeekKey(localYmd(NOW, TZ));
const HISTORY: CheckHistory[] = [
  { day: 1, status: 'done', read: 'Ordinary day.', do: 'After you make coffee, sit one minute.' },
];

function filled(): TraitValues {
  const values = emptyTraitValues();
  for (const axis of TRAIT_AXES) values[axis] = 0.8;
  values.attachment_anxiety = 0.2;
  return values;
}

function firstNineGap(): TraitValues {
  return emptyTraitValues();
}

function extraOnlyGap(): TraitValues {
  const values = emptyTraitValues();
  for (const axis of TRAIT_AXES) {
    if (!(EXTRA_AXES as readonly string[]).includes(axis)) values[axis] = 0.8;
  }
  return values;
}

function midFilled(): TraitValues {
  const values = emptyTraitValues();
  for (const axis of TRAIT_AXES) values[axis] = 0.5;
  return values;
}

function input(values: TraitValues, knows = emptySageKnowsState(), touched: TraitTouched = {}): ResolveAskInput {
  return {
    values,
    touched,
    knows,
    knocksYouOff: 'sleep',
    facts: [],
    history: HISTORY,
    now: NOW,
    timeZone: TZ,
  };
}

function notArray(value: unknown) {
  assert.equal(Array.isArray(value), false);
}

const freeFilled = input(filled());
assert.ok(resolveSageKnows(freeFilled));
assert.equal(resolveRanking(freeFilled), null);
assert.equal(resolveScenario(freeFilled), null);

const claimed = applyRankingWeek(emptySageKnowsState(), 'openness', WEEK, 'answered');
assert.ok(weekSlotTaken(claimed, WEEK));
const spent = resolveAsk(input(filled(), claimed));
assert.equal(spent, null);
notArray(spent);
ok('spent week returns null even when a free week would pick sage_knows');

const sage = resolveAsk(freeFilled);
assert.ok(sage);
assert.equal(sage.kind, 'sage_knows');
assert.ok(sage.prompt);
notArray(sage);
notArray(sage.prompt);
ok('all 15 filled and week free -> sage_knows');

const rankingIn = input(firstNineGap());
assert.equal(resolveSageKnows(rankingIn), null);
assert.ok(resolveRanking(rankingIn));
const ranking = resolveAsk(rankingIn);
assert.ok(ranking);
assert.equal(ranking.kind, 'ranking');
assert.ok(ranking.prompt);
notArray(ranking);
ok('first-nine gap and week free -> ranking');

const scenarioIn = input(extraOnlyGap());
assert.equal(resolveSageKnows(scenarioIn), null);
assert.equal(resolveRanking(scenarioIn), null);
assert.ok(resolveScenario(scenarioIn));
const scenario = resolveAsk(scenarioIn);
assert.ok(scenario);
assert.equal(scenario.kind, 'scenario');
assert.ok(scenario.prompt);
notArray(scenario);
ok('extra-axis-only gap and week free -> scenario');

const noneIn = input(midFilled());
assert.equal(resolveSageKnows(noneIn), null);
assert.equal(resolveRanking(noneIn), null);
assert.equal(resolveScenario(noneIn), null);
const none = resolveAsk(noneIn);
assert.equal(none, null);
notArray(none);
ok('all three resolvers null -> null');

ok('exactly one AskPick is ever returned; never an array');

console.log(`\nAll ${passed} ask checks passed.`);
