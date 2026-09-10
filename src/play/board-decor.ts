/**
 * Board decorator — dresses the Defend board with Kenney Scribble Dungeons
 * tiles (§19) WITHOUT touching combat geometry. Waypoints/pads stay the source
 * of truth; this only answers "which tile image goes in which 8×8 cell, and how
 * is it rotated".
 *
 * Output is in the same 0..100 board-unit space the board uses, so a tile at
 * `{x, y, size}` maps to an absolutely-positioned image at `left: x%`, etc.
 * Pure + deterministic so it can be memoized per map.
 */
import type { DefendMap } from '@/play/defend';
import type { PlayTileId } from '@/play/art';

/** Grid resolution across the board (100 board units / 8 = 12.5 per tile). */
export const BOARD_GRID = 8;
const CELL = 100 / BOARD_GRID;
/**
 * Cells whose centre is this close to the lane centreline become path. Must be
 * at least half a cell (6.25) or a lane that runs along a grid line — Main's
 * y=0.12 and x=0.62 runs — lands between two rows/cols and draws nothing.
 */
const LANE_HALF = CELL / 2;

export type BoardTile = {
  key: PlayTileId;
  /** Top-left corner, board units. */
  x: number;
  y: number;
  /** Square edge, board units. */
  size: number;
  /** Degrees, clockwise, applied around the tile centre. */
  rotate: number;
};

type Vec = { x: number; y: number };

const toUnits = (p: { x: number; y: number }): Vec => ({ x: p.x * 100, y: p.y * 100 });

/** Compass angle in degrees: east = 0, south = 90, west = 180, north = 270. */
function angleOf(dx: number, dy: number): number {
  return ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
}

function normalizeAngle(a: number): number {
  return ((a % 360) + 360) % 360;
}

/** Rotation aligning the tile's base open edges (east + south) to a target pair. */
function rotationForOpenPair(targetA: number, targetB: number): number {
  const base = [0, 90];
  for (const r of [0, 90, 180, 270]) {
    const open = new Set(base.map((a) => normalizeAngle(a + r)));
    if (open.has(normalizeAngle(targetA)) && open.has(normalizeAngle(targetB))) return r;
  }
  return 0;
}

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

/** True when the two joined segments are not collinear (a real turn). */
function isTurn(prev: Vec, at: Vec, next: Vec): boolean {
  const inAng = angleOf(at.x - prev.x, at.y - prev.y);
  const outAng = angleOf(next.x - at.x, next.y - at.y);
  return Math.abs(normalizeAngle(outAng - inAng)) > 1 && Math.abs(normalizeAngle(outAng - inAng)) < 359;
}

const key = (i: number, j: number) => `${i},${j}`;

/**
 * Build the full tile list for a map: floors everywhere, walls on the outer
 * ring (skipped on the lane and on pads), path tiles over the lane, and a
 * doorway/stairs marker at the exit/spawn.
 */
export function boardDecor(map: DefendMap): BoardTile[] {
  const pts = map.path.map(toUnits);
  const padCells = new Set(map.pads.map((pad) => cellOf({ x: pad.x, y: pad.y })).map((c) => key(c.i, c.j)));

  // Classify every cell: is it on the lane?
  const laneInfo = new Map<string, { tile: PlayTileId; rotate: number }>();

  for (let i = 0; i < BOARD_GRID; i += 1) {
    for (let j = 0; j < BOARD_GRID; j += 1) {
      const center = cellCenter(i, j);
      let best = Infinity;
      let bestSeg = -1;
      for (let s = 0; s < pts.length - 1; s += 1) {
        const d = distanceToSegment(center.x, center.y, pts[s]!, pts[s + 1]!);
        if (d < best) {
          best = d;
          bestSeg = s;
        }
      }
      if (best > LANE_HALF || bestSeg < 0) continue;

      const a = pts[bestSeg]!;
      const b = pts[bestSeg + 1]!;
      // path.png runs vertically (north–south); rotate it onto the segment.
      const rotate = normalizeAngle(angleOf(b.x - a.x, b.y - a.y) - 90);
      laneInfo.set(key(i, j), { tile: 'path', rotate });
    }
  }

  // Turns: the cell containing each interior waypoint draws the curve tile, and
  // is forced onto the lane even if the sampling above just missed it.
  for (let v = 1; v < pts.length - 1; v += 1) {
    const at = pts[v]!;
    const prev = pts[v - 1]!;
    const next = pts[v + 1]!;
    if (!isTurn(prev, at, next)) continue;
    const back = angleOf(prev.x - at.x, prev.y - at.y);
    const fwd = angleOf(next.x - at.x, next.y - at.y);
    const cell = cellOf(at);
    laneInfo.set(key(cell.i, cell.j), {
      tile: 'path_curve',
      rotate: rotationForOpenPair(back, fwd),
    });
  }

  const tiles: BoardTile[] = [];

  // Base layer: floor everywhere, walls on the outer ring (never on lane/pad).
  for (let j = 0; j < BOARD_GRID; j += 1) {
    for (let i = 0; i < BOARD_GRID; i += 1) {
      const k = key(i, j);
      const onLane = laneInfo.has(k);
      const isPad = padCells.has(k);
      const isBorder = i === 0 || j === 0 || i === BOARD_GRID - 1 || j === BOARD_GRID - 1;

      let base: PlayTileId = 'floor';
      let rotate = 0;
      if (isBorder && !onLane && !isPad) {
        // wall.png is a wall along the tile's TOP edge.
        base = 'wall';
        rotate = j === 0 ? 0 : j === BOARD_GRID - 1 ? 180 : i === 0 ? 270 : 90;
      }
      tiles.push({ key: base, x: i * CELL, y: j * CELL, size: CELL, rotate });
    }
  }

  // Lane layer: path / curve tiles over the floor.
  for (const [k, info] of laneInfo) {
    const [i, j] = k.split(',').map(Number) as [number, number];
    tiles.push({ key: info.tile, x: i * CELL, y: j * CELL, size: CELL, rotate: info.rotate });
  }

  // Endpoint markers: stairs at spawn, doorway at the exit.
  const spawn = cellOf(pts[0]!);
  const exit = cellOf(pts[pts.length - 1]!);
  tiles.push({ key: 'stairs', x: spawn.i * CELL, y: spawn.j * CELL, size: CELL, rotate: 0 });
  tiles.push({ key: 'door', x: exit.i * CELL, y: exit.j * CELL, size: CELL, rotate: 0 });

  return tiles;
}
