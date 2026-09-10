/**
 * Board decorator — dresses the Defend board with the active skin's terrain
 * (grass floor + pad markers + light Craftpix prop garnish) WITHOUT touching
 * combat geometry. Waypoints/pads stay the source of truth.
 *
 * The ROAD is painted as a ribbon stroked along the waypoint polyline in the
 * board SVG (see `defend-screen`), so the art hugs the exact line creeps walk.
 * This module emits only the GROUND layers: grass cells, prop garnish, and the
 * pad slot markers — all rendered in the `boardTiles` layer UNDER the gameplay
 * SVG.
 *
 * Roles come from the skin contract (no raw tile filenames). Props are capped
 * (~12 per map), placed deterministically off the road (≥8 board units) and off
 * pads, from the allow list in `ROLE_MAP.md`.
 *
 * Anchors (one shared world space):
 * - `corner` — grid tiles (grass) tile from their top-left.
 * - `center` — entity-style markers (pads, props) sit ON the world point.
 */
import type { DefendMap } from '@/play/defend';
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
 * Prop garnish per map — verified ≥8 board units off the road polyline and ≥6
 * off every pad, so garnish never blocks path or pads. Trees at outer corners,
 * bushes near bends, stones as choke flavor, grass tufts near the lane, one
 * edge fence. No camps / campfires / lamps / boxes (forbid list).
 */
const MAP_PROPS: Record<string, readonly PropSpec[]> = {
  trial: [
    { role: 'prop.tree', x: 5, y: 6, size: 15, h: 17.5, rotate: 0 },
    { role: 'prop.tree', x: 95, y: 6, size: 15, h: 17.5, rotate: 90 },
    { role: 'prop.tree', x: 6, y: 92, size: 15, h: 17.5, rotate: 270 },
    { role: 'prop.tree', x: 94, y: 92, size: 15, h: 17.5, rotate: 180 },
    { role: 'prop.bush', x: 30, y: 10, size: 9, h: 8, rotate: 0 },
    { role: 'prop.bush', x: 74, y: 30, size: 9, h: 8, rotate: 180 },
    { role: 'prop.bush', x: 74, y: 48, size: 9, h: 8, rotate: 90 },
    { role: 'prop.stone', x: 36, y: 70, size: 8, h: 6, rotate: 0 },
    { role: 'prop.stone', x: 18, y: 6, size: 7, h: 5, rotate: 45 },
    { role: 'prop.grass', x: 58, y: 12, size: 6, h: 7, rotate: 0 },
    { role: 'prop.grass', x: 72, y: 50, size: 6, h: 7, rotate: 90 },
    { role: 'prop.fence', x: 44, y: 4, size: 12, h: 7, rotate: 0 },
  ],
  main: [
    { role: 'prop.tree', x: 4, y: 3, size: 15, h: 17.5, rotate: 0 },
    { role: 'prop.tree', x: 94, y: 5, size: 15, h: 17.5, rotate: 90 },
    { role: 'prop.tree', x: 6, y: 94, size: 15, h: 17.5, rotate: 270 },
    { role: 'prop.tree', x: 94, y: 94, size: 15, h: 17.5, rotate: 180 },
    { role: 'prop.bush', x: 8, y: 20, size: 9, h: 8, rotate: 0 },
    { role: 'prop.bush', x: 42, y: 3, size: 9, h: 8, rotate: 180 },
    { role: 'prop.bush', x: 72, y: 60, size: 9, h: 8, rotate: 90 },
    { role: 'prop.stone', x: 40, y: 39, size: 8, h: 6, rotate: 0 },
    { role: 'prop.stone', x: 10, y: 64, size: 7, h: 5, rotate: 45 },
    { role: 'prop.grass', x: 48, y: 3, size: 6, h: 7, rotate: 0 },
    { role: 'prop.grass', x: 70, y: 50, size: 6, h: 7, rotate: 90 },
  ],
};

/**
 * Build the tile list for a map: grass under every cell, prop garnish, then a
 * pad slot marker CENTRED on each tower pad (drawn last so pads sit on top of
 * garnish). The road ribbon is drawn in the board SVG.
 */
export function boardDecor(map: DefendMap): BoardTile[] {
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
