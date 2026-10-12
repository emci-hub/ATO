/**
 * Walk facing buckets — shared by `skinWalkDirIndex` (board) and room
 * `poseDrawable` (Hideout). Kept free of Metro art registries so checks can
 * import the snap without loading PLAY_ART.
 *
 * 2-dir clips: east/west only. A near-vertical heading returns
 * `SKIN_WALK_NO_DIR` so the caller keeps the static rotation — never a side
 * walk. 4-dir clips: nearest cardinal, order [north, east, south, west].
 */

/** Sentinel meaning "this heading has no honest walk frame". */
export const SKIN_WALK_NO_DIR = -1;

/** 4-dir walk row order — must match `skinWalkDirIndex` / packed hero Walk. */
export const SKIN_WALK_4DIR_ORDER = ['north', 'east', 'south', 'west'] as const;

/** Minimum |dx| for a heading to count as honestly east/west on a 2-dir clip. */
export const WALK_2DIR_MIN_DX = 0.35;

/**
 * Walk facing bucket for a clip (0..`walk.dirs`-1), or `SKIN_WALK_NO_DIR`.
 * Same snap `skinWalkDirIndex` uses once it has resolved the role's walk.
 */
export function walkClipDirIndex(
  walk: { dirs: number } | undefined,
  dx: number,
  dy: number,
): number {
  if (!walk) return SKIN_WALK_NO_DIR;
  if (walk.dirs === 2) {
    if (Math.abs(dx) < WALK_2DIR_MIN_DX) return SKIN_WALK_NO_DIR;
    return dx > 0 ? 0 : 1; // [east, west]
  }
  if (walk.dirs === 8) {
    const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
    const bearing = deg + 90;
    return ((Math.round(bearing / 45) % 8) + 8) % 8;
  }
  // 4-dir: nearest cardinal, order [north, east, south, west].
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI; // east = 0
  const a = ((deg % 360) + 360) % 360; // 0..360 clockwise from east
  if (a < 45 || a >= 315) return 1; // east
  if (a < 135) return 2; // south
  if (a < 225) return 3; // west
  return 0; // north
}
