/**
 * Decor slots (Divecore roadmap step 5, plan approved by emci 2026-10-15).
 * Run: npm run check:decor-slots
 *
 *   1. Slots: 3, ids forever (d1..d3), 4×2 cells each, on walkable floor, clear of every baked prop,
 *      hotspot, spawn and pet target, and of each other; clear of both rails at 430 and 375 wide.
 *   2. Shelf: 10 free props with forever ids (`dc_*`); every sprite exists in the art library at the
 *      size the table says, the trim box sits inside the file, and the UI names the art through
 *      ART.prop (never a typed id, path or require()).
 *   3. Rules: fill / swap / take away; unknown slot or item = no change; parse is tolerant.
 *   4. Free: filling or emptying a slot moves nothing but `hideout.decor` (no tokens, shells, stones,
 *      pet tokens, wardrobe, pet) and does not even touch the pet's passive income.
 *   5. Save: rides the Hideout state → the whole Play doc → the wave96 cloud save; round trip keeps
 *      it, garbage and an old save read as an empty room.
 *   6. Walk: a filled slot blocks its cells; with all 3 filled the room is still reachable at every
 *      stage, and a pet roaming at both phone widths never steps onto a filled slot.
 *   7. Depth + wiring: the sprite stands on its footprint's bottom edge and sorts by it; the room,
 *      the picker (float layer, `overlayBusy`) and the save call are wired as described; no app
 *      screen, network or model call anywhere in the feature.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { PNG } from 'pngjs';

import {
  DECOR_ITEMS,
  DECOR_ITEM_IDS,
  DECOR_ROOM,
  DECOR_SLOTS,
  DECOR_SLOT_IDS,
  decorGeom,
  decorKey,
  decorLayer,
  parseDecor,
  placedDecor,
  setDecorSlot,
  slotRect,
  type DecorState,
} from '../src/play/decor-slots';
import { cloudSavePayload } from '../src/play/cloud-save-model';
import { VISITOR_CLEAR_PX, VISITOR_MIN_PET_STRIP_PX, VISITOR_SPOT } from '../src/play/daily-visitors';
import { HIDEOUT_GEOM, assertRoomReachable, hideoutGridFor, isoClampToWalk, isoOnWalkFloor, pointInPoly, planHideoutStep } from '../src/play/hideout-iso';
import { RAIL_CLEAR_PT, RAIL_ROOM_GEOM, railWalkBounds } from '../src/play/hideout-rails-model';
import { emptyHideout, parseHideout } from '../src/play/hideout-progress';
import { PET_STAGES } from '../src/play/pet';
import { defaultPlayStore, markHideoutCoach, parsePlayStore, setHideoutDecor } from '../src/play/playStore';

const root = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');
const TILE = HIDEOUT_GEOM.tile;
const rectsOverlap = (a: readonly number[], b: readonly number[]) =>
  a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];

/* 1 · slots --------------------------------------------------------------- */

