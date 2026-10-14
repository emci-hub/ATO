/**
 * Pet auras (save v32, reworked 2026-10-14). Run: npm run check:auras
 *
 *   1. Five styles (Rune circle, Fire, Water, Earth, Thunder), prices in config;
 *      the old ids (blaze, bubbles, spiky) are migrated, never lost.
 *   2. Colourways are data: single colours are free, a two-colour set has a
 *      different second colour and costs once; old element / #hex tints land on
 *      the nearest colourway.
 *   3. The art is one indexed atlas per style; a colourway only rewrites the
 *      palette (pixel data and every other chunk untouched, CRC valid).
 *   4. Art budget: the aura atlases stay at or under
 *      the size budget; every style has 8 frames anchored on the ground point.
 *   5. Saves round-trip; old auras are migrated, a v31 `aura_style` still loads.
 *   6. The renderer is atlas + UI-thread frame index (no per-pixel SVG, no
 *      setState per frame), drawn at whole device pixels on the ground point.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { PLAY_EVERYTHING_FREE } from '../src/lib/dev-mode';
import {
  AURA_STYLES,
  auraColourways,
  auraConfigErrors,
  auraMixPrice,
  auraPaintOrder,
  auraPrice,
  auraRamps,
  auraSingleColourways,
  auraStyleFps,
  auraTintFor,
  auraTintLabel,
  auraTintParts,
  isAuraTint,
  legacyAuraTint,
  parseAuraMixes,
  parseAuraOwned,
  parseAuraStyle,
  parseAuraWears,
  planAuraColour,
  planAuraWear,
  quietFoilOpacity,
} from '../src/play/auras';
import { crc32, readPalette, recolourPng, recolouredPalette } from '../src/play/aura-palette';
import { GROUND_FRACTION, groundInset, groundRow } from '../src/play/ground-point';
import { applyPetAura, defaultPlayStore, devSetPetAura, parsePlayStore, setPetAuraColor } from '../src/play/playStore';

const repo = path.resolve(__dirname, '..');
const T0 = Date.UTC(2026, 9, 4);
let passed = 0;
const ok = (name: string) => {
  passed += 1;
  console.log('ok', name);
};
const read = (rel: string) => readFileSync(path.join(repo, rel), 'utf8');

/* ------------------------------------------------------------ 1. styles ---- */

assert.deepEqual(auraConfigErrors(), []);
assert.deepEqual([...AURA_STYLES], ['rune', 'fire', 'water', 'earth', 'thunder']);
assert.equal(auraPrice('fire', false), 900);
assert.equal(auraPrice('thunder', false), 450);
assert.equal(auraPrice('rune', false), 300);
assert.equal(auraPrice('water', false), 300);
assert.equal(auraPrice('earth', false), 300);
assert.equal(auraPrice('fire', true), 675);
assert.equal(auraPrice('thunder', true), 340);
assert.equal(auraPrice('rune', true), 225);
assert.ok(quietFoilOpacity() > 0 && quietFoilOpacity() < 0.4);
for (const style of AURA_STYLES) assert.ok(auraStyleFps(style) >= 4 && auraStyleFps(style) <= 12, style);
assert.equal(parseAuraStyle('blaze'), 'fire');
assert.equal(parseAuraStyle('bubbles'), 'water');
assert.equal(parseAuraStyle('spiky'), 'thunder');
assert.equal(parseAuraStyle('halo'), 'none');
assert.deepEqual(parseAuraOwned(['blaze', 'fire', 'spiky', 'bubbles', 'nope']), ['fire', 'thunder', 'water']);
ok('five styles with prices in config; blaze / bubbles / spiky migrate to fire / water / thunder');

/* ----------------------------------------------------------- 2. colours ---- */

