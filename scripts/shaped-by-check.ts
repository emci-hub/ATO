/**
 * "What shapes this" — the tap-to-open explanation behind a category card, the
 * identity name and each trait. Run: npm run check:shaped-by
 *
 * Runs the real logic (pure), checks the trait quotes and names, and pins that
 * every reveal is closed by default and never shows an internal trait name or a
 * number.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { AXIS_POLES, AXIS_SHORT_NAME, poleCopyClean } from '../src/lib/axis-poles';
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

// --- the quotes and the names -----------------------------------------------------
assert.equal(poleCopyClean(), true);
for (const axis of TRAIT_AXES) {
  for (const side of ['low', 'high'] as const) {
    const line = AXIS_POLES[axis][side];
    // Each line is something a person on that side would SAY, shown in quotes
    // after "You sound more like:" or "The other side:". So: short, and with no
    // quote marks of its own (the screen adds them).
    assert.ok(line.length > 0 && line.length <= 45, `${axis}.${side} is ${line.length} chars: ${line}`);
    assert.doesNotMatch(line, /["“”]/, `${axis}.${side} carries its own quote marks: ${line}`);
    assert.doesNotMatch(line, /\balways\b/i, `${axis}.${side}: ${line}`);
  }
  assert.notEqual(AXIS_POLES[axis].low, AXIS_POLES[axis].high);
}
for (const axis of TRAIT_AXES) {
  const name = AXIS_SHORT_NAME[axis];
  assert.ok(name.length > 0 && name.length <= 26, `${axis} name is ${name.length} chars`);
  assert.doesNotMatch(name, /_|\baxis\b/i, `internal word in a trait name: ${name}`);
}
assert.equal(new Set(Object.values(AXIS_SHORT_NAME)).size, TRAIT_AXES.length);
ok('all 32 trait quotes are short things a person would say, and all 16 trait names are short, plain and distinct');

// --- the logic -------------------------------------------------------------------
assert.equal(shapedByRow('openness', []).line, SHAPED_BY_NOT_ANSWERED);
assert.equal(shapedByRow('openness', [track('openness', 0.52)]).line, SHAPED_BY_MIDDLE);
const high = shapedByRow('openness', [track('openness', 0.8)]);
assert.equal(high.lean, 'high');
assert.equal(high.line, AXIS_POLES.openness.high);
assert.equal(high.label, AXIS_SHORT_NAME.openness);
assert.equal(high.settled, true);
const low = shapedByRow('openness', [track('openness', 0.2, 2)]);
assert.equal(low.line, AXIS_POLES.openness.low);
assert.equal(low.settled, false);
ok('a trait shows the quote for the side it leans to, says so when unanswered or in between, and knows if it is settled');

for (const row of shapedByRows(TRAIT_AXES, TRAIT_AXES.map((axis) => track(axis, 0.9)))) {
  assert.doesNotMatch(row.label, /_/, `internal name leaked: ${row.label}`);
  assert.doesNotMatch(`${row.label} ${row.line}`, /\d\.\d|%/, `a number leaked: ${row.label} ${row.line}`);
}
ok('a reveal row never shows an internal trait name or a score');

for (const def of CATEGORY_DEFS) {
  for (const axis of def.axes) assert.ok(categoriesForAxis(axis).includes(def.name));
}
assert.match(showsUpInLine('conscientiousness'), /^Part of: .+\.$/);
ok('every trait knows which categories it is part of, matching the category catalog');

const recipe = identityRecipe([]);
assert.deepEqual(recipe.first.map((r) => r.axis), [...MODIFIER_AXES]);
assert.deepEqual(recipe.second.map((r) => r.axis), [...CORE_AXES]);
ok('the name recipe lists the first word’s three traits and the second word’s three, in the classifier’s order');

// --- wiring ----------------------------------------------------------------------
const reveal = read('src/components/info-reveal.tsx');
assert.match(reveal, /const \[open, setOpen\] = useState\(false\);/);
assert.match(reveal, /\{open \? <View style=\{styles\.body\}>\{children\}<\/View> : null\}/);
assert.match(reveal, /\{row\.lean \? quoted\(row\.line\) : row\.line\}/);
ok('a reveal is closed until tapped, renders nothing while closed, and puts a quote in quote marks');

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
assert.match(profile, /\{YOUR_SIDE_LEAD\} \{quoted\(shaped\.line\)\}/);
assert.match(profile, /<InfoReveal label=\{AXIS_SHORT_NAME\[axis\]\} strong>/);
assert.equal((profile.match(/<InfoReveal /g) ?? []).length, 1, 'one "?" per trait, not two');
assert.doesNotMatch(profile, /AxisCodeLabel/, 'no two-letter trait codes on the full profile');
// Someone who leans one way must be shown the OPPOSITE quote as the other side.
assert.match(profile, /\{OTHER_SIDE_LEAD\} \{quoted\(poles\[shaped\.lean === 'high' \? 'low' : 'high'\]\)\}/);
ok('the full profile shows the trait’s plain name and your own quote; one "?" opens the other side and what it is part of');

for (const rel of ['src/components/paged-questions.tsx', 'src/components/profile-fill-fold.tsx']) {
  assert.match(read(rel), /AXIS_SHORT_NAME\[/, `${rel} should use the short trait name`);
}
ok('Questions and the traits-answered list use the same short trait names');

for (const rel of ['src/lib/shaped-by.ts', 'src/components/info-reveal.tsx']) {
  assert.doesNotMatch(read(rel), /generateText|ai-generate|supabase/, `${rel} must stay offline`);
}
ok('the explanations are computed on the phone: no model call, no network');

console.log(`\n${passed}/${passed} shaped-by checks passed.`);
