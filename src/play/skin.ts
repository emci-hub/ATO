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
import { heroById, type HeroDef, BOUND_HERO_TOWER_CLIPS } from '@/play/heroes-data';
import { defaultTowerSkin, type TowerSkinDef, type TowerSkinRole } from '@/play/tower-skins-data';

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

/** Named multi-dir clips beyond the legacy `walk` field (the Avatar's cast set:
 * idle loop, attack/skill/hurt one-shots, dash). */
export type SkinAnimClipName = 'idle' | 'attack' | 'skill' | 'hurt' | 'dash';

/**
 * A multi-frame directional walk clip (creep legs while moving). Towers and
 * `dirs: 1` roles author no `walk`, so they keep static rotations.
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
   * the world point. The value is the role's measured alpha-bbox feet line
   * (shallowest idle rotation bottom) — `0.75` for the 64px creeps, lower for
   * the 128px/188px bosses + towers whose padding differs (see cast skin.json).
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
  /** Named multi-dir clips (`idle`/`attack`/`skill`/`hurt`/`dash`), same shape
   * as `walk`. The Avatar's cast role uses these for its directional cycle. */
  anims?: Partial<Record<SkinAnimClipName, SkinWalk>>;
  /** Solid tone + casing for a ribbon role (the road), sampled from the tile. */
  tone?: string;
  casing?: string;
};

/** One skin file: the roles it defines. A skin may define only a subset. */
type SkinFile = { pack: string; roles: Record<string, SkinRole> };

/** Minimum |dx| for a heading to count as honestly east/west. Below this the
 * heading is effectively vertical and the 2-facing walk clip has no art to show
 * for it, so `skinWalkDirIndex` declines and the static rotation stays — while
 * `skinWalkFace` (humanoid path walkers) keeps the last side profile instead.
 * Roads in this game are axis-aligned, so real headings sit near |dx| = 1 or
 * |dx| = 0. */
const WALK_2DIR_MIN_DX = 0.35;

/** Active skin first, fallbacks after. Per-role resolution walks the stack so a
 * partial skin only overrides the roles it actually defines. The cast skin
 * (PixelLab defaults) leads; craftpix-td owns map/props; kenney-td stays the
 * complete fallback for unit.avatar / fx.* / anything else. */
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
 *
 * Humanoid path walkers do NOT ask this for their own heading — a vertical road
 * would freeze them (`SKIN_WALK_NO_DIR`) or snap them north/south (4-dir clips).
 * They use `skinWalkFace` + `skinWalkFaceIndex` instead, which keep the last
 * east/west profile through the vertical run while the legs keep cycling.
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

/* -------------------------------------------- humanoid path walkers ------ */

/**
 * Side profile a humanoid path walker is drawn in. The cast authors honest
 * east/west side art only, so a walker on the road is always one of these two —
 * never rotated into the path tangent, never snapped to a north/south rotation.
 * Commercial TD practice: a minion on a switchback keeps its last side profile
 * through the vertical lane and lets the walk cycle carry the motion.
 */
export type SkinWalkFace = 'e' | 'w';

/**
 * Roles that ride the road as side-profile walkers: the three creeps
 * (Village Girl / Wizard / Knight) plus the scout mini-boss (Crimson Oni) and
 * the final boss (Archangel Commander). Towers sit on static pads, the Avatar
 * is player-driven, and the semi's kenney `unit.tank_alt` has no side-profile
 * art — none of those belong in this set.
 */
export const SKIN_PATH_WALKER_ROLES = [
  'unit.puff',
  'unit.runner',
  'unit.tank',
  'unit.boss_scout',
  'unit.final',
] as const satisfies readonly SkinRoleId[];

/** True for the roles drawn as humanoid side-profile path walkers. */
export function isPathWalker(role: SkinRoleId): boolean {
  return (SKIN_PATH_WALKER_ROLES as readonly SkinRoleId[]).includes(role);
}

/**
 * Sticky side profile for a path walker heading along (`dx`, `dy`).
 *
 * `|dx| >= WALK_2DIR_MIN_DX` means the heading is honestly east/west, so the
 * face follows the sign of `dx`. Below that the heading is vertical (straight
 * vertical lanes / the corners' tangent) and the walker keeps `lastFace`. The
 * caller keeps advancing the walk frame from distance travelled, so a vertical
 * run reads as a side-profile walk rather than a north/south snap or a frozen
 * glide. Pass a spawn's first face in as `lastFace` (the caller defaults `'e'`).
 */
export function skinWalkFace(dx: number, lastFace: SkinWalkFace): SkinWalkFace {
  if (Math.abs(dx) >= WALK_2DIR_MIN_DX) return dx >= 0 ? 'e' : 'w';
  return lastFace;
}

