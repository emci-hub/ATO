/**
 * Quest blend (quests-game-track-plan §5, fixes 5-7). Run: npm run check:quest-blend
 *
 * Pins `effectiveValue`: includeQuests off = exactly the value shown today
 * (`report?.value ?? me`) for all 16 axes; the cap, the room rule and the 0.8 / 0.2 limit;
 * no report row = no blend and no label; non-Quest axes ignored; deterministic. Source scan:
 * no share / identity / hero / holo / almanac file uses the blend, and the profile's share
 * `content.tracks` stays the raw array. (S3 adds the profile screens that may import it.)
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { QUEST_AXES } from '../src/lib/quests/types';
import {
  QUEST_BLEND_CAP,
  QUEST_BLEND_CEILING,
  QUEST_BLEND_FLOOR,
  effectiveValue,
  trackFor,
  type TraitTrack,
} from '../src/lib/trait-stability';
import { TRAIT_AXES, type TraitAxis } from '../src/lib/traits';

const ok = (msg: string) => console.log(`  ok  ${msg}`);
const near = (a: number | null, b: number, msg = '') => {
  assert.ok(a !== null && Math.abs(a - b) <= 1e-9, `${msg} expected ${b}, got ${a}`);
};

const row = (axis: TraitAxis, track: TraitTrack['track'], value: number): TraitTrack => ({
  axis,
  track,
  value,
  stability: 0.5,
  answerCount: 5,
  lastTouched: '2026-10-28T12:00:00.000Z',
  lastDepthAt: null,
});

const questAxis = QUEST_AXES[0] as TraitAxis;
const nonQuest = TRAIT_AXES.find((a) => !(QUEST_AXES as readonly TraitAxis[]).includes(a));
assert.ok(nonQuest, 'there is at least one non-Quest axis');

// 1. Off = what is displayed today, all 16 axes (report value, else the me fallback).
for (const [i, axis] of TRAIT_AXES.entries()) {
  const withReport = [row(axis, 'report', 0.1 + i * 0.05), row(axis, 'quest', 0.95), row(axis, 'game', 0.9)];
  const shownToday = trackFor(withReport, axis, 'report')?.value ?? 0.42;
  const off = effectiveValue(withReport, axis, false, 0.42);
  assert.equal(off.value, shownToday, `${axis} off = report value`);
  assert.equal(off.blended, false);
  assert.equal(off.label, 'Questions');
  const noReport = effectiveValue([row(axis, 'quest', 0.95)], axis, false, 0.42);
  assert.equal(noReport.value, 0.42, `${axis} off, no report = me value`);
  assert.equal(noReport.label, null);
  assert.equal(effectiveValue([], axis, false).value, null);
}
ok('off = displayed value for all 16 axes');

// 2. Cap: a full-strength quest moves a mid value by exactly the cap, either way.
near(effectiveValue([row(questAxis, 'report', 0.5), row(questAxis, 'quest', 1)], questAxis, true).value, 0.5 + QUEST_BLEND_CAP, 'up cap');
near(effectiveValue([row(questAxis, 'report', 0.5), row(questAxis, 'quest', 0)], questAxis, true).value, 0.5 - QUEST_BLEND_CAP, 'down cap');
near(effectiveValue([row(questAxis, 'report', 0.5), row(questAxis, 'quest', 0.55)], questAxis, true).value, 0.55, 'small offset');
near(effectiveValue([row(questAxis, 'report', 0.5), row(questAxis, 'quest', 0.5)], questAxis, true).value, 0.5, 'neutral quest');
assert.equal(effectiveValue([row(questAxis, 'report', 0.5), row(questAxis, 'quest', 0.5)], questAxis, true).blended, false, 'neutral quest: not blended');
assert.equal(effectiveValue([row(questAxis, 'report', 0.9), row(questAxis, 'quest', 1)], questAxis, true).blended, false, 'held at report: not blended');
assert.equal(effectiveValue([row(questAxis, 'report', 0.5), row(questAxis, 'quest', 1)], questAxis, true).blended, true, 'moved: blended');
ok('cap holds');

// 3. Room rule: settled axes do not overshoot; 0.8 / 0.2 limit unless the report is already there.
const hi = effectiveValue([row(questAxis, 'report', 0.9), row(questAxis, 'quest', 1)], questAxis, true).value!;
assert.ok(hi >= 0.9 && hi <= 1, 'high report never lowered by an upward push, never past 1');
near(hi, 0.9, 'report already past 0.8: an upward push adds nothing');
near(effectiveValue([row(questAxis, 'report', 0.75), row(questAxis, 'quest', 1)], questAxis, true).value, QUEST_BLEND_CEILING, 'held at 0.8');
near(effectiveValue([row(questAxis, 'report', 0.25), row(questAxis, 'quest', 0)], questAxis, true).value, QUEST_BLEND_FLOOR, 'held at 0.2');
near(effectiveValue([row(questAxis, 'report', 0.95), row(questAxis, 'quest', 1)], questAxis, true).value, 0.95, 'report above 0.8 is not raised further');
near(effectiveValue([row(questAxis, 'report', 0.7), row(questAxis, 'quest', 1)], questAxis, true).value, 0.7 + QUEST_BLEND_CAP * 0.6, 'scaled by room (0.3 * 2), under the ceiling');
near(effectiveValue([row(questAxis, 'report', 0.95), row(questAxis, 'quest', 0)], questAxis, true).value, 0.95 - QUEST_BLEND_CAP, 'report above 0.8 pushed down: full cap');
for (let r = 0; r <= 100; r++) {
  for (const q of [0, 0.25, 0.5, 0.75, 1]) {
    const v = effectiveValue([row(questAxis, 'report', r / 100), row(questAxis, 'quest', q)], questAxis, true).value!;
    assert.ok(v >= 0 && v <= 1, `in range at ${r / 100}/${q}`);
    assert.ok(Math.abs(v - r / 100) <= QUEST_BLEND_CAP + 1e-9, `within cap at ${r / 100}/${q}`);
    if (q >= 0.5) assert.ok(v >= r / 100 - 1e-9, 'upward push never lowers');
    if (q <= 0.5) assert.ok(v <= r / 100 + 1e-9, 'downward push never raises');
  }
}
ok('room rule and 0.8 / 0.2 limit hold');

// 4. No report row = no blend, no label. Missing quest row = no change.
const noRep = effectiveValue([row(questAxis, 'quest', 1)], questAxis, true, 0.4);
assert.deepEqual(noRep, { value: 0.4, label: null, blended: false });
const noQuest = effectiveValue([row(questAxis, 'report', 0.6)], questAxis, true, 0.4);
assert.deepEqual(noQuest, { value: 0.6, label: 'Questions', blended: false });
ok('no report row / no quest row = no change');

// 5. Non-Quest axes ignored; the quest row only counts on its own axis.
const nq = effectiveValue([row(nonQuest, 'report', 0.5), row(nonQuest, 'quest', 1)], nonQuest, true);
assert.deepEqual(nq, { value: 0.5, label: 'Questions', blended: false });
const other = effectiveValue([row(questAxis, 'report', 0.5), row(nonQuest, 'quest', 1)], questAxis, true);
assert.equal(other.blended, false);
ok('non-Quest axes ignored');

// 6. Deterministic, and it never mutates its input.
const tracks = [row(questAxis, 'report', 0.4), row(questAxis, 'quest', 0.9)];
const frozen = JSON.stringify(tracks);
assert.deepEqual(effectiveValue(tracks, questAxis, true), effectiveValue(tracks, questAxis, true));
assert.equal(JSON.stringify(tracks), frozen);
ok('deterministic, input untouched');

// 7. Source scan: the blend stays off shared surfaces.
const SRC = resolve(__dirname, '../src');
const read = (p: string) => readFileSync(join(SRC, p), 'utf8');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
const BLEND = /\beffectiveValue\b|QUEST_BLEND_|\bEffectiveValue\b/;
const fenced = [
  ...['share-card', 'share-poster', 'identity-card', 'home-hero', 'holo-card'].map((n) => join(SRC, 'components', `${n}.tsx`)),
  ...walk(join(SRC, 'components', 'almanac')),
  ...walk(join(SRC, 'lib', 'almanac')),
  join(SRC, 'lib', 'almanac-share.ts'),
  join(SRC, 'lib', 'almanac-badges-store.ts'),
  join(SRC, 'hooks', 'use-almanac-day.ts'),
  join(SRC, 'components', 'today-pick-card.tsx'),
  join(SRC, 'app', '[handle].tsx'),
];
for (const f of fenced) {
  assert.ok(!BLEND.test(readFileSync(f, 'utf8')), `${f} must not use the Quest blend`);
}
ok(`${fenced.length} share / identity / hero / holo / almanac files never use the blend`);

assert.ok(
  /tracks: tracksOwned \? tracks : \[\]/.test(read('app/(tabs)/you.tsx')),
  'the tracks you.tsx hands to the almanac feed must stay the raw tracks array',
);
ok('you.tsx almanac-feed tracks stay the raw array (no caller fills share content.tracks today)');

console.log('quest-blend: all checks passed');
