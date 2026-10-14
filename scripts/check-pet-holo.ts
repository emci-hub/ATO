/**
 * Holo on the pet (aura/holo rework, SPEC §5). Run: npm run check:pet-holo
 *
 * Pins the pure model (pet-holo-model.ts) and its textures in plain Node:
 *   1. Band sequences never jump from the last colour to the first; a ramp's
 *      pattern repeats exactly at its period; every colour set has the right
 *      length and valid hex.
 *   2. The sweep eases 0 → 1, rests between passes, and never goes still.
 *   3. Glint frames match the spec (dot · plus 1 · plus 2 · plus 3 + diagonals
 *      peak held · plus 2 · plus 1 · dot); a spot fires when the line passes
 *      it between two ticks; Reduce Motion fades only.
 *   4. The glint spot picker is deterministic, 4 on the pet + 4 in the halo
 *      (≤ 5 px out), at least 12 px apart.
 *   5. The foil rim is 1 px outside the silhouette: lit on the right / below
 *      side, shadow on the left / above side, never inside.
 *   6. Reduce Motion never yields a still loop.
 *   7. The textures are real PNGs (round-trip through the decoder), pixel-exact
 *      and tiny; the sprite stays pixel-true (no blur, no soft gradients).
 *   8. Ground point and clip wiring: PetHolo is its own layer, floor effects use
 *      the ground point, the pet stage and the room are clipped.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { decodePng } from '../src/play/aura-png';
import { finishColors, finishConfig, finishGlints, finishSweeps } from '../src/play/finishes';
import {
  GLINT_CELL,
  GLINT_FULL,
  GLINT_GENTLE,
  HALO,
  PING,
  PRISM_BAND,
  RIM_BAND,
  SPOT_APART,
  SPOT_HALO,
  SPOT_ON,
  bandIndex,
  bandPeriod,
  easeInOut,
  glintFireTick,
  glintFrameAt,
  glintLife,
  glintShapes,
  hexRgb,
  holoTiming,
  irisColours,
  matchColours,
  matchGlint,
  pickGlintSpots,
  prismShift,
  prismStrength,
  rampAt,
  rimPixels,
  seqFor,
  sweepPeriod,
  sweepPos,
  sweepSpan,
  sweepStep,
  TICKS_PER_SECOND,
  type Rgb,
} from '../src/play/pet-holo-model';
import { bandTexture, glintSheet, sweepTexture } from '../src/play/pet-holo-textures';

const repo = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(repo, rel), 'utf8');
let passed = 0;
const ok = (msg: string) => {
  passed += 1;
  console.log(`  ✓ ${msg}`);
};
const HEX = /^#[0-9a-fA-F]{6}$/;

/* ------------------------------------------------------------ 1. bands ----- */

