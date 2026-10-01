/**
 * Dev Inspector checks. Run: npm run check:dev-inspector
 *
 * The Inspector is how a tester SEES the system: axes as points with their band,
 * categories with the axes behind them, the AI gates, and where round questions
 * came from. These pin that what it shows is what the app actually computes.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { getCategoryDefs } from '../src/lib/categories';
import {
  AI_GATE_FEATURES,
  BAND_CUTS,
  aiGates,
  axisLine,
  axisName,
  inspectAxes,
  inspectCategories,
  roundItemFrom,
  roundSummary,
  toPoints,
} from '../src/lib/dev-inspector-model';
import type { TraitTrack } from '../src/lib/trait-stability';
import { TRAIT_AXES, emptyTraitState, traitBand, type TraitAxis } from '../src/lib/traits';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}
const read = (rel: string) => readFileSync(resolve(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const NOW = new Date('2026-10-01T12:00:00Z');
const track = (axis: TraitAxis, value: number, answerCount: number, stability = 0.8): TraitTrack => ({
  axis,
  track: 'report',
  value,
  stability,
  answerCount,
  lastTouched: NOW.toISOString(),
  lastDepthAt: null,
});

/* 1. points and bands are the app's own numbers */
{
  assert.equal(toPoints(0.62), 62);
  assert.equal(toPoints(null), null);
  assert.equal(toPoints(undefined), null);
  assert.deepEqual(BAND_CUTS, { low: 35, high: 65 }, 'the legend shows the real cut-offs');
  assert.equal(axisName('conflict_assertiveness'), 'Conflict assertiveness');

  const state = emptyTraitState();
  state.values.openness = 0.2;
  state.values.extraversion = 0.5;
  state.values.playfulness = 0.9;
  state.sources.playfulness = 'self_tap';
  state.sources.openness = 'self_situation';
  const tracks = [track('openness', 0.2, 6), track('extraversion', 0.5, 1), track('playfulness', 0.9, 4)];
  const history = [
    { id: '1', axis: 'openness' as const, value: 0.8, source: 'self_situation' as const, createdAt: 'a' },
    { id: '2', axis: 'openness' as const, value: 0.2, source: 'self_situation' as const, createdAt: 'b' },
  ];
  const rows = inspectAxes(state, tracks, history, NOW);
  assert.equal(rows.length, TRAIT_AXES.length, 'all 16 axes are listed, answered or not');
  const by = Object.fromEntries(rows.map((r) => [r.axis, r]));
  assert.equal(by.openness.points, 20);
  assert.equal(by.openness.band, 'low');
  assert.equal(by.extraversion.band, 'mid');
  assert.equal(by.playfulness.band, 'high');
  for (const r of rows) assert.equal(r.band, traitBand(state.values[r.axis]), `${r.axis}: the band is traitBand()`);
  assert.deepEqual(by.openness.recent, [80, 20], 'the score after each recent answer, oldest to newest, in points');
  // Game-track rows are a different track; they must not appear here.
  const withGame = inspectAxes(state, tracks, [...history, { id: '3', axis: 'openness' as const, value: 0.99, source: 'self_game' as const, createdAt: 'c' }], NOW);
  assert.deepEqual(withGame.find((r) => r.axis === 'openness')!.recent, [80, 20], 'game-track rows are left out');
  // The number shown is the report track's (what Explore and categories read), not a drifted profile column.
  const drift = emptyTraitState();
  drift.values.openness = 0.9;
  assert.equal(inspectAxes(drift, [track('openness', 0.2, 6)], [], NOW).find((r) => r.axis === 'openness')!.points, 20, 'the report track wins over the profile column');
  // SETTLED must be the rule categories really use (effectiveStability > 0), not the stricter Sage-title rule:
  // an axis with enough answers but LOW stability is still used by categories, so it must read settled here too.
  const lowButUsed = [track('openness', 0.7, 6, 0.1), track('extraversion', 0.7, 6, 0.1)];
  const lowAxes = inspectAxes(emptyTraitState(), lowButUsed, [], NOW);
  const lowCat = inspectCategories(lowButUsed, NOW).find((c) => c.id === 'cat_openness')!;
  assert.equal(lowAxes.find((r) => r.axis === 'openness')!.settled, lowCat.axes.find((a) => a.axis === 'openness')!.used, 'section 1 "settled" and section 2 "used" never contradict');
  for (const c of inspectCategories(tracks, NOW)) {
    for (const a of c.axes) assert.equal(a.used, rows.find((r) => r.axis === a.axis)!.settled, `${c.id}/${a.axis}: used === settled`);
  }
  assert.equal(by.openness.origin, 'from answers');
  assert.equal(by.playfulness.origin, 'you set it');
  assert.equal(by.steadiness.origin, 'not answered');
  assert.equal(axisLine(by.steadiness), 'not answered yet');
  assert.equal(by.openness.settled, true, '6 consistent answers settle an axis');
  assert.equal(by.extraversion.settled, false, '1 answer does not');
  assert.match(axisLine(by.openness), /^20 pts · LOW · 6 answers · settled$/);
  assert.match(axisLine(by.extraversion), /^50 pts · MID · 1 answer · needs \d+ answers to settle$/);
}
ok('axes: 16 rows, points out of 100, LOW / MID / HIGH from the app’s own cut-offs, recent answers, settled or not');

