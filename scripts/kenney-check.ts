/**
 * Kenney pipeline checks. Run: npx tsx scripts/kenney-check.ts
 *
 * Verifies: manifest ↔ exported asset completeness, variant matching, legacy
 * recipe migration, and generic resolution (no family branches). The generated
 * asset registry is Metro-only (uses require), so completeness is checked by
 * scanning the exported files + the registry file's text.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { SHAPE_MANIFEST } from '../src/lib/kenney/manifests/shape';
import { kenneyCredits, KENNEY_SITE_URL } from '../src/lib/kenney/credits';
import {
  ACCOUNT_RECIPES,
  DEFAULT_RECIPE,
  KENNEY_REGISTRY,
  accountRecipeIndex,
  nearestVariant,
  normalizeRecipe,
  recipeForAccount,
  recipeFromAccountId,
  resolveCharacter,
} from '../src/lib/kenney/registry';
import { TAP_MOODS, pickTapMood } from '../src/lib/kenney/tap-moods';
import { PNG } from 'pngjs';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

// Every manifest state must exist on disk (colorable × 6 variants), EXCEPT the
// magic `hidden` state, which intentionally has no asset (renders nothing).
const assetsRoot = path.resolve(__dirname, '../assets/kenney/shape');
let expected = 0;
const expectedKeys: string[] = [];
for (const part of SHAPE_MANIFEST.parts) {
  for (const sprite of Object.values(part.states)) {
    if (sprite.asset === 'hidden') continue;
    const variants = part.colorable ? SHAPE_MANIFEST.colorVariants.map((v) => v.id) : [''];
    for (const variant of variants) {
      const name = part.colorable ? `${sprite.asset}.${variant}.png` : `${sprite.asset}.png`;
      const file = path.join(assetsRoot, part.id, name);
      assert.ok(fs.existsSync(file), `missing exported asset ${part.id}/${name}`);
      expectedKeys.push(`'shape/${part.id}/${name}'`);
      expected += 1;
    }
  }
}
ok(`all ${expected} manifest assets are exported`);

// The generated registry must reference every key (Metro can't be run here).
const registryPath = path.resolve(__dirname, '../src/lib/kenney/generated-assets.ts');
const registryText = fs.readFileSync(registryPath, 'utf8');
for (const key of expectedKeys) {
  assert.ok(registryText.includes(key), `registry missing ${key}`);
}
ok(`generated-assets.ts references all ${expected} assets`);

// Variant matching picks the nearest Kenney color.
assert.equal(nearestVariant(SHAPE_MANIFEST, '#738ae9'), 'blue');
assert.equal(nearestVariant(SHAPE_MANIFEST, '#da5463'), 'red');
assert.equal(nearestVariant(SHAPE_MANIFEST, '#f8c13a'), 'yellow');
ok('nearestVariant matches the 6 pack colors from a hex palette');

// show_up must actually drive the pixel color: the palette handed to the
// variant matcher is hex (never hsl, which the hex parser would read as NaN
// and collapse every account to the first variant = blue).
const { resolveFacePalette, accentFromShowUp } = require('../src/lib/color') as typeof import('../src/lib/color');
const hexRe = /^#[0-9a-f]{6}$/i;
for (const phrase of ['building something', 'running hot', 'finishing my resume', 'quiet week']) {
  assert.match(resolveFacePalette(null, phrase), hexRe);
  assert.match(accentFromShowUp(phrase).light, hexRe);
  assert.match(accentFromShowUp(phrase).dark, hexRe);
}
const showUpVariants = new Set(
  ['building something', 'running hot', 'finishing my resume'].map((phrase) =>
    nearestVariant(SHAPE_MANIFEST, resolveFacePalette(null, phrase)),
  ),
);
assert.ok(showUpVariants.size >= 3, 'distinct show_up answers must land on distinct color variants');
ok('show_up maps to a real hex palette and distinct pixel colors, not a blue default');

// Legacy migrations.
const legacyShape = normalizeRecipe({ source: 'shape', base: 'rhombus', top: 'tired', hair: null, palette: null });
assert.equal(legacyShape.source, 'shape');
assert.equal(legacyShape.parts.body, 'rhombus');
assert.equal(legacyShape.parts.face, 'tired');

const legacyString = normalizeRecipe('listen');
assert.equal(legacyString.parts.face, 'listen');
assert.equal(legacyString.parts.body, DEFAULT_RECIPE.parts.body);

const legacyMonster = normalizeRecipe({ source: 'monster', base: 'body_blueA', top: 'horn_large', hair: null, palette: null });
assert.equal(legacyMonster.source, 'shape', 'unmanifested family falls back to the default shape look');

const newShape = normalizeRecipe({ source: 'shape', parts: { body: 'square', face: 'glow', hand: 'peace' }, palette: '#da5463' });
assert.equal(newShape.parts.hand, 'peace');
assert.equal(newShape.parts.face, 'glow');
assert.equal(newShape.palette, '#da5463');

assert.deepEqual(normalizeRecipe('junk recipe'), DEFAULT_RECIPE);
ok('normalizeRecipe migrates legacy shape / string / monster and validates the new shape');

// Generic resolution: default recipe has hands HIDDEN at rest.
const resolved = resolveCharacter(DEFAULT_RECIPE);
assert.deepEqual(
  resolved.layers.map((l) => l.partId),
  ['body', 'face'],
  'default rest has no hand layer (hands hidden)',
);
const bodyLayer = resolved.layers.find((l) => l.partId === 'body')!;
assert.ok(bodyLayer.key.endsWith('.blue.png'), `default palette -> blue variant (got ${bodyLayer.key})`);
const faceLayer = resolved.layers.find((l) => l.partId === 'face')!;
assert.ok(faceLayer.key.endsWith('face_a.png'), `default face is face_a (got ${faceLayer.key})`);

// A gesture state (e.g. thumb) brings the hand layers back, mirrored.
const gesturing = resolveCharacter({
  ...DEFAULT_RECIPE,
  parts: { ...DEFAULT_RECIPE.parts, hand: 'thumb' },
});
const handLayer = gesturing.layers.find((l) => l.partId === 'hand')!;
assert.equal(handLayer.instances.length, 2, 'two hand placements when gesturing');
assert.equal(handLayer.instances[1].flip, true, 'left hand mirrors');
assert.ok(handLayer.key.endsWith('thumb.blue.png'), `gesture thumb resolves (got ${handLayer.key})`);
ok('resolveCharacter hides hands at rest and re-adds them for a gesture, zero family branches');

// Event gestures are manifest-driven.
const gestureMap = SHAPE_MANIFEST.eventGestures ?? {};
assert.equal(gestureMap.checkDone?.state, 'thumb');
assert.equal(gestureMap.talkReply?.state, 'point');
assert.equal(gestureMap.circleConnected?.state, 'peace');
assert.equal(gestureMap.posterShared?.state, 'peace');
ok('event gestures map to manifest-declared hand states');

const handStateIds = Object.keys(SHAPE_MANIFEST.parts.find((p) => p.id === 'hand')!.states);
for (const mood of Object.values(TAP_MOODS)) {
  assert.ok(handStateIds.includes(mood.hand), `${mood.id} uses a real hand state`);
  assert.ok(mood.durationMs <= 900, `${mood.id} stays under 1s (${mood.durationMs}ms)`);
}
assert.equal(TAP_MOODS.wave.hand, 'open');
assert.equal(TAP_MOODS.thumbsUp.hand, 'thumb');
assert.equal(TAP_MOODS.happyBounce.hand, 'peace');
assert.equal(TAP_MOODS.hug.hand, 'open');
const first = pickTapMood(false, null);
const second = pickTapMood(false, first.id);
assert.notEqual(second.id, first.id);
ok('tap moods are complete coherent gestures under 1s, no last-id repeat');

// Hand/body color consistency: every exported hand variant's dominant color
// must match its body variant. Guards the raw-name-override regression where
// all hands were exported as the yellow file.
function dominantColor(file: string): string | null {
  const png = PNG.sync.read(fs.readFileSync(file));
  const counts = new Map<string, number>();
  for (let i = 0; i < png.data.length; i += 4) {
    const a = png.data[i + 3];
    if (a < 200) continue;
    const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
    if (r === g && g === b) continue;
    const key = `${r},${g},${b}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((x, y) => y[1] - x[1])[0];
  return top ? top[0] : null;
}
const variants = SHAPE_MANIFEST.colorVariants.map((v) => v.id);
const handStates = Object.keys(
  SHAPE_MANIFEST.parts.find((p) => p.id === 'hand')!.states,
).filter((s) => s !== 'hidden');
let colorChecks = 0;
for (const variant of variants) {
  const body = dominantColor(path.join(assetsRoot, 'body', `circle.${variant}.png`));
  assert.ok(body, `no body color for ${variant}`);
  const [br, bg, bb] = body.split(',').map(Number);
  for (const state of handStates) {
    const hand = dominantColor(path.join(assetsRoot, 'hand', `${state}.${variant}.png`));
    assert.ok(hand, `no hand color for ${variant}/${state}`);
    const [hr, hg, hb] = hand.split(',').map(Number);
    const dist = (br - hr) ** 2 + (bg - hg) ** 2 + (bb - hb) ** 2;
    assert.ok(dist < 500, `${state}.${variant} hand ${hand} vs body ${body} (dist ${dist})`);
    colorChecks += 1;
  }
}
ok(`all ${colorChecks} hand assets match their body variant's color (no all-yellow regression)`);

// Registry is manifest-driven.
assert.equal(Object.keys(KENNEY_REGISTRY).length, 1, 'one registered family');

const credits = kenneyCredits();
assert.equal(credits.length, Object.keys(KENNEY_REGISTRY).length);
assert.equal(credits.length, 1);
assert.equal(credits[0].pack, 'Shape Characters');
assert.equal(credits[0].creator, 'Kenney');
assert.equal(credits[0].siteUrl, KENNEY_SITE_URL);
assert.equal(credits[0].packUrl, 'https://kenney.nl/assets/shape-characters');
assert.ok(fs.existsSync(path.join(assetsRoot, '..', credits[0].family)));
assert.equal(fs.existsSync(path.resolve(__dirname, '../assets/kenney/monster')), false);
const youTab = fs.readFileSync(path.resolve(__dirname, '../src/app/(tabs)/you.tsx'), 'utf8');
assert.match(youTab, /KenneyCreditsCard/);
assert.doesNotMatch(youTab, /Fantasy UI|Modular Characters|1-Bit|Animal Remastered|Monster Builder/);
ok('credits list only the registered Shape Characters pack and is wired on You');

assert.equal(ACCOUNT_RECIPES.length, 6);
assert.equal(ACCOUNT_RECIPES[0]?.parts.body, DEFAULT_RECIPE.parts.body);
assert.equal(ACCOUNT_RECIPES[0]?.parts.face, DEFAULT_RECIPE.parts.face);
const pairs = new Set<string>();
for (const recipe of ACCOUNT_RECIPES) {
  assert.equal(recipe.source, 'shape');
  assert.equal(recipe.parts.hand, 'hidden');
  assert.equal(recipe.palette, null);
  const pair = `${recipe.parts.body}/${recipe.parts.face}`;
  assert.equal(pairs.has(pair), false, `duplicate recipe ${pair}`);
  pairs.add(pair);
  assert.ok(resolveCharacter(recipe).layers.length >= 2, `recipe ${pair} should resolve body+face`);
}
const seedA = '00000000-0000-4000-8000-000000000001';
const seedB = '00000001-0000-4000-8000-000000000001';
const seedC = '00000002-0000-4000-8000-000000000001';
assert.equal(accountRecipeIndex(seedA), 0);
assert.equal(accountRecipeIndex(seedB), 1);
assert.equal(accountRecipeIndex(seedC), 2);
assert.deepEqual(recipeFromAccountId(seedA), recipeFromAccountId(seedA));
assert.notEqual(recipeFromAccountId(seedA).parts.body + recipeFromAccountId(seedA).parts.face, recipeFromAccountId(seedB).parts.body + recipeFromAccountId(seedB).parts.face);
assert.notEqual(recipeFromAccountId(seedB).parts.face, recipeFromAccountId(seedC).parts.face);
const legacyDefault = { source: 'shape', base: 'circle', top: 'even', hair: null, palette: null };
assert.deepEqual(recipeForAccount(seedB, legacyDefault), recipeFromAccountId(seedB));
assert.deepEqual(recipeForAccount(seedB, ACCOUNT_RECIPES[3]), ACCOUNT_RECIPES[3]);
ok('six hashed recipes are shape-only, stable per account, and distinct across seeds');

console.log(`\nAll ${passed} Kenney pipeline checks passed.`);