{
  // Four colours ping-pong; mixes play each colour twice in order, then back.
  assert.deepEqual(seqFor(4), [0, 1, 2, 3, 3, 2, 1, 0]);
  assert.deepEqual([...PING], seqFor(4));
  assert.deepEqual(seqFor(3), [0, 0, 1, 1, 2, 2, 1, 1]);
  for (const color of finishColors()) {
    const ramp = color.stops.map(hexRgb);
    const seq = seqFor(ramp.length);
    // Never a jump from the last step to the first (wrapping included).
    for (let i = 0; i < seq.length; i++) {
      const a = seq[i];
      const b = seq[(i + 1) % seq.length];
      if (color.group === 'Single colour') assert.ok(Math.abs(a - b) <= 1, `${color.id} step ${i}`);
      else assert.ok(Math.abs(a - b) <= 1 || (a === ramp.length - 1 && b === ramp.length - 1), `${color.id} step ${i}`);
    }
    assert.equal(seq[0], 0);
    assert.equal(seq[seq.length - 1] <= 1, true, `${color.id} ends next to its start`);
    assert.equal(seq.length === 8 || color.group === 'Mix', true);
    // The pattern repeats exactly at its period, along x + y.
    for (const width of [PRISM_BAND, RIM_BAND]) {
      const period = bandPeriod(ramp, width);
      assert.equal(period, seq.length * width);
      for (let n = -3; n < 40; n++) {
        assert.deepEqual(rampAt(ramp, bandIndex(n, 0, 0, width)), rampAt(ramp, bandIndex(n + period, 0, 0, width)));
        assert.deepEqual(rampAt(ramp, bandIndex(n, 7, 0, width)), rampAt(ramp, bandIndex(n + 7 - 1, 1, 0, width)), 'constant x + y');
      }
    }
    assert.ok(color.stops.every((hex) => HEX.test(hex)), color.id);
    assert.equal(color.group === 'Single colour' ? color.stops.length : color.stops.length >= 3, color.group === 'Single colour' ? 4 : true);
  }
  for (const sweep of finishSweeps()) {
    for (const hex of [sweep.core, sweep.mid, sweep.outer]) if (hex) assert.ok(HEX.test(hex), sweep.id);
  }
  for (const glint of finishGlints()) {
    for (const hex of [glint.core, glint.arm, glint.tip]) if (hex) assert.ok(HEX.test(hex), glint.id);
  }
  // Bands run down-right: the colour at a pixel depends on x + y, so moving one pixel right and one down is the same band.
  assert.equal(bandIndex(10, 5, 0, 3), bandIndex(11, 4, 0, 3));
  assert.equal(bandIndex(10, 5, 3, 3), bandIndex(10, 5, 0, 3) + 1);
}
ok('band sequences never jump last → first; patterns repeat at their period; every colour set is valid hex');

/* ------------------------------------------------------------ 2. sweep ----- */

{
  for (const gentle of [false, true]) {
    const t = holoTiming(gentle);
    const period = sweepPeriod(gentle);
    assert.equal(period, t.travel + t.rest);
    // Eases from the left edge to past the right and rests.
    assert.equal(easeInOut(0), 0);
    assert.equal(easeInOut(1), 1);
    assert.ok(easeInOut(0.25) < 0.25 && easeInOut(0.75) > 0.75, 'ease-in-out');
    const w = 128;
    const h = 128;
    assert.equal(sweepPos(0, gentle, w, h), -8, 'starts just off the left edge');
    const last = sweepPos(t.travel - 1, gentle, w, h) ?? 0;
    assert.ok(last > sweepSpan(w, h) - 12, 'finishes past the far corner');
    let prev = -Infinity;
    for (let p = 0; p < t.travel; p++) {
      const pos = sweepPos(p, gentle, w, h)!;
      assert.ok(pos >= prev, 'monotonic');
      prev = pos;
    }
    for (let p = t.travel; p < period; p++) assert.equal(sweepPos(p, gentle, w, h), null, 'rests between passes');
    assert.notEqual(sweepPos(period, gentle, w, h), null, 'loops');
    assert.equal(sweepPos(period, gentle, w, h), sweepPos(0, gentle, w, h));
  }
  assert.equal(holoTiming(false).travel / TICKS_PER_SECOND, 1, 'full pass = 1 s');
  assert.equal(holoTiming(false).rest / TICKS_PER_SECOND, 2, 'full rest = 2 s');
  assert.equal(holoTiming(true).travel / TICKS_PER_SECOND, 2, 'gentle pass = 2 s');
  assert.equal(holoTiming(true).rest / TICKS_PER_SECOND, 6, 'gentle rest = 6 s');
  assert.equal(sweepStep(0), 'core');
  assert.equal(sweepStep(-1), 'mid');
  assert.equal(sweepStep(2), 'outer');
  assert.equal(sweepStep(3), null);
}
ok('the sweep eases 0 → 1, rests 2 s (6 s gentle) and loops');

/* ----------------------------------------------------------- 3. glints ----- */

