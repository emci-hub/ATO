/**
 * Defend board registry — the geometry + tile-grid for every board, keyed by
 * `BoardId`. Two boards live here:
 *
 *  - `ato` (DEFAULT) — the LOCKED ATO board: the single walk polyline + 15
 *    tower pads from `games/grove/ref/ato-map/PATH_LOCKED.md`. Its 16×16 paint
 *    grid is rasterized from that polyline (walls hatch, road cells fill).
 *  - `neon-maze` (PARKED) — the letter-maze tile map copied verbatim from
 *    `games/grove/ref/neon-viper-hub/gameData.js` (`mapRows` / `buildPads`).
 *    Its walk path is ONE orthogonal route traced through the maze; the letter
 *    crossbars / the "O" loop are paint only, never walked.
 *
 * Cell values: 28 wall · 10 path · 1 start. 16×16, row 0 = top, col 0 = left.
 *
 * This is pure geometry/data — no engine, no combat numbers, no React.
 */

export const TILE = { WALL: 28, PATH: 10, START: 1 } as const;

export const DIVECORE_COLS = 16;
export const DIVECORE_ROWS = 16;
/** One tile edge, board units (0..100 viewBox). */
export const DIVECORE_CELL = 100 / DIVECORE_COLS; // 6.25

export const DIVECORE_MAP_ROWS: readonly (readonly number[])[] = [
  [28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [28, 28, 28, 28, 28, 28, 28, 28, 28, 10, 10, 10, 10, 10, 28, 28],
  [28, 10, 10, 10, 10, 10, 28, 28, 28, 10, 28, 10, 28, 10, 28, 28],
  [28, 10, 28, 28, 28, 10, 28, 10, 10, 10, 10, 10, 10, 10, 28, 28],
  [28, 10, 28, 28, 28, 10, 28, 10, 28, 28, 28, 28, 28, 10, 28, 28],
  [28, 10, 10, 10, 10, 10, 28, 10, 28, 28, 10, 10, 10, 10, 28, 28],
  [28, 10, 28, 28, 28, 10, 28, 10, 28, 28, 10, 28, 28, 28, 28, 28],
  [28, 10, 10, 10, 10, 10, 28, 10, 10, 28, 10, 10, 10, 10, 10, 28],
  [28, 10, 28, 28, 28, 10, 28, 28, 10, 28, 28, 10, 28, 28, 10, 28],
  [28, 10, 10, 28, 28, 10, 28, 28, 10, 28, 28, 10, 28, 28, 10, 28],
  [28, 28, 10, 28, 10, 10, 28, 28, 10, 28, 10, 10, 10, 10, 10, 28],
  [28, 28, 10, 28, 10, 28, 28, 28, 10, 28, 10, 28, 28, 28, 10, 28],
  [28, 10, 10, 28, 10, 10, 28, 28, 10, 28, 10, 28, 28, 28, 10, 28],
  [28, 10, 28, 28, 28, 10, 28, 28, 10, 28, 10, 10, 10, 10, 10, 28],
  [10, 10, 28, 28, 28, 10, 10, 10, 10, 28, 28, 28, 10, 28, 28, 28],
  [1, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 10, 28, 28, 28],
];

/** Tower build pads (col, row) — 6 slots, all on wall cells (off-road). */
export const DIVECORE_BUILD_PADS: readonly { id: number; col: number; row: number }[] = [
  { id: 1, col: 0, row: 0 },
  { id: 2, col: 13, row: 0 },
  { id: 3, col: 2, row: 3 },
  { id: 4, col: 8, row: 4 },
  { id: 5, col: 6, row: 8 },
  { id: 6, col: 12, row: 8 },
];

/** Center of tile `(row, col)` in 0..1 board fractions (path space). */
export function tileCenterFrac(row: number, col: number): { x: number; y: number } {
  return { x: (col + 0.5) / DIVECORE_COLS, y: (row + 0.5) / DIVECORE_ROWS };
}

/** Center of tile `(row, col)` in 0..100 board units (pad / sprite space). */
export function tileCenterUnits(row: number, col: number): { x: number; y: number } {
  return { x: (col + 0.5) * DIVECORE_CELL, y: (row + 0.5) * DIVECORE_CELL };
}

/**
 * The ONE walk route through the maze, as `[row, col]` tile centers in order:
 * spawn `(15,0)` → exit `(15,12)`. Traced orthogonally (each step shares a
 * row or column with the last) so the creeps walk crisp right-angle turns.
 *
 * It sweeps the letters in reading order — up the "A" left leg, across the
 * apex, down the right leg, along the bottom to the "T" stem, up the stem,
 * across the top bar, then down the "O" right side to the exit. The letter
 * crossbars and the "O" loop are left as paint-only branches.
 */
export const DIVECORE_WALK_CELLS: readonly (readonly [number, number])[] = [
  [15, 0], [14, 0], [14, 1], [13, 1], [12, 1], [12, 2], [11, 2], [10, 2], [9, 2], [9, 1],
  [8, 1], [7, 1], [6, 1], [5, 1], [4, 1], [3, 1], [2, 1], [2, 2], [2, 3], [2, 4],
  [2, 5], [3, 5], [4, 5], [5, 5], [6, 5], [7, 5], [8, 5], [9, 5], [10, 5], [10, 4],
  [11, 4], [12, 4], [12, 5], [13, 5], [14, 5], [14, 6], [14, 7], [14, 8], [13, 8], [12, 8],
  [11, 8], [10, 8], [9, 8], [8, 8], [7, 8], [6, 8], [5, 8], [4, 8], [3, 8], [3, 9],
  [3, 10], [3, 11], [3, 12], [3, 13], [4, 13], [5, 13], [5, 12], [5, 11], [5, 10], [6, 10],
  [7, 10], [7, 11], [7, 12], [7, 13], [7, 14], [8, 14], [9, 14], [10, 14], [11, 14], [12, 14],
  [13, 14], [13, 13], [13, 12], [14, 12], [15, 12],
];

/** The walk route as 0..1 waypoints (what `defend.ts` uses as `map.path`). */
export const DIVECORE_WALK_PATH = DIVECORE_WALK_CELLS.map(([row, col]) =>
  tileCenterFrac(row, col),
);

/** The build pads as 0..100 board-unit waypoints (what `defend.ts` pads use). */
export const DIVECORE_WALK_PADS = DIVECORE_BUILD_PADS.map((p) =>
  tileCenterUnits(p.row, p.col),
);

/**
 * SVG polyline `d` for a map's walk path in the 0..100 viewBox. Used by the
 * `grove-classic` skin to stroke the cobble road underlay along the walk line.
 * Structurally typed so it needs no import from `defend.ts`.
 */
export function boardPathD(
  map: { path: readonly { x: number; y: number }[] },
): string {
  const first = map.path[0];
  if (!first) return '';
  const parts = [`M ${first.x * 100} ${first.y * 100}`];
  for (let i = 1; i < map.path.length; i += 1) {
    const point = map.path[i]!;
    parts.push(`L ${point.x * 100} ${point.y * 100}`);
  }
  return parts.join(' ');
}

/* -------------------------------------------------------- locked ATO board --- */

/**
 * LOCKED ATO board geometry (games/grove/ref/ato-map/PATH_LOCKED.md,
 * 2026-09-11) — the DEFAULT board. Waypoints are 0..1 board fractions in path
 * order; repeated vertices are intentional joins where the road loops back on
 * itself (the `o` loop). Do not "dedupe" them.
 */
export const ATO_PATH: readonly { x: number; y: number }[] = [
  { x: 0.0625, y: 0.9375 }, // (1,15) spawn
  { x: 0.125, y: 0.9375 }, // (2,15)
  { x: 0.125, y: 0.375 }, // (2,6)
  { x: 0.375, y: 0.375 }, // (6,6)
  { x: 0.375, y: 0.125 }, // (6,2)
  { x: 0.125, y: 0.125 }, // (2,2)
  { x: 0.125, y: 0.375 }, // (2,6)  ← join (retraces 2)
  { x: 0.375, y: 0.375 }, // (6,6)  ← join (retraces 3)
  { x: 0.375, y: 0.875 }, // (6,14)
  { x: 0.875, y: 0.875 }, // (14,14)
  { x: 0.875, y: 0.625 }, // (14,10)
  { x: 0.625, y: 0.625 }, // (10,10)
  { x: 0.625, y: 0.375 }, // (10,6)
  { x: 0.875, y: 0.375 }, // (14,6)
  { x: 0.875, y: 0.625 }, // (14,10) ← join (retraces 10)
  { x: 0.625, y: 0.625 }, // (10,10) ← join (retraces 11)
  { x: 0.625, y: 0.125 }, // (10,2)
  { x: 0.875, y: 0.125 }, // (14,2)
  { x: 0.875, y: 0 }, // (14,0) exit / leak
];

/** LOCKED ATO tower pads (0..100 board units) — all 15 slots; the deploy cap
 * (`MAX_TOWERS = 6`) is what limits a run, not the pad count. */
export const ATO_PADS: readonly { x: number; y: number }[] = [
  { x: 25, y: 25 }, // (4,4)
  { x: 25, y: 50 }, // (4,8)
  { x: 25, y: 62.5 }, // (4,10)
  { x: 25, y: 75 }, // (4,12)
  { x: 25, y: 87.5 }, // (4,14)
  { x: 50, y: 12.5 }, // (8,2)
  { x: 50, y: 25 }, // (8,4)
  { x: 50, y: 37.5 }, // (8,6)
  { x: 50, y: 50 }, // (8,8)
  { x: 50, y: 62.5 }, // (8,10)
  { x: 50, y: 75 }, // (8,12)
  { x: 75, y: 25 }, // (12,4)
  { x: 93.75, y: 25 }, // (15,4)
  { x: 75, y: 50 }, // (12,8)
  { x: 68.75, y: 75 }, // (11,12)
];

/** Road half-width, board units, used to rasterize the locked polyline into
 * path cells. Matches the original ~11-unit road ribbon. */
const ATO_ROAD_HALF = 5.5;

/** Distance from point `p` to segment `a→b` (board units). */
function distToSeg(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * Rasterize a 0..1-fraction polyline into a 16×16 tile grid: any cell whose
 * center is within `ATO_ROAD_HALF` of the road becomes a PATH cell; everything
 * else is WALL; the first waypoint's cell is the START. Used to paint the
 * locked ATO road as crisp path cells (same technique as the maze board).
 */
function rasterizeRoad(path: readonly { x: number; y: number }[]): number[][] {
  const grid: number[][] = Array.from({ length: DIVECORE_ROWS }, () =>
    Array(DIVECORE_COLS).fill(TILE.WALL),
  );
  for (let row = 0; row < DIVECORE_ROWS; row += 1) {
    for (let col = 0; col < DIVECORE_COLS; col += 1) {
      const cx = (col + 0.5) * DIVECORE_CELL;
      const cy = (row + 0.5) * DIVECORE_CELL;
      let min = Infinity;
      for (let i = 0; i < path.length - 1; i += 1) {
        const a = path[i]!;
        const b = path[i + 1]!;
        const d = distToSeg(cx, cy, a.x * 100, a.y * 100, b.x * 100, b.y * 100);
        if (d < min) min = d;
      }
      if (min <= ATO_ROAD_HALF) grid[row]![col] = TILE.PATH;
    }
  }
  const spawn = path[0]!;
  const scol = Math.floor((spawn.x * 100) / DIVECORE_CELL);
  const srow = Math.floor((spawn.y * 100) / DIVECORE_CELL);
  grid[srow]![scol] = TILE.START;
  return grid;
}

const ATO_GRID: readonly (readonly number[])[] = rasterizeRoad(ATO_PATH);

/* ----------------------------------------------------------- board registry --- */

export type BoardId = 'ato' | 'neon-maze';

/** One board: geometry (path 0..1 + pads 0..100) + its 16×16 paint grid. */
export type BoardMap = {
  id: BoardId;
  name: string;
  path: readonly { x: number; y: number }[];
  pads: readonly { x: number; y: number }[];
  grid: readonly (readonly number[])[];
};

/** All boards, keyed by id. `ato` is the default; `neon-maze` is parked. */
export const BOARD_MAPS: Record<BoardId, BoardMap> = {
  ato: {
    id: 'ato',
    name: 'ATO',
    path: ATO_PATH,
    pads: ATO_PADS,
    grid: ATO_GRID,
  },
  'neon-maze': {
    id: 'neon-maze',
    name: 'Neon Maze',
    path: DIVECORE_WALK_PATH,
    pads: DIVECORE_WALK_PADS,
    grid: DIVECORE_MAP_ROWS,
  },
};

/** Display order for the Maps picker (default first). */
export const BOARD_ORDER: readonly BoardId[] = ['ato', 'neon-maze'];
