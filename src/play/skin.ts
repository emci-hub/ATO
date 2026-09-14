/**
 * Defend entity skin contract — Cast Presenter skin stack.
 *
 * Skins live under `assets/play/skins/<id>/skin.json`; each maps a game ROLE
 * (`tower.archer`, `unit.puff`, `map.grass`, `fx.shot`, `prop.tree`, …) to art
 * keys + draw metadata (dirs / pivot / units / per-level scales / clips / tone).
 * Code reads roles only — no raw tile filenames outside the contract.
 *
 * Resolution is per-role across a SKIN STACK (active first, then fallbacks):
 * the active `craftpix-td` skin defines map + prop roles only, and everything
 * else (units / towers / avatar / fx) falls through to `kenney-td`, which
 * stays loadable as a complete fallback skin. A future job just adds the
 * remaining roles to craftpix-td and they light up with no TS change.
 *
 * Everything on the board shares one world space: 0..1 path fractions and
 * 0..100 pad/enemy/avatar board units. `skinDrawBox()` turns a world point +
 * size into the top-left box the renderer needs, honouring `pivot`.
 */
import type { ImageSourcePropType } from 'react-native';

import rawCast from '@/assets/play/skins/cast/skin.json';
import rawCraftpix from '@/assets/play/skins/craftpix-td/skin.json';
import rawKenney from '@/assets/play/skins/kenney-td/skin.json';
import { PLAY_ART } from '@/play/generated-play-assets';

export type SkinRoleId =
  | 'map.grass'
  | 'map.path'
  | 'map.pad'
  | 'road.straight'
  | 'road.corner_bl'
  | 'road.corner_tr'
  | 'road.corner_tl'
  | 'road.corner_rb'
  | 'road.underlay'
  | 'prop.tree'
  | 'prop.bush'
  | 'prop.stone'
  | 'prop.grass'
  | 'prop.fence'
  | 'tower.archer'
  | 'tower.vine'
  | 'tower.crystal'
  | 'unit.avatar'
  | 'unit.puff'
  | 'unit.runner'
  | 'unit.tank'
  | 'unit.tank_alt'
  | 'unit.boss_scout'
  | 'unit.final'
  | 'fx.shot'
  | 'fx.coin';

export type SkinPivot = 'center' | 'feet';
export type SkinDirs = 1 | 4 | 8;

/** Frame counts per clip. */
export type SkinClips = { idle?: number; walk?: number; attack?: number };

/**
 * A multi-frame directional walk clip (creep legs while moving). Towers,
 * `dirs: 1` roles and Titan-X author no `walk`, so they keep static rotations.
 *
 * Frame keys are built at read time from `base` + `order[dirIndex]` +
 * `frame_###` (PixelLab's stable 3-digit export naming) — the contract avoids
 * hand-listing dozens of `frame_NNN` keys in the skin JSON.
 */
export type SkinWalk = {
  /** How many facings the walk is authored for (2 = E/W, 4 = cardinals). */
  dirs: 2 | 4 | 8;
  /** Facing folder names, indexed by dirIndex (see `skinWalkDirIndex`). */
  order: readonly string[];
  /** Frames per facing (uniform across facings). */
  frames: number;
  /** Registry key base (hash-stripped) to the clip folder. */
  base: string;
};

export type SkinRole = {
  /** Art-registry keys. `dirs: 1` uses `keys[0]`; 4/8 index by facing. */
  keys: readonly string[];
  dirs: SkinDirs;
  pivot: SkinPivot;
  /**
   * Only meaningful with `pivot: 'feet'`. Where the sprite's VISUAL feet sit
   * inside the drawn box, as a fraction of the box height measured from its
   * TOP (`0.75` = three quarters down). Default `1` = the box's bottom edge,
   * which is only correct when the PNG has no transparent padding underneath.
   *
   * Cast (PixelLab) art ships each rotation as a square canvas with the
   * character filling the middle ~50%, so the bottom ~25% of the PNG is
   * transparent. Without `footAt` the feet float `(1 - footAt) * units` above
   * the world point — hence `0.75` for every cast role.
   */
  footAt?: number;
  /** Source tile size in px (informational — the board scales in units). */
  cellPx?: number;
  /** Drawn box edge in board units (0..100 space). */
  units?: number;
  /** Per-level size multipliers: `scales[level - 1]` (Lv1..Lv3). */
  scales?: readonly number[];
  clips?: SkinClips;
  walk?: SkinWalk;
  /** Solid tone + casing for a ribbon role (the road), sampled from the tile. */
  tone?: string;
  casing?: string;
};

/** One skin file: the roles it defines. A skin may define only a subset. */
type SkinFile = { pack: string; roles: Record<string, SkinRole> };

/** Minimum |dx| for a 2-facing walk clip to claim an east/west frame. Below
 * this the heading is effectively vertical and the clip has no honest art, so
 * `skinWalkDirIndex` declines and the static rotation stays. Roads in this game
 * are axis-aligned, so real headings sit near |dx| = 1 or |dx| = 0. */
const WALK_2DIR_MIN_DX = 0.35;