{
  assert.equal(GLINT_FULL.length, 8);
  assert.deepEqual(GLINT_FULL[0], [[0, 0, 1]], 'f1 dot(arm)');
  assert.equal(GLINT_FULL[1].length, 5, 'f2 plus r1');
  assert.equal(GLINT_FULL[2].length, 9, 'f3 plus r2');
  assert.equal(GLINT_FULL[3].length, 17, 'f4 plus r3 + diagonals r1');
  assert.deepEqual(GLINT_FULL[3], GLINT_FULL[4], 'f5 held peak');
  assert.equal(GLINT_FULL[5].length, 9, 'f6 plus r2');
  assert.equal(GLINT_FULL[6].length, 5, 'f7 plus r1');
  assert.deepEqual(GLINT_FULL[7], [[0, 0, 2]], 'f8 dot(tip)');
  // Outer pixel of an arm longer than 1 is the tip role; the centre is the core.
  const peak = GLINT_FULL[3];
  assert.ok(peak.some(([dx, dy, role]) => dx === 3 && dy === 0 && role === 2));
  assert.ok(peak.some(([dx, dy, role]) => dx === 2 && dy === 0 && role === 1));
  assert.ok(peak.some(([dx, dy, role]) => dx === 1 && dy === 1 && role === 2), 'diagonal r1 is a tip');
  assert.ok(peak.some(([dx, dy, role]) => dx === 0 && dy === 0 && role === 0), 'centre is the core');
  assert.ok(peak.every(([dx, dy]) => Math.abs(dx) <= 3 && Math.abs(dy) <= 3), 'fits the 9 × 9 cell');
  assert.equal(GLINT_CELL, 9);
  // Reduce Motion: a fade only, never bigger than a plus of 1.
  assert.equal(GLINT_GENTLE.length, 6);
  assert.ok(GLINT_GENTLE.every((shape) => shape.length <= 5), 'no pop in the gentle loop');
  assert.deepEqual(glintShapes(true), GLINT_GENTLE);
  assert.deepEqual(glintShapes(false), GLINT_FULL);
  // Frame timing: 2 ticks per frame (12 fps) full, 3 ticks gentle.
  assert.equal(glintFrameAt(-1, false), -1);
  assert.equal(glintFrameAt(0, false), 0);
  assert.equal(glintFrameAt(1, false), 0);
  assert.equal(glintFrameAt(2, false), 1);
  assert.equal(glintFrameAt(15, false), 7);
  assert.equal(glintFrameAt(16, false), -1);
  assert.equal(glintLife(false), 16);
  assert.equal(glintFrameAt(17, true), 5);
  assert.equal(glintFrameAt(18, true), -1);
  // A spot fires when the line passes it between two ticks — not only when it lands on it.
  const w = 128;
  const h = 128;
  for (const gentle of [false, true]) {
    const spots = [
      { x: 20, y: 30 },
      { x: 64, y: 64 },
      { x: 100, y: 110 },
      { x: 3, y: 3 },
    ];
    let prevFire = -1;
    for (const spot of spots) {
      const fire = glintFireTick(spot, gentle, w, h);
      assert.notEqual(fire, null, `spot ${spot.x},${spot.y} is reached`);
      assert.ok(fire! >= 1 && fire! < holoTiming(gentle).travel);
      const v = spot.x + spot.y * 0.7;
      assert.ok(v > sweepPos(fire! - 1, gentle, w, h)! && v <= sweepPos(fire!, gentle, w, h)!, 'crossed between two ticks');
      assert.ok(fire! + glintLife(gentle) < sweepPeriod(gentle), 'a glint ends before the next pass');
      prevFire = Math.max(prevFire, fire!);
    }
    assert.ok(prevFire > 0);
  }
  // Colours: match uses the prism's lightest + 3rd-from-last.
  const prism: Rgb[] = [[10, 10, 10], [20, 20, 20], [30, 30, 30], [40, 40, 40]];
  assert.deepEqual(matchGlint(prism), [[255, 255, 255], [40, 40, 40], [20, 20, 20]]);
  assert.deepEqual(matchColours(prism), { core: [255, 255, 255], mid: [40, 40, 40], outer: [20, 20, 20] });
  const iris = irisColours(finishColors().find((c) => c.id === 'spectrum')!.stops.map(hexRgb), 12, 4);
  assert.ok(iris.core[0] >= 178 && iris.core[1] >= 178, '70 % toward white');
}
ok('glint frames match the spec; a spot fires between two ticks; Reduce Motion fades without popping');

