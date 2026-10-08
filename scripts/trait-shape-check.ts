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

import { AXIS_SHORT_NAME } from '../src/lib/axis-poles';
import {
  SHAPE_LABEL_RING,
  axisAtPoint,
  labeledOuterRadius,
  shapeFilledCount,
  shapeGeometry,
  traitShapePoints,
} from '../src/lib/trait-shape';
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

// Bigger and easier to tap (emci, 2026-10-08).
{
  const names = TRAIT_AXES.map((a) => AXIS_SHORT_NAME[a]);
  for (const size of [260, 313, 340]) {
    const font = size >= 280 ? 10 : 9.5;
    const outer = labeledOuterRadius(names, size, font);
    assert.ok(outer > size * 0.25, `size ${size}: the shape is bigger than the old quarter (${outer.toFixed(1)})`);
    // Every name still fits inside the square, anchored the way the component draws it.
    names.forEach((name, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / names.length;
      const x = size / 2 + outer * SHAPE_LABEL_RING * Math.cos(angle);
      const width = name.length * font * 0.56;
      const cos = Math.cos(angle);
      const left = cos > 0.05 ? x : cos < -0.05 ? x - width : x - width / 2;
      const right = cos > 0.05 ? x + width : cos < -0.05 ? x : x + width / 2;
      assert.ok(left >= 0 && right <= size, `size ${size}: "${name}" fits (${left.toFixed(0)}..${right.toFixed(0)})`);
    });
  }
  const geo = shapeGeometry(traitShapePoints({} as never, []), 300, 100);
  geo.coords.forEach((c, i) => {
    assert.equal(axisAtPoint(geo, c.edgeX, c.edgeY), c.axis, 'a tap on a spoke is that trait');
    // A tap just short of halfway to the next spoke still belongs to this one.
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 16 + (Math.PI / 16) * 0.9;
    assert.equal(axisAtPoint(geo, 150 + 60 * Math.cos(a), 150 + 60 * Math.sin(a)), c.axis, 'each trait owns its whole slice');
  });
  assert.equal(axisAtPoint(geo, 150, 150), null, 'the very centre picks nothing');
  const shapeComponent = readFileSync(resolve(__dirname, '../src/components/trait-shape.tsx'), 'utf8');
  assert.match(
    shapeComponent,
    /const axis = axisAtPoint\(geo, event\.nativeEvent\.locationX, event\.nativeEvent\.locationY\);/,
    'one tap area over the whole diagram',
  );
  assert.match(shapeComponent, /accessibilityActions=\{geo\.coords\.map/, 'screen readers get one action per trait');
  assert.doesNotMatch(shapeComponent, /const HIT = 26/, 'the old 26px dots are gone');
}
ok('the hero shape is as big as its names allow, and a tap anywhere in a trait’s slice opens it');


console.log(`\ntrait-shape-check: ${passed} passed`);
