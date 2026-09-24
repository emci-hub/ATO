/**
 * check:sheet-sprite — the check that would have caught the corner bug.
 *
 * A packed sprite used to be drawn as a nested `<Svg x={} y={}>`. react-native-svg
 * renders a nested `<Svg>` as a NATIVE VIEW positioned by React Native's layout
 * system: its `render()` reads `width`/`height` into a style and never applies
 * `x`/`y` (node_modules/react-native-svg/src/elements/Svg.tsx). So every packed
 * sprite drew at the board's ORIGIN — bound heroes piled into the top-left
 * corner instead of landing on their pad.
 *
 * Nothing caught it: typecheck, lint and all 85 offline checks passed, and the
 * dev Sheet Lab (the screen built to prove the crop) draws every sprite at
 * x=0, y=0 — the one position where "ignores x/y" and "honours x/y" render
 * identically. Hence this file: assert placement at a NON-ZERO position, with
 * real packed frames, and refuse the broken shape structurally.
 *
 * Run: npx tsx scripts/check-sheet-sprite.ts
 */
import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

import { sheetSpritePlacement } from '../src/play/sheet-sprite-math';

const repoRoot = path.resolve(__dirname, '..');
let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

/* ------------------------------------------------ 1 — placement maths --- */

// A real packed frame: archangel's Hover_Idle, an east frame partway along the
// sheet, so a dropped `rect.x` shows up as a wrong offset rather than a no-op.
const sheets = JSON.parse(
  fs.readFileSync(
    path.join(repoRoot, 'assets/play/sheets/cast/heroes/archangel/sheets.json'),
    'utf8',
  ),
) as Record<string, { sheetW: number; sheetH: number; frames: Record<string, { x: number; y: number; w: number; h: number }> }>;

const idle = sheets['sheets/cast/heroes/archangel/Hover_Idle'];
assert.ok(idle, 'archangel Hover_Idle is packed');
const rect = idle.frames['east/frame_003'];
assert.ok(rect, 'Hover_Idle has an east/frame_003');
assert.ok(rect.x > 0, 'the sample frame is NOT at sheet origin (x > 0) — a frame at x=0 cannot catch a dropped offset');

// Place it somewhere that is emphatically not the origin.
const BOX_X = 37.5;
const BOX_Y = 61.25;
const BOX_SIZE = 24;

const place = sheetSpritePlacement(rect, BOX_X, BOX_Y, BOX_SIZE);

assert.match(
  place.transform,
  /^translate\(/,
  'placement must TRANSLATE the group — this is the whole bug: a nested <Svg x y> does not move',
);
// Assert the WHOLE transform, values and all. An earlier version of this
// check only asserted that the string contained "scale(" — which a wrong
// factor like `scale(24)` would have sailed through, leaving the sprite the
// right shape in the wrong size. Pin the exact numbers instead.
const expectedScaleX = BOX_SIZE / rect.w;
const expectedScaleY = BOX_SIZE / rect.h;
assert.equal(
  place.transform,
  `translate(${BOX_X}, ${BOX_Y}) scale(${expectedScaleX}, ${expectedScaleY})`,
  `transform must translate to the box origin AND scale frame pixels to board units, got "${place.transform}"`,
);
ok(
  `placed off-origin: translate(${BOX_X}, ${BOX_Y}) scale(${expectedScaleX}, ${expectedScaleY}) — not the board origin`,
);

// One frame pixel must become exactly one box unit on both axes, so the frame
// fills its size×size box — the scale half of the maths, pinned numerically.
assert.equal(rect.w * expectedScaleX, BOX_SIZE, 'frame width scales to exactly the box width');
assert.equal(rect.h * expectedScaleY, BOX_SIZE, 'frame height scales to exactly the box height');
ok(`the frame fills its box exactly (${BOX_SIZE}u), no crop and no overflow`);

// The sheet offset must cancel the frame's position inside the sheet, so the
// wanted frame — not its neighbour — sits at the group origin.
assert.equal(place.imageX, -rect.x, 'sheet is offset by -rect.x so the frame lands on the origin');
assert.equal(place.imageY, -rect.y, 'sheet is offset by -rect.y so the frame lands on the origin');
assert.deepEqual(
  place.clip,
  { x: 0, y: 0, width: rect.w, height: rect.h },
  'clip is exactly the frame rect at the group origin — neighbours stay hidden',
);
ok('the sheet is offset and clipped to the wanted frame, not its neighbour');

// Two different frames of the same sheet must resolve to DIFFERENT offsets —
// catches a crop that silently always shows frame 0.
const other = idle.frames['east/frame_000'];
assert.ok(other, 'Hover_Idle has an east/frame_000');
const placeOther = sheetSpritePlacement(other, BOX_X, BOX_Y, BOX_SIZE);
assert.notEqual(
  place.imageX,
  placeOther.imageX,
  'two different frames must crop to different sheet offsets (a frozen crop would show frame 0 forever)',
);
ok('different frames of one sheet crop to different offsets');

/* ------------------------------------- 2 — the broken shape stays gone --- */

const spriteSrc = fs.readFileSync(path.join(repoRoot, 'src/play/sheet-sprite.tsx'), 'utf8');
// Comments legitimately NAME the broken shape (the file documents why it must
// never come back), so assert against code only.
const spriteCode = spriteSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

assert.doesNotMatch(
  spriteCode,
  /<Svg\b/,
  'sheet-sprite.tsx must not render a nested <Svg>: react-native-svg lays it out as a native view and IGNORES x/y, which drew every packed sprite at the board origin',
);
ok('sheet-sprite.tsx renders no nested <Svg> (the shape that ignored x/y)');

assert.match(
  spriteCode,
  /sheetSpritePlacement\(/,
  'SheetSprite must place through sheetSpritePlacement, so this check tests the real path',
);
ok('SheetSprite places through the maths this check asserts');

console.log(`\nAll ${passed} sheet-sprite checks passed.`);