assert.equal(DECOR_ROOM, 'hideout');
assert.deepEqual([...DECOR_SLOT_IDS], ['d1', 'd2', 'd3'], 'three slots, ids forever');
const baseGrid = HIDEOUT_GEOM.grid;
const walkable = (c: number, r: number) => baseGrid.walkable[r]?.[c] === '1';
const pxRects = DECOR_SLOTS.map((s) => slotRect(s, TILE));
for (const [i, s] of DECOR_SLOTS.entries()) {
  const [c, r, w, h] = s.cells;
  assert.deepEqual([w, h], [4, 2], `${s.id}: 4×2 cells (64×32 art px)`);
  for (let rr = r; rr < r + h; rr += 1) for (let cc = c; cc < c + w; cc += 1) assert.ok(walkable(cc, rr), `${s.id}: cell ${cc},${rr} is walkable floor`);
  const rect = pxRects[i]!;
  for (const p of HIDEOUT_GEOM.props) {
    assert.ok(!rectsOverlap(rect, [p.footprintCells[0] * TILE, p.footprintCells[1] * TILE, p.footprintCells[2] * TILE, p.footprintCells[3] * TILE]), `${s.id}: clear of the ${p.id} footprint`);
    assert.ok(!rectsOverlap(rect, p.rect), `${s.id}: clear of the ${p.id} art`);
  }
  for (const hs of HIDEOUT_GEOM.hotspots) {
    assert.ok(!rectsOverlap(rect, hs.rect), `${s.id}: clear of the ${hs.id} hotspot`);
    assert.ok(!pointInPoly(hs.walk[0], hs.walk[1], [[rect[0], rect[1]], [rect[0] + rect[2], rect[1]], [rect[0] + rect[2], rect[1] + rect[3]], [rect[0], rect[1] + rect[3]]]), `${s.id}: not on the ${hs.id} walk-to point`);
  }
  for (const [name, pt] of [...Object.entries(HIDEOUT_GEOM.targets), ...Object.entries(HIDEOUT_GEOM.spawns)]) {
    assert.ok(!(pt[0] >= rect[0] && pt[0] <= rect[0] + rect[2] && pt[1] >= rect[1] && pt[1] <= rect[1] + rect[3]), `${s.id}: not on ${name} (${pt[0]},${pt[1]})`);
  }
  for (const [j, other] of pxRects.entries()) if (j !== i) assert.ok(!rectsOverlap(rect, other), `${s.id} and ${DECOR_SLOTS[j]!.id} do not overlap`);
}
// The rugs sit on the floor layer: slots stay off them too.
for (const rug of (HIDEOUT_GEOM as unknown as { rugs?: number[][] }).rugs ?? []) {
  if (rug.length >= 4) for (const [i, s] of DECOR_SLOTS.entries()) assert.ok(!rectsOverlap(pxRects[i]!, [rug[0]!, rug[1]!, rug[2]!, rug[3]!]), `${s.id}: clear of the rug`);
}
// Art-px rects of the flat floor pieces the map does not list as props (rug, pet bed, bowl, hatch).
const FLOOR_PIECES: Record<string, readonly number[]> = { rug: [120, 353, 112, 45], bed: [248, 395, 64, 30], bowl: [98, 455, 27, 20], hatch: [144, 480, 64, 32] };
for (const [name, fr] of Object.entries(FLOOR_PIECES)) for (const [i, s] of DECOR_SLOTS.entries()) assert.ok(!rectsOverlap(pxRects[i]!, fr), `${s.id}: clear of the ${name}`);
// Clear of the rails at both phone widths: the slot's centre is outside the rails' screen strip.
for (const w of [430, 375]) {
  const pt = w / 352;
  for (const [i, s] of DECOR_SLOTS.entries()) {
    const cx = (pxRects[i]![0] + pxRects[i]![2] / 2) * pt; // screen pt, room origin at the stage's left edge
    assert.ok(cx >= RAIL_CLEAR_PT + 8 && cx <= w - RAIL_CLEAR_PT - 8, `${w}: ${s.id}'s "+" (x ${Math.round(cx)} pt) is clear of both rail strips (${RAIL_CLEAR_PT} pt each side)`);
  }
}

/* 2 · shelf --------------------------------------------------------------- */

