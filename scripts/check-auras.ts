/**
 * Pet auras (save v31). Run: npm run check:auras
 *
 * Prices, the sword ramp, and the four approved styles generated from alpha.
 * The sprite's opaque pixels are never painted. Halo, Zap and Smoke are absent.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  auraConfigErrors,
  auraFramesFromAlpha,
  auraPrice,
  planAuraWear,
  quietFoilOpacity,
  swordRamp,
  type AuraStyle,
} from '../src/play/auras';
import { applyPetAura, defaultPlayStore, devSetPetAura, parsePlayStore } from '../src/play/playStore';
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
}
ok('fire mid stays the sword hex; pale elements are deepened');

{
  const free = planAuraWear({ owned: [], tokens: 0, pass: false, free: true, style: 'blaze' });
  assert.equal(free.ok && free.cost, 0);
  const pass = planAuraWear({ owned: [], tokens: 675, pass: true, free: false, style: 'blaze' });
  assert.equal(pass.ok && pass.cost, 675);
  const poor = planAuraWear({ owned: [], tokens: 100, pass: false, free: false, style: 'blaze' });
  assert.deepEqual(poor, { ok: false, reason: 'tokens' });
  const again = planAuraWear({ owned: ['rune'], tokens: 0, pass: false, free: false, style: 'rune' });
  assert.equal(again.ok && again.cost, 0);
  const off = planAuraWear({ owned: ['rune'], tokens: 0, pass: false, free: false, style: 'none' });
  assert.equal(off.ok && off.style, 'none');
}
ok('buy per style; free unlocks; a second wear is free');

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
  const worn = applyPetAura(grown, T0, grown.pet.uid, 'blaze');
  assert.equal(worn.result.ok, true);
  if (worn.result.ok) assert.equal(worn.result.cost, PLAY_EVERYTHING_FREE ? 0 : 900);
  assert.equal(worn.doc.pet.aura_style, 'blaze');
  assert.equal(worn.doc.pet.shiny, false);
  const round = parsePlayStore(JSON.stringify(worn.doc), T0);
  assert.ok(round);
  assert.equal(round.version, 31);
  assert.equal(round.pet.aura_style, 'blaze');
  assert.ok(round.aura_owned.includes('blaze'));

  const legacy = JSON.parse(JSON.stringify(fresh)) as Record<string, unknown>;
  legacy.version = 30;
  delete legacy.aura_owned;
  const loaded = parsePlayStore(JSON.stringify(legacy), T0);
  assert.ok(loaded);
  assert.equal(loaded.version, 31);
  assert.equal(loaded.pet.aura_style, 'none');
  assert.deepEqual(loaded.aura_owned, []);

  const egg = applyPetAura(fresh, T0, fresh.pet.uid, 'rune');
  assert.equal(egg.result.ok, false);
  const dev = devSetPetAura(grown, T0, grown.pet.uid, 'bubbles');
  assert.equal(dev?.pet.aura_style, 'bubbles');
  assert.equal(dev?.tokens, grown.tokens);
  assert.deepEqual(dev?.aura_owned, grown.aura_owned);
}
ok('save v31 round-trips; a v30 save has no aura; an egg refuses; the dev kit does not mint');

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
