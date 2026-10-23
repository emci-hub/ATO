/**
 * Daily insights selection — determinism, spread, weekday mode, provisional
 * gate, persisted pick, Superpower / Kryptonite, Conflict style, visibility.
 * Run: npm run check:daily-insights-pick
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  CATEGORY_DEFS,
  readCategory,
  readyCategories,
  type CategoryId,
  type CategoryReading,
} from '../src/lib/categories';
import {
  CONFLICT_MIDDLE_HIGH,
  CONFLICT_MIDDLE_LOW,
  conflictStyleFor,
  emptyStore,
  pickConflict,
  pickSuperpower,
  pickTryToday,
  resolveShowProvisional,
  resolveTryToday,
  shouldShowTryToday,
  dailyInsightsVisible,
  tryTodayMode,
  weekdayOfYmd,
  type PickTryTodayInput,
} from '../src/lib/daily-insights';
import { addDaysYmd, localYmd } from '../src/lib/local-date';
import type { TraitTrack } from '../src/lib/trait-stability';
import { TRAIT_AXES, type TraitAxis } from '../src/lib/traits';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
assert.equal(pkg.scripts['check:daily-insights-pick'], 'tsx ./scripts/daily-insights-pick-check.ts');
ok('wired as check:daily-insights-pick');

const now = new Date('2026-10-07T12:00:00Z');
function track(axis: TraitAxis, value: number): TraitTrack {
  return {
    axis,
    track: 'report',
    value,
    stability: 1,
    answerCount: 6,
    lastTouched: '2026-10-01T00:00:00Z',
    lastDepthAt: null,
  } as TraitTrack;
}
function tracksFrom(values: Partial<Record<TraitAxis, number>>): TraitTrack[] {
  return Object.entries(values).map(([axis, value]) => track(axis as TraitAxis, value!));
}
/** Every axis set: all 11 categories ready. */
const allValues: Partial<Record<TraitAxis, number>> = {};
TRAIT_AXES.forEach((axis, i) => {
  allValues[axis] = 0.25 + ((i * 37) % 50) / 100;
});
const allTracks = tracksFrom(allValues);
const allReady = readyCategories(allTracks, now);
assert.equal(allReady.length, 11, 'fixture: all 11 categories ready');

function input(over: Partial<PickTryTodayInput> = {}): PickTryTodayInput {
  return {
    userId: 'user-a',
    dateKey: '2026-10-13',
    ready: allReady,
    signalAxes: [],
    history: [],
    showProvisional: false,
    ...over,
  };
}

// --- determinism -------------------------------------------------------------
const first = pickTryToday(input());
assert.ok(first);
for (let i = 0; i < 100; i += 1) assert.deepEqual(pickTryToday(input()), first);
ok('same inputs → same pick, 100×');

// --- spread over 60 days -----------------------------------------------------
{
  let store = emptyStore('user-a');
  const seq: CategoryId[] = [];
  let day = '2026-10-01';
  for (let i = 0; i < 60; i += 1) {
    const out = resolveTryToday(store, { dateKey: day, ready: allReady, signalAxes: [], showProvisional: false });
    assert.ok(out.pick, `pick on ${day}`);
    seq.push(out.pick!.line.categoryId);
    store = out.store;
    day = addDaysYmd(day, 1);
  }
  const distinct = new Set(seq).size;
  assert.ok(distinct >= 6, `only ${distinct} distinct categories over 60 days`);
  for (let i = 3; i < seq.length; i += 1) {
    const run = seq.slice(i - 3, i + 1);
    assert.ok(!run.every((id) => id === run[0]), `${run[0]} on 4 days in a row`);
  }
  for (let i = 1; i < seq.length; i += 1) assert.notEqual(seq[i], seq[i - 1], 'no repeat on the next day');
  ok(`60 days: ${distinct} distinct categories, never 4 days running`);
}
{
  const users = new Set<string>();
  for (const userId of ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8']) {
    users.add(pickTryToday(input({ userId }))!.line.categoryId);
  }
  assert.ok(users.size >= 3, 'different users spread across categories');
  ok(`8 users on one day land on ${users.size} categories`);
}

// --- weekday mode + safety override ------------------------------------------
assert.equal(weekdayOfYmd('2026-10-12'), 1); // Monday
const modes = ['2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17'].map(
  (d) => tryTodayMode(d, 'cat_drive', 'high'),
);
assert.deepEqual(modes, ['strength', 'strength', 'stretch', 'strength', 'stretch', 'strength', 'stretch']);
for (const d of ['2026-10-13', '2026-10-15', '2026-10-17']) {
  assert.equal(tryTodayMode(d, 'cat_resilience', 'low'), 'strength');
  assert.equal(tryTodayMode(d, 'cat_steadiness', 'low'), 'strength');
  assert.equal(tryTodayMode(d, 'cat_resilience', 'high'), 'stretch');
}
ok('Sun/Mon/Wed/Fri strength, Tue/Thu/Sat stretch; low Resilience/Steadiness always strength');