assert.deepEqual(
  [...DECOR_ITEM_IDS],
  ['dc_plant', 'dc_beanbag', 'dc_table', 'dc_lamp', 'dc_crate', 'dc_boombox', 'dc_traffic_cone', 'dc_barrel_fire', 'dc_tire_stack', 'dc_trash_bags'],
  'the shelf: ids are forever (append only)',
);
assert.equal(new Set(DECOR_ITEM_IDS).size, 10);
const uiSrc = read('src/play/decor-slots-ui.tsx');
const propsDir = path.join(root, 'assets/art/props');
const findPng = (set: string, name: string): string | null => {
  for (const state of ['in-use', 'unused']) {
    const f = path.join(propsDir, state, set, `${name}.png`);
    if (fs.existsSync(f)) return f;
  }
  return null;
};
const ART_OF: Record<string, [string, string, string]> = {
  dc_plant: ['hideout/streetwear', 'plant', 'ART.prop.hideout.streetwear.plant'],
  dc_beanbag: ['hideout/streetwear', 'beanbag', 'ART.prop.hideout.streetwear.beanbag'],
  dc_table: ['hideout/streetwear', 'table', 'ART.prop.hideout.streetwear.table'],
  dc_lamp: ['hideout/streetwear', 'lamp', 'ART.prop.hideout.streetwear.lamp'],
  dc_crate: ['streetwear', 'crate', 'ART.prop.streetwear.crate'],
  dc_boombox: ['streetwear', 'boombox', 'ART.prop.streetwear.boombox'],
  dc_traffic_cone: ['streetwear', 'traffic-cone', 'ART.prop.streetwear.trafficCone'],
  dc_barrel_fire: ['streetwear', 'barrel-fire', 'ART.prop.streetwear.barrelFire'],
  dc_tire_stack: ['streetwear', 'tire-stack', 'ART.prop.streetwear.tireStack'],
  dc_trash_bags: ['streetwear', 'trash-bags', 'ART.prop.streetwear.trashBags'],
};
for (const it of DECOR_ITEMS) {
  assert.match(it.id, /^dc_[a-z_]+$/);
  assert.ok(it.label.length > 0 && it.label.length <= 12, `${it.id}: a short label`);
  const [set, name, chain] = ART_OF[it.id]!;
  const file = findPng(set, name);
  assert.ok(file, `${it.id}: its sprite is in the art library (${set}/${name}.png)`);
  const png = PNG.sync.read(fs.readFileSync(file));
  assert.deepEqual([png.width, png.height], [...it.src], `${it.id}: the file is ${it.src.join('×')}`);
  const [tx, ty, tw, th] = it.trim;
  assert.ok(tx >= 0 && ty >= 0 && tx + tw <= png.width && ty + th <= png.height, `${it.id}: the trim box sits inside the file`);
  // The trim box is exactly the drawn pixels (no padding row or column left in, none cut off).
  let minX = png.width, minY = png.height, maxX = -1, maxY = -1;
  for (let y = 0; y < png.height; y += 1) for (let x = 0; x < png.width; x += 1) if (png.data[(y * png.width + x) * 4 + 3]! > 0) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  assert.deepEqual([minX, minY, maxX - minX + 1, maxY - minY + 1], [tx, ty, tw, th], `${it.id}: trim = the drawn pixels`);
  assert.ok(tw <= 70 && th <= 110, `${it.id}: on the room's prop ladder (≤ 70 wide, ≤ 110 tall)`);
  assert.ok(uiSrc.includes(`getArtSource(${chain})`), `${it.id}: named through ${chain}`);
}
assert.ok(!/require\(|['"`]prop\.|assets\/art\//.test(uiSrc), 'no typed art id, path or require() in the decor UI');

/* 3 · rules --------------------------------------------------------------- */

let d: DecorState = {};
d = setDecorSlot(d, 'd1', 'dc_plant');
d = setDecorSlot(d, 'd2', 'dc_crate');
assert.deepEqual(d, { d1: 'dc_plant', d2: 'dc_crate' });
d = setDecorSlot(d, 'd1', 'dc_boombox');
assert.equal(d.d1, 'dc_boombox', 'swap');
assert.equal(setDecorSlot(d, 'd9', 'dc_plant'), d, 'unknown slot = no change');
assert.equal(setDecorSlot(d, 'd1', 'dc_nope'), d, 'unknown item = no change');
d = setDecorSlot(d, 'd2', null);
assert.deepEqual(d, { d1: 'dc_boombox' }, 'take away');
assert.deepEqual(setDecorSlot({}, 'd3', null), {}, 'taking away an empty spot is fine');
// The same prop may stand in two spots (nothing is "used up").
assert.deepEqual(setDecorSlot({ d1: 'dc_plant' }, 'd2', 'dc_plant'), { d1: 'dc_plant', d2: 'dc_plant' });
assert.deepEqual(parseDecor(null), {});
assert.deepEqual(parseDecor([]), {});
assert.deepEqual(parseDecor('d1'), {});
assert.deepEqual(parseDecor(7), {});
assert.deepEqual(parseDecor({ d1: 'dc_plant', d2: 'gone', d4: 'dc_crate', d3: 3 }), { d1: 'dc_plant' }, 'unknown slots / items are dropped');
assert.equal(decorKey({}), '-|-|-');
assert.notEqual(decorKey({ d1: 'dc_plant' }), decorKey({ d2: 'dc_plant' }));

/* 4 · free ---------------------------------------------------------------- */

const now = Date.UTC(2026, 9, 16, 12);
const doc0 = defaultPlayStore(now);
const filled = setHideoutDecor(doc0, 'd1', 'dc_plant');
assert.ok(filled, 'filling a spot changes the doc');
const strip = (x: typeof doc0) => JSON.stringify({ ...x, hideout: { ...x.hideout, decor: null } });
assert.equal(strip(filled), strip(doc0), 'only hideout.decor changed — no tokens, shells, stones, pet tokens, wardrobe or pet, and no passive income');
assert.equal(setHideoutDecor(filled, 'd1', 'dc_plant'), null, 'the same prop again = nothing to save');
assert.equal(setHideoutDecor(doc0, 'd1', null), null, 'emptying an empty spot = nothing to save');
assert.equal(setHideoutDecor(doc0, 'd7', 'dc_plant'), null, 'unknown slot = nothing to save');
let busy = doc0;
for (let i = 0; i < 40; i += 1) {
  const r = setHideoutDecor(busy, DECOR_SLOTS[i % 3]!.id, i % 5 === 4 ? null : DECOR_ITEMS[i % DECOR_ITEMS.length]!.id);
  if (r) busy = r;
}
assert.equal(strip(busy), strip(doc0), '40 swaps later: still nothing but decor moved');
// The pet's own day is untouched (a control that does touch it differs, so the comparison means something).
assert.notEqual(JSON.stringify(markHideoutCoach(doc0, now + 36 * 3600_000).pet), JSON.stringify(doc0.pet), 'control: touching the pet does move its day');
const storeSrc = read('src/play/playStore.ts');
const fn = storeSrc.slice(storeSrc.indexOf('export function setHideoutDecor'), storeSrc.indexOf('export function resetDivecore'));
assert.ok(fn.length > 40 && !/touchPet|tokens|shells|stones|pet_cosmetics/.test(fn), 'setHideoutDecor never touches the economy or the wardrobe');

/* 5 · save ---------------------------------------------------------------- */

assert.deepEqual(emptyHideout().decor, {});
assert.deepEqual(parseHideout({}, 0).decor, {}, 'an old save without the field reads as an empty room');
assert.deepEqual(parseHideout({ decor: { d1: 'dc_plant', d2: 'gone' } }, 0).decor, { d1: 'dc_plant' });
const saved = setHideoutDecor(setHideoutDecor(doc0, 'd2', 'dc_beanbag')!, 'd3', 'dc_barrel_fire')!;
const restored = parsePlayStore(JSON.stringify(saved), now + 1000);
assert.ok(restored);
assert.deepEqual(restored.hideout.decor, { d2: 'dc_beanbag', d3: 'dc_barrel_fire' }, 'decor survives the save round trip');
const payload = cloudSavePayload(saved, now + 2000);
assert.ok(payload, 'the save fits the cloud cap with decor in it');
const fromCloud = parsePlayStore(JSON.stringify(payload.p_doc), now + 3000);
assert.deepEqual(fromCloud?.hideout.decor, saved.hideout.decor, 'decor rides the wave96 cloud save');
assert.ok(/cloudSavePayload\(next\.doc/.test(read('src/play/cloud-save.ts')), 'cloud-save.ts pushes the whole doc');
// Offline: nothing here imports the network.
for (const f of ['src/play/decor-slots.ts', 'src/play/decor-slots-ui.tsx']) {
  assert.ok(!/from '@\/app\/|from '@\/lib\/supabase|generateText|ai-generate|fetch\(/.test(read(f)), `${f}: no app screen, no network, no model call`);
}

/* 6 · walk ---------------------------------------------------------------- */

assert.equal(decorGeom(HIDEOUT_GEOM, {}), HIDEOUT_GEOM, 'nothing placed = the room as it was');
const all: DecorState = { d1: 'dc_plant', d2: 'dc_beanbag', d3: 'dc_table' };
const blocked = decorGeom(HIDEOUT_GEOM, all);
assert.notEqual(blocked, HIDEOUT_GEOM);
assert.equal(blocked.grid.walkable.length, baseGrid.walkable.length);
for (const s of DECOR_SLOTS) {
  const [c, r, w, h] = s.cells;
  for (let rr = 0; rr < baseGrid.rows; rr += 1) {
    for (let cc = 0; cc < baseGrid.cols; cc += 1) {
      const inside = cc >= c && cc < c + w && rr >= r && rr < r + h;
      if (inside) assert.equal(blocked.grid.walkable[rr]![cc], '0', `${s.id}: cell ${cc},${rr} blocked`);
    }
  }
}
let diff = 0;
for (let rr = 0; rr < baseGrid.rows; rr += 1) for (let cc = 0; cc < baseGrid.cols; cc += 1) if (baseGrid.walkable[rr]![cc] !== blocked.grid.walkable[rr]![cc]) diff += 1;
assert.equal(diff, 24, 'exactly 3 × 8 cells changed, nothing else');
assert.ok(hideoutGridFor('adult', HIDEOUT_GEOM) !== hideoutGridFor('adult', blocked), 'the padded walk grid is built from the blocked cells');
// Every place the pet goes on purpose (bowl, bed, cushion, door, chair, boombox, each hotspot's walk-to point)
// is exactly as reachable as before: a filled slot never takes one away.
const goPoints = [...Object.values(HIDEOUT_GEOM.targets), ...Object.values(HIDEOUT_GEOM.spawns), ...HIDEOUT_GEOM.hotspots.map((h) => h.walk)];
for (const stage of PET_STAGES.filter((s) => s !== 'egg')) {
  for (const pt of goPoints) {
    assert.equal(isoOnWalkFloor(pt[0], pt[1], blocked, stage), isoOnWalkFloor(pt[0], pt[1], HIDEOUT_GEOM, stage), `${stage}: (${pt[0]},${pt[1]}) is as walkable as before`);
  }
  const res = assertRoomReachable(blocked, stage);
  assert.ok(res.ok, `${stage}: every spot of the room is still reachable with all 3 filled (${'reason' in res ? res.reason : ''})`);
  for (const s of DECOR_SLOTS) {
    const r = slotRect(s, TILE);
    const p = isoClampToWalk(r[0] + r[2] / 2, r[1] + r[3] / 2, blocked, stage);
    assert.ok(!(p[0] > r[0] && p[0] < r[0] + r[2] && p[1] > r[1] && p[1] < r[1] + r[3]), `${stage}: a pet put on ${s.id} is moved off it`);
  }
}
let seed = 5;
const rng = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
};
const roomGeom = RAIL_ROOM_GEOM.hideout!;
const roam = decorGeom(roomGeom, all);
for (const w of [430, 375]) {
  const bounds = railWalkBounds({ stageW: w, originLeft: 0, pt: w / 352 });
  let x = roam.spawns.default?.[0] ?? 176;
  let y = roam.spawns.default?.[1] ?? 360;
  let moved = 0;
  for (let n = 0; n < 400; n += 1) {
    const step = planHideoutStep({ kit: { idle: 4, walk: 4, attack: 4, skill: 4 }, mood: 'happy', branch: 'standard', stage: 'adult', x, y, rng, geom: roam, bounds });
    for (const p of step.path) {
      for (const s of DECOR_SLOTS) {
        const r = slotRect(s, TILE);
        assert.ok(!(p[0] > r[0] && p[0] < r[0] + r[2] && p[1] > r[1] && p[1] < r[1] + r[3]), `${w}: the pet never steps onto ${s.id} (${Math.round(p[0])},${Math.round(p[1])})`);
      }
    }
    if (step.toX !== x || step.toY !== y) moved += 1;
    x = step.toX;
    y = step.toY;
  }
  assert.ok(moved > 60, `${w}: the pet still roams with all 3 filled (${moved} moves)`);
}
assert.ok(isoOnWalkFloor(roam.spawns.default![0], roam.spawns.default![1], roam, 'adult'), 'the spawn is still floor');
// Today's visitor + all 3 filled: the pet is kept left of the visitor (pet-room's rule) and must still roam,
// never onto a slot.
for (const w of [430, 375]) {
  const rails = railWalkBounds({ stageW: w, originLeft: 0, pt: w / 352 });
  const [vx] = isoClampToWalk(VISITOR_SPOT[0], VISITOR_SPOT[1], roam, 'adult', rails);
  const cap = vx - VISITOR_CLEAR_PX;
  if (cap - rails.minX < VISITOR_MIN_PET_STRIP_PX) continue; // pet-room leaves the bounds alone then
  const bounds = { minX: rails.minX, maxX: Math.min(rails.maxX, cap) };
  let x = roam.spawns.default?.[0] ?? 176;
  let y = roam.spawns.default?.[1] ?? 360;
  let moved = 0;
  for (let n = 0; n < 300; n += 1) {
    const step = planHideoutStep({ kit: { idle: 4, walk: 4, attack: 4, skill: 4 }, mood: 'happy', branch: 'standard', stage: 'adult', x, y, rng, geom: roam, bounds });
    for (const p of step.path) {
      assert.ok(p[0] <= cap + 8, `${w}: with a visitor in, the pet stays left of it`);
      for (const s of DECOR_SLOTS) {
        const r = slotRect(s, TILE);
        assert.ok(!(p[0] > r[0] && p[0] < r[0] + r[2] && p[1] > r[1] && p[1] < r[1] + r[3]), `${w}: visitor + decor: the pet never steps onto ${s.id}`);
      }
    }
    if (step.toX !== x || step.toY !== y) moved += 1;
    x = step.toX;
    y = step.toY;
  }
  assert.ok(moved > 20, `${w}: the pet still roams with a visitor in AND all 3 spots filled (${moved} moves)`);
}

/* 7 · depth + wiring ------------------------------------------------------ */

for (const p of placedDecor({ d1: 'dc_lamp', d2: 'dc_table', d3: 'dc_crate' }, TILE)) {
  const s = DECOR_SLOTS.find((x) => x.id === p.slot)!;
  const fr = slotRect(s, TILE);
  assert.equal(p.rect[1] + p.rect[3], fr[1] + fr[3], `${p.slot}: stands on its footprint's bottom edge`);
  assert.equal(p.sortY, fr[1] + fr[3], `${p.slot}: sorts by the footprint bottom (a pet above it is behind it)`);
  assert.ok(Math.abs(p.rect[0] + p.rect[2] / 2 - (fr[0] + fr[2] / 2)) <= 1, `${p.slot}: centred on the footprint`);
  assert.ok(p.rect[0] >= 0 && p.rect[0] + p.rect[2] <= HIDEOUT_GEOM.canvas[0] && p.rect[1] >= 0, `${p.slot}: inside the room`);
}
assert.deepEqual(placedDecor({}, TILE), []);
// Layers: A behind all · B between visitor and pet · C between pet and visitor · D in front of all.
assert.equal(decorLayer(496, 520, null), 'A', 'no visitor: the pet below the prop = prop behind');
assert.equal(decorLayer(496, 300, null), 'D', 'no visitor: the pet above the prop = prop in front');
assert.equal(decorLayer(496, 520, 430), 'B', 'pet in front of the prop, visitor behind the prop, visitor behind the pet: between them');
assert.equal(decorLayer(416, 520, 430), 'A', 'prop behind both');
assert.equal(decorLayer(496, 300, 430), 'D', 'prop in front of both');
assert.equal(decorLayer(300, 200, 430), 'C', 'visitor in front of the pet: a prop between them goes between them');
assert.equal(decorLayer(496, 200, 430), 'D');
assert.equal(decorLayer(150, 200, 430), 'A');
const roomSrc = read('src/play/pet-room.tsx');
assert.ok(/decorGeom\(roomGeom\('hideout'\), decor\.placed\)/.test(roomSrc), 'pet-room builds the blocked geometry');
assert.ok(/geom: hideoutStage \? \(decorWalkGeomRef\.current \?\? roomGeom\(hideoutStage\.presence\.room\)\) : undefined/.test(roomSrc), 'the walk planner gets the decor geometry');
assert.ok(/hideoutStage, decorWalkGeom\]\);/.test(roomSrc), 'the walk loop replans when what is placed changes');
assert.ok(/\[decorWalkGeom, hideoutPt, hasRails\]/.test(roomSrc), 'a pet standing where a prop lands is moved clear (placed / Motion Off / room switch)');
assert.ok(/hideoutStage\?\.viewed === 'hideout' && !picking && width > 0/.test(roomSrc), 'decor shows in the Hideout room only');
assert.ok(/decorLayer\(p\.sortY, feet\.y, visitorFeet \? visitorFeet\[1\] : null\) === layer/.test(roomSrc), 'props sort against the pet AND the visitor by footprint bottom');
const at = (needle: string) => {
  const i = roomSrc.indexOf(needle);
  assert.ok(i >= 0, `pet-room has ${needle}`);
  return i;
};
const petWrap = at('<Animated.View pointerEvents={streetRoom');
assert.ok(
  at('<DecorSprites items={decorA}') < at('{visitorBehind ? visitorEl : null}') &&
    at('{visitorBehind ? visitorEl : null}') < at('<DecorSprites items={decorB}') &&
    at('<DecorSprites items={decorB}') < petWrap &&
    petWrap < at('<DecorSprites items={decorC}') &&
    at('<DecorSprites items={decorC}') < at('{visitorBehind ? null : visitorEl}') &&
    at('{visitorBehind ? null : visitorEl}') < at('<DecorSprites items={decorD}'),
  'draw order: A · visitor-behind · B · pet · C · visitor-front · D',
);
assert.ok(at('<DecorSpots') < petWrap && at('<DecorSpots') > at('<DecorSprites items={decorB}'), 'the tap spots sit UNDER the pet, so a tap on the pet is still "say hi"');
assert.ok(/const h = Math\.max\(TAP_MIN, fh \* k\);/.test(uiSrc), 'a spot is its footprint (≥ 44 pt), never the full height of a tall prop');
assert.ok(/A prop that just landed under the pet/.test(roomSrc), 'the walk loop starts from free floor when a prop lands on the pet (no walk-in-place step)');
const screenSrc = read('src/play/pet-screen.tsx');
assert.ok(/const overlayBusy = busy \|\| visitorShown \|\| decorShown;/.test(screenSrc), 'the picker counts as busy (separate value; the away-card pin on `busy` is untouched)');
assert.ok(/const decorShown = decorSlot != null && !awayShown && !settingsOpen && !visitorShown/.test(screenSrc), 'the picker waits for the away card and the visitor card, hides under Settings');
assert.ok(/decorShown && decorSlot \? \(\s*<DecorSheet/.test(screenSrc), 'the picker floats over the Hideout (GameScreen float)');
assert.ok(/decor=\{street \? \{ placed: view\.hideout\.state\.decor, onTap: setDecorSlot \} : null\}/.test(screenSrc), 'one call site, street layout only');
assert.ok(/commit\(\(doc\) => setHideoutDecor\(doc, slot, item\)\)/.test(screenSrc), 'a pick saves through the Play store');
assert.ok(/BackHandler\.addEventListener\('hardwareBackPress'/.test(uiSrc), 'Android back closes the picker');
assert.ok(/noticeReduceMotion\(\)/.test(uiSrc), 'Reduce Motion = a gentle fade');
for (const f of ['src/play/pet-room.tsx', 'src/play/pet-screen.tsx']) assert.ok(!/@\/app\//.test(read(f).replace(/@\/app\/play/g, '')), `${f}: stays in Play`);

console.log(`check:decor-slots ok — ${DECOR_SLOTS.length} slots, ${DECOR_ITEMS.length} free props, walk blocked + reachable, save rides the cloud doc, economy unchanged`);