/* 2. categories show exactly the axes that feed them */
{
  const none = inspectCategories([], NOW);
  assert.equal(none.length, getCategoryDefs().length, 'every category is listed');
  assert.equal(none.length, 11);
  assert.ok(none.every((c) => !c.ready && c.result === 'not open yet' && c.needs), 'nothing answered: every category says what it needs');
  for (const c of none) {
    const def = getCategoryDefs().find((d) => d.id === c.id)!;
    assert.deepEqual(c.axes.map((a) => a.axis), [...def.axes], `${c.id}: lists its own axes, in order`);
  }
  const all = TRAIT_AXES.map((axis, i) => track(axis, (i % 10) / 10 + 0.05, 6));
  const full = inspectCategories(all, NOW);
  assert.ok(full.every((c) => c.ready && c.needs === null), 'all settled: every category is open');
  const communication = full.find((c) => c.id === 'cat_communication')!;
  assert.match(communication.result, /^\d+ pts \(average/, 'a bar shows one number');
  const love = full.find((c) => c.id === 'cat_love')!;
  assert.match(love.result, /^\d+ \/ \d+ pts \(two axes/, 'a map shows two');
  assert.ok(full.every((c) => c.axes.every((a) => a.used)), 'settled axes are marked as counted');
  const partial = inspectCategories([track('openness', 0.7, 6)], NOW).find((c) => c.id === 'cat_openness')!;
  assert.equal(partial.ready, false);
  assert.match(partial.needs ?? '', /1 of 2 axes settled — needs 1 more/);
}
ok('categories: all 11, each with its own axes and points, a result when open and what it needs when not');

/* 3. AI gates */
{
  const open = aiGates({ consent: 'granted', profileDone: true, usedToday: 3, dailyCap: 20 });
  assert.deepEqual(open.map((g) => g.label), ['A tap', 'Profile done', 'AI consent', 'A call left']);
  assert.ok(open.every((g) => g.pass));
  assert.match(open[3].detail, /Today: 3 of 20 used, 17 left/);
  // The monthly cap is a real server gate too, and unknown usage is never shown as a pass.
  assert.equal(aiGates({ consent: 'granted', profileDone: true, usedToday: 3, dailyCap: 20, usedMonth: 200, monthlyCap: 200 })[3].pass, false, 'month used up = not a pass');
  assert.equal(aiGates({ consent: 'granted', profileDone: true, usedToday: null, dailyCap: null })[3].pass, false, 'usage not loaded = not a pass');
  const shut = aiGates({ consent: 'pending', profileDone: false, usedToday: 20, dailyCap: 20 });
  assert.deepEqual(shut.map((g) => g.pass), [true, false, false, false]);
  assert.equal(aiGates({ consent: 'denied', profileDone: true, usedToday: null, dailyCap: null })[2].pass, false);
  assert.equal(AI_GATE_FEATURES.length, 4, 'the four live AI features');
  // "A tap" is a claim about the app; it is only honest while this check exists and runs.
  const pkg = read('package.json');
  assert.ok(pkg.includes('"check:no-auto-ai"'), 'the no-auto-AI check the panel cites is real');
}
ok('AI gates: tap, profile, consent, a call left — each shown pass / fail');

/* 4. question pool */
{
  assert.equal(roundItemFrom('authored'), 'shared bank');
  assert.equal(roundItemFrom('ai'), 'written by AI');
  assert.equal(roundItemFrom(null), 'unknown');
  assert.equal(roundItemFrom(null, true), 'written by AI', 'a bank id whose row is not readable is an AI question');
  assert.equal(roundItemFrom(undefined, false), 'unknown');
  const items = [
    { axis: 'openness', prompt: 'a', answered: true, from: 'shared bank' as const },
    { axis: 'openness', prompt: 'b', answered: false, from: 'written by AI' as const },
    { axis: 'autonomy', prompt: 'c', answered: false, from: 'shared bank' as const },
  ];
  assert.equal(roundSummary(items), '3 questions · 2 from the shared bank · 1 written by AI · 1 answered');
}
ok('pool: each round question is labelled shared bank or written by AI');

/* 5. read-only, and reachable */
{
  const panel = read('src/components/dev-inspector.tsx');
  assert.doesNotMatch(panel, /generateText|claimAiCall|\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\('(?!bank_pool_depth)/, 'the panel never writes and never calls a model');
  const model = read('src/lib/dev-inspector-model.ts');
  assert.doesNotMatch(model, /supabase|generateText|AsyncStorage/, 'the model is pure');
  assert.ok(read('src/app/dev-lab.tsx').includes('<DevInspector />'), 'in the Dev Tools Hub');
  assert.ok(read('src/components/app-dev-fab.tsx').includes("case 'inspector':"), 'in the floating DEV bubble');
  assert.ok(read('src/lib/dev-fab-model.ts').includes("APP_DEV_EVERYWHERE: readonly AppDevSection[] = ['inspector',"), 'on every app screen, first');
}
ok('read-only, pure model, shown in the Hub and on every screen via the DEV bubble');

console.log(`\n${passed} dev-inspector checks passed`);