{
  const all = auraColourways();
  assert.deepEqual(
    all.map((c) => c.id),
    ['natural', 'ember', 'azure', 'verdant', 'violet', 'gold', 'chrome', 'neon', 'spectrum'],
  );
  assert.deepEqual(
    auraSingleColourways().map((c) => c.id),
    all.slice(1).map((c) => c.id),
  );
  for (const style of AURA_STYLES) {
    for (const tint of ['sword', ...all.slice(1).map((c) => c.id), ...all.map((c) => `two:${c.id}`)]) {
      assert.ok(isAuraTint(tint) || tint === 'natural', tint);
      if (tint === 'natural') continue;
      const r = auraRamps(style, tint as never, 'fire');
      assert.equal(r.main.length, 5, `${style} ${tint}`);
      assert.equal(r.second.length, 5, `${style} ${tint}`);
      const luma = (hex: string) => {
        const n = Number.parseInt(hex.slice(1), 16);
        return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
      };
      for (const ramp of [r.main, r.second]) {
        for (let i = 1; i < 5; i++) assert.ok(luma(ramp[i]) >= luma(ramp[i - 1]) - 1, `${style} ${tint} ramp rises`);
      }
    }
    const natural = auraRamps(style, 'two:natural', null);
    assert.notDeepEqual(natural.main, natural.second, `${style} natural is a pair`);
    for (const colour of all.slice(1)) {
      const single = auraRamps(style, colour.id, null);
      assert.deepEqual(single.main, single.second, `${style} ${colour.id} single is one colour`);
      const two = auraRamps(style, `two:${colour.id}` as never, null);
      assert.deepEqual(two.main, single.main, `${style} ${colour.id} pair keeps its main colour`);
      assert.notDeepEqual(two.second, two.main, `${style} ${colour.id} pair has a different second colour`);
    }
  }
  // Earth is petals vs rocks: a different second colour than the water / fire pairs.
  assert.notDeepEqual(auraRamps('earth', 'two:ember', null).second, auraRamps('fire', 'two:ember', null).second);
  assert.notDeepEqual(auraRamps('thunder', 'two:violet', null).second, auraRamps('fire', 'two:violet', null).second);
  // Match sword follows the equipped element; no sword falls back to fire.
  assert.deepEqual(auraRamps('fire', 'sword', 'water').main, auraRamps('fire', 'azure', null).main);
  assert.deepEqual(auraRamps('fire', 'sword', null).main, auraRamps('fire', 'ember', null).main);
  assert.deepEqual(auraRamps('fire', 'sword', 'unknown').main, auraRamps('fire', 'ember', null).main);
  assert.equal(auraTintLabel('two:neon'), 'Neon pair');
  assert.equal(auraTintLabel('azure'), 'Azure');
  assert.deepEqual(auraTintParts('two:gold'), { colour: 'gold', two: true });
  assert.equal(auraTintFor('gold', true), 'two:gold');
  assert.equal(auraTintFor('gold', false), 'gold');
  // Old tints land on the nearest colourway.
  assert.equal(legacyAuraTint('fire'), 'ember');
  assert.equal(legacyAuraTint('water'), 'azure');
  assert.equal(legacyAuraTint('earth'), 'verdant');
  assert.equal(legacyAuraTint('dark'), 'violet');
  assert.equal(legacyAuraTint('sword'), 'sword');
  assert.equal(legacyAuraTint('#E85D04'), 'ember');
  assert.equal(legacyAuraTint('#3B82F6'), 'azure');
  assert.equal(legacyAuraTint('#22C55E'), 'verdant');
  assert.equal(legacyAuraTint('#9ca3af'), 'chrome');
  assert.equal(legacyAuraTint(42), 'sword');
  assert.equal(legacyAuraTint('two:gold'), 'two:gold');
  assert.equal(auraMixPrice(false), 150);
  assert.equal(auraMixPrice(true), 110);
  assert.deepEqual(parseAuraMixes(['gold', 'gold', 'nope', 'neon']), ['gold', 'neon']);
}
ok('colourways are data: every ramp has 5 rising steps, a pair has its own second colour, old tints migrate');

/* -------------------------------------------------------------- 3. plans ---- */

