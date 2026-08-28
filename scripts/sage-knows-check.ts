/**
 * Does Sage know you? Run: npm run check:sage-knows
 *
 * Banked copy, eligibility, weekly budget, rotation, streak graduation.
 * No live model call.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  AXIS_EDITOR_COPY,
  CRUEL_CHECKIN_POLES,
  SAGE_KNOWS_COOLDOWN_DAYS,
  applyGameInviteWeek,
  applySageKnowsDismiss,
  applySageKnowsNotQuite,
  applySageKnowsStillFits,
  axisPastCooldown,
  composeSageKnowsLine,
  eligibleSageKnowsAxes,
  emptySageKnowsState,
  hasUnfilledTraitAxis,
  isCruelCheckinPole,
  isGraduatedAxis,
  parseSageKnowsState,
  pickSageKnowsAxis,
  resolveSageKnows,
  sageKnowsWeekKey,
  youTabSoftAsk,
} from '../src/lib/sage-knows';
import {
  TRAIT_AXES,
  TRAIT_POLE_LINES,
  confirmTraitSource,
  emptyTraitState,
  emptyTraitValues,
  traitPoleLine,
  type TraitTouched,
  type TraitValues,
} from '../src/lib/traits';
import type { CheckHistory } from '../src/lib/voice/types';

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
const TODAY = '2026-08-28';
const OLD = '2026-07-01T18:00:00.000Z';
const FRESH = '2026-08-27T18:00:00.000Z';
const WEEK = sageKnowsWeekKey(TODAY);

function safeFilled(over: Partial<TraitValues> = {}): TraitValues {
  const values = emptyTraitValues();
  for (const axis of TRAIT_AXES) values[axis] = 0.8;
  values.attachment_anxiety = 0.2;
  return { ...values, ...over };
}

function touchedAll(at: string, over: TraitTouched = {}): TraitTouched {
  const touched: TraitTouched = {};
  for (const axis of TRAIT_AXES) touched[axis] = at;
  return { ...touched, ...over };
}

function resolveWith(
  over: {
    values?: TraitValues;
    touched?: TraitTouched;
    knows?: ReturnType<typeof emptySageKnowsState>;
    knocks?: string;
    facts?: string[];
    history?: CheckHistory[];
  } = {},
) {
  return resolveSageKnows({
    values: over.values ?? safeFilled(),
    touched: over.touched ?? touchedAll(OLD),
    knows: over.knows ?? emptySageKnowsState(),
    knocksYouOff: over.knocks ?? 'sleep',
    facts: over.facts ?? [],
    history: over.history ?? [
      { day: 1, status: 'done', read: 'Ordinary day.', do: 'After you make coffee, sit one minute.' },
    ],
    now: NOW,
    timeZone: TZ,
  });
}

const logic = read('src/lib/sage-knows.ts');
const card = read('src/components/sage-knows-card.tsx');
const meSrc = read('src/lib/me.ts');
const talkSrc = read('src/lib/voice/talk.ts');
const sageTab = read('src/app/(tabs)/sage.tsx');
const homeTab = read('src/app/(tabs)/index.tsx');

assert.doesNotMatch(logic, /claimAiCall|routeVoice|generateTalk|gemini|MODEL_PROVIDER/);
assert.doesNotMatch(card, /claimAiCall|routeVoice|generateTalk|gemini/);
assert.match(card, /Still fits/);
assert.match(card, /Not quite/);
assert.doesNotMatch(card, /Yes|No\b|Confirm\b|Correct\b/);
assert.match(logic, /TRAIT_POLE_LINES|traitPoleLine/);
ok('guess copy is banked; Still fits / Not quite; zero AI imports on this surface');

const skipHistory: CheckHistory[] = [
  { day: 1, status: 'skipped', read: 'Skip one.', do: 'After you make coffee, sit one minute.' },
  { day: 2, status: 'skipped', read: 'Skip two.', do: 'After you make coffee, write one line.' },
];
const withSignal = resolveWith({ history: skipHistory });
assert.ok(withSignal);
assert.equal(withSignal.kind, 'signal');
assert.match(withSignal.line, /this week/);
assert.match(withSignal.line, /Still how it works\?/);
assert.doesNotMatch(withSignal.line, /you are /i);
const bank = traitPoleLine(withSignal.axis, 0.8) ?? traitPoleLine(withSignal.axis, 0.2);
assert.ok(bank);
assert.match(
  withSignal.line.toLowerCase(),
  new RegExp(bank.replace(/^They /, '').replace(/\.$/, '').slice(0, 24).toLowerCase()),
);
const quiet = resolveWith({ knocks: '', facts: [], history: [] });
assert.ok(quiet);
assert.equal(quiet.kind, 'check-in');
assert.match(quiet.line, /Still in the neighborhood\?/);
assert.doesNotMatch(quiet.line, /guess|discovered|I think/i);
ok('signal lines use Nudge this-week register; no-signal is a plain check-in from the bank');

assert.equal(hasUnfilledTraitAxis(safeFilled()), false);
const gap = safeFilled({ openness: null });
assert.equal(hasUnfilledTraitAxis(gap), true);
assert.equal(resolveWith({ values: gap }), null);
ok('yields entirely while any trait axis is still null');

const gameWeek = applyGameInviteWeek(emptySageKnowsState(), WEEK);
assert.equal(resolveWith({ knows: gameWeek }), null);
ok('Home/Sage week claimed by a game invite does not also show this');

assert.equal(youTabSoftAsk(gap, touchedAll(OLD), TODAY, TZ), 'completeness');
assert.equal(youTabSoftAsk(safeFilled(), touchedAll(OLD), TODAY, TZ), null);
const stale = touchedAll('2026-01-01T12:00:00.000Z');
assert.equal(youTabSoftAsk(safeFilled(), stale, TODAY, TZ), 'three_month');
assert.notEqual(youTabSoftAsk(gap, stale, TODAY, TZ), 'three_month');
ok('You/Settings: completeness while nulls exist; 3-month only when every axis is filled');

const midOnly = safeFilled();
for (const axis of TRAIT_AXES) midOnly[axis] = 0.5;
assert.equal(
  eligibleSageKnowsAxes({
    values: midOnly,
    touched: touchedAll(OLD),
    knows: emptySageKnowsState(),
    todayYmd: TODAY,
    timeZone: TZ,
  }).length,
  0,
);
assert.equal(resolveWith({ values: midOnly }), null);
ok('mid-band axes never appear');

for (const row of CRUEL_CHECKIN_POLES) {
  const values = safeFilled();
  for (const axis of TRAIT_AXES) values[axis] = 0.5;
  values[row.axis] = row.band === 'low' ? 0.2 : 0.8;
  assert.equal(isCruelCheckinPole(row.axis, values[row.axis]), true);
  const eligible = eligibleSageKnowsAxes({
    values,
    touched: touchedAll(OLD),
    knows: emptySageKnowsState(),
    todayYmd: TODAY,
    timeZone: TZ,
  });
  assert.equal(eligible.includes(row.axis), false);
  assert.equal(resolveWith({ values }), null);
}
ok('cruel-content poles are excluded from this surface entirely');

assert.equal(axisPastCooldown(touchedAll(FRESH), 'extraversion', TODAY, TZ), false);
assert.equal(axisPastCooldown(touchedAll(OLD), 'extraversion', TODAY, TZ), true);
const freshExtra = touchedAll(OLD, { extraversion: FRESH });
const eligibleFresh = eligibleSageKnowsAxes({
  values: safeFilled(),
  touched: freshExtra,
  knows: emptySageKnowsState(),
  todayYmd: TODAY,
  timeZone: TZ,
});
assert.equal(eligibleFresh.includes('extraversion'), false);
assert.ok(eligibleFresh.length > 0);
const pickedFresh = resolveWith({ touched: freshExtra });
assert.ok(pickedFresh);
assert.notEqual(pickedFresh.axis, 'extraversion');
ok(`freshly-set axis sits out for ${SAGE_KNOWS_COOLDOWN_DAYS} days`);

const firstPick = pickSageKnowsAxis(
  ['extraversion', 'openness'],
  null,
  { extraversion: '2026-08-01T00:00:00.000Z', openness: '2026-06-01T00:00:00.000Z' },
);
assert.equal(firstPick, 'openness');
const afterOpenness = pickSageKnowsAxis(
  ['openness', 'conscientiousness', 'extraversion'],
  'openness',
  touchedAll(OLD),
);
assert.equal(afterOpenness, 'conscientiousness');
const inferredSame = pickSageKnowsAxis(
  ['openness', 'extraversion'],
  'openness',
  { openness: OLD, extraversion: OLD },
);
assert.equal(inferredSame, 'extraversion');
ok('round-robin after cursor; oldest last_touched only ties the first pick, never jumps a new axis');

const shown = emptySageKnowsState();
shown.last_axis = 'openness';
const next = resolveWith({ knows: shown });
assert.ok(next);
assert.notEqual(next.axis, 'openness');
ok('does not show the same axis as last time when another eligible axis exists');

let streakState = emptySageKnowsState();
streakState = applySageKnowsStillFits(streakState, 'openness', WEEK, NOW.toISOString());
assert.equal(streakState.streaks.openness, 1);
assert.equal(isGraduatedAxis(streakState, 'openness'), false);
streakState = applySageKnowsStillFits(streakState, 'openness', WEEK, NOW.toISOString());
assert.equal(streakState.streaks.openness, 2);
assert.equal(isGraduatedAxis(streakState, 'openness'), true);
const afterGraduate = emptySageKnowsState();
afterGraduate.streaks = { openness: 2 };
afterGraduate.graduated = { openness: NOW.toISOString() };
afterGraduate.last_axis = 'conscientiousness';
afterGraduate.week_key = '2026-08-16';
const eligibleGrad = eligibleSageKnowsAxes({
  values: safeFilled(),
  touched: touchedAll(OLD),
  knows: afterGraduate,
  todayYmd: TODAY,
  timeZone: TZ,
});
assert.equal(eligibleGrad.includes('openness'), false);
const shownGrad = resolveWith({ knows: afterGraduate });
assert.ok(shownGrad);
assert.notEqual(shownGrad.axis, 'openness');
ok('two consecutive Still fits on the same axis graduates it off this surface');

const reset = applySageKnowsNotQuite(streakState, 'openness', WEEK);
assert.equal(reset.streaks.openness, undefined);
assert.equal(reset.graduated.openness, undefined);
ok('Not quite resets that axis streak');

const dismissed = applySageKnowsDismiss(emptySageKnowsState(), 'openness', WEEK);
assert.equal(resolveWith({ knows: dismissed }), null);
const nextWeek = { ...dismissed, week_key: '2026-08-16', week_done: 'dismissed' as const };
assert.ok(resolveWith({ knows: nextWeek }));
ok('dismiss ends this week and does not deal another axis');

const before = emptyTraitState();
before.values.openness = 0.8;
before.sources.openness = 'self_grid';
const confirmed = confirmTraitSource(before, ['openness'], NOW.toISOString());
assert.equal(confirmed.values.openness, 0.8);
assert.equal(confirmed.sources.openness, 'self_confirm');
ok('Still fits still uses confirmTraitSource — number unchanged');

assert.match(meSrc, /recordSageKnowsFits/);
assert.match(meSrc, /self_settings/);
assert.match(meSrc, /recordSageKnowsCorrection/);
assert.doesNotMatch(talkSrc, /sage-knows|resolveSageKnows|SAGE_KNOWS/);
assert.match(sageTab, /SageKnowsCard/);
assert.match(homeTab, /SageKnowsCard/);
const talkBlock = sageTab.slice(sageTab.indexOf('messages.map'), sageTab.indexOf("busy === 'send'"));
assert.doesNotMatch(talkBlock, /SageKnowsCard|resolveSageKnows/);
ok('surface is on Home and Sage toys, never inside Talk replies');

const composedCheckin = composeSageKnowsLine(TRAIT_POLE_LINES.extraversion.low, null);
assert.match(composedCheckin.line, /quieter time/);
assert.match(composedCheckin.line, /Still in the neighborhood\?/);
assert.doesNotMatch(composedCheckin.line, /They /);
for (const axis of TRAIT_AXES) {
  assert.ok(AXIS_EDITOR_COPY[axis].label.length > 0);
  assert.doesNotMatch(
    AXIS_EDITOR_COPY[axis].label,
    /attachment|mindset|efficacy|locus|self-determination/i,
  );
  assert.doesNotMatch(
    AXIS_EDITOR_COPY[axis].hint,
    /attachment|mindset|efficacy|locus|self-determination/i,
  );
}
ok('editor copy is plain language; banked lines convert They → You');

const migration = read('supabase/migrations/wave15_sage_knows.sql');
assert.match(migration, /add column if not exists sage_knows jsonb/);
assert.doesNotMatch(migration, /create function public.complete_signup|alter function public.complete_signup/);
assert.equal(parseSageKnowsState(undefined).last_axis, null);
assert.equal(parseSageKnowsState({ last_axis: 'openness' }).last_axis, 'openness');
ok('sage_knows column is additive; complete_signup untouched');

console.log(`\nAll ${passed} sage-knows checks passed.`);
