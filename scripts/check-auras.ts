/**
 * Pet auras (save v32). Run: npm run check:auras
 *
 * Prices, the sword ramp, and the four approved styles generated from alpha.
 * The sprite's opaque pixels are never painted. Halo, Zap and Smoke are absent.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  auraConfigErrors,
  auraFramesFromAlpha,
  auraHueHex,
  auraPaintOrder,
  auraPrice,
  snapAuraHex,
  planAuraWear,
  quietFoilOpacity,
  swordRamp,
  type AuraStyle,
} from '../src/play/auras';
import { applyPetAura, defaultPlayStore, devSetPetAura, parsePlayStore, setPetAuraColor } from '../src/play/playStore';
import { PLAY_EVERYTHING_FREE } from '../src/lib/dev-mode';

const T0 = Date.UTC(2026, 9, 4);
let passed = 0;
const ok = (name: string) => {
  passed += 1;
  console.log('ok', name);
};
const read = (path: string) => readFileSync(path, 'utf8');

assert.deepEqual(auraConfigErrors(), []);
assert.equal(auraPrice('blaze', false), 900);
assert.equal(auraPrice('spiky', false), 450);
assert.equal(auraPrice('rune', false), 300);
assert.equal(auraPrice('bubbles', false), 300);
assert.equal(auraPrice('blaze', true), 675);
assert.equal(auraPrice('spiky', true), 340);
assert.equal(auraPrice('rune', true), 225);
assert.equal(auraPrice('bubbles', true), 225);
assert.ok(quietFoilOpacity() > 0 && quietFoilOpacity() < 0.4);
ok('prices live in config, pass is 3/4, foil quiets');

{
  const fire = swordRamp('fire');
  assert.equal(Math.round(fire.mid[0]), 232);
  assert.equal(Math.round(fire.mid[1]), 93);
  assert.equal(Math.round(fire.mid[2]), 4);
  const bolt = swordRamp('lightning');
  const frost = swordRamp('frost');
  const luma = (c: number[]) => (0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]) / 255;
  assert.ok(luma(bolt.mid) < 0.75);
  assert.ok(luma(frost.mid) < 0.75);
  assert.ok(bolt.core[0] > bolt.mid[0]);
  const mix = swordRamp(auraHueHex(300, 2));
  const sum = (c: number[]) => c[0] + c[1] + c[2];
  assert.ok(sum(mix.core) > sum(mix.mid) && sum(mix.mid) > sum(mix.tip));
  const pale = swordRamp(auraHueHex(60, 2));
  assert.ok(luma(pale.mid) < 0.75);
  const snapped = snapAuraHex('#FF00AA');
  assert.equal(snapAuraHex(snapped), snapped);
  assert.ok(snapped.startsWith('#'));
}
ok('fire mid stays the sword hex; pale elements are deepened');

{
  const free = planAuraWear({ owned: [], worn: [], tokens: 0, pass: false, free: true, style: 'blaze', on: true });
  assert.equal(free.ok && free.cost, 0);
  assert.ok(free.ok && free.worn[0]?.color === 'sword');
  const pass = planAuraWear({ owned: [], worn: [], tokens: 675, pass: true, free: false, style: 'blaze', on: true });
  assert.equal(pass.ok && pass.cost, 675);
  const poor = planAuraWear({ owned: [], worn: [], tokens: 100, pass: false, free: false, style: 'blaze', on: true });
  assert.deepEqual(poor, { ok: false, reason: 'tokens' });
  const again = planAuraWear({ owned: ['rune'], worn: [], tokens: 0, pass: false, free: false, style: 'rune', on: true });
  assert.equal(again.ok && again.cost, 0);
  const stack = planAuraWear({
    owned: ['rune'],
    worn: [{ style: 'rune', color: 'water' }],
    tokens: 0,
    pass: false,
    free: true,
    style: 'spiky',
    on: true,
  });
  assert.ok(stack.ok && stack.worn.map((wear) => wear.style).join() === 'rune,spiky');
  assert.ok(stack.ok && stack.worn[0]?.color === 'water');
  const off = planAuraWear({
    owned: ['rune', 'spiky'],
    worn: stack.ok ? stack.worn : [],
    tokens: 0,
    pass: false,
    free: false,
    style: 'rune',
    on: false,
  });
  assert.ok(off.ok && off.worn.length === 1 && off.worn[0]?.style === 'spiky');
  assert.ok(off.ok && off.owned.includes('rune'));
  const paint = auraPaintOrder([
    { style: 'blaze', color: 'sword' },
    { style: 'rune', color: 'light' },
    { style: 'spiky', color: 'water' },
    { style: 'bubbles', color: 'frost' },
  ]);
  assert.deepEqual(paint.map((wear) => wear.style), ['rune', 'bubbles', 'spiky', 'blaze']);
}
ok('buy per style; colours are free; a stack keeps the others');

function blob(w: number, h: number, x0: number, y0: number, bw: number, bh: number): Uint8Array {
  const alpha = new Uint8Array(w * h);
  for (let y = y0; y < y0 + bh; y++) for (let x = x0; x < x0 + bw; x++) alpha[y * w + x] = 255;
  return alpha;
}

{
  const w = 40;
  const h = 40;
  const alpha = blob(w, h, 14, 11, 11, 20);
  const styles: AuraStyle[] = ['blaze', 'spiky', 'rune', 'bubbles'];
  for (const style of styles) {
    const frames = auraFramesFromAlpha(alpha, w, h, style, 'fire').frames;
    assert.equal(frames.length, style === 'blaze' ? 8 : 6);
    for (const frame of frames) {
      for (const p of frame.pixels) {
        if (p.x >= 14 && p.x < 25 && p.y >= 11 && p.y < 31) assert.fail(`${style} painted the sprite`);
      }
      for (const s of frame.sparks) {
        if (s.x >= 14 && s.x < 25 && s.y >= 11 && s.y < 31) assert.fail('spark on sprite');
      }
    }
    if (style !== 'blaze') assert.equal(frames[0].sparks.length, 0);
  }
  const blaze = auraFramesFromAlpha(alpha, w, h, 'blaze', 'fire').frames[3];
  const ys = blaze.pixels.map((p) => p.y);
  const ratio = (Math.max(...ys) - Math.min(...ys) + 1) / 20;
  assert.ok(ratio > 1.25 && ratio < 1.6, `blaze height ${ratio}`);
  const spiky = auraFramesFromAlpha(alpha, w, h, 'spiky', 'fire').frames[2];
  assert.ok(spiky.pixels.length < 120);
  assert.ok(spiky.pixels.length > 40);
  const rune = auraFramesFromAlpha(alpha, w, h, 'rune', 'light').frames;
  assert.ok(rune[0].pixels.length <= 30);
  assert.ok(rune.some((frame) => frame.pixels.some((p) => p.col[0] === 255 && p.col[1] === 255 && p.col[2] === 255)));
  assert.ok(rune.some((frame) => frame.pixels.length < rune[0].pixels.length));
  const bubbles = auraFramesFromAlpha(alpha, w, h, 'bubbles', 'water').frames[0];
  assert.ok(bubbles.pixels.length > 10 && bubbles.pixels.length < 80);
  const head = bubbles.pixels.filter((p) => p.y < 11);
  const body = bubbles.pixels.filter((p) => p.y >= 11);
  assert.ok(body.length > head.length);
  const tall = blob(160, 160, 40, 30, 40, 80);
  const grown = auraFramesFromAlpha(tall, 160, 160, 'blaze', 'fire');
  const grownYs = grown.frames[3].pixels.map((p) => p.y);
  const grownRatio = (Math.max(...grownYs) - Math.min(...grownYs) + 1) / 80;
  assert.ok(grownRatio < 1.2, `blaze stays a thin hug ${grownRatio}`);
  assert.ok(Math.min(...grownYs) < 30, 'short tongues');
  assert.ok(grown.frames[3].pixels.every((p) => p.x > 28 && p.x < 92), 'flame hugs the sides');
}
ok('frames match the samples: thin blaze, calm spiky, twinkling rune, attached bubbles; sprite untouched');

{
  const fresh = defaultPlayStore(T0);
  const grown = {
    ...fresh,
    tokens: 1000,
    pet: { ...fresh.pet, stage: 'adult' as const, hero: 'elowen', grade: 'rare' as const, uid: fresh.pet.uid || 1 },
  };
  const worn = applyPetAura(grown, T0, grown.pet.uid, 'blaze', true);
  assert.equal(worn.result.ok, true);
  if (worn.result.ok) assert.equal(worn.result.cost, PLAY_EVERYTHING_FREE ? 0 : 900);
  assert.deepEqual(worn.doc.pet.auras, [{ style: 'blaze', color: 'sword' }]);
  const stacked = applyPetAura(worn.doc, T0, grown.pet.uid, 'spiky', true);
  const colored = setPetAuraColor(stacked.doc, T0, grown.pet.uid, 'spiky', 'water');
  assert.equal(colored.result.ok, true);
  assert.equal(colored.doc.tokens, stacked.doc.tokens);
  assert.deepEqual(
    colored.doc.pet.auras.map((wear) => `${wear.style}:${wear.color}`),
    ['blaze:sword', 'spiky:water'],
  );
  const mixed = setPetAuraColor(colored.doc, T0, grown.pet.uid, 'blaze', '#FF00AA');
  assert.equal(mixed.doc.tokens, colored.doc.tokens);
  assert.equal(mixed.doc.pet.auras.find((wear) => wear.style === 'blaze')?.color, snapAuraHex('#FF00AA'));
  const round = parsePlayStore(JSON.stringify(mixed.doc), T0);
  assert.ok(round);
  assert.equal(round.version, 32);
  assert.equal(round.pet.auras.find((wear) => wear.style === 'blaze')?.color, snapAuraHex('#FF00AA'));
  assert.equal(round.pet.auras.length, 2);
  assert.ok(round.aura_owned.includes('blaze'));

  const legacy = JSON.parse(JSON.stringify(fresh)) as Record<string, unknown>;
  legacy.version = 30;
  delete legacy.aura_owned;
  const loaded = parsePlayStore(JSON.stringify(legacy), T0);
  assert.ok(loaded);
  assert.equal(loaded.version, 32);
  assert.deepEqual(loaded.pet.auras, []);
  assert.deepEqual(loaded.aura_owned, []);

  const v31 = JSON.parse(JSON.stringify(grown)) as { version: number; pet: Record<string, unknown> };
  v31.version = 31;
  delete v31.pet.auras;
  v31.pet.aura_style = 'blaze';
  const migrated = parsePlayStore(JSON.stringify(v31), T0);
  assert.deepEqual(migrated?.pet.auras, [{ style: 'blaze', color: 'sword' }]);

  const egg = applyPetAura(fresh, T0, fresh.pet.uid, 'rune', true);
  assert.equal(egg.result.ok, false);
  const dev = devSetPetAura(grown, T0, grown.pet.uid, 'bubbles');
  assert.equal(dev?.pet.auras[0]?.style, 'bubbles');
  const both = dev ? devSetPetAura(dev, T0, grown.pet.uid, 'rune') : null;
  assert.deepEqual(both?.pet.auras.map((wear) => wear.style), ['bubbles', 'rune']);
  assert.equal(both?.tokens, grown.tokens);
  assert.deepEqual(both?.aura_owned, grown.aura_owned);
}
ok('save v32 round-trips; a v31 aura migrates; a v30 save has none; the dev kit does not mint');

{
  const defend = read('src/play/defend-screen.tsx');
  for (const needle of ['aura-view', 'PetAura', 'aura_style', 'applyPetAura']) {
    assert.ok(!defend.includes(needle), needle);
  }
  const figure = read('src/play/pet-figure.tsx');
  assert.ok(figure.includes('PetAura'));
  assert.ok(figure.includes('layer="back"'));
  assert.ok(figure.includes('layer="front"'));
  assert.ok(!figure.includes('FinishSheen'));
  const shop = read('src/play/pet-sheets.tsx');
  assert.ok(shop.includes('applyPetAura'));
  assert.ok(shop.includes('>Aura<'));
  const dev = read('src/play/pet-dev-panel.tsx');
  assert.ok(dev.includes('devSetPetAura'));
  assert.ok(dev.includes('PRE_LAUNCH_DEV'));
}
ok('aura is on the pet, the card shop and the dev kit, and not in Defend');

console.log(`\ncheck:auras — ${passed} groups passed.`);