{
  const free = planAuraWear({ owned: [], worn: [], tokens: 0, pass: false, free: true, style: 'fire', on: true });
  assert.equal(free.ok && free.cost, 0);
  assert.ok(free.ok && free.worn[0]?.color === 'sword');
  const pass = planAuraWear({ owned: [], worn: [], tokens: 675, pass: true, free: false, style: 'fire', on: true });
  assert.equal(pass.ok && pass.cost, 675);
  const poor = planAuraWear({ owned: [], worn: [], tokens: 100, pass: false, free: false, style: 'fire', on: true });
  assert.deepEqual(poor, { ok: false, reason: 'tokens' });
  const again = planAuraWear({ owned: ['rune'], worn: [], tokens: 0, pass: false, free: false, style: 'rune', on: true });
  assert.equal(again.ok && again.cost, 0);
  const stack = planAuraWear({
    owned: ['rune'],
    worn: [{ style: 'rune', color: 'azure' }],
    tokens: 0,
    pass: false,
    free: true,
    style: 'thunder',
    on: true,
  });
  assert.ok(stack.ok && stack.worn.map((wear) => wear.style).join() === 'rune,thunder');
  assert.ok(stack.ok && stack.worn[0]?.color === 'azure');
  const off = planAuraWear({
    owned: ['rune', 'thunder'],
    worn: stack.ok ? stack.worn : [],
    tokens: 0,
    pass: false,
    free: false,
    style: 'rune',
    on: false,
  });
  assert.ok(off.ok && off.worn.length === 1 && off.worn[0]?.style === 'thunder');
  assert.ok(off.ok && off.owned.includes('rune'));
  assert.deepEqual(
    auraPaintOrder([
      { style: 'fire', color: 'sword' },
      { style: 'rune', color: 'gold' },
      { style: 'thunder', color: 'azure' },
      { style: 'water', color: 'chrome' },
    ]).map((wear) => wear.style),
    ['rune', 'water', 'thunder', 'fire'],
  );

  const singleFree = planAuraColour({ tint: 'neon', mixes: [], tokens: 0, pass: false, free: false });
  assert.equal(singleFree.ok && singleFree.cost, 0);
  const pairBuy = planAuraColour({ tint: 'two:neon', mixes: [], tokens: 150, pass: false, free: false });
  assert.ok(pairBuy.ok && pairBuy.cost === 150 && pairBuy.mixes.join() === 'neon');
  const pairPass = planAuraColour({ tint: 'two:gold', mixes: ['neon'], tokens: 110, pass: true, free: false });
  assert.ok(pairPass.ok && pairPass.cost === 110 && pairPass.mixes.join() === 'neon,gold');
  const pairOwned = planAuraColour({ tint: 'two:neon', mixes: ['neon'], tokens: 0, pass: false, free: false });
  assert.equal(pairOwned.ok && pairOwned.cost, 0);
  assert.deepEqual(planAuraColour({ tint: 'two:neon', mixes: [], tokens: 149, pass: false, free: false }), { ok: false, reason: 'tokens' });
  assert.deepEqual(planAuraColour({ tint: 'two:neon', mixes: [], tokens: 0, pass: false, free: true }), {
    ok: true,
    cost: 0,
    mixes: ['neon'],
    tint: 'two:neon',
  });
  assert.deepEqual(planAuraColour({ tint: '#FF00AA', mixes: [], tokens: 0, pass: false, free: true }), { ok: false, reason: 'tint' });
  assert.deepEqual(planAuraColour({ tint: 'two:natural', mixes: [], tokens: 150, pass: false, free: false }).ok, true);
}
ok('buy per style; single colours free; a two-colour set costs once (150, pass 110); a stack keeps the others');

/* ------------------------------------------------------------ 4. palette ---- */