/** Active skin first, fallbacks after. Per-role resolution walks the stack so a
 * partial skin only overrides the roles it actually defines. The cast skin
 * (PixelLab defaults) leads; craftpix-td owns map/props; kenney-td stays the
 * complete fallback for unit.avatar / unit.final / fx.* / anything else. */
const SKIN_STACK: readonly SkinFile[] = [rawCast, rawCraftpix, rawKenney] as unknown as readonly SkinFile[];

/** Resolve a role across the skin stack (active first, then fallbacks). */
function resolveRole(role: SkinRoleId): SkinRole | undefined {
  for (const skin of SKIN_STACK) {
    const def = skin.roles[role];
    if (def) return def;
  }
  return undefined;
}

/** The role definition, or undefined when no skin in the stack defines it. */
export function getSkinRole(role: SkinRoleId): SkinRole | undefined {
  return resolveRole(role);
}

/** Art source for a role. With `dirs > 1`, `dirIndex` picks the facing. */
export function skinArt(
  role: SkinRoleId,
  dirIndex = 0,
): ImageSourcePropType | undefined {
  const def = resolveRole(role);
  if (!def || def.keys.length === 0) return undefined;
  const key =
    def.dirs === 1
      ? def.keys[0]
      : def.keys[((dirIndex % def.keys.length) + def.keys.length) % def.keys.length];
  return key ? PLAY_ART[key] : undefined;
}

/** Drawn box edge for a role (board units), falling back to `fallbackUnits`. */
export function skinUnits(role: SkinRoleId, fallbackUnits: number): number {
  const units = resolveRole(role)?.units;
  return typeof units === 'number' && units > 0 ? units : fallbackUnits;
}

/** Number of facing dirs for a role (1 = single up-facing sprite that rotates;
 * 4/8 = per-direction sprites). */
export function skinDirs(role: SkinRoleId): number {
  return resolveRole(role)?.dirs ?? 1;
}

/**
 * Facing bucket 0..7 for a role, north-first canonical order matching the
 * `keys` array in the skin: 0 north · 1 north-east · 2 east · 3 south-east ·
 * 4 south · 5 south-west · 6 west · 7 north-west. Returns 0 for `dirs <= 1`
 * (single-sprite roles rotate instead of picking a direction).
 */
export function skinDirIndex(role: SkinRoleId, dx: number, dy: number): number {
  const dirs = resolveRole(role)?.dirs ?? 1;
  if (dirs <= 1) return 0;
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI; // -180..180, east = 0
  const bearing = deg + 90; // compass: north = 0, clockwise
  return ((Math.round(bearing / 45) % 8) + 8) % 8;
}

/** Solid tone for a ribbon role (the road), or undefined when it has none. */
export function skinTone(role: SkinRoleId): string | undefined {
  return resolveRole(role)?.tone;
}

/** Darker casing tone for a ribbon role, or undefined when it has none. */
export function skinCasing(role: SkinRoleId): string | undefined {
  return resolveRole(role)?.casing;
}

/** Level multiplier for a role (Lv1..LvN), clamped; 1 when no scales. */
export function skinScale(role: SkinRoleId, level: number): number {
  const scales = resolveRole(role)?.scales;
  if (!scales || scales.length === 0) return 1;
  const index = Math.max(0, Math.min(scales.length - 1, Math.floor(level) - 1));
  return scales[index] ?? 1;
}

/** Frame counts for a clip (0 when the clip isn't authored). */
export function skinClipFrames(role: SkinRoleId, clip: keyof SkinClips): number {
  return resolveRole(role)?.clips?.[clip] ?? 0;
}

/**
 * Art for a multi-frame clip on a `dirs: 1` role: `keys` are read as frames
 * (index 0 = frame 0). Returns undefined when the role has no such clip or only
 * one frame, so callers fall back to the idle art.
 */
export function skinClipArt(
  role: SkinRoleId,
  clip: keyof SkinClips,
  frame: number,
): ImageSourcePropType | undefined {
  const def = resolveRole(role);
  if (!def || def.dirs !== 1) return undefined;
  const frames = def.clips?.[clip] ?? 0;
  if (frames <= 1) return undefined;
  const key = def.keys[((frame % frames) + frames) % frames];
  return key ? PLAY_ART[key] : undefined;
}

/** Number of walk facings for a role (0 = no walk clip authored). */
export function skinWalkDirs(role: SkinRoleId): number {
  return resolveRole(role)?.walk?.dirs ?? 0;
}

/** Number of frames per facing in the role's walk clip (0 = none). */
export function skinWalkFrames(role: SkinRoleId): number {
  return resolveRole(role)?.walk?.frames ?? 0;
}

/** Sentinel from `skinWalkDirIndex` meaning "this heading has no honest walk
 * frame" — the caller keeps the static rotation instead. */
export const SKIN_WALK_NO_DIR = -1;

