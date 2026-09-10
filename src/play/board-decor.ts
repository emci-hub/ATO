/**
 * Board decorator — dresses the Defend board with the Kenney Tower Defense
 * terrain (GAME_SPEC §19) WITHOUT touching combat geometry. Waypoints/pads stay
 * the source of truth; this only answers "which role goes where".
 *
 * Roles come from the skin contract (`map.grass` / `map.path` / `map.pad`), so
 * no raw tile numbers live here (see `games/grove/KENNEY_TD_TILE_MAP.md`).
 *
 * Anchors (one shared world space):
 * - `corner` — grid tiles (grass/path) tile the board from their top-left, so a
 *   cell at (i, j) draws at `i * CELL`.
 * - `center` — entity-style markers (the pad slot) sit ON the pad's world point,
 *   so `x`/`y` are the CENTRE. This is the fix for the old bug that snapped the
 *   pad art to 8×8 cell corners and left it off the tower/ring centre.
 *
 * Pure + deterministic so it can be memoized per map.
 */
import type { DefendMap } from '@/play/defend';
import type { SkinRoleId } from '@/play/skin';

/** Grid resolution across the board (100 board units / 8 = 12.5 per tile). */
export const BOARD_GRID = 8;
const CELL = 100 / BOARD_GRID;
/**
 * Cells whose centre is this close to the lane centreline become path. Must be
 * at least half a cell (6.25) or a lane that runs along a grid line — Main's
 * y=0.12 and x=0.62 runs — lands between two rows/cols and draws nothing.
 */
const LANE_HALF = CELL / 2;

/** Pad slot marker edge, board units (centred on the pad point). */
const PAD_MARKER_UNITS = 11;

export type BoardTileAnchor = 'corner' | 'center';

export type BoardTile = {
  /** Skin role for this tile (`map.grass` / `map.path` / `map.pad`). */
  role: SkinRoleId;
  /** `corner` = x/y is top-left; `center` = x/y is the centre. */
  anchor: BoardTileAnchor;
  /** Board units (0..100). */
  x: number;
  y: number;
  /** Square edge, board units. */
  size: number;
  /** Degrees, clockwise, applied around the tile centre. */
  rotate: number;
};

type Vec = { x: number; y: number };

const toUnits = (p: { x: number; y: number }): Vec => ({ x: p.x * 100, y: p.y * 100 });

function distanceToSegment(px: number, py: number, a: Vec, b: Vec): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const lenSq = vx * vx + vy * vy;
  if (lenSq === 0) return Math.hypot(px - a.x, py - a.y);
  let t = ((px - a.x) * vx + (py - a.y) * vy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a.x + t * vx), py - (a.y + t * vy));
}

function cellCenter(i: number, j: number): Vec {
  return { x: (i + 0.5) * CELL, y: (j + 0.5) * CELL };
}

function cellOf(p: Vec): { i: number; j: number } {
  const i = Math.max(0, Math.min(BOARD_GRID - 1, Math.floor(p.x / CELL)));
  const j = Math.max(0, Math.min(BOARD_GRID - 1, Math.floor(p.y / CELL)));
  return { i, j };
}

const key = (i: number, j: number) => `${i},${j}`;

/**
 * Build the full tile list for a map: grass everywhere, path over every cell
 * the lane crosses, and a pad slot marker CENTRED on each tower pad.
 */
export function boardDecor(map: DefendMap): BoardTile[] {
  const pts = map.path.map(toUnits);

  // Classify every cell: is it on the lane?
  const laneCells = new Set<string>();
  for (let i = 0; i < BOARD_GRID; i += 1) {
    for (let j = 0; j < BOARD_GRID; j += 1) {
      const center = cellCenter(i, j);
      let best = Infinity;
      for (let s = 0; s < pts.length - 1; s += 1) {
        const d = distanceToSegment(center.x, center.y, pts[s]!, pts[s + 1]!);
        if (d < best) best = d;
      }
      if (best <= LANE_HALF) laneCells.add(key(i, j));
    }
  }
  // The cell containing an interior waypoint is always lane, so a bend can't
  // fall between samples and leave a gap.
  for (let v = 1; v < pts.length - 1; v += 1) {
    const cell = cellOf(pts[v]!);
    laneCells.add(key(cell.i, cell.j));
  }

  const tiles: BoardTile[] = [];

  // Grass floor everywhere, path tiles over the lane (grid-anchored).
  for (let j = 0; j < BOARD_GRID; j += 1) {
    for (let i = 0; i < BOARD_GRID; i += 1) {
      const onLane = laneCells.has(key(i, j));
      tiles.push({
        role: onLane ? 'map.path' : 'map.grass',
        anchor: 'corner',
        x: i * CELL,
        y: j * CELL,
        size: CELL,
        rotate: 0,
      });
    }
  }

  // Pad slot marker — CENTRED on the pad's world point so it stacks with the
  // tower sprite and the range ring on the same centre.
  map.pads.forEach((pad) => {
    tiles.push({
      role: 'map.pad',
      anchor: 'center',
      x: pad.x,
      y: pad.y,
      size: PAD_MARKER_UNITS,
      rotate: 0,
    });
  });

  return tiles;
}