// --- provisional gate --------------------------------------------------------
const MAPS: CategoryId[] = ['cat_love', 'cat_independence', 'cat_structure'];
{
  let sawMap = false;
  for (let i = 0; i < 200; i += 1) {
    const dateKey = addDaysYmd('2026-01-01', i);
    const off = pickTryToday(input({ dateKey }));
    assert.ok(off && !MAPS.includes(off.line.categoryId) && !off.line.provisional, `provisional leaked ${dateKey}`);
    const on = pickTryToday(input({ dateKey, showProvisional: true }));
    if (on && MAPS.includes(on.line.categoryId)) sawMap = true;
  }
  assert.ok(sawMap, 'provisional categories reachable with the flag on');
  const mapsOnly = allReady.filter((row) => MAPS.includes(row.def.id));
  assert.equal(pickTryToday(input({ ready: mapsOnly })), null);
  ok('flag off: provisional never picked (and maps-only → null); flag on: reachable');
}
assert.equal(resolveShowProvisional({ base: false, devOverride: true, devToolsActive: false }), false);
assert.equal(resolveShowProvisional({ base: true, devOverride: null, devToolsActive: false }), false);
assert.equal(resolveShowProvisional({ base: false, devOverride: true, devToolsActive: true }), true);
assert.equal(resolveShowProvisional({ base: false, devOverride: null, devToolsActive: true }), false);
ok('production (dev tools off) never reads the provisional flag as true');

// --- empty / single / never throws -------------------------------------------
assert.equal(pickTryToday(input({ ready: [] })), null);
{
  const one = allReady.filter((row) => row.def.id === 'cat_drive');
  const history = [
    { dateKey: '2026-10-12', id: 'cat_drive.high.strength' },
    { dateKey: '2026-10-11', id: 'cat_drive.high.strength' },
  ];
  const pick = pickTryToday(input({ ready: one, history }));
  assert.equal(pick?.line.categoryId, 'cat_drive', 'single ready category: history ignored');
}
assert.doesNotThrow(() =>
  pickTryToday(input({ ready: [{ def: { id: 'cat_nope' } } as unknown as CategoryReading], dateKey: 'garbage' })),
);
assert.equal(pickTryToday(input({ ready: readyCategories([], now) })), null);
ok('0 ready → null; 1 ready → history ignored; junk input never throws');

// --- persisted pick wins -------------------------------------------------------
{
  const base = emptyStore('user-a');
  const day1 = resolveTryToday(base, { dateKey: '2026-10-13', ready: allReady, signalAxes: [], showProvisional: false });
  assert.ok(day1.changed && day1.pick);
  assert.equal(day1.store.history.length, 1);
  const moreData = allReady.slice(0, 2);
  const again = resolveTryToday(day1.store, {
    dateKey: '2026-10-13',
    ready: moreData,
    signalAxes: ['openness'],
    showProvisional: false,
  });
  assert.equal(again.changed, false);
  assert.equal(again.pick!.line.id, day1.pick!.line.id);
  assert.equal(again.store.history.length, 1);
  // A stored provisional line that is now hidden re-picks.
  const hidden = { ...base, picks: { '2026-10-13': 'cat_love.high.strength' } };
  const repick = resolveTryToday(hidden, { dateKey: '2026-10-13', ready: allReady, signalAxes: [], showProvisional: false });
  assert.ok(repick.pick && !repick.pick.line.provisional);
  const gone = { ...base, picks: { '2026-10-13': 'cat_gone.high.strength' } };
  assert.ok(resolveTryToday(gone, { dateKey: '2026-10-13', ready: allReady, signalAxes: [], showProvisional: false }).pick);
  ok('persisted pick wins for its day; hidden or missing line re-picks; history grows once');
}

// --- timezone: the dateKey, not UTC, drives the day ----------------------------
{
  const instant = new Date('2026-10-13T20:00:00Z');
  const edm = localYmd(instant, 'America/Edmonton');
  const akl = localYmd(instant, 'Pacific/Auckland');
  assert.equal(edm, '2026-10-13');
  assert.equal(akl, '2026-10-14');
  assert.equal(tryTodayMode(edm, 'cat_drive', 'high'), 'stretch'); // Tuesday
  assert.equal(tryTodayMode(akl, 'cat_drive', 'high'), 'strength'); // Wednesday
  ok('same instant: Edmonton Tue (stretch) vs Auckland Wed (strength)');
}

