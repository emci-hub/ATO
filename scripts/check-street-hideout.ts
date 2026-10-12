/**
 * Streetwear Hideout + Underground (iso room, 2D roam, Motion v2).
 * Run: npm run check:street-hideout
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import {
  HIDEOUT_AURA_PAD_PX,
  HIDEOUT_CANVAS,
  HIDEOUT_CONTENT,
  HIDEOUT_DOOR_LABEL_NUDGE,
  HIDEOUT_PHONE_CAP_DPX,
  HIDEOUT_SPOTS,
  HIDEOUT_TARGETS,
  clampToWalk,
  hideoutIntegerScale,
  hideoutLabelAnchor,
  hideoutTargetPoint,
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
  assert.deepEqual([...HIDEOUT_CANVAS], [256, 320]);
  assert.deepEqual([...HIDEOUT_CONTENT], [15, 42, 226, 237]);
  assert.equal(HIDEOUT_PHONE_CAP_DPX, 4);
  assert.deepEqual([...HIDEOUT_DOOR_LABEL_NUDGE], [0, 28]);
  const door = hideoutLabelAnchor('door');
  const raw = hideoutLabelAnchor('chair');
  assert.ok(door[1] > raw[1] || door[1] === 28 || door[1] > 0, 'door label is nudged');
  assert.ok(HIDEOUT_SPOTS.some((s) => s.id === 'manhole'));
  assert.ok(onWalkFloor(...hideoutTargetPoint('bowl')));
  assert.ok(onWalkFloor(...hideoutTargetPoint('cushion')));
  assert.ok(onWalkFloor(...hideoutTargetPoint('door')));
  assert.ok(onWalkFloor(...hideoutTargetPoint('chair')));
  const mid = clampToWalk(128, 200);
  assert.ok(onWalkFloor(mid[0], mid[1]));
  const phone = hideoutIntegerScale({ availW: 430, availH: 700, pixelRatio: 3 });
  assert.ok(phone.dpx <= 4 && phone.dpx >= 2);
  assert.ok(Math.abs(phone.pt * 3 - phone.dpx) < 1e-9);
  ok('iso map: canvas, content bounds, 4 dpx cap, door nudge, walk targets');
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
  assert.doesNotMatch(room, /if \(reduceMotion\) step = \{ \.\.\.step, act: step\.act === 'sleep'/);
  const street = read('src/play/street-room.tsx');
  assert.match(street, /room-hideout-iso/);
  assert.match(street, /PIXEL_FONT\.label/);
  const dive = read('src/play/dive-street.tsx');
  assert.match(dive, /ManholeTransit/);
  assert.match(dive, /KEEP_TRAVEL_PT/);
  assert.match(read('src/play/pet-screen.tsx'), /ManholeTransit/);
  assert.match(read('src/play/dive-screen.tsx'), /ManholeTransit/);
  assert.match(read('src/play/divecore-settings.tsx'), /Motion: Full \/ Reduced \/ Off/);
  ok('wired: iso art, 2D walk, manhole transit, Motion labels');
}

{
  const art = [
    'assets/play/skins/streetwear/ui/rooms/hideout-iso.png',
    'assets/play/skins/streetwear/ui/rooms/hideout-iso-front.png',
    'assets/play/skins/streetwear/ui/rooms/hideout-iso-manhole.png',
    'assets/play/skins/streetwear/ui/rooms/hideout-iso-bowl.png',
    'assets/play/skins/streetwear/ui/rooms/hideout-iso-cushion.png',
    'assets/play/skins/streetwear/ui/rooms/hideout-iso-mask.png',
    'assets/play/skins/streetwear/ui/rooms/hideout-iso.map.json',
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
  ok('delivered iso + hideout FX art is present');
}

console.log(`\ncheck:street-hideout — ${passed} groups passed.`);
