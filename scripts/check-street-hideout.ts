/**
 * Streetwear Hideout + Underground (3/4 top-down room, A* roam, Motion v2).
 * Run: npm run check:street-hideout
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import {
  HIDEOUT_AURA_PAD_PX,
  HIDEOUT_CANVAS,
  HIDEOUT_CONTENT,
  HIDEOUT_DECALS,
  HIDEOUT_DOOR_TILES,
  HIDEOUT_FLOOR,
  HIDEOUT_FLOOR_COLS,
  HIDEOUT_FLOOR_ROWS,
  HIDEOUT_GEOM,
  HIDEOUT_GRID_COLS,
  HIDEOUT_GRID_ROWS,
  HIDEOUT_HERO_FIGURE_PX,
  HIDEOUT_HERO_RENDER_SCALE,
  HIDEOUT_HERO_SRC_PX,
  HIDEOUT_PET_ART_PX,
  HIDEOUT_PHONE_WIDTHS_PT,
  HIDEOUT_SPOTS,
  HIDEOUT_SPOT_HIT_PT,
  HIDEOUT_STAGE_SCALE,
  HIDEOUT_TARGETS,
  HIDEOUT_TILE,
  HIDEOUT_WALK_ART_PX_PER_SEC,
  assertRoomReachable,
  clampToWalk,
  hideoutArtToScreen,
  hideoutClearancePx,
  hideoutFeetInFloorScreen,
  hideoutHeroArtPx,
  hideoutIntegerScale,
  hideoutPetBox,
  hideoutPhoneLayout,
  hideoutStageOrigin,
  hideoutTargetPoint,
  hideoutWalkMs,
  onWalkFloor,
  planHideoutStep,
  pointInPoly,
  randomWalkPoint,
} from '../src/play/hideout-iso';
import { diveWorldCuts } from '../src/play/dive-fx-model';

let passed = 0;
const ok = (name: string) => {
  passed += 1;
  console.log(`  ✓ ${name}`);
};
const read = (path: string) => readFileSync(path, 'utf8');

{
  assert.deepEqual([...HIDEOUT_CANVAS], [264, 576]);
  assert.deepEqual([...HIDEOUT_CONTENT], [0, 0, 264, 576]);
  assert.equal(HIDEOUT_TILE, 12);
  assert.equal(HIDEOUT_GRID_COLS, 22);
  assert.equal(HIDEOUT_GRID_ROWS, 48);
  assert.equal(HIDEOUT_FLOOR_COLS, 20);
  assert.equal(HIDEOUT_FLOOR_ROWS, 36);
  assert.equal(HIDEOUT_DOOR_TILES, 4);
  assert.equal(HIDEOUT_GEOM.grid.cols, 22);
  assert.equal(HIDEOUT_GEOM.grid.rows, 48);
  assert.equal(HIDEOUT_GEOM.tile, 12);
  assert.equal(HIDEOUT_HERO_SRC_PX, 192);
  assert.equal(HIDEOUT_HERO_RENDER_SCALE, 1 / 2);
  assert.equal(HIDEOUT_PET_ART_PX, 96);
  assert.equal(HIDEOUT_HERO_FIGURE_PX, 53);
  assert.equal(hideoutHeroArtPx('egg'), 64);
  assert.equal(hideoutHeroArtPx('baby'), 64);
  assert.equal(hideoutHeroArtPx('child'), Math.round(192 * 0.37));
  assert.equal(hideoutHeroArtPx('teen'), Math.round(192 * 0.42));
  assert.equal(hideoutHeroArtPx('adult'), Math.round(192 * 0.46));
  assert.equal(hideoutHeroArtPx('god'), HIDEOUT_PET_ART_PX);
  assert.ok(hideoutHeroArtPx('baby') < hideoutHeroArtPx('child'));
  assert.ok(hideoutHeroArtPx('child') < hideoutHeroArtPx('teen'));
  assert.ok(hideoutHeroArtPx('teen') < hideoutHeroArtPx('adult'));
  assert.ok(hideoutHeroArtPx('adult') < hideoutHeroArtPx('god'));
  assert.ok(hideoutClearancePx('baby') < hideoutClearancePx('god'), 'clearance follows stage footprint');
  assert.equal(HIDEOUT_STAGE_SCALE.egg, 1 / 3);
  assert.equal(HIDEOUT_STAGE_SCALE.god, 1 / 2);
  assert.equal(HIDEOUT_STAGE_SCALE.child, 0.37);
  assert.equal(HIDEOUT_STAGE_SCALE.teen, 0.42);
  assert.equal(HIDEOUT_STAGE_SCALE.adult, 0.46);
  const reachable = assertRoomReachable(HIDEOUT_GEOM, 'god');
  assert.equal(reachable.ok, true, reachable.ok ? '' : reachable.reason);
  assert.ok(HIDEOUT_GEOM.props.some((p) => p.occluder && p.crop[2] > 0 && p.sortY > 0), 'occluders have crop + sortY');
  assert.equal(HIDEOUT_SPOT_HIT_PT, 48);
  assert.ok(HIDEOUT_SPOT_HIT_PT >= 44, 'HIG 44pt floor');
  assert.ok(HIDEOUT_SPOTS.some((s) => s.id === 'manhole'));
  assert.ok(onWalkFloor(...hideoutTargetPoint('bowl')));
  assert.ok(onWalkFloor(...hideoutTargetPoint('cushion')));
  assert.ok(onWalkFloor(...hideoutTargetPoint('door')));
  assert.ok(onWalkFloor(...hideoutTargetPoint('chair')));
  assert.ok(onWalkFloor(...hideoutTargetPoint('boombox')));
  const mid = clampToWalk(132, 360);
  assert.ok(onWalkFloor(mid[0], mid[1]));
  const at440 = hideoutIntegerScale({ availW: 440, availH: 1000, pixelRatio: 3 });
  assert.ok(Math.abs(at440.canvasW - 440) < 0.5, `440pt fills width (got ${at440.canvasW})`);
  assert.ok(Math.abs(at440.dpx - 5) < 1e-6, `440pt @ 3x is 5 dpx (got ${at440.dpx})`);
  const at430 = hideoutIntegerScale({ availW: 430, availH: 1000, pixelRatio: 3 });
  assert.ok(Math.abs(at430.canvasW - 430) < 0.5, `430pt fills width (got ${at430.canvasW})`);
  const a = hideoutWalkMs(40, 0, 1);
  const b = hideoutWalkMs(80, 0, 1);
  assert.ok(Math.abs(b / a - 2) < 0.15, 'walk duration scales with distance (constant speed)');
  assert.ok(HIDEOUT_WALK_ART_PX_PER_SEC >= 16);
  ok('3/4 map: 264×576, 430+440pt fit, hero scale config, walk targets');
}

{
  const kit = { idle: 4, walk: 4, attack: 4, skill: 4 };
  let seed = 7;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  const cells = new Set<string>();
  const acts = new Set<string>();
  let x = HIDEOUT_TARGETS.cushion[0];
  let y = HIDEOUT_TARGETS.cushion[1];
  for (const stage of ['baby', 'child', 'teen', 'adult', 'god'] as const) {
    for (const branch of ['standard', 'bright', 'battle', 'scruffy', 'deep'] as const) {
      const step = planHideoutStep({ kit, mood: 'happy', branch, stage, x, y, rng });
      acts.add(step.act);
      cells.add(`${Math.round(step.toX / 12)}:${Math.round(step.toY / 12)}`);
      x = step.toX;
      y = step.toY;
    }
  }
  const hungry = planHideoutStep({
    kit,
    mood: 'hungry',
    branch: 'standard',
    stage: 'teen',
    x: hideoutTargetPoint('door')[0],
    y: hideoutTargetPoint('door')[1],
    rng: () => 0.1,
    hungry: true,
  });
  const bowl = hideoutTargetPoint('bowl');
  assert.ok(Math.hypot(hungry.toX - bowl[0], hungry.toY - bowl[1]) < 14, 'hungry pet walks to the bowl');
  assert.ok(cells.size >= 4, `roam visits the floor (cells=${cells.size})`);
  assert.ok(acts.has('wander') || acts.has('idle'), 'planner walks or idles');
  const samples = [0.12, 0.28, 0.44, 0.61, 0.83].map((t, i) =>
    randomWalkPoint(() => (t + i * 0.07) % 1),
  );
  const span = Math.max(
    ...samples.map((p, i) =>
      Math.max(...samples.slice(i + 1).map((q) => Math.hypot(p[0] - q[0], p[1] - q[1]))),
    ),
    0,
  );
  assert.ok(samples.every((p) => onWalkFloor(p[0], p[1])), 'random points sit on the floor');
  assert.ok(span > 16, `random walk points spread across the polygon (span=${span.toFixed(1)})`);
  ok('2D roam: every stage/form, bowl target, spread points');
}

{
  const motion = read('src/play/play-motion.ts');
  assert.match(motion, /vestibularSafe: osReduce \|\| mode !== 'full'/);
  assert.match(motion, /cosmeticsStill: mode === 'off'/);
  const cutsRm = diveWorldCuts('full', true, false);
  assert.equal(cutsRm.motion, true);
  assert.equal(cutsRm.parallax, false);
  const cutsOff = diveWorldCuts('full', true, true);
  assert.equal(cutsOff.motion, false);
  ok('Motion v2: OS RM / Reduced keep walk+life; Off freezes cosmetics');
}

{
  const room = read('src/play/pet-room.tsx');
  assert.match(room, /planHideoutStep/);
  assert.match(room, /walkOn/);
  assert.match(room, /cosmeticsStill/);
  assert.match(room, /hideoutHeroArtPx\(pet\.stage\)/);
  assert.match(room, /hideoutPetBox\(/);
  assert.match(room, /top: isoOn \? 0 : top/);
  assert.match(room, /ox \+ artX\.value \* isoPt - box \/ 2/);
  assert.match(room, /oy \+ artY\.value \* isoPt - footAt \* box/);
  assert.match(room, /StreetRoomAuraClip/);
  assert.match(room, /StreetRoomYard/);
  assert.match(room, /hideoutFace/);
  assert.match(room, /ReduceMotion\.Never/);
  assert.match(room, /reduceMotion: ReduceMotion\.Never/);
  assert.doesNotMatch(room, /if \(reduceMotion\) step = \{ \.\.\.step, act: step\.act === 'sleep'/);
  const street = read('src/play/street-room.tsx');
  assert.match(street, /StreetRoomArt/);
  assert.match(street, /occludeDayA/);
  assert.match(street, /crop/);
  assert.match(street, /PIXEL_FONT\.label/);
  assert.match(street, /StreetRoomAuraClip/);
  assert.match(street, /StreetRoomYard/);
  assert.match(street, /hideoutBricks/);
  assert.match(street, /HIDEOUT_SPOT_HIT_PT/);
  assert.match(street, /PIXEL\.cyan/);
  assert.match(street, /chipFaded/);
  assert.match(street, /fillRule="evenodd"/);
  const dive = read('src/play/dive-street.tsx');
  assert.match(dive, /ManholeTransit/);
  assert.match(dive, /KEEP_TRAVEL_PT/);
  assert.match(read('src/play/pet-screen.tsx'), /ManholeTransit/);
  assert.match(read('src/play/dive-screen.tsx'), /ManholeTransit/);
  assert.match(read('src/play/divecore-settings.tsx'), /Motion: Full \/ Reduced \/ Off/);
  ok('wired: 3/4 room art, ART-PX pet scale, 2D walk, manhole transit, Motion labels');
}

{
  const art = [
    'assets/play/rooms/hideout-td.map.json',
    'assets/play/rooms/hideout-td-back.png',
    'assets/play/rooms/hideout-td-floor.png',
    'assets/play/rooms/hideout-td-props.png',
    'assets/play/rooms/hideout-td-occlude-day-a.png',
    'assets/play/rooms/hideout-td-occlude-day-b.png',
    'assets/play/rooms/hideout-td-occlude-night-a.png',
    'assets/play/rooms/hideout-td-occlude-night-b.png',
    'assets/play/rooms/hideout-td-neon-a.png',
    'assets/play/rooms/hideout-td-neon-b.png',
    'assets/play/skins/streetwear/fx/hideout/blaze-84-behind.png',
    'assets/play/skins/streetwear/fx/hideout/bubbles-outlined-behind.png',
    'assets/play/skins/streetwear/fx/hideout/sheets.json',
  ];
  for (const f of art) assert.ok(existsSync(f), f);
  assert.ok(HIDEOUT_AURA_PAD_PX >= 8);
  assert.ok(pointInPoly(100, 100, [
    [0, 0],
    [200, 0],
    [200, 200],
    [0, 200],
  ]));
  assert.ok(!pointInPoly(-4, 100, [
    [0, 0],
    [200, 0],
    [200, 200],
    [0, 200],
  ]));
  ok('delivered 3/4 room + hideout FX art is present');
}

{
  assert.equal(HIDEOUT_PET_ART_PX, 96);
  assert.deepEqual([...HIDEOUT_PHONE_WIDTHS_PT], [430, 440]);
  for (const id of ['manhole'] as const) {
    const d = HIDEOUT_DECALS.find((x) => x.id === id);
    assert.ok(d && d.size[0] >= 8 && d.size[1] >= 6, `${id} decal has a draw size`);
  }
  const samples: { id: string; x: number; y: number }[] = [];
  for (const id of ['bowl', 'cushion', 'chair', 'door', 'boombox'] as const) {
    const p = hideoutTargetPoint(id);
    samples.push({ id, x: p[0], y: p[1] });
  }
  samples.push({ id: 'start-cushion', x: HIDEOUT_TARGETS.cushion[0], y: HIDEOUT_TARGETS.cushion[1] });
  const rngPts = [0.12, 0.28, 0.44, 0.61, 0.83].map((t, i) => randomWalkPoint(() => (t + i * 0.07) % 1));
  rngPts.forEach((p, i) => samples.push({ id: `rand-${i}`, x: p[0], y: p[1] }));

  for (const width of HIDEOUT_PHONE_WIDTHS_PT) {
    for (const pr of [2, 3]) {
      const { scale, origin } = hideoutPhoneLayout(width, pr);
      assert.ok(Math.abs(scale.canvasW - width) < 0.5, `${width}pt fills width (got ${scale.canvasW})`);
      if (width === 440 && pr === 3) assert.ok(Math.abs(scale.dpx - 5) < 1e-6, '440pt @ 3x is 5 dpx');
      const placed = hideoutStageOrigin(width, Math.ceil((576 * width) / 264), scale);
      assert.equal(placed.left, origin.left);
      const expectLeft = Math.round((width - scale.contentW) / 2 - HIDEOUT_CONTENT[0] * scale.pt);
      assert.equal(origin.left, expectLeft, `content-centered origin at ${width}@${pr}x`);
      const box = hideoutPetBox(HIDEOUT_PET_ART_PX, scale, pr);
      assert.ok(Math.abs(box - HIDEOUT_PET_ART_PX * scale.pt) < 1e-6, `god pet box is 96 art px at ${width}@${pr}x`);
      const baby = hideoutPetBox(hideoutHeroArtPx('baby'), scale, pr);
      assert.ok(baby < box, 'baby cell is smaller than god in the same room');
      const floorS = HIDEOUT_FLOOR.map((p) => {
        const s = hideoutArtToScreen(p[0], p[1], origin, scale);
        return [s.x, s.y] as const;
      });
      for (const s of samples) {
        assert.ok(
          hideoutFeetInFloorScreen(s.x, s.y, origin, scale),
          `feet (${s.id}=${s.x.toFixed(1)},${s.y.toFixed(1)}) inside floor in screen space at ${width}pt/${pr}x`,
        );
        const feet = hideoutArtToScreen(s.x, s.y, origin, scale);
        assert.ok(
          pointInPoly(feet.x, feet.y, floorS),
          `screen feet for ${s.id} in transformed polygon at ${width}pt`,
        );
      }
    }
  }
  ok('screen-space feet sit inside the floor polygon at 430/440pt');
}

{
  const street = read('src/play/street-room.tsx');
  assert.match(street, /minWidth: hit/);
  assert.match(street, /minHeight: hit/);
  assert.match(street, /HIDEOUT_SPOT_HIT_PT/);
  assert.equal(HIDEOUT_SPOT_HIT_PT, 48);
  ok('hotspot chips are 48pt hit targets with a cyan frame');
}

console.log(`\ncheck:street-hideout — ${passed} groups passed.`);