/**
 * Index into a role's walk `order` for one side profile — the walk frame row to
 * play. Handles both authored shapes: 2-dir clips (`[east, west]`) and 4-dir
 * clips (`[north, east, south, west]`), where a path walker deliberately uses
 * only the east/west rows and leaves the north/south rows unused at runtime
 * (the assets stay in the pack; only the draw ignores them).
 * Returns `SKIN_WALK_NO_DIR` when the role authors no walk clip — or its order
 * has no such side — so the caller falls back to the rotation art.
 */
export function skinWalkFaceIndex(role: SkinRoleId, face: SkinWalkFace): number {
  const walk = resolveRole(role)?.walk;
  if (!walk) return SKIN_WALK_NO_DIR;
  const index = walk.order.indexOf(face === 'e' ? 'east' : 'west');
  return index >= 0 ? index : SKIN_WALK_NO_DIR;
}

/**
 * Index into a role's static `keys` for one side profile — the idle/fallback
 * rotation to draw when the walk clip is missing or a frame isn't authored.
 * Matched on the key's trailing path segment so `east` never lands on
 * `north-east` / `south-east`. Falls back to 0 (the first/north key) only when
 * the resolved skin has no `east`/`west` key at all — unreachable for the five
 * path-walker roles, whose cast keys always carry both sides. A `dirs: 1` role
 * has a single up-facing sprite and ignores the index anyway.
 */
export function skinFaceArtIndex(role: SkinRoleId, face: SkinWalkFace): number {
  const keys = resolveRole(role)?.keys;
  if (!keys || keys.length === 0) return 0;
  const re = face === 'e' ? /(?:^|\/)east$/ : /(?:^|\/)west$/;
  const index = keys.findIndex((key) => re.test(key));
  return index >= 0 ? index : 0;
}

/**
 * Art for one frame of a directional clip (`walk` or a named `anims` clip).
 * Returns undefined when the clip is absent or the frame key isn't authored, so
 * callers fall back to the rotation art.
 */
export function directionalClipArt(
  clip: { dirs: number; order: readonly string[]; frames: number; base: string } | undefined,
  dirIndex: number,
  frame: number,
): ImageSourcePropType | undefined {
  if (!clip || dirIndex < 0) return undefined;
  const dir = ((dirIndex % clip.dirs) + clip.dirs) % clip.dirs;
  const dirName = clip.order[dir];
  if (!dirName) return undefined;
  const f = ((frame % clip.frames) + clip.frames) % clip.frames;
  const key = `${clip.base}/${dirName}/frame_${String(f).padStart(3, '0')}`;
  return PLAY_ART[key];
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
  return directionalClipArt(resolveRole(role)?.walk, dirIndex, frame);
}

/** Number of frames in a role's named directional clip (0 when unauthored). */
export function skinAnimFrames(role: SkinRoleId, clip: SkinAnimClipName): number {
  return resolveRole(role)?.anims?.[clip]?.frames ?? 0;
}

/**
 * Index into a role's named directional clip `order` for one side profile —
 * the frame row to play. Returns `SKIN_WALK_NO_DIR` when the clip is missing or
 * its order has no such side.
 */
export function skinAnimFaceIndex(
  role: SkinRoleId,
  clip: SkinAnimClipName,
  face: SkinWalkFace,
): number {
  const anim = resolveRole(role)?.anims?.[clip];
  if (!anim) return SKIN_WALK_NO_DIR;
  const index = anim.order.indexOf(face === 'e' ? 'east' : 'west');
  return index >= 0 ? index : SKIN_WALK_NO_DIR;
}

/**
 * Art for one frame of a role's named directional clip (idle/attack/skill/
 * hurt/dash). Returns undefined when the role authors no such clip, so callers
 * fall back to the rotation art.
 */
export function skinAnimArt(
  role: SkinRoleId,
  clip: SkinAnimClipName,
  dirIndex: number,
  frame: number,
): ImageSourcePropType | undefined {
  return directionalClipArt(resolveRole(role)?.anims?.[clip], dirIndex, frame);
}

/**
 * Feet anchor for a `pivot: 'feet'` role, clamped to (0, 1]. Falls back to 1
 * (box bottom) when the role omits `footAt` or pivots center.
 */
