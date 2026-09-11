/**
 * Board decorator — dresses the Defend board with the active skin's terrain
 * (grass floor + pad markers + light Craftpix prop garnish) WITHOUT touching
 * combat geometry. Waypoints/pads stay the source of truth.
 *
 * The ROAD is painted as a ribbon stroked along the waypoint polyline in the
 * board SVG (see `defend-screen`), so the art hugs the exact line creeps walk.
 * This module emits the GROUND layers — grass cells, prop garnish, and the pad
 * slot markers — all rendered in the `boardTiles` layer UNDER the gameplay SVG,
 * plus the ATO ghost path (`ATO_GHOST_D`) that the gameplay SVG paints under
 * the road.
 *
 * Roles come from the skin contract (no raw tile filenames). Prop garnish is one
 * shared list (~12) placed to sit clear of the lane and pads, from the allow
 * list in `ROLE_MAP.md`.
 *
 * Anchors (one shared world space):
 * - `corner` — grid tiles (grass) tile from their top-left.
 * - `center` — entity-style markers (pads, props) sit ON the world point.
 */
import type { BoardMap } from '@/play/board-data';
import type { SkinRoleId } from '@/play/skin';

/** Grid resolution across the board (100 board units / 8 = 12.5 per tile). */
export const BOARD_GRID = 8;
const CELL = 100 / BOARD_GRID;

/** Pad slot marker edge, board units (centred on the pad point). */
const PAD_MARKER_UNITS = 12;

export type BoardTileAnchor = 'corner' | 'center';

export type BoardTile = {
  /** Skin role for this tile (`map.grass` / `map.pad` / `prop.*`). */
  role: SkinRoleId;
  /** `corner` = x/y is top-left; `center` = x/y is the centre. */
  anchor: BoardTileAnchor;
  /** Board units (0..100). */
  x: number;
  y: number;
  /** Square edge / width, board units. */
  size: number;
  /** Optional height (board units) — defaults to `size` for non-square props. */
  h?: number;
  /** Degrees, clockwise, applied around the tile centre. */
  rotate: number;
};

type PropSpec = {
  role: SkinRoleId;
  x: number;
  y: number;
  size: number;
  h: number;
  rotate: number;
};

/**
 * Prop garnish for the locked ATO board — ONE shared list, used by BOTH maps
 * because Trial and Main share the same geometry. Placed to sit clear of the
 * road and pads; props draw UNDER the road/pad layer, so any edge overlap is
 * occluded rather than a gameplay issue. Trees at outer corners, bushes near
 * bends, stones as choke flavor, grass tufts near the lane, one edge fence.
 * No camps / campfires / lamps / boxes (forbid list).
 *
 * Kept keyed by map id so Trial / Main can diverge into their own packs later.
 */
const ATO_BOARD_PROPS: readonly PropSpec[] = [
  { role: 'prop.tree', x: 5, y: 6, size: 15, h: 17.5, rotate: 0 },
  { role: 'prop.tree', x: 95, y: 6, size: 15, h: 17.5, rotate: 90 },
  // (6,92) sat on the locked ATO road — moved to the clear bottom band.
  { role: 'prop.tree', x: 20, y: 97, size: 13, h: 15, rotate: 270 },
  { role: 'prop.tree', x: 94, y: 92, size: 15, h: 17.5, rotate: 180 },
  // (30,10) sat on the locked road — moved to the clear top band.
  { role: 'prop.bush', x: 33, y: 3, size: 9, h: 8, rotate: 0 },
  { role: 'prop.bush', x: 74, y: 30, size: 9, h: 8, rotate: 180 },
  { role: 'prop.bush', x: 74, y: 48, size: 9, h: 8, rotate: 90 },
  // (36,70) sat on the locked road — moved to the clear bottom band.
  { role: 'prop.stone', x: 58, y: 97, size: 7, h: 5, rotate: 0 },
  { role: 'prop.stone', x: 18, y: 6, size: 7, h: 5, rotate: 45 },
  // (58,12) sat on the locked road — moved to the clear top band.
  { role: 'prop.grass', x: 55, y: 3, size: 6, h: 7, rotate: 0 },
  { role: 'prop.grass', x: 72, y: 50, size: 6, h: 7, rotate: 90 },
  { role: 'prop.fence', x: 44, y: 4, size: 12, h: 7, rotate: 0 },
];

const MAP_PROPS: Record<string, readonly PropSpec[]> = {
  ato: ATO_BOARD_PROPS,
  'neon-maze': ATO_BOARD_PROPS,
};

