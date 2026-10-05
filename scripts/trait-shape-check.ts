/**
 * "Your shape" maths (polish pass, emci 2026-10-05).
 * Run: npm run check:trait-shape
 *
 * Pins: 16 points in TRAIT_AXES order; a missing value is blank (never 0);
 * the report track wins over the `me` column; the middle ring is lean 0.5;
 * no outline under 3 points; the shape component prints no numbers.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { shapeFilledCount, shapeGeometry, traitShapePoints } from '../src/lib/trait-shape';
import type { TraitTrack } from '../src/lib/trait-stability';
import { TRAIT_AXES } from '../src/lib/traits';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const empty = traitShapePoints(null, []);
assert.equal(empty.length, 16);
assert.deepEqual(
  empty.map((p) => p.axis),
  [...TRAIT_AXES],
);
assert.ok(empty.every((p) => p.state === 'blank' && p.lean === null));
assert.equal(shapeFilledCount(empty), 0);
ok('no data = 16 blank spokes in TRAIT_AXES order');

const track = (axis: (typeof TRAIT_AXES)[number], value: number, answerCount: number): TraitTrack => ({
  axis,
  track: 'report',
  value,
  stability: 0.9,
  answerCount,
  lastTouched: new Date().toISOString(),
  lastDepthAt: null,
});
const me = { openness: 0.2, extraversion: 0.9 } as Record<string, number>;
const pts = traitShapePoints(me, [track('openness', 0.8, 1), { ...track('extraversion', 0.1, 1), track: 'game' }]);
assert.equal(pts[0].lean, 0.8, 'report track wins over the me column');
assert.equal(pts[2].lean, 0.9, 'the game track never mixes in');
assert.equal(pts[1].state, 'blank');
assert.equal(pts[0].state, 'settling', 'one answer is not settled');
ok('report track first, then the me column; game track ignored');

const geo = shapeGeometry(pts, 200, 80);
const midR = geo.mid;
const blank = geo.coords[1];
assert.ok(Math.abs(Math.hypot(blank.x - geo.cx, blank.y - geo.cy) - midR) < 0.01);
assert.equal(geo.path, null, 'two points draw no outline');
ok('blank spokes sit on the middle ring; no outline under 3 points');

const full = traitShapePoints(
  Object.fromEntries(TRAIT_AXES.map((a) => [a, 0.5])) as Record<string, number>,
  [],
);
const fullGeo = shapeGeometry(full, 200, 80);
assert.ok(fullGeo.path?.startsWith('M'));
assert.ok(fullGeo.coords.every((c) => Math.abs(Math.hypot(c.x - 100, c.y - 100) - fullGeo.mid) < 0.01));
ok('every lean of 0.5 sits exactly on the dashed middle ring');

const component = readFileSync(resolve(__dirname, '../src/components/trait-shape.tsx'), 'utf8');
assert.doesNotMatch(component, /toFixed|Math\.round|%`|stability|answerCount/);
assert.match(component, /reduceMotion \|\| !animate/);
assert.doesNotMatch(component, /generateText|supabase|\.rpc\(/);
ok('the shape prints no numbers, honours Reduce Motion and calls nothing');

console.log(`\ntrait-shape-check: ${passed} passed`);