/* ------------------------------------------------------------ 4. spots ----- */

function figure(w: number, h: number): { alpha: Uint8Array; luma: Uint8Array } {
  const alpha = new Uint8Array(w * h);
  const luma = new Uint8Array(w * h);
  for (let y = 40; y < 110; y++) {
    for (let x = 44; x < 84; x++) {
      alpha[y * w + x] = 255;
      luma[y * w + x] = 60 + ((x * 7 + y * 3) % 190);
    }
  }
  return { alpha, luma };
}

{
  const w = 128;
  const h = 128;
  const { alpha, luma } = figure(w, h);
  const spots = pickGlintSpots(alpha, luma, w, h);
  assert.deepEqual(spots, pickGlintSpots(alpha, luma, w, h), 'deterministic');
  assert.equal(spots.length, SPOT_ON + SPOT_HALO);
  assert.equal(spots.filter((s) => s.kind === 'on').length, SPOT_ON);
  assert.equal(spots.filter((s) => s.kind === 'halo').length, SPOT_HALO);
  for (const s of spots) {
    const inside = alpha[s.y * w + s.x] > 8;
    if (s.kind === 'on') {
      assert.ok(inside, 'on-pet spot sits on the pet');
      assert.ok(luma[s.y * w + s.x] / 255 > 0.42, 'on bright pixels');
    } else {
      assert.ok(!inside, 'halo spot is outside');
      let near = 99;
      for (let dy = -HALO; dy <= HALO; dy++) {
        for (let dx = -HALO; dx <= HALO; dx++) {
          if (alpha[(s.y + dy) * w + s.x + dx] > 8) near = Math.min(near, Math.max(Math.abs(dx), Math.abs(dy)));
        }
      }
      assert.ok(near >= 2 && near <= HALO, `halo spot is 2–${HALO} px out (${near})`);
    }
  }
  for (let i = 0; i < spots.length; i++) {
    for (let j = i + 1; j < spots.length; j++) {
      assert.ok(Math.abs(spots[i].x - spots[j].x) + Math.abs(spots[i].y - spots[j].y) > SPOT_APART, 'spots are spread out');
    }
  }
  // A different seed gives different spots; an empty sprite gives none and does not hang.
  assert.notDeepEqual(spots, pickGlintSpots(alpha, luma, w, h, 99));
  assert.deepEqual(pickGlintSpots(new Uint8Array(w * h), new Uint8Array(w * h), w, h), []);
}
ok('glint spots: deterministic, 4 on bright pixels + 4 in the halo within 5 px, at least 12 px apart');

/* ------------------------------------------------------------- 5. rim ------ */

{
  const w = 12;
  const h = 12;
  const alpha = new Uint8Array(w * h);
  for (let y = 4; y < 8; y++) for (let x = 4; x < 8; x++) alpha[y * w + x] = 255;
  const rim = rimPixels(alpha, w, h);
  assert.ok(rim.length > 0);
  for (const p of rim) assert.equal(alpha[p.y * w + p.x], 0, 'the rim is only ever outside the silhouette');
  const at = (x: number, y: number) => rim.find((p) => p.x === x && p.y === y);
  assert.equal(at(3, 5)?.lit, true, 'left of the figure: its right neighbour is opaque → lit');
  assert.equal(at(5, 3)?.lit, true, 'above: its lower neighbour is opaque → lit');
  assert.equal(at(8, 5)?.lit, false, 'right of the figure → shadow');
  assert.equal(at(5, 8)?.lit, false, 'below → shadow');
  assert.equal(at(3, 3), undefined, 'a diagonal corner has no 4-neighbour: not rim');
  assert.equal(at(0, 0), undefined);
  // One pixel thick: nothing two pixels away.
  assert.equal(at(2, 5), undefined);
  assert.equal(at(5, 9), undefined);
}
ok('the foil rim is 1 px outside the silhouette: lit top-left, shadow bottom-right, never inside');

/* ----------------------------------------------------- 6. reduce motion ---- */