// --- Superpower / Kryptonite --------------------------------------------------
function bar(id: CategoryId, value: number): CategoryReading {
  const def = CATEGORY_DEFS.find((d) => d.id === id)!;
  return { def, ready: true, bar: value, map: null, stableAxes: [...def.axes], texture: [] };
}
{
  const out = pickSuperpower([bar('cat_steadiness', 0.7), bar('cat_drive', 0.7), bar('cat_social', 0.3)]);
  assert.equal(out?.superpower?.categoryId, 'cat_steadiness', 'tie → catalog order');
  assert.equal(out?.kryptonite?.categoryId, 'cat_social');
  const lowTie = pickSuperpower([bar('cat_steadiness', 0.8), bar('cat_drive', 0.3), bar('cat_social', 0.3)]);
  assert.equal(lowTie?.kryptonite?.categoryId, 'cat_drive');
  // emci 2026-10-14: each half only when its score is really on that side of 0.5.
  const two = pickSuperpower([bar('cat_steadiness', 0.9), bar('cat_drive', 0.1)]);
  assert.equal(two?.superpower?.categoryId, 'cat_steadiness', 'two bars are enough');
  assert.equal(two?.kryptonite?.categoryId, 'cat_drive');
  const close = pickSuperpower([bar('cat_steadiness', 0.55), bar('cat_drive', 0.5), bar('cat_social', 0.46)]);
  assert.equal(close?.superpower?.categoryId, 'cat_steadiness', '0.55 is above 0.5');
  assert.equal(close?.kryptonite?.categoryId, 'cat_social', '0.46 is below 0.5');
  const exact = pickSuperpower([bar('cat_steadiness', 0.6), bar('cat_drive', 0.55), bar('cat_social', 0.5)]);
  assert.ok(exact?.superpower, 'top above 0.5 shows');
  assert.equal(exact!.kryptonite, null, 'exactly 0.5 is on neither side: no kryptonite');
  assert.equal(pickSuperpower([bar('cat_steadiness', 0.5), bar('cat_drive', 0.5)]), null, 'all at 0.5: no card');
  const one = pickSuperpower([bar('cat_steadiness', 0.8)]);
  assert.ok(one?.superpower && !one.kryptonite, 'one bar is never both halves');
  const allHigh = pickSuperpower([bar('cat_steadiness', 0.9), bar('cat_drive', 0.7), bar('cat_social', 0.6)]);
  assert.ok(allHigh?.superpower && !allHigh.kryptonite);
  const allLow = pickSuperpower([bar('cat_steadiness', 0.4), bar('cat_drive', 0.2), bar('cat_social', 0.1)]);
  assert.ok(allLow && !allLow.superpower && allLow.kryptonite?.categoryId === 'cat_social');
  const withMaps = readyCategories(allTracks, now);
  const both = pickSuperpower(withMaps);
  for (const half of [both?.superpower, both?.kryptonite]) {
    if (half) assert.equal(CATEGORY_DEFS.find((d) => d.id === half.categoryId)?.shape, 'bar');
  }
  ok('superpower: tie → catalog order, each half only strictly past 0.5, never both from one bar, bars only');
}

// --- Conflict style ----------------------------------------------------------
{
  assert.equal(CONFLICT_MIDDLE_LOW, 0.4);
  assert.equal(CONFLICT_MIDDLE_HIGH, 0.6);
  const cases: [number, number, string][] = [
    [0.4, 0.4, 'deal_maker'],
    [0.6, 0.6, 'deal_maker'],
    [0.5, 0.5, 'deal_maker'],
    [0.4, 0.6, 'deal_maker'],
    [0.7, 0.7, 'team_fixer'],
    [0.61, 0.5, 'team_fixer'],
    [0.7, 0.3, 'straight_shooter'],
    [0.5, 0.39, 'straight_shooter'],
    [0.3, 0.7, 'peacekeeper'],
    [0.39, 0.5, 'peacekeeper'],
    [0.2, 0.2, 'quiet_exit'],
    [0.39, 0.45, 'quiet_exit'],
  ];
  for (const [a, c, want] of cases) assert.equal(conflictStyleFor(a, c), want, `A=${a} C=${c}`);
  const live = pickConflict(tracksFrom({ conflict_assertiveness: 0.75, conflict_cooperativeness: 0.25 }), now);
  assert.equal(live?.id, 'straight_shooter');
  assert.equal(pickConflict(tracksFrom({ conflict_assertiveness: 0.75 }), now), null, 'both must be stable');
  ok('conflict: all 5 regions incl. 0.40 / 0.50 / 0.60 boundaries; both axes required');
}

// --- visibility ----------------------------------------------------------------
assert.equal(shouldShowTryToday({ insightTryTodayShown: false, slotKind: 'none' }), true);
assert.equal(shouldShowTryToday({ insightTryTodayShown: true, slotKind: 'none' }), false);
assert.equal(shouldShowTryToday({ insightTryTodayShown: false, slotKind: 'missed_check' }), false);
assert.equal(shouldShowTryToday({ insightTryTodayShown: false, slotKind: 'note' }), true);
assert.equal(dailyInsightsVisible({ slotKind: 'week' }), true);
assert.equal(dailyInsightsVisible({ slotKind: 'missed_check' }), false);
ok('visibility: hidden on a missed-check day or when another try is shown; shown otherwise (crisis removed)');

// Map fixture sanity: a not-ready map never yields a provisional lean.
assert.equal(readCategory(CATEGORY_DEFS.find((d) => d.id === 'cat_love')!, [], now).ready, false);

console.log(`\n${passed} daily-insights-pick checks passed`);