/**
 * Walk facing bucket for a role's walk clip (0..`skinWalkDirs(role)`-1).
 * 2-dir clips snap to east/west; 4-dir clips snap to the nearest cardinal
 * (diagonals fall to the closer cardinal, matching the `order` array below).
 * Returns `SKIN_WALK_NO_DIR` when the role has no walk clip, or when a 2-dir
 * clip is asked for a near-vertical heading it cannot express (playing a
 * sideways cycle there would be worse than the static rotation).
 */
export function skinWalkDirIndex(role: SkinRoleId, dx: number, dy: number): number {
  const walk = resolveRole(role)?.walk;
  if (!walk) return SKIN_WALK_NO_DIR;
  if (walk.dirs === 2) {
    // A 2-facing clip only has east + west art. Roads are axis-aligned, so a
    // vertical heading (|dx| ≈ 0) must fall back rather than pick a side.
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

/**
 * Art for one frame of a role's directional walk clip. Returns undefined when
 * the role authors no walk clip, so callers fall back to the rotation art.
 */
export function skinWalkArt(
  role: SkinRoleId,
  dirIndex: number,
  frame: number,
): ImageSourcePropType | undefined {
  const walk = resolveRole(role)?.walk;
  if (!walk || dirIndex < 0) return undefined;
  const dir = ((dirIndex % walk.dirs) + walk.dirs) % walk.dirs;
  const dirName = walk.order[dir];
  if (!dirName) return undefined;
  const f = ((frame % walk.frames) + walk.frames) % walk.frames;
  const key = `${walk.base}/${dirName}/frame_${String(f).padStart(3, '0')}`;
  return PLAY_ART[key];
}

/**
 * Top-left draw box for a sprite of `size` board units centred (or footed) on
 * the world point (`cx`, `cy`). Every presenter uses this so all layers stack
 * on one centre.
 *
 * `pivot: 'center'` puts the box middle on the point. `pivot: 'feet'` puts the
 * sprite's VISUAL feet on the point via the role's `footAt` (transparent
 * padding at the bottom of the PNG is compensated for, not drawn past).
 */
export function skinDrawBox(
  role: SkinRoleId,
  cx: number,
  cy: number,
  size: number,
): { x: number; y: number; size: number } {
  const def = resolveRole(role);
  if ((def?.pivot ?? 'center') === 'feet') {
    // `footAt` = fraction of the box height (from the top) holding the visual
    // feet; `1` means the art is flush to the bottom (no padding).
    const raw = def?.footAt;
    const footAt = typeof raw === 'number' && raw > 0 && raw <= 1 ? raw : 1;
    return { x: cx - size / 2, y: cy - size * footAt, size };
  }
  return { x: cx - size / 2, y: cy - size / 2, size };
}

/** Facing quantised to the role's `dirs`, as a rotation in degrees (east = 0).
 * `dirs: 1` has no distinct facings → 0. */
export function skinFacingDeg(
  role: SkinRoleId,
  dx: number,
  dy: number,
): number {
  const dirs = resolveRole(role)?.dirs ?? 1;
  if (dirs <= 1) return 0;
  const step = 360 / dirs;
  const raw = (Math.atan2(dy, dx) * 180) / Math.PI;
  return ((Math.round(raw / step) * step) % 360 + 360) % 360;
}

/* ----------------------------------------------------------- board chrome --- */

/**
 * Active board paint for the Defend screen (Trial + Main share it).
 *
 * - `neon` (default) — procedural Neon Viper chrome painted in code/SVG: void
 *   wall, glowing path corridor, magenta pad brackets. No field tiles / no road
 *   stamps (see `neon-chrome`).
 * - `grove-classic` — the Craftpix field tiles + cobble road stamps, kept as the
 *   original "Grove Classic" board skin.
 *
 * Swap this one value to preview either board. Gameplay geometry is untouched —
 * this is paint only.
 */
export type BoardSkinId = 'neon' | 'grove-classic';

export const BOARD_SKIN: BoardSkinId = 'neon';

export const BOARD_SKIN_LABEL: Record<BoardSkinId, string> = {
  neon: 'Neon Viper',
  'grove-classic': 'Grove Classic',
};

/** Which unit role plays each boss band (art only — bands/scaling unchanged).
 * Scout mini + scout boss now use the dedicated Titan-X `unit.boss_scout` role
 * (split off `unit.tank` so Knight stays the tank creep); semi/final keep their
 * kenney fallback sprites until their cast packs land. */
export const BAND_UNIT_ROLE = {
  final: 'unit.final',
  semi: 'unit.tank_alt',
  scoutBoss: 'unit.boss_scout',
  scoutMini: 'unit.boss_scout',
  runner: 'unit.runner',
} as const satisfies Record<string, SkinRoleId>;

/** Unit role for a boss band kind (`final` / `semi` / `scout` / `scout_mini`). */
export function bandUnitRole(kind: string): SkinRoleId {
  switch (kind) {
    case 'final':
      return BAND_UNIT_ROLE.final;
    case 'semi':
      return BAND_UNIT_ROLE.semi;
    case 'scout':
      return BAND_UNIT_ROLE.scoutBoss;
    case 'scout_mini':
      return BAND_UNIT_ROLE.scoutMini;
    default:
      return BAND_UNIT_ROLE.final;
  }
}
