/**
 * Hideout rails check (feature/hideout-rails, 2026-10-14).
 *
 * Every Hideout action is on a rail (left = the room's actions, right = the room switcher), the old
 * in-room spots / labels / Hideout-Loft-Call row are gone, and there is no blue press fill or cyan
 * ellipse left in the room. Pure rules in `src/play/hideout-rails-model.ts` + static pins.
 *
 * Run: npm run check:hideout-rails
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import { HIDEOUT_ROOM_IDS, emptyHideout, type HideoutRoomId } from '../src/play/hideout-progress';
import { HIDEOUT_SPOTS, hideoutGridFor, planHideoutStep, withWalkBounds } from '../src/play/hideout-iso';
import {
  RAIL_BUTTON_PT,
  RAIL_CLEAR_PT,
  RAIL_EDGE_PT,
  RAIL_GAP_PT,
  leftRailActions,
  railMaxHeight,
  railRooms,
  railScrolls,
  railSpeechRange,
  railWalkBounds,
  RAIL_ROOM_GEOM,
} from '../src/play/hideout-rails-model';
import { REGIONS } from '../src/play/stage-frame';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

// --- the left rail: the map's actions, same ids -------------------------------------------------
const h = emptyHideout();
const labels = (room: HideoutRoomId) => leftRailActions(room, h).map((a) => a.label);
assert.deepEqual(labels('hideout'), ['Play', 'Stash', 'Underground', 'Explore'], 'Hideout rail');
assert.deepEqual(labels('loft'), ['Sleep', 'Light', 'Back'], 'Loft rail');
assert.deepEqual(labels('garage'), ['Back', 'Up'], 'Underground room rail');
for (const room of HIDEOUT_ROOM_IDS) {
  for (const a of leftRailActions(room, h)) assert.ok(/^\S+$/.test(a.label), `${room}/${a.label}: one word`);
}
const spotIds = leftRailActions('hideout', h).flatMap((a) => (a.kind === 'spot' ? [a.spot] : []));
for (const s of HIDEOUT_SPOTS) assert.ok(spotIds.includes(s.coach), `the map's ${s.thing} (${s.action}) is on the rail`);
ok('left rail: every map hotspot is a rail button (Play · Stash · Underground · Explore / Sleep · Light · Back / Back · Up), one word each');

const up = leftRailActions('garage', h).find((a) => a.label === 'Up');
assert.ok(up && up.kind === 'view' && up.room === 'rooftop' && up.dim, 'Up leads to the Rooftop and is dimmed while it is locked');
assert.equal(leftRailActions('garage', h).length, 2, 'a locked action is dimmed, never hidden');
const unlocked = { ...h, rooms_unlocked: { ...h.rooms_unlocked, loft: true, garage: true, rooftop: true } };
assert.equal((leftRailActions('garage', unlocked).find((a) => a.label === 'Up') as { dim: boolean }).dim, false, 'Up lights up once the Rooftop is built');
ok('locked actions are dimmed, never hidden');

const lockedLoft = leftRailActions('loft', h);
assert.deepEqual(lockedLoft.map((x) => [x.label, x.dim]), [['Sleep', true], ['Light', true], ['Back', false]], 'a room that is not built: only the way out stays lit');
ok('an unbuilt room dims everything except Back');

// --- the right rail: rooms + Call, scrolls past 5 -----------------------------------------------
const rooms = railRooms(h, 'hideout', 'hideout', (id) => id);
assert.ok(rooms.length >= 1 && rooms[0]!.id === 'hideout' && rooms[0]!.selected, 'the viewed room is selected');
assert.equal(railScrolls(3), false);
assert.equal(railScrolls(4), false, '4 rooms + Call = 5 items, no scroll');
assert.equal(railScrolls(5), true, 'more than 5 items scrolls');
assert.equal(railMaxHeight(563), 563 - RAIL_EDGE_PT * 2, 'a rail never grows past the stage');
ok('right rail: viewed room selected, scrolls past 5 items, height capped by the stage');

// --- sizes and clearance -------------------------------------------------------------------------
assert.ok(RAIL_BUTTON_PT >= 44, 'tap target ≥ 44 pt');
assert.equal(RAIL_GAP_PT, 8, '8 pt gaps');
assert.equal(RAIL_CLEAR_PT, RAIL_EDGE_PT + RAIL_BUTTON_PT + 8, 'clear zone = rail width + 8 pt');
for (const [w, pt] of [[430, 430 / 352], [375, 375 / 352]] as const) {
  const b = railWalkBounds({ stageW: w, originLeft: 0, pt });
  assert.ok(b.minX * pt >= RAIL_CLEAR_PT, `${w}: feet stay right of the left rail`);
  assert.ok(w - b.maxX * pt >= RAIL_CLEAR_PT, `${w}: feet stay left of the right rail`);
  assert.ok(b.maxX - b.minX >= 120, `${w}: the pet still has room to walk (${Math.round(b.maxX - b.minX)} art px)`);
  const r = railSpeechRange({ stageW: w });
  assert.equal(r.left, RAIL_CLEAR_PT);
  assert.equal(r.right, w - RAIL_CLEAR_PT);
}
ok('walk area and speech bubble stay clear of both rails (rail width + 8 pt) at 430 and 375');

// --- the pet really walks inside the bounds ------------------------------------------------------
let seed = 7;
const rng = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
};
for (const room of ['hideout', 'loft'] as const) {
  const geom = RAIL_ROOM_GEOM[room]!;
  const bounds = railWalkBounds({ stageW: 430, originLeft: 0, pt: 430 / 352 });
  const grid = withWalkBounds(hideoutGridFor('adult', geom), bounds);
  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.cols; col += 1) {
      if (grid.walkable[row]![col] !== '1') continue;
      const cx = (col + 0.5) * grid.tile;
      assert.ok(cx >= bounds.minX && cx <= bounds.maxX, `${room}: walkable cell ${col},${row} is inside the bounds`);
    }
  }
  let x = geom.spawns.default?.[0] ?? 176;
  let y = geom.spawns.default?.[1] ?? 360;
  for (let n = 0; n < 150; n += 1) {
    const step = planHideoutStep({ kit: { idle: 4, walk: 4, attack: 4, skill: 4 }, mood: 'happy', branch: 'standard', stage: 'adult', x, y, rng, geom, bounds });
    for (const p of step.path.slice(1)) {
      assert.ok(p[0] >= bounds.minX - 8 && p[0] <= bounds.maxX + 8, `${room}: path point ${Math.round(p[0])} is clear of the rails`);
    }
    x = step.toX;
    y = step.toY;
  }
}
ok('the pet never walks into a rail (150 planned steps in the Hideout and the Loft)');

// --- the room is bare: no spots, labels, blue fill, ellipses --------------------------------------
const room = readFileSync('src/play/street-room.tsx', 'utf8');
assert.ok(!/StreetRoomSpots|chipPressed|PIXEL\.glow|<Ellipse|ChipBob|showAllLabels|useHideoutShowLabels|SEEN_KEY/.test(room), 'street-room.tsx: no spots, tap rects, labels, blue press fill or cyan ellipses');
assert.ok(!/stroke=\{PIXEL\.cyan\}/.test(room), 'no cyan stroke left in the room');
const sheets = readFileSync('src/play/pet-sheets.tsx', 'utf8');
assert.ok(!/Show labels|ShowLabels/.test(sheets), 'Info has no "Show labels" switch (there are no labels)');
assert.ok(!existsSync('src/play/hideout-bar.tsx'), 'the old Hideout / Loft / Call bar is gone');
const stage = readFileSync('src/play/hideout-stage.tsx', 'utf8');
assert.ok(!/HideoutStageControls|HideoutRoomBar/.test(stage), 'no room bar in the stage code');
ok('no in-room spots, labels, tap rects, blue press fill, cyan ellipses or Show labels; old bar deleted');

const screen = readFileSync('src/play/pet-screen.tsx', 'utf8');
assert.ok(!/roomRow|HideoutStageControls|ROW_ONLY/.test(screen), 'pet-screen: no Hideout / Loft / Call row above Feed / Info');
assert.match(screen, /rails=\{\s*street \? \(\s*<HideoutRails/, 'pet-screen hands the rails to the room');
assert.equal(REGIONS.hideout.dock, 64, 'the dock is one row (Feed · Info); the room fills down to the cyan line');
const petRoom = readFileSync('src/play/pet-room.tsx', 'utf8');
assert.match(petRoom, /<\/Animated\.View>\s*\{rails\}/, 'the rails float over the stage, outside the camera layer');
assert.match(petRoom, /bounds: walkBoundsRef\.current/, 'the walk planner gets the rail bounds');
assert.match(petRoom, /RAIL_CLEAR_PT/, 'the speech bubble is clamped clear of the rails');
ok('Hideout screen: row removed, dock = Feed · Info (64), rails float over the stage, walk + speech clear of both rails');

const railsSrc = readFileSync('src/play/hideout-rails.tsx', 'utf8');
assert.match(railsSrc, /if \(a\.dim\) \{\s*if \(a\.kind === 'view'\) onTease\(\);\s*return;\s*\}/, 'a dimmed action never runs (a locked way out opens the build sheet)');
assert.match(railsSrc, /r\.locked \? onTease\(\) : onView\(r\.id\)/, 'a locked room on the right rail opens its build sheet (the tease sign sits under the rail)');
assert.ok(!/<Pressable/.test(readFileSync('src/play/hideout-stage.tsx', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')), 'no tap area left in the room (the lamp is the Light button)');
assert.match(readFileSync('src/play/pet-room.tsx', 'utf8'), /paddingHorizontal: RAIL_CLEAR_PT/, 'the egg picker is inset clear of the rails');
ok('dimmed = inert; locked rooms open the build sheet; the lamp has no tap area; egg picker clear of the rails');

// --- the rails: accessible, press effect on the button, gentle pulse -----------------------------
const rails = readFileSync('src/play/hideout-rails.tsx', 'utf8');
assert.ok(/accessibilityRole=\{role\}/.test(rails) && /accessibilityLabel=\{a11yLabel\}/.test(rails), 'every rail button has a role and a label');
assert.match(rails, /accessibilityState=\{role === 'tab' \? \{ selected \} : \{ disabled: dim \}\}/, 'the selected room is marked selected; dimmed actions disabled');
assert.match(rails, /role="tab"/, 'room buttons are tabs');
assert.match(rails, /accessibilityRole="tablist"/, 'the room rail is a tablist');
assert.match(rails, /pressed && styles\.squash/, 'press effect is on the button itself');
assert.ok(!/glow|backgroundColor: PIXEL/.test(rails), 'no highlight fill behind a rail button');
assert.match(rails, /ReduceMotion\.Never/, 'the pulse keeps breathing under Reduce Motion');
assert.match(rails, /const low = gentle \? 0\.6 : 0\.35;/, 'a gentle breathe under Reduce Motion');
assert.match(rails, /tipAnchorRef\('hatch'\)/, 'the Underground button carries the coach tip anchor');
ok('rails: roles + labels, selected room marked, press effect on the button only, gentle coach pulse, tip anchor');

console.log(`\ncheck:hideout-rails — ${passed} groups passed.`);