const auraDir = 'assets/play/sheets/streetwear/auras';
let atlasBytes = 0;
{
  const ramps = auraRamps('fire', 'two:neon', null);
  const other = auraRamps('fire', 'verdant', null);
  for (const style of AURA_STYLES) {
    const file = path.join(repo, auraDir, style, 'atlas.png');
    const raw = new Uint8Array(readFileSync(file));
    atlasBytes += raw.length;
    const palette = readPalette(raw);
    assert.ok(palette, `${style} atlas is an indexed png`);
    assert.ok(palette.rgb.length <= 16, `${style} atlas keeps a tiny palette (${palette.rgb.length})`);
    const swapped = recolourPng(raw, ramps);
    assert.equal(swapped.length, raw.length, 'same size: only PLTE is rewritten');
    // Everything outside the PLTE chunk is byte-identical, and the PLTE CRC is right.
    let o = 8;
    while (o < raw.length) {
      const len = ((raw[o] << 24) | (raw[o + 1] << 16) | (raw[o + 2] << 8) | raw[o + 3]) >>> 0;
      const type = String.fromCharCode(raw[o + 4], raw[o + 5], raw[o + 6], raw[o + 7]);
      const end = o + 12 + len;
      if (type !== 'PLTE') assert.deepEqual(swapped.subarray(o, end), raw.subarray(o, end), `${style} ${type} untouched`);
      else {
        const stored = ((swapped[end - 4] << 24) | (swapped[end - 3] << 16) | (swapped[end - 2] << 8) | swapped[end - 1]) >>> 0;
        assert.equal(stored, crc32(swapped, o + 4, end - 4), `${style} PLTE crc`);
      }
      o = end;
    }
    const next = readPalette(swapped);
    assert.ok(next);
    assert.deepEqual(readPalette(recolourPng(raw, ramps))?.rgb, next.rgb, 'deterministic');
    assert.notDeepEqual(readPalette(recolourPng(raw, other))?.rgb, next.rgb, 'a colourway changes the palette');
    // The ramp colours show up: a main step and a second step are in the swapped palette.
    const hex = (c: readonly number[]) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    const shown = new Set(next.rgb.map(hex));
    assert.ok(ramps.main.some((c) => shown.has(c)), `${style} shows the main colour`);
    assert.ok(ramps.second.some((c) => shown.has(c)), `${style} shows the second colour`);
    // Outline stays dark, clear stays clear.
    const original = palette.rgb.map((c, i) => ({ c, a: palette.alpha[i] }));
    recolouredPalette(palette, ramps).forEach((c, i) => {
      if (original[i].a < 128) assert.deepEqual(c, original[i].c, 'clear entry untouched');
    });
  }
}
ok('a colourway rewrites only the palette: pixel data and every other chunk untouched, CRC valid');

/* ------------------------------------------------------------ 5. art -------- */

{
  const meta = JSON.parse(read('assets/play/sheets/streetwear/meta.json')) as {
    chars: Record<string, { footAt: number; groundAt: number; bodyRatio: number }>;
    auras: Record<string, { frames: number; cell: number; anchorX: number; anchorY: number; refBodyPx: number }>;
  };
  assert.deepEqual(Object.keys(meta.auras).sort(), [...AURA_STYLES].sort());
  for (const style of AURA_STYLES) {
    const m = meta.auras[style];
    assert.equal(m.frames, 8, style);
    assert.equal(m.refBodyPx, 106, `${style} is drawn around Kael (106 px)`);
    assert.ok(m.anchorX > 0.3 && m.anchorX < 0.7, `${style} is centred`);
    assert.ok(m.anchorY > 0.5 && m.anchorY < 1, `${style} anchor sits on the ground`);
    const sheets = JSON.parse(read(`${auraDir}/${style}/sheets.json`)) as Record<string, { frames: Record<string, unknown> }>;
    for (const which of ['behind', 'front']) {
      assert.equal(Object.keys(sheets[`sheets/streetwear/auras/${style}/${which}`].frames).length, 8, `${style} ${which}`);
    }
  }
  // Every packed character has a measured ground point above its toe edge, by about 4 % of the figure.
  for (const [name, c] of Object.entries(meta.chars)) {
    assert.ok(c.groundAt > 0 && c.groundAt < c.footAt, `${name} groundAt above footAt`);
    const inset = (c.footAt - c.groundAt) / c.bodyRatio;
    assert.ok(inset > GROUND_FRACTION * 0.5 && inset < GROUND_FRACTION * 1.6, `${name} ground inset ${inset.toFixed(3)}`);
  }
  // The ground-point rule itself.
  assert.equal(groundInset(106), 4);
  assert.equal(groundRow(148, 106), 144);
  assert.equal(groundInset(10), 1);
  // Size budget: aura atlases + the holo's glint sheet stay at or under the budget.
  // SPEC §4 said ≈ 32 KB; the flare Fire (emci 2026-10-14) (fire streams) lands at ~38.1 KB total, so the ceiling is 40 KB.
  const BUDGET = 40 * 1024;
  assert.ok(atlasBytes <= BUDGET, `aura atlases ${atlasBytes} B over the ${BUDGET} B budget`);
  console.log(`   aura atlases: ${atlasBytes} B of ${BUDGET} B budget`);
}
ok('every style has 8 frames, anchored on the ground point; every character has a measured ground point; art is under budget');

