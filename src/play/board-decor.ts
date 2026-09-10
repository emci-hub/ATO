/**
 * Board decorator — dresses the Defend board with the Kenney Tower Defense
 * terrain (GAME_SPEC §19) WITHOUT touching combat geometry. Waypoints/pads stay
 * the source of truth; this only answers "which role goes where".
 *
 * The ROAD is no longer painted as grid cells: blocky 8×8 path tiles drifted
 * off the walk line. Instead this emits **grass floor only** (plus the pad slot
 * markers), and the road itself is drawn as a ribbon stroked along the waypoint
 * polyline in the board SVG (`defend-screen`), so the art hugs the exact line
 * creeps walk. Roles come from the skin contract, so no raw tile numbers live
 * here (see `games/grove/KENNEY_TD_TILE_MAP.md`).
 *
 * Anchors (one shared world space):
 * - `corner` — grid tiles (grass) tile the board from their top-left, so a cell
 *   at (i, j) draws at `i * CELL`.
 * - `center` — entity-style markers (the pad slot) sit ON the pad's world point,
 *   so `x`/`y` are the CENTRE, stacking with the tower sprite + range ring.
 *
 * Pure + deterministic so it can be memoized per map.
 */
import type { DefendMap } from '@/play/defend';
import type { SkinRoleId } from '@/play/skin';

/** Grid resolution across the board (100 board units / 8 = 12.5 per tile). */
export const BOARD_GRID = 8;
const CELL = 100 / BOARD_GRID;

/** Pad slot marker edge, board units (centred on the pad point). */
const PAD_MARKER_UNITS = 11;

export type BoardTileAnchor = 'corner' | 'center';

export type BoardTile = {
  /** Skin role for this tile (`map.grass` / `map.pad`). */
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

/**
 * Build the tile list for a map: grass under every cell, and a pad slot marker
 * CENTRED on each tower pad. (The road ribbon is drawn in the board SVG.)
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