{
  const w = 128;
  const h = 128;
  const t = holoTiming(true);
  // The gentle loop keeps every layer moving: the band drifts, the sweep passes, glints fade.
  assert.ok(t.driftTicks > holoTiming(false).driftTicks, 'slower');
  assert.ok(t.driftTicks > 0 && Number.isFinite(t.driftTicks));
  assert.equal(prismShift(0, true), 0);
  assert.ok(prismShift(t.driftTicks * 3, true) === 3, 'still drifts one pixel per step');
  assert.ok(prismShift(sweepPeriod(true), true) > 0, 'the drift never stops');
  const seen = new Set<number | null>();
  for (let p = 0; p < sweepPeriod(true); p++) seen.add(sweepPos(p, true, w, h));
  assert.ok(seen.size > 10, 'the gentle sweep passes');
  assert.ok(GLINT_GENTLE.length > 1 && glintLife(true) > 0);
  assert.equal(prismStrength(0.26, 0.05), 0, 'the near-black outline is untouched');
  assert.ok(prismStrength(0.26, 0.9) > prismStrength(0.26, 0.2), 'strength grows with lightness');
  assert.ok(prismStrength(0.26, 1) <= 0.26 + 1e-9);
  // No JS-thread timers anywhere in the holo.
  const holo = read('src/play/pet-holo.tsx');
  assert.ok(!/setInterval|setTimeout|requestAnimationFrame/.test(holo), 'one UI-thread clock, no JS timers');
  assert.ok(holo.includes('useFrameCallback') && holo.includes('useAnimatedProps'));
  assert.ok(holo.includes('vestibularSafe') && holo.includes('cosmeticsStill'), 'Reduce Motion / Motion Off → gentle loop, not still');
}
ok('Reduce Motion and Motion Off play the gentle loop: the drift, sweep and glints never stop');

/* ----------------------------------------------------------- 7. textures --- */

{
  const prism = finishColors().find((c) => c.id === 'opal')!.stops.map(hexRgb);
  const band = bandTexture(prism, PRISM_BAND, 128, 128);
  const decoded = decodePng(band.png);
  assert.equal(decoded.w, band.w);
  assert.equal(decoded.h, 128);
  assert.equal(band.w, 128 + band.period);
  // Pixel-exact: a texture pixel is exactly the ramp colour of its band, fully opaque.
  for (const [x, y] of [
    [0, 0],
    [17, 3],
    [140, 90],
    [band.w - 1, 127],
  ]) {
    const o = (y * decoded.w + x) * 4;
    const want = rampAt(prism, bandIndex(x, y, 0, PRISM_BAND));
    assert.deepEqual([decoded.data[o], decoded.data[o + 1], decoded.data[o + 2], decoded.data[o + 3]], [...want.map(Math.round), 255]);
  }
  // Sliding the texture by `shift` gives exactly the band pattern after `shift` steps.
  const shift = 5;
  for (const [x, y] of [
    [3, 3],
    [60, 100],
  ]) {
    const o = (y * decoded.w + (x + (shift % band.period))) * 4;
    const want = rampAt(prism, bandIndex(x, y, shift, PRISM_BAND));
    assert.deepEqual([decoded.data[o], decoded.data[o + 1], decoded.data[o + 2]], want.map(Math.round));
  }
  // At most 4 distinct colours in a single-colour texture: no gradients, no blur.
  const colours = new Set<number>();
  for (let i = 0; i < decoded.data.length; i += 4) colours.add((decoded.data[i] << 16) | (decoded.data[i + 1] << 8) | decoded.data[i + 2]);
  assert.equal(colours.size, 4);

  const sweep = sweepTexture(
    { kind: 'fixed', colours: { core: [255, 255, 255], mid: [255, 250, 235], outer: [235, 240, 255] } },
    128,
    { core: 0.72, mid: 0.5, outer: 0.24 },
  );
  const sd = decodePng(sweep.png);
  assert.equal(sd.h, 128);
  const alphaAt = (x: number, y: number) => sd.data[(y * sd.w + x) * 4 + 3];
  // The core column sits at `core` on every row's x + 0.7y line; 5 pixels wide at most: core, ±1, ±2.
  for (const y of [0, 40, 127]) {
    const cx = sweep.core - Math.round(y * 0.7);
    assert.equal(alphaAt(cx, y), Math.round(0.72 * 255), `core row ${y}`);
    assert.equal(alphaAt(cx + 1, y), Math.round(0.5 * 255));
    assert.equal(alphaAt(cx - 1, y) > 0, true);
    assert.equal(alphaAt(cx + 3, y), 0, 'the band is 5 px wide');
  }
  const glints = glintSheet([[255, 255, 255], [255, 246, 220], [200, 190, 160]], false);
  const gd = decodePng(glints.png);
  assert.equal(gd.w, 8 * GLINT_CELL);
  assert.equal(gd.h, GLINT_CELL);
  assert.equal(gd.data[(4 * gd.w + 3 * GLINT_CELL + 4) * 4 + 3], 255, 'f4 centre');
  assert.equal(gd.data[(4 * gd.w + 7 * GLINT_CELL + 4) * 4 + 3], 190, 'f8 tip is translucent over empty ground');
  assert.equal(decodePng(glintSheet([[255, 255, 255], [255, 255, 255], [255, 255, 255]], true).png).w, 6 * GLINT_CELL);
  // Small: no texture is more than a few tens of KB (indexed, one byte per pixel).
  for (const tex of [band, sweep, glints]) assert.ok(tex.png.length < 32 * 1024, `texture ${tex.png.length} B`);
}
ok('textures are real PNGs, pixel-exact, ≤ 4 colours per single-colour band, a few KB each');