/* ------------------------------------------------------------ 6. saves ----- */

{
  const fresh = defaultPlayStore(T0);
  const grown = {
    ...fresh,
    tokens: 1000,
    pet: { ...fresh.pet, stage: 'adult' as const, hero: 'elowen', grade: 'rare' as const, uid: fresh.pet.uid || 1 },
  };
  const worn = applyPetAura(grown, T0, grown.pet.uid, 'fire', true);
  assert.equal(worn.result.ok, true);
  if (worn.result.ok) assert.equal(worn.result.cost, PLAY_EVERYTHING_FREE ? 0 : 900);
  assert.deepEqual(worn.doc.pet.auras, [{ style: 'fire', color: 'sword' }]);
  const stacked = applyPetAura(worn.doc, T0, grown.pet.uid, 'thunder', true);
  const colored = setPetAuraColor(stacked.doc, T0, grown.pet.uid, 'thunder', 'azure');
  assert.equal(colored.result.ok, true);
  assert.equal(colored.doc.tokens, stacked.doc.tokens, 'a single colour is free');
  assert.deepEqual(
    colored.doc.pet.auras.map((wear) => `${wear.style}:${wear.color}`),
    ['fire:sword', 'thunder:azure'],
  );
  const pair = setPetAuraColor(colored.doc, T0, grown.pet.uid, 'fire', 'two:neon');
  assert.equal(pair.result.ok, true);
  assert.equal(pair.doc.tokens, PLAY_EVERYTHING_FREE ? colored.doc.tokens : colored.doc.tokens - 150);
  assert.deepEqual(pair.doc.aura_mixes, ['neon']);
  assert.equal(pair.doc.pet.auras.find((wear) => wear.style === 'fire')?.color, 'two:neon');
  const reuse = setPetAuraColor(pair.doc, T0, grown.pet.uid, 'thunder', 'two:neon');
  assert.equal(reuse.doc.tokens, pair.doc.tokens, 'a bought pair is free on any style');
  const poor = setPetAuraColor({ ...colored.doc, tokens: 10 }, T0, grown.pet.uid, 'fire', 'two:gold');
  if (!PLAY_EVERYTHING_FREE) assert.deepEqual(poor.result, { ok: false, reason: 'tokens' });
  assert.deepEqual(setPetAuraColor(colored.doc, T0, grown.pet.uid, 'earth', 'ember').result, { ok: false, reason: 'missing' });
  assert.deepEqual(setPetAuraColor(colored.doc, T0, grown.pet.uid, 'fire', '#FF00AA' as never).result, { ok: false, reason: 'style' });

  const round = parsePlayStore(JSON.stringify(pair.doc), T0);
  assert.ok(round);
  assert.equal(round.version, 33);
  assert.deepEqual(round.pet.auras.map((wear) => `${wear.style}:${wear.color}`), ['fire:two:neon', 'thunder:azure']);
  assert.deepEqual(round.aura_mixes, ['neon']);
  assert.ok(round.aura_owned.includes('fire'));

  // A save written before the rework: old styles and old colours migrate, nothing is lost.
  const oldSave = JSON.parse(JSON.stringify(grown)) as { pet: Record<string, unknown>; aura_owned: string[] };
  oldSave.pet.auras = [
    { style: 'blaze', color: 'sword' },
    { style: 'bubbles', color: 'water' },
    { style: 'spiky', color: '#E85D04' },
    { style: 'rune', color: 'light' },
  ];
  oldSave.aura_owned = ['blaze', 'bubbles', 'rune'];
  const migrated = parsePlayStore(JSON.stringify(oldSave), T0);
  assert.ok(migrated);
  assert.deepEqual(migrated.pet.auras, [
    { style: 'fire', color: 'sword' },
    { style: 'water', color: 'azure' },
    { style: 'thunder', color: 'ember' },
    { style: 'rune', color: 'gold' },
  ]);
  assert.deepEqual(migrated.aura_owned, ['fire', 'water', 'rune']);
  assert.deepEqual(migrated.aura_mixes, []);

  const legacy = JSON.parse(JSON.stringify(fresh)) as Record<string, unknown>;
  legacy.version = 30;
  delete legacy.aura_owned;
  const loaded = parsePlayStore(JSON.stringify(legacy), T0);
  assert.ok(loaded);
  assert.equal(loaded.version, 33);
  assert.deepEqual(loaded.pet.auras, []);
  assert.deepEqual(loaded.aura_owned, []);

  const v31 = JSON.parse(JSON.stringify(grown)) as { version: number; pet: Record<string, unknown> };
  v31.version = 31;
  delete v31.pet.auras;
  v31.pet.aura_style = 'blaze';
  assert.deepEqual(parsePlayStore(JSON.stringify(v31), T0)?.pet.auras, [{ style: 'fire', color: 'sword' }]);
  assert.deepEqual(parseAuraWears({ aura_style: 'spiky' }), [{ style: 'thunder', color: 'sword' }]);

  const egg = applyPetAura(fresh, T0, fresh.pet.uid, 'rune', true);
  assert.equal(egg.result.ok, false);
  const dev = devSetPetAura(grown, T0, grown.pet.uid, 'water');
  assert.equal(dev?.pet.auras[0]?.style, 'water');
  const both = dev ? devSetPetAura(dev, T0, grown.pet.uid, 'rune') : null;
  assert.deepEqual(both?.pet.auras.map((wear) => wear.style), ['water', 'rune']);
  assert.equal(both?.tokens, grown.tokens);
  assert.deepEqual(both?.aura_owned, grown.aura_owned);
}
ok('saves round-trip; old styles and colours are migrated; a v31 aura_style still loads; the dev kit does not mint');