export function skinFootAt(role: SkinRoleId): number {
  const raw = resolveRole(role)?.footAt;
  return typeof raw === 'number' && raw > 0 && raw <= 1 ? raw : 1;
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
 * Scout mini + scout boss use the Crimson Oni `unit.boss_scout` role; final
 * uses the Archangel Commander `unit.final` role; semi keeps its kenney
 * fallback sprite until its cast pack lands. */
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

/* ------------------------------------------- dynamic Avatar hero role ---- */
/* A3 — the Avatar the board draws is the hero the player set in Dress
 * (`active_avatar_hero_id`), not a fixed Corvus role. The `unit.avatar` role
 * stays in the cast skin as Corvus (the starter + the fallback); the helpers
 * below build the SAME shape for any hero from its `heroes.json` def, so there
 * is one code path and no per-hero skin.json duplication. */

/** Canonical north-first rotation order — every cast hero folder ships the same
 * 8 rotations the `unit.avatar` role lists. */
const CAST_ROTATION_DIRS = [
  'north',
  'north-east',
  'east',
  'south-east',
  'south',
  'south-west',
  'west',
  'north-west',
] as const;

/** `footAt` (feet-line fraction of the drawn box, from the top) per hero id,
 * matching the measured values the cast skin already carries for the same art:
 * `unit.avatar` (Corvus) 0.7417, `unit.final` (Archangel) 0.7344,
 * `unit.boss_scout` (Oni) 0.7447. Art-less heroes fall back to the Corvus role
 * anyway, so this only needs the heroes whose art can actually be bundled. */
const HERO_FOOT_AT: Readonly<Record<string, number>> = {
  corvus: 0.7417,
  archangel: 0.7344,
  oni: 0.7447,
};

/** A 2-dir E/W `SkinWalk` for one of a hero's clip folders, frame count measured
 * from the generated registry (east == west, enforced by `check:heroes`).
 * Returns undefined when the hero omits the clip or its art is not bundled —
 * callers fall back to idle/rotation art for that slot instead of inventing
 * frames or a PNG. */
function heroClipWalk(hero: HeroDef, name: string | undefined): SkinWalk | undefined {
  if (!name) return undefined;
  const base = `${hero.folder.replace(/^assets\/play\//, '')}/animations/${name}`;
  let frames = 0;
  while (PLAY_ART[`${base}/east/frame_${String(frames).padStart(3, '0')}`]) frames += 1;
  return frames > 0 ? { dirs: 2, order: ['east', 'west'], frames, base } : undefined;
}

/**
 * The `unit.avatar` role for the hero the player set as their Avatar.
 *
 * Built from the hero's `heroes.json` def — its cast folder (8 rotations) plus
 * its authored clips as `walk` / named `anims` — with frame counts read from the
 * generated registry, so there is no per-hero skin.json duplication and a hero
 * whose art hasn't been copied is an honest stub. Falls back to the static
 * Corvus `unit.avatar` role when the id is unknown or none of its art is
 * bundled, so a stale save or an art-less hero (Aurex/Kitsune today) still
 * draws rather than crashing or rendering blank.
 */
export function heroAvatarRole(heroId: string): SkinRole {
  const fallback = resolveRole('unit.avatar');
  const hero = heroById(heroId);
  if (!hero) return fallback ?? { keys: [], dirs: 8, pivot: 'feet' };

  const base = hero.folder.replace(/^assets\/play\//, '');
  const keys = CAST_ROTATION_DIRS.map((dir) => `${base}/rotations/${dir}`);
  const walk = heroClipWalk(hero, hero.clips.walk);
  const anims: SkinRole['anims'] = {};
  for (const clip of ['idle', 'attack', 'skill', 'hurt', 'dash'] as const) {
    const w = heroClipWalk(hero, hero.clips[clip]);
    if (w) anims[clip] = w;
  }

  // None of the hero's art is bundled (no clips AND no rotations) — the honest
  // stub. Keep the Corvus role so the board always has a sprite to draw.
  const anyArt =
    walk != null || Object.keys(anims).length > 0 || PLAY_ART[keys[2]] != null;
  if (!anyArt) return fallback ?? { keys: [], dirs: 8, pivot: 'feet' };

  return {
    keys,
    dirs: 8,
    pivot: 'feet',
    footAt: HERO_FOOT_AT[hero.id] ?? 0.7417,
    cellPx: 120,
    units: 24,
    walk,
    anims,
  };
}

/* ------------------------------------------- tower clip-kit role ------- */
/* K1 — towers are stationary humanoids. The board keeps the static cast
 * rotation role (8-dir keys + footAt/units/scales) and OVERLAYS the tower
 * skin's idle/attack/skill clips as `anims`, so the renderer plays a breathing
 * idle loop, a shoot one-shot, and (K1b) a skill one-shot when the art is
 * bundled — and falls back to the static rotations when it is not (today: no
 * tower animation folders exist). `skill` only appears when the skin authors
 * `clips.skill`; a null skill contributes no `skill` anim, so the FSM skips it. */

/** Tower kind → cast skin role id (art only). Same mapping `defend-screen`'s
 * `TOWER_ROLE` uses; kept here so the clip-kit builder and the renderer read
 * one canonical role per tower kind. */
export const TOWER_KIND_ROLE: Record<TowerSkinRole, SkinRoleId> = {
  archer: 'tower.archer',
  vine: 'tower.vine',
  crystal: 'tower.crystal',
};

/** A 2-dir E/W `SkinWalk` for one of a tower skin's clip folders, frame count
 * measured from the generated registry (east == west). Returns undefined when
 * the skin omits the clip or its art is not bundled — callers fall back to the
 * static rotation instead of inventing frames. */
function towerClipWalk(skin: TowerSkinDef, name: string | undefined): SkinWalk | undefined {
  if (!name) return undefined;
  const base = `${skin.folder.replace(/^assets\/play\//, '')}/animations/${name}`;
  let frames = 0;
  while (PLAY_ART[`${base}/east/frame_${String(frames).padStart(3, '0')}`]) frames += 1;
  return frames > 0 ? { dirs: 2, order: ['east', 'west'], frames, base } : undefined;
}

/** The draw role for a tower kind: the static cast rotation role PLUS the tower
 * skin's idle/attack/skill clips as `anims`. Falls back to the static role when
 * the kind is unknown or none of the skin's clip art is bundled, so a tower
 * whose clips haven't been copied still draws its rotation instead of crashing. */
export function towerSkinRole(kind: TowerSkinRole): SkinRole {
  const base = resolveRole(TOWER_KIND_ROLE[kind]);
  if (!base) return { keys: [], dirs: 8, pivot: 'feet' };
  const skin = defaultTowerSkin(kind);
  if (!skin) return base;
  const anims: SkinRole['anims'] = {};
  for (const clip of ['idle', 'attack', 'skill'] as const) {
    const w = towerClipWalk(skin, skin.clips[clip]);
    if (w) anims[clip] = w;
  }
  if (Object.keys(anims).length === 0) return base;
  return { ...base, anims };
}

/* ------------------------------------------- bound hero as tower -------- */
/* A6 prep — a hero bound as a tower (Slice A2 → A6) resolves its idle/attack/
 * skill clips from `heroes.json` through the SAME `heroAvatarRole` builder the
 * Avatar uses, narrowed to the tower FSM's three slots. No placement UI yet:
 * this is the resolve path only, so Archangel's skill clip is playable the day
 * A6 places a hero on a pad. An unknown/art-less hero falls back to the Corvus
 * role (heroAvatarRole's own fallback), so the board always has a sprite. */
export function resolveBoundHeroTowerKit(heroId: string): SkinRole {
  const role = heroAvatarRole(heroId); // 8 rotations + full frame-counted anims
  const anims: SkinRole['anims'] = {};
  for (const clip of BOUND_HERO_TOWER_CLIPS) {
    if (role.anims?.[clip]) anims[clip] = role.anims[clip];
  }
  // A tower never walks — drop the hero's locomotion clip.
  return { ...role, walk: undefined, anims };
}

/** Feet anchor for a role object (same clamp as `skinFootAt`). */
export function roleFootAt(role: SkinRole | undefined): number {
  const raw = role?.footAt;
  return typeof raw === 'number' && raw > 0 && raw <= 1 ? raw : 1;
}

/** Static rotation art for a role object at a facing index. */
export function roleArt(
  role: SkinRole | undefined,
  dirIndex = 0,
): ImageSourcePropType | undefined {
  if (!role || role.keys.length === 0) return undefined;
  const key =
    role.dirs === 1
      ? role.keys[0]
      : role.keys[((dirIndex % role.keys.length) + role.keys.length) % role.keys.length];
  return key ? PLAY_ART[key] : undefined;
}

/** Index into a role object's static `keys` for one side profile (east/west). */
export function roleFaceArtIndex(role: SkinRole | undefined, face: SkinWalkFace): number {
  const keys = role?.keys;
  if (!keys || keys.length === 0) return 0;
  const re = face === 'e' ? /(?:^|\/)east$/ : /(?:^|\/)west$/;
  const index = keys.findIndex((key) => re.test(key));
  return index >= 0 ? index : 0;
}

/** Index into a role object's walk `order` for one side profile. */
export function roleWalkFaceIndex(role: SkinRole | undefined, face: SkinWalkFace): number {
  const walk = role?.walk;
  if (!walk) return SKIN_WALK_NO_DIR;
  const index = walk.order.indexOf(face === 'e' ? 'east' : 'west');
  return index >= 0 ? index : SKIN_WALK_NO_DIR;
}

/** Index into a role object's named clip `order` for one side profile. */
export function roleAnimFaceIndex(
  role: SkinRole | undefined,
  clip: SkinAnimClipName,
  face: SkinWalkFace,
): number {
  const anim = role?.anims?.[clip];
  if (!anim) return SKIN_WALK_NO_DIR;
  const index = anim.order.indexOf(face === 'e' ? 'east' : 'west');
  return index >= 0 ? index : SKIN_WALK_NO_DIR;
}