/**
 * Build the tile list for a map: grass under every cell, prop garnish, then a
 * pad slot marker CENTRED on each tower pad (drawn last so pads sit on top of
 * garnish). The road is emitted separately by `roadDecor` (cobble stamps).
 */
export function boardDecor(map: BoardMap): BoardTile[] {
  const tiles: BoardTile[] = [];

  for (let j = 0; j < BOARD_GRID; j += 1) {
    for (let i = 0; i < BOARD_GRID; i += 1) {
      tiles.push({
        role: 'map.grass',
        anchor: 'corner',
        x: i * CELL,
        y: j * CELL,
        size: CELL,
        rotate: 0,
      });
    }
  }

  // Prop garnish — ground decor, under the pads and the gameplay SVG.
  for (const prop of MAP_PROPS[map.id] ?? []) {
    tiles.push({
      role: prop.role,
      anchor: 'center',
      x: prop.x,
      y: prop.y,
      size: prop.size,
      h: prop.h,
      rotate: prop.rotate,
    });
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

/* ------------------------------------------------------------------ road --- */

export type RoadStamp = {
  /** Skin role: `road.straight` or `road.corner_*`. */
  role: SkinRoleId;
  /** Centre point, board units (0..100). */
  x: number;
  y: number;
  /** Square edge, board units (the road tile is square; corners too). */
  size: number;
  /** Degrees, clockwise (only the flare stamps rotate for direction). */
  rotate: number;
};

/** Cobble stamp edge, board units (matches `road.straight` units). */
const ROAD_WIDTH = 9;
/** Flare multiplier at the spawn + exit (wider cobble so the ends read). */
const ROAD_FLARE_SCALE = 1.5;

type Vec = { x: number; y: number };

/** Cardinal direction of a segment (unit vector), or null for a zero segment. */
function segDir(a: Vec, b: Vec): Vec | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  return { x: dx / len, y: dy / len };
}

/** The corner role for a 90° turn `inDir` → `outDir` (road enters from one
 * edge, exits an adjacent one). Matches the Craftpix elbow quadrants. */
function cornerRole(inDir: Vec, outDir: Vec): SkinRoleId {
  // Cardinal axis of each direction (sign only): +1 east/south, -1 west/north.
  const axis = (v: Vec): { e: number; s: number } => {
    if (Math.abs(v.x) > Math.abs(v.y)) return { e: Math.sign(v.x), s: 0 };
    return { e: 0, s: Math.sign(v.y) };
  };
  const inA = axis(inDir);
  const outA = axis(outDir);
  // Entering edge is the OPPOSITE of travel direction; exiting = same as travel.
  const enter = { e: -inA.e, s: -inA.s };
  const exit = outA;
  // Enter/exit edges → corner quadrant.
  const enterWest = enter.e === -1;
  const enterEast = enter.e === 1;
  const enterNorth = enter.s === -1;
  const enterSouth = enter.s === 1;
  const exitEast = exit.e === 1;
  const exitWest = exit.e === -1;
  const exitSouth = exit.s === 1;
  const exitNorth = exit.s === -1;
  if (enterWest && exitSouth) return 'road.corner_bl';
  if (enterWest && exitNorth) return 'road.corner_tl';
  if (enterNorth && exitEast) return 'road.corner_tr';
  if (enterNorth && exitWest) return 'road.corner_tl';
  if (enterEast && exitSouth) return 'road.corner_rb';
  if (enterEast && exitNorth) return 'road.corner_tr';
  if (enterSouth && exitEast) return 'road.corner_rb';
  if (enterSouth && exitWest) return 'road.corner_bl';
  // Degenerate / non-90° — fall back to a straight stamp.
  return 'road.straight';
}

/**
 * Cobble road stamps hugging the waypoint polyline: straight tiles along each
 * segment (centred on the centreline), a real elbow tile at each bend, and a
 * flared straight at the spawn + exit so the leak ends read. Waypoints stay the
 * walk truth — stamps are centred on the polyline, never offset from it.
 */
export function roadDecor(map: BoardMap): RoadStamp[] {
  const pts = map.path.map((p) => ({ x: p.x * 100, y: p.y * 100 }));
  const stamps: RoadStamp[] = [];
  if (pts.length < 2) return stamps;

  // Flare ends.
  const first = pts[0]!;
  const firstDir = segDir(first, pts[1]!);
  if (firstDir) {
    stamps.push({
      role: 'road.straight',
      x: first.x,
      y: first.y,
      size: ROAD_WIDTH * ROAD_FLARE_SCALE,
      rotate: 0,
    });
  }
  const last = pts[pts.length - 1]!;
  const lastDir = segDir(pts[pts.length - 2]!, last);
  if (lastDir) {
    stamps.push({
      role: 'road.straight',
      x: last.x,
      y: last.y,
      size: ROAD_WIDTH * ROAD_FLARE_SCALE,
      rotate: 0,
    });
  }

  // Straight segments + corner elbows.
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const dir = segDir(a, b);
    if (!dir) continue;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    // Straight stamps from just inside `a` to just inside `b`, step ROAD_WIDTH.
    const start = ROAD_WIDTH / 2;
    const end = len - ROAD_WIDTH / 2;
    for (let t = start; t <= end + 1e-6; t += ROAD_WIDTH) {
      stamps.push({
        role: 'road.straight',
        x: a.x + dir.x * t,
        y: a.y + dir.y * t,
        size: ROAD_WIDTH,
        rotate: 0,
      });
    }

    // A bend at the interior waypoint between this segment and the next.
    if (i < pts.length - 2) {
      const nextDir = segDir(pts[i + 1]!, pts[i + 2]!);
      if (nextDir) {
        const corner = cornerRole(dir, nextDir);
        stamps.push({
          role: corner,
          x: b.x,
          y: b.y,
          size: ROAD_WIDTH,
          rotate: 0,
        });
      }
    }
  }

  return stamps;
}