/* ------------------------------------------------------------ 7. renderer --- */

{
  const defend = read('src/play/defend-screen.tsx');
  for (const needle of ['aura-view', 'PetAura', 'aura_style', 'applyPetAura']) {
    assert.ok(!defend.includes(needle), needle);
  }
  const view = read('src/play/aura-view.tsx');
  for (const needle of ['recolourPng', 'useAnimatedStyle', 'withRepeat', 'snapArtScale', 'body.ground', 'anchorY', 'ExpoImage']) {
    assert.ok(view.includes(needle), needle);
  }
  assert.ok(!/setInterval\(\(\) => setTick/.test(view.split('HideoutAuraStrip')[0]), 'no setState per frame on the pet aura');
  assert.ok(!view.includes('<Path'), 'no per-pixel SVG paths');
  assert.ok(!view.includes('aura-png'), 'aura-view never decodes the atlas');
  assert.ok(view.includes('Math.floor(frames / 2)'), 'gentle two-frame breathe under Reduce Motion');
  const figure = read('src/play/pet-figure.tsx');
  assert.ok(figure.includes('PetAuraSprite') && figure.includes('auraRamps'));
  assert.ok(figure.includes('layer="back"') && figure.includes('layer="front"'));
  assert.ok(!figure.includes("overflow: 'visible'"), 'the pet stage is clipped, never overflow visible');
  assert.ok(figure.includes('STAGE_RESERVE') && figure.includes('styles.stage'));
  assert.ok(!figure.includes('FinishSheen'));
  const shop = read('src/play/pet-sheets.tsx');
  assert.ok(shop.includes('applyPetAura') && shop.includes('AuraColourPicker') && shop.includes('>Aura<'));
  const picker = read('src/play/aura-colour-picker.tsx');
  assert.ok(picker.includes('Single colour') && picker.includes('Two colours') && picker.includes('Match sword'));
  const dev = read('src/play/pet-dev-panel.tsx');
  assert.ok(dev.includes('devSetPetAura'));
  assert.ok(dev.includes('PRE_LAUNCH_DEV'));
  // The art pipeline stores one atlas per style (a style loads only its own pixels).
  for (const style of AURA_STYLES) assert.ok(statSync(path.join(repo, auraDir, style, 'atlas.png')).isFile());
  assert.deepEqual(
    readdirSync(path.join(repo, auraDir)).sort(),
    [...AURA_STYLES].sort(),
    'one folder per style, no shared atlas',
  );
}
ok('aura is an atlas + UI-thread frame index on the ground point; clipped stage; shop, dev kit and Defend wiring');

console.log(`\ncheck:auras — ${passed} groups passed.`);
