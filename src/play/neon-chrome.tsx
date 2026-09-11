/**
 * Neon Viper board chrome — the default procedural board paint for Defend
 * (Trial + Main). Pure code/SVG, no PNGs, no SVG filters (Android-safe):
 *
 *  - walls: `#152138` field + a diagonal hatch (one shared path, no `<Pattern>`)
 *  - path: `#0C2736` fill + thin cyan border per tile (crisp 16×16 mosaic)
 *  - start: `#11243B` + thin pink border (the spawn cell)
 *  - pads: 2×2-tile footprint, FOUR thin pink L-brackets only (no fat fill,
 *    no glow) + a Space Mono cyan P-label at the top-left
 *  - soft cyan shadow behind the path — approximated with two translucent
 *    halo layers (NOT a second wide stroke; SVG filters aren't on Android)
 *  - outer map frame: thin cyan border + a faint cyan shadow
 *  - ATO ghost painted under the path on the `ato` board only (the letter-maze
 *    already spells ATO, so its ghost is skipped)
 *
 * Rendered as the FIRST block of the gameplay `<Svg>` (see `defend-screen`), so
 * it sits UNDER every gameplay layer. It never owns a tap. Geometry is painted
 * from the active board's 16×16 tile grid (`map.grid` in `board-data.ts`), NOT
 * from a stroked polyline.
 *
 * The Craftpix field tiles + cobble road remain the `grove-classic` board skin
 * (`BOARD_SKIN` in `skin.ts`).
 */
import { memo, useMemo } from 'react';
import { G, Path, Rect, Text as SvgText } from 'react-native-svg';

import { Fonts } from '@/constants/theme';
import { ATO_GHOST_D } from '@/play/board-decor';
import { DIVECORE_CELL, DIVECORE_COLS, DIVECORE_ROWS, TILE } from '@/play/board-data';
import type { BoardMap } from '@/play/board-data';

/** Neon Viper board palette (from `games/grove/ref/neon-viper-hub` tokens). */
export const NEON_BOARD = {
  ink: '#05070D',
  wall: '#152138',
  /** Diagonal hatch, drawn over the wall field (subtle, crisp). */
  wallHatch: 'rgba(0, 234, 255, 0.07)',
  corridor: '#0C2736',
  /** 1px cyan border on each path tile. */
  corridorBorder: 'rgba(0, 234, 255, 0.55)',
  /** Start / spawn cell fill (tilePlayer). */
  start: '#11243B',
  startBorder: '#FF23C9',
  /** Soft cyan shadow layers behind the path (falloff is faked, not filtered). */
  haloInner: 'rgba(0, 234, 255, 0.14)',
  haloOuter: 'rgba(0, 234, 255, 0.08)',
  pad: '#FF23C9',
  padLabel: '#00EAFF',
  frameBorder: 'rgba(0, 234, 255, 0.55)',
  frameGlow: 'rgba(0, 234, 255, 0.10)',
  grid: 'rgba(0, 234, 255, 0.15)',
} as const;

const CELL = DIVECORE_CELL; // 6.25 board units
/** Path tile border width (≈1px on a ~350px board). */
const PATH_BORDER = 0.45;
/** Hatch line width. */
const HATCH_W = 0.3;
/** Outer frame border width. */
const FRAME_W = 0.6;
/** Pad bracket stroke (thin). */
const PAD_W = 0.7;
/** Pad footprint is 2×2 tiles → half = one tile. */
const PAD_HALF = CELL;
/** L-bracket arm length, board units. */
const PAD_ARM = 2.5;

/** Faint cyan grid — DEBUG ONLY, OFF by default (and off in Trial). */
export const NEON_BOARD_GRID = false;

/* -------------------------------------------------------- cell path builders --- */

type Grid = readonly (readonly number[])[];

/** One subpath rect `d` for a tile, optionally expanded by `e` units. */
function cellRectD(x: number, y: number, e = 0): string {
  const w = CELL + e * 2;
  return `M ${x - e} ${y - e} h ${w} v ${w} h ${-w} Z`;
}

/** All cells of `kind` as ONE fill path (union — no internal wall seams). */
function buildCellsD(grid: Grid, kind: number, expand = 0): string {
  const parts: string[] = [];
  for (let row = 0; row < DIVECORE_ROWS; row += 1) {
    for (let col = 0; col < DIVECORE_COLS; col += 1) {
      if (grid[row]![col] !== kind) continue;
      parts.push(cellRectD(col * CELL, row * CELL, expand));
    }
  }
  return parts.join(' ');
}

/** Wall diagonal hatch as ONE stroke path (no `<Pattern>` — Android-safe). */
function buildWallHatchD(grid: Grid): string {
  const parts: string[] = [];
  for (let row = 0; row < DIVECORE_ROWS; row += 1) {
    for (let col = 0; col < DIVECORE_COLS; col += 1) {
      if (grid[row]![col] !== TILE.WALL) continue;
      const x = col * CELL;
      const y = row * CELL;
      parts.push(`M ${x} ${y + CELL} L ${x + CELL} ${y}`);
    }
  }
  return parts.join(' ');
}