/* -------------------------------------------------------------- ato ghost --- */

/**
 * ATO 16×16 logo mask, baked from `games/grove/ref/ato-map/ato-map.tmx`
 * (Tile Layer 1 CSV). `10` = a drawn ATO cell, `28` = ground. It is painted as
 * ONE faint SVG path UNDER the road (see `defend-screen`) — pure decor: the
 * gameplay layer is `pointerEvents="none"`, so the ghost can never own a tap,
 * and it never touches the waypoint polyline the pips walk.
 *
 * To flip the mask polarity, change the `'10'` test in `buildAtoGhostD`.
 */
const ATO_GHOST_CSV: readonly string[] = [
  '28,28,28,28,28,28,28,28,28,28,28,28,28,10,10,28',
  '28,10,10,10,10,10,10,28,28,10,10,10,10,10,10,28',
  '28,10,10,10,10,10,10,28,28,10,10,10,10,10,10,28',
  '28,10,10,28,28,10,10,28,28,10,10,28,28,28,28,28',
  '28,10,10,28,28,10,10,28,28,10,10,28,28,28,28,28',
  '28,10,10,10,10,10,10,28,28,10,10,10,10,10,10,28',
  '28,10,10,10,10,10,10,28,28,10,10,10,10,10,10,28',
  '28,10,10,28,28,10,10,28,28,10,10,28,28,10,10,28',
  '28,10,10,28,28,10,10,28,28,10,10,28,28,10,10,28',
  '28,10,10,28,28,10,10,28,28,10,10,10,10,10,10,28',
  '28,10,10,28,28,10,10,28,28,10,10,10,10,10,10,28',
  '28,10,10,28,28,10,10,28,28,28,28,28,28,10,10,28',
  '28,10,10,28,28,10,10,28,28,28,28,28,28,10,10,28',
  '28,10,10,28,28,10,10,10,10,10,10,10,10,10,10,28',
  '10,10,10,28,28,10,10,10,10,10,10,10,10,10,10,28',
  '10,10,10,28,28,28,28,28,28,28,28,28,28,28,28,28',
];

/** Edge of one ATO ghost cell, board units (16 cells across the 0..100 board). */
export const ATO_GHOST_CELL = 100 / ATO_GHOST_CSV.length;

/** Hairline overlap so neighbouring cells don't leak anti-aliased seams. */
const ATO_GHOST_BLEED = 0.05;

/** One SVG path `d` for the whole ATO ghost (0..100 board viewBox). */
export const ATO_GHOST_D: string = buildAtoGhostD();

function buildAtoGhostD(): string {
  const cell = ATO_GHOST_CELL;
  const size = cell + ATO_GHOST_BLEED;
  const parts: string[] = [];
  ATO_GHOST_CSV.forEach((row, y) => {
    row.split(',').forEach((value, x) => {
      if (value.trim() !== '10') return;
      const px = x * cell;
      const py = y * cell;
      parts.push(`M ${px} ${py} h ${size} v ${size} h ${-size} Z`);
    });
  });
  return parts.join(' ');
}
