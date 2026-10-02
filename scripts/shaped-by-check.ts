/**
 * "What shapes this" — the tap-to-open explanation behind a category card, the
 * identity name and each trait. Run: npm run check:shaped-by
 *
 * Runs the real logic (pure), checks the trait-end lines can be read from
 * either side, and pins that every reveal is closed by default and never shows
 * an internal trait name or a number.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { AXIS_POLES, poleCopyClean } from '../src/lib/axis-poles';
import { CATEGORY_DEFS } from '../src/lib/categories';
import { CORE_AXES, MODIFIER_AXES } from '../src/lib/legends64/classify';
import {
  SHAPED_BY_MIDDLE,
  SHAPED_BY_NOT_ANSWERED,
  categoriesForAxis,
  identityRecipe,
  shapedByRow,
  shapedByRows,
  showsUpInLine,
} from '../src/lib/shaped-by';
import type { TraitTrack } from '../src/lib/trait-stability';
import { TRAIT_AXES, type TraitAxis } from '../src/lib/traits';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

function track(axis: TraitAxis, value: number, answerCount = 4, stability = 0.8): TraitTrack {
  return { axis, track: 'report', value, stability, answerCount, lastTouched: new Date().toISOString(), lastDepthAt: null };
}

// --- the lines ------------------------------------------------------------------
assert.equal(poleCopyClean(), true);
for (const axis of TRAIT_AXES) {
  for (const side of ['low', 'high'] as const) {
    const line = AXIS_POLES[axis][side];
    assert.ok(line.length > 0 && line.length <= 110, `${axis}.${side} length ${line.length}`);
    // Each line is shown both as "Your side: …" and as "The other end: …", so it
    // may not carry a subject of its own.
    assert.doesNotMatch(line, /\b(you|your|they|their|them)\b/i, `${axis}.${side} has a subject: ${line}`);
    assert.doesNotMatch(line, /\balways\b/i, `${axis}.${side}: ${line}`);
  }
  assert.notEqual(AXIS_POLES[axis].low, AXIS_POLES[axis].high);
}
ok('all 32 trait-end lines pass the fence, are short, and carry no subject so they read from either side');

// --- the logic -------------------------------------------------------------------
assert.equal(shapedByRow('openness', []).line, SHAPED_BY_NOT_ANSWERED);
assert.equal(shapedByRow('openness', [track('openness', 0.52)]).line, SHAPED_BY_MIDDLE);
const high = shapedByRow('openness', [track('openness', 0.8)]);
assert.equal(high.lean, 'high');
assert.equal(high.line, AXIS_POLES.openness.high);
assert.equal(high.settled, true);
const low = shapedByRow('openness', [track('openness', 0.2, 2)]);
assert.equal(low.line, AXIS_POLES.openness.low);
assert.equal(low.settled, false);
ok('a trait shows the line for the side it leans to, says so when unanswered or in the middle, and knows if it is settled');

for (const row of shapedByRows(TRAIT_AXES, TRAIT_AXES.map((axis) => track(axis, 0.9)))) {
  assert.doesNotMatch(row.label, /_/, `internal name leaked: ${row.label}`);
  assert.doesNotMatch(`${row.label} ${row.line}`, /\d\.\d|%/, `a number leaked: ${row.label} ${row.line}`);
}
ok('a reveal row never shows an internal trait name or a score');

for (const def of CATEGORY_DEFS) {
  for (const axis of def.axes) assert.ok(categoriesForAxis(axis).includes(def.name));
}
assert.match(showsUpInLine('conscientiousness'), /^Shows up in: .+\.$/);
ok('every trait knows which categories it feeds, matching the category catalog');

const recipe = identityRecipe([]);
assert.deepEqual(recipe.first.map((r) => r.axis), [...MODIFIER_AXES]);
assert.deepEqual(recipe.second.map((r) => r.axis), [...CORE_AXES]);
ok('the name recipe lists the first word’s three traits and the second word’s three, in the classifier’s order');

// --- wiring ----------------------------------------------------------------------
const reveal = read('src/components/info-reveal.tsx');
assert.match(reveal, /const \[open, setOpen\] = useState\(false\);/);
assert.match(reveal, /\{open \? <View style=\{styles\.body\}>\{children\}<\/View> : null\}/);
ok('a reveal is closed until tapped and renders nothing underneath while closed');

const fold = read('src/components/categories-fold.tsx');
assert.match(fold, /<InfoReveal label=\{SHAPED_BY_LABEL\}>/);
assert.match(fold, /<ShapedByList rows=\{shapedByRows\(reading\.def\.axes, tracks\)\} \/>/);
// Inside the opened card, not on the list row: the list stays a clean list.
assert.ok(fold.indexOf('<InfoReveal label={SHAPED_BY_LABEL}>') > fold.indexOf('{open ? ('));
ok('a category card explains what shapes it, inside the opened card only');

const identity = read('src/components/identity-card.tsx');
assert.match(identity, /<InfoReveal label=\{IDENTITY_RECIPE_LABEL\}>/);
assert.match(identity, /<ShapedByList rows=\{recipe\.first\} \/>[\s\S]*<ShapedByList rows=\{recipe\.second\} \/>/);
ok('the identity card explains how the name is made');

const profile = read('src/components/full-profile-fold.tsx');
assert.match(profile, /Your side: \{shaped\.line\}/);
assert.match(profile, /<InfoReveal label=\{shaped\.lean \? OTHER_END_LABEL : BOTH_ENDS_LABEL\}>/);
// Someone who leans one way must be shown the OPPOSITE line as the other end.
assert.match(profile, /The other end: \{poles\[shaped\.lean === 'high' \? 'low' : 'high'\]\}/);
assert.doesNotMatch(profile, /Low: \{poles\.low\}/);
ok('the full profile leads with your own side; the other end and where it shows up are one tap away');

for (const rel of ['src/lib/shaped-by.ts', 'src/components/info-reveal.tsx']) {
  assert.doesNotMatch(read(rel), /generateText|ai-generate|supabase/, `${rel} must stay offline`);
}
ok('the explanations are computed on the phone: no model call, no network');

console.log(`\n${passed}/${passed} shaped-by checks passed.`);