/** The (single) start cell's top-left corner, or (0,0) when none. */
function findStartCell(grid: Grid): { x: number; y: number } {
  for (let row = 0; row < DIVECORE_ROWS; row += 1) {
    for (let col = 0; col < DIVECORE_COLS; col += 1) {
      if (grid[row]![col] === TILE.START) {
        return { x: col * CELL, y: row * CELL };
      }
    }
  }
  return { x: 0, y: 0 };
}

/** Four thin L-brackets around a 2×2 pad footprint centred on `(cx, cy)`. */
function padBracketD(cx: number, cy: number): string {
  const h = PAD_HALF;
  const a = PAD_ARM;
  const corners: [number, number, number, number][] = [
    [cx - h, cy - h, 1, 1], // top-left
    [cx + h, cy - h, -1, 1], // top-right
    [cx - h, cy + h, 1, -1], // bottom-left
    [cx + h, cy + h, -1, -1], // bottom-right
  ];
  return corners
    .map(
      ([x, y, sx, sy]) =>
        `M ${x} ${y} L ${x + sx * a} ${y} M ${x} ${y} L ${x} ${y + sy * a}`,
    )
    .join(' ');
}

type Props = {
  map: BoardMap;
  /** ATO ghost fill (the screen's accent colour). */
  ghostColor: string;
};

/**
 * The whole neon chrome block, in paint order:
 * void → frame → walls (+hatch) → grid → (ATO ghost on `ato`) → path (+halo)
 * → start → pad brackets + labels.
 */
export const NeonBoardChrome = memo(function NeonBoardChrome({ map, ghostColor }: Props) {
  const grid = map.grid;
  const wallD = useMemo(() => buildCellsD(grid, TILE.WALL), [grid]);
  const hatchD = useMemo(() => buildWallHatchD(grid), [grid]);
  const pathD = useMemo(() => buildCellsD(grid, TILE.PATH), [grid]);
  const haloInnerD = useMemo(() => buildCellsD(grid, TILE.PATH, 1.3), [grid]);
  const haloOuterD = useMemo(() => buildCellsD(grid, TILE.PATH, 2.9), [grid]);
  const start = useMemo(() => findStartCell(grid), [grid]);
  const showGhost = map.id === 'ato';

  return (
    <G>
      {/* Void base + outer map frame (thin cyan border + faint shadow). */}
      <Rect x={0} y={0} width={100} height={100} fill={NEON_BOARD.ink} />
      <Rect
        x={0.3}
        y={0.3}
        width={99.4}
        height={99.4}
        fill="none"
        stroke={NEON_BOARD.frameGlow}
        strokeWidth={2.4}
      />
      <Rect
        x={0.3}
        y={0.3}
        width={99.4}
        height={99.4}
        fill="none"
        stroke={NEON_BOARD.frameBorder}
        strokeWidth={FRAME_W}
      />

      {/* Walls: solid field + diagonal hatch. */}
      <Path d={wallD} fill={NEON_BOARD.wall} />
      <Path d={hatchD} fill="none" stroke={NEON_BOARD.wallHatch} strokeWidth={HATCH_W} />

      {NEON_BOARD_GRID ? (
        <G stroke={NEON_BOARD.grid} strokeWidth={0.25}>
          {Array.from({ length: DIVECORE_COLS - 1 }, (_, i) => {
            const p = ((i + 1) * 100) / DIVECORE_COLS;
            return (
              <G key={`grid-${i}`}>
                <Path d={`M ${p} 0 L ${p} 100`} />
                <Path d={`M 0 ${p} L 100 ${p}`} />
              </G>
            );
          })}
        </G>
      ) : null}

      {/* ATO ghost — under the road so the mark reads through the path.
       * Skipped on the letter-maze (it already spells ATO). */}
      {showGhost ? <Path d={ATO_GHOST_D} fill={ghostColor} fillOpacity={0.07} /> : null}

      {/* Path: soft cyan shadow (two halos) → fill + 1px cyan border. */}
      <Path d={haloOuterD} fill={NEON_BOARD.haloOuter} />
      <Path d={haloInnerD} fill={NEON_BOARD.haloInner} />
      <Path
        d={pathD}
        fill={NEON_BOARD.corridor}
        stroke={NEON_BOARD.corridorBorder}
        strokeWidth={PATH_BORDER}
      />

      {/* Start cell (spawn): dark fill + thin pink border. */}
      <Rect
        x={start.x}
        y={start.y}
        width={CELL}
        height={CELL}
        fill={NEON_BOARD.start}
        stroke={NEON_BOARD.startBorder}
        strokeWidth={0.5}
      />

      {/* Pads: FOUR thin pink L-brackets (no fill, no glow) + cyan P-label. */}
      <G
        fill="none"
        stroke={NEON_BOARD.pad}
        strokeWidth={PAD_W}
        strokeLinecap="square"
        strokeLinejoin="miter">
        {map.pads.map((pad, index) => (
          <Path key={`bracket-${index}`} d={padBracketD(pad.x, pad.y)} />
        ))}
      </G>
      {map.pads.map((pad, index) => (
        <SvgText
          key={`pad-label-${index}`}
          x={pad.x - PAD_HALF + 0.7}
          y={pad.y - PAD_HALF + 2.6}
          fontSize={2.6}
          fontFamily={Fonts.mono}
          fill={NEON_BOARD.padLabel}>
          {`P${index + 1}`}
        </SvgText>
      ))}
    </G>
  );
});
