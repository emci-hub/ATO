/**
 * Defend entity skin contract (v0 — Kenney Tower Defense).
 *
 * `assets/play/skins/kenney-td/skin.json` is the single place that maps a
 * game ROLE (`tower.archer`, `unit.puff`, `fx.shot`, …) to art keys + draw
 * metadata (dirs / pivot / units / per-level scales). Code reads roles only —
 * no raw `towerDefense_tileNNN` outside this contract (see
 * `games/grove/KENNEY_TD_TILE_MAP.md`).
 *
 * Everything on the board shares one world space: 0..1 path fractions and
 * 0..100 pad/enemy/avatar board units. `skinDrawBox()` turns a world point +
 * size into the top-left box the renderer needs, honouring `pivot`, so the pad
 * marker, tower, enemy, avatar, range ring and projectile all stack on the
 * same centre.
 */
import type { ImageSourcePropType } from 'react-native';

import rawSkin from '@/assets/play/skins/kenney-td/skin.json';
import { PLAY_ART } from '@/play/generated-play-assets';

export type SkinRoleId =
  | 'map.grass'
  | 'map.path'
  | 'map.pad'
  | 'tower.archer'
  | 'tower.vine'
  | 'tower.crystal'
  | 'unit.avatar'
  | 'unit.puff'
  | 'unit.runner'
  | 'unit.tank'
  | 'unit.tank_alt'
  | 'unit.final'
  | 'fx.shot'
  | 'fx.coin';

export type SkinPivot = 'center' | 'feet';
export type SkinDirs = 1 | 4 | 8;

/** Frame counts per clip. Kenney v0 ships 1 frame for every clip. */
export type SkinClips = { idle?: number; walk?: number; attack?: number };

export type SkinRole = {
  /** Art-registry keys. `dirs: 1` uses `keys[0]`; 4/8 index by facing. */
  keys: readonly string[];
  dirs: SkinDirs;
  pivot: SkinPivot;
  /** Source tile size in px (informational — the board scales in units). */
  cellPx?: number;
  /** Drawn box edge in board units (0..100 space). */
  units?: number;
  /** Per-level size multipliers: `scales[level - 1]` (Lv1..Lv3). */
  scales?: readonly number[];
  clips?: SkinClips;
};

const ROLES = rawSkin.roles as unknown as Record<string, SkinRole>;

/** The role definition, or undefined when the id is not in the skin. */
export function getSkinRole(role: SkinRoleId): SkinRole | undefined {
  return ROLES[role];
}

/** Art source for a role. With `dirs > 1`, `dirIndex` picks the facing. */
export function skinArt(
  role: SkinRoleId,
  dirIndex = 0,
): ImageSourcePropType | undefined {
  const def = ROLES[role];
  if (!def || def.keys.length === 0) return undefined;
  const key =
    def.dirs === 1
      ? def.keys[0]
      : def.keys[((dirIndex % def.keys.length) + def.keys.length) % def.keys.length];
  return key ? PLAY_ART[key] : undefined;
}

/** Drawn box edge for a role (board units), falling back to `fallbackUnits`. */
export function skinUnits(role: SkinRoleId, fallbackUnits: number): number {
  const units = ROLES[role]?.units;
  return typeof units === 'number' && units > 0 ? units : fallbackUnits;
}

/** Level multiplier for a role (Lv1..LvN), clamped; 1 when no scales. */
export function skinScale(role: SkinRoleId, level: number): number {
  const scales = ROLES[role]?.scales;
  if (!scales || scales.length === 0) return 1;
  const index = Math.max(0, Math.min(scales.length - 1, Math.floor(level) - 1));
  return scales[index] ?? 1;
}

/** Frame counts for a clip (0 when the clip isn't authored). */
export function skinClipFrames(role: SkinRoleId, clip: keyof SkinClips): number {
  return ROLES[role]?.clips?.[clip] ?? 0;
}

/**
 * Art for a multi-frame clip on a `dirs: 1` role: `keys` are read as frames
 * (index 0 = frame 0). Returns undefined when the role has no such clip or only
 * one frame, so callers fall back to the idle art (Kenney v0 ships 1 frame).
 */
export function skinClipArt(
  role: SkinRoleId,
  clip: keyof SkinClips,
  frame: number,
): ImageSourcePropType | undefined {
  const def = ROLES[role];
  if (!def || def.dirs !== 1) return undefined;
  const frames = def.clips?.[clip] ?? 0;
  if (frames <= 1) return undefined;
  const key = def.keys[((frame % frames) + frames) % frames];
  return key ? PLAY_ART[key] : undefined;
}

/**
 * Top-left draw box for a sprite of `size` board units centred (or footed) on
 * the world point (`cx`, `cy`). Every presenter uses this so all layers stack
 * on one centre.
 */
export function skinDrawBox(
  role: SkinRoleId,
  cx: number,
  cy: number,
  size: number,
): { x: number; y: number; size: number } {
  const pivot = ROLES[role]?.pivot ?? 'center';
  if (pivot === 'feet') return { x: cx - size / 2, y: cy - size, size };
  return { x: cx - size / 2, y: cy - size / 2, size };
}

/** Facing quantised to the role's `dirs`, as a rotation in degrees (east = 0).
 * `dirs: 1` has no distinct facings → 0. */
export function skinFacingDeg(
  role: SkinRoleId,
  dx: number,
  dy: number,
): number {
  const dirs = ROLES[role]?.dirs ?? 1;
  if (dirs <= 1) return 0;
  const step = 360 / dirs;
  const raw = (Math.atan2(dy, dx) * 180) / Math.PI;
  return ((Math.round(raw / step) * step) % 360 + 360) % 360;
}

/** Which unit role plays each boss band (art only — bands/scaling unchanged). */
export const BAND_UNIT_ROLE = {
  final: 'unit.final',
  semi: 'unit.tank_alt',
  scoutBoss: 'unit.tank',
  scoutMini: 'unit.tank',
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