/* ------------------------------------------------- 8. layers + ground ------ */

{
  const holo = read('src/play/pet-holo.tsx');
  assert.ok(holo.includes('maskType="alpha"'), 'masked to the sprite');
  assert.ok(holo.includes('mixBlendMode'), 'overlay blend for the prism');
  assert.ok(holo.includes('RIM_SHADOW_ALPHA'), 'shadow rim');
  assert.ok(!holo.includes('RadialGradient'), 'no soft gradients on the pet');
  assert.ok(!holo.includes('blurRadius') && !holo.includes('shadowRadius'), 'no blur');
  const figure = read('src/play/pet-figure.tsx');
  // Layer order: aura behind · sprite · holo · aura front.
  const behind = figure.indexOf('layer="back"');
  const sprite = figure.indexOf('<ClipImage drawable={drawable} />');
  const holoAt = figure.indexOf('<PetHolo');
  const front = figure.indexOf('layer="front"');
  assert.ok(behind > 0 && behind < sprite && sprite < holoAt && holoAt < front, 'aura behind · sprite · holo · aura front');
  assert.ok(figure.includes('styles.stage') && figure.includes("stage: { position: 'absolute', overflow: 'hidden' }"), 'the stage is clipped');
  const room = read('src/play/pet-room.tsx');
  assert.ok(room.includes('roleGroundAt') && room.includes('groundAt={groundAt}'), 'room floor effects use the ground point');
  assert.ok(room.includes('top: groundAt * box - 8'), 'the floor ring is centred on the ground point');
  assert.ok(!room.includes('footAt={footAt}'), 'no floor effect uses the toe edge');
  const looks = read('src/play/pet-looks.tsx');
  assert.ok(looks.includes('cy={groundAt * size}') && !looks.includes('footAt * size'), 'glimmer and shiny ring use the ground point');
  assert.ok(room.includes("stage: { flex: 1, minHeight: 0, overflow: 'hidden' }"), 'the room viewport is clipped');
  const card = read('src/play/pet-card.tsx');
  assert.ok(/art: \{[^}]*overflow: 'hidden'/.test(card), "the card's art area clips the pet layers");
  // The holo and aura draw only inside the stage; the card's colour set is data.
  const cfg = finishConfig();
  assert.equal(cfg.defaults.sweep, 'white');
  assert.equal(cfg.defaults.glint, 'white');
  assert.ok(read('src/play/data/finishes.json').includes('"prism"'), 'colour sets are data, not code');
}
ok('PetHolo is its own layer between sprite and front aura; floor effects use the ground point; the stage, room and card clip');

console.log(`\ncheck:pet-holo — ${passed} groups passed.`);
