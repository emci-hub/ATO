/**
 * Wave 20: EWMA tracks, anti-gaming, settled completeness, Sage titles.
 * Run: npm run check:wave20
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { AXIS_POLES, POLE_COPY_REVIEWED, poleCopyClean } from '../src/lib/axis-poles';
import {
  TITLE_COPY_REVIEWED,
  TITLE_EMPTY,
  TITLE_SAMPLES,
  parseTitleBody,
  titleCopyClean,
  titleReady,
} from '../src/lib/sage-title';
import {
  divergingAxes,
  divergingAxesFromTracks,
} from '../src/lib/trait-history';
import {
  DECAY_GRACE_DAYS,
  DECAY_HALF_LIFE_DAYS,
  DEPTH_COOLDOWN_HOURS,
  EWMA_ALPHA,
  STABILITY_FLOOR_N,
  UNDO_SAME_AXIS_REPEAT_CAP,
  applyEwmaAnswer,
  decayedStability,
  depthReady,
  effectiveStability,
  settledAxisLabel,
  settledCount,
  settledScore,
  trackKindForSource,
  type TraitTrack,
} from '../src/lib/trait-stability';
import { TRAIT_AXES } from '../src/lib/traits';
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

assert.equal(EWMA_ALPHA, 0.35);
assert.equal(STABILITY_FLOOR_N, 3);
assert.equal(DECAY_GRACE_DAYS, 60);
assert.equal(DECAY_HALF_LIFE_DAYS, 90);
assert.equal(DEPTH_COOLDOWN_HOURS, 48);
assert.equal(UNDO_SAME_AXIS_REPEAT_CAP, 1);

const nowIso = '2026-08-31T12:00:00.000Z';
const first = applyEwmaAnswer(null, 'openness', 'report', 0.8, nowIso);
assert.equal(first.value, 0.8);
assert.equal(first.answerCount, 1);
assert.equal(first.stability, 0);
assert.equal(effectiveStability(first), 0);

const second = applyEwmaAnswer(first, 'openness', 'report', 0.2, nowIso);
assert.equal(second.answerCount, 2);
assert.ok(second.value > 0.2 && second.value < 0.8, 'second sample blends, never overwrites');
assert.equal(effectiveStability(second), 0);

const third = applyEwmaAnswer(second, 'openness', 'report', 0.8, nowIso);
assert.equal(third.answerCount, 3);
assert.ok(effectiveStability(third) > 0);
assert.ok(third.value !== 0.8);
ok('EWMA blends; stability is 0 below the 3-answer floor');

assert.equal(trackKindForSource('self_game'), 'game');
assert.equal(trackKindForSource('self_tap'), 'report');
assert.equal(trackKindForSource('self_situation'), 'report');
const game = applyEwmaAnswer(null, 'openness', 'game', 0.1, nowIso);
assert.equal(game.track, 'game');
assert.equal(settledScore([game, first]), 0);
ok('self_game is a separate game track and never counts toward settled');

const now = new Date('2026-08-31T00:00:00.000Z');
const fresh: TraitTrack = {
  ...third,
  stability: 1,
  lastTouched: '2026-08-01T00:00:00.000Z',
};
assert.equal(effectiveStability(fresh, now), 1);
const idle: TraitTrack = {
  ...third,
  stability: 1,
  lastTouched: '2026-04-01T00:00:00.000Z',
};
assert.ok(effectiveStability(idle, now) < 1);
assert.equal(decayedStability(1, '2026-08-01T00:00:00.000Z', now), 1);
ok('stability decays at read after 60 idle days, 90-day half-life');

const reportStable: TraitTrack = {
  axis: 'extraversion',
  track: 'report',
  value: 0.8,
  stability: 1,
  answerCount: 5,
  lastTouched: nowIso,
  lastDepthAt: null,
};
assert.equal(settledAxisLabel([reportStable]), '1 of 16 settled');
assert.equal(settledCount([]), 0);
ok('completeness is stability-weighted N of 16 settled');

assert.equal(depthReady(null, now), true);
assert.equal(depthReady('2026-08-30T00:00:00.000Z', now), false);
assert.equal(depthReady('2026-08-28T00:00:00.000Z', now), true);
ok('Full Profile Depth is 48h per axis');

const blendedDiv = divergingAxesFromTracks([
  { ...reportStable, axis: 'autonomy', value: 0.8 },
  { axis: 'autonomy', track: 'game', value: 0.2, stability: 0.5, answerCount: 3, lastTouched: nowIso, lastDepthAt: null },
]);
assert.equal(blendedDiv.length, 1);
assert.equal(blendedDiv[0]!.axis, 'autonomy');
const rawDiv = divergingAxes([
  { id: '1', axis: 'autonomy', value: 0.9, source: 'self_tap', createdAt: nowIso },
  { id: '2', axis: 'autonomy', value: 0.1, source: 'self_game', createdAt: nowIso },
]);
assert.equal(rawDiv.length, 1);
ok('divergence helper compares blended tracks; raw last-answer helper remains as fallback');

assert.equal(POLE_COPY_REVIEWED, false);
assert.equal(TITLE_COPY_REVIEWED, false);
assert.equal(poleCopyClean(), true);
assert.equal(titleCopyClean(), true);
assert.equal(Object.keys(AXIS_POLES).length, TRAIT_AXES.length);
assert.equal(TITLE_SAMPLES.length, 6);
for (const axis of TRAIT_AXES) {
  assert.equal(containsFrameworkTerm(AXIS_POLES[axis].low), false, axis);
  assert.equal(containsFrameworkTerm(AXIS_POLES[axis].high), false, axis);
}
assert.equal(containsFrameworkTerm(TITLE_EMPTY), false);
ok('pole + title drafts are flagged unreviewed and fence-clean');

assert.equal(parseTitleBody('{"title":"INTJ Visionary","lede":"You are an INTJ."}'), null);
assert.equal(parseTitleBody('{"title":"Quiet follow-through","lede":"Keeps the plan, prefers a smaller room."}')?.title, 'Quiet follow-through');
const thin: TraitTrack[] = [first];
assert.equal(titleReady(thin), false);
ok('title parser rejects type-branding; thin profiles stay unnamed');

const sql = read('supabase/migrations/wave20_trait_tracks_titles.sql');
assert.match(sql, /create table public.trait_tracks/);
assert.match(sql, /track in \('report', 'game'\)/);
assert.match(sql, /create table public.sage_title_flags/);
assert.match(sql, /claim_title_generate/);
assert.match(sql, /by_type.title/);
assert.match(sql, /does not increment Talk calls/);
assert.doesNotMatch(sql, /calls = calls \+ 1/);
assert.match(sql, /title_daily_cap/);
ok('schema: dual tracks + title flags; title RPC does not increment Talk calls');

const meSrc = read('src/lib/me.ts');
assert.match(meSrc, /applyEwmaAnswer/);
assert.match(meSrc, /trackKindForSource/);
const confirmStart = meSrc.indexOf('export async function confirmTraits');
const persistStart = meSrc.indexOf('async function persistMe(');
assert.ok(confirmStart >= 0 && persistStart > confirmStart);
assert.doesNotMatch(meSrc.slice(confirmStart, persistStart), /applyEwmaAnswer/);
ok('confirm-upgrade still does not touch tracks or the number');

const sage = read('src/app/(tabs)/sage.tsx');
assert.match(sage, /settledAxisLabel/);
assert.match(sage, /settledCount/);
assert.match(sage, /divergingAxesFromTracks/);
assert.match(sage, /SageTitleCard/);
assert.doesNotMatch(sage, /answeredAxisLabel/);
assert.doesNotMatch(sage, /divergingAxes\(/);
ok('Sage uses settled completeness, blended-track divergence, and the title card');

const fold = read('src/components/full-profile-fold.tsx');
assert.match(fold, /settledAxisLabel/);
assert.match(fold, /AXIS_POLES/);
assert.match(fold, /undoBlocked/);
assert.match(fold, /lastDepthAt/);
assert.match(read('src/components/axis-taps.tsx'), /undoBlocked/);
assert.match(read('src/components/depth-dive.tsx'), /depthReady/);
ok('Full Profile shows poles, undo cap, and depth cooldown');

const home = read('src/app/(tabs)/index.tsx');
const crisis = read('src/components/crisis-card.tsx');
const widget = read('targets/widget/widgets.swift');
for (const [name, source] of [
  ['home', home],
  ['crisis', crisis],
  ['widget', widget],
] as const) {
  if (name === 'home') {
    assert.doesNotMatch(source, /SageTitleCard|AXIS_POLES|settledAxisLabel|sage_title_flags/);
    assert.doesNotMatch(source, /FullProfileFold/);
  } else {
    assert.doesNotMatch(source, /trait_tracks|SageTitleCard|AXIS_POLES|settledAxisLabel|sage_title_flags/);
  }
  assert.doesNotMatch(source, /of \d+ settled/, `${name} must not show settled completeness`);
}
ok('Home, crisis card, and widget stay untouched');

console.log(`\n${passed} wave20 checks passed`);
