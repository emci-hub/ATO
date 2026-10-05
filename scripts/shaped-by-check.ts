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

import { AXIS_POLE_NAME, AXIS_POLES, AXIS_SHORT_NAME, poleCopyClean } from '../src/lib/axis-poles';
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
// Uniform: every trait is one noun (at most two words), every end is one word.
const endWords: string[] = [];
for (const axis of TRAIT_AXES) {
  assert.ok(AXIS_SHORT_NAME[axis].split(' ').length <= 2, `trait name is a phrase: ${AXIS_SHORT_NAME[axis]}`);
  assert.match(AXIS_SHORT_NAME[axis], /^[A-Z]/);
  for (const end of ['low', 'high'] as const) {
    const word = AXIS_POLE_NAME[axis][end];
    assert.match(word, /^[A-Z][a-z]+(-[a-z]+)?$/, `end name must be one capitalised word: ${word}`);
    endWords.push(word);
  }
  assert.notEqual(AXIS_POLE_NAME[axis].low, AXIS_POLE_NAME[axis].high);
}
assert.equal(new Set(endWords).size, endWords.length, 'two traits share an end word');
ok('all 32 quotes are short things a person would say; all 16 traits are one noun and all 32 ends one distinct word');

// --- the logic -------------------------------------------------------------------
assert.equal(shapedByRow('openness', []).line, SHAPED_BY_NOT_ANSWERED);
assert.equal(shapedByRow('openness', [track('openness', 0.52)]).line, SHAPED_BY_MIDDLE);
const high = shapedByRow('openness', [track('openness', 0.8)]);
assert.equal(high.lean, 'high');
assert.equal(high.line, AXIS_POLES.openness.high);
assert.equal(high.label, AXIS_SHORT_NAME.openness);
assert.equal(high.poleName, AXIS_POLE_NAME.openness.high);
assert.equal(shapedByRow('openness', []).poleName, null);
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
assert.deepEqual(recipe.third.map((r) => r.axis), ['growth_mindset', 'steadiness', 'playfulness']);
ok('the name recipe lists the first word’s three traits and the second word’s three, in the classifier’s order');

// --- wiring ----------------------------------------------------------------------
const reveal = read('src/components/info-reveal.tsx');
assert.match(reveal, /const \[open, setOpen\] = useState\(false\);/);
assert.match(reveal, /\{open \? <View style=\{styles\.body\}>\{children\}<\/View> : null\}/);
assert.match(reveal, /\{row\.lean \? quoted\(row\.line\) : row\.line\}/);
assert.match(reveal, /\{row\.poleName \? ` · \$\{row\.poleName\}` : ''\}/);
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
assert.match(profile, /\{YOUR_SIDE_LEAD\} \{shaped\.poleName\}: \{quoted\(shaped\.line\)\}/);
assert.match(profile, /<InfoReveal label=\{AXIS_SHORT_NAME\[axis\]\} strong>/);
assert.equal((profile.match(/<InfoReveal /g) ?? []).length, 1, 'one "?" per trait, not two');
assert.doesNotMatch(profile, /AxisCodeLabel/, 'no two-letter trait codes on the full profile');
// Someone who leans one way is shown only the OPPOSITE end inside the "?", by name.
assert.match(profile, /const listedEnds: readonly TraitLean\[\] = shaped\.lean\s+\? \[shaped\.lean === 'high' \? 'low' : 'high'\]\s+: \['low', 'high'\];/);
assert.match(profile, /\{AXIS_POLE_NAME\[axis\]\[end\]\}: \{quoted\(poles\[end\]\)\}/);
assert.doesNotMatch(profile + read('src/lib/shaped-by.ts'), /One side|The other side|other end/i);
ok('the full profile shows the trait, the end you lean to by name, and its quote; one "?" opens the opposite end and what it is part of');

for (const rel of ['src/components/paged-questions.tsx', 'src/components/profile-fill-fold.tsx']) {
  assert.match(read(rel), /AXIS_SHORT_NAME\[/, `${rel} should use the short trait name`);
}
ok('Questions and the traits-answered list use the same short trait names');

for (const rel of ['src/lib/shaped-by.ts', 'src/components/info-reveal.tsx']) {
  assert.doesNotMatch(read(rel), /generateText|ai-generate|supabase/, `${rel} must stay offline`);
}
ok('the explanations are computed on the phone: no model call, no network');

console.log(`\n${passed}/${passed} shaped-by checks passed.`);
