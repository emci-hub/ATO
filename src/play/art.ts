/**
 * Play art accessors — the single place code turns a stable id (item, avatar,
 * beast, tile) into a bundled `require()` source. Packs live under
 * `assets/play/` (see GAME_SPEC §19); keys are emitted by
 * `scripts/play-art-prep.ts` into `generated-play-assets.ts`.
 *
 * Add art = unpack the pack under `assets/play/`, re-run the prep script, and
 * (if it needs a stable id) add a mapping here. No screen should `require()` a
 * play PNG directly.
 *
 * The board cast is the **Kenney Tower Defense** pack (grass/dirt terrain,
 * towers, top-down units). Scribble / Primal / Dungeon Legends / Masterpiece /
 * Cozy are no longer loaded for the board (their files stay on disk). The
 * locked tile ids live in `games/grove/KENNEY_TD_TILE_MAP.md`.
 */
import type { ImageSourcePropType } from 'react-native';

import { PLAY_ART } from '@/play/generated-play-assets';

/** An 8-way facing (matches the rotation folders the packs ship). */
export type Dir8 =
  | 'north'
  | 'north-east'
  | 'east'
  | 'south-east'
  | 'south'
  | 'south-west'
  | 'west'
  | 'north-west';

/** The board is top-down: +x is east, +y is south (screen-down). */
export function dir8FromDelta(dx: number, dy: number): Dir8 {
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI; // -180..180, 0 = east
  const octant = Math.round(angle / 45) % 8;
  const table: readonly Dir8[] = [
    'east',
    'south-east',
    'south',
    'south-west',
    'west',
    'north-west',
    'north',
    'north-east',
  ];
  return table[(octant + 8) % 8] ?? 'south';
}

function art(key: string): ImageSourcePropType | undefined {
  return PLAY_ART[key];
}

/* --------------------------------------------------- Kenney Tower Defense --- */

/**
 * Locked board-cast tile ids (see `games/grove/KENNEY_TD_TILE_MAP.md`). Every
 * sprite is a single top-down 64px tile — no rotation sheets, so facing is a
 * transform, not a different image.
 */
export const TD_TILE = {
  /** Grass floor — painted under the whole board. */
  grass: 24,
  /** Dirt path — painted on every path cell (no corner autotile this pass). */
  path: 50,
  /** Tower pad slot marker. */
  pad: 181,
  /** Towers (art only; jobs + math unchanged). */
  towerArcher: 249,
  towerVine: 206,
  towerCrystal: 250,
  /** Units. */
  avatar: 247,
  puff: 245,
  runner: 248,
  tank: 268,
  tankAlt: 269,
  final: 271,
  coin: 272,
  projectile: 273,
} as const;

/** One Kenney Tower Defense tile by number (`towerDefense_tileNNN`). */
export function tdTile(n: number): ImageSourcePropType | undefined {
  return art(`kenney-td/towerDefense_tile${String(n).padStart(3, '0')}`);
}

/* ------------------------------------------------------------------ tiles --- */

export type PlayTileId =
  | 'floor'
  | 'wall'
  | 'path'
  | 'path_curve'
  | 'door'
  | 'stairs';

const TILE_FILES: Record<PlayTileId, string> = {
  floor: 'tiles',
  wall: 'wall',
  path: 'path',
  path_curve: 'path_curve',
  door: 'door_open',
  stairs: 'stairs_down',
};

/** A Scribble Dungeons 64px tile by stable id. Kept for non-board UI use. */
export function playTile(id: PlayTileId): ImageSourcePropType | undefined {
  return art(`tiles/scribble-dungeons/${TILE_FILES[id]}`);
}

/* ------------------------------------------------------------------ icons --- */

/** `items.json` `core.art` id → Kenney Cursor Pack icon. Missing = no icon. */
const ITEM_ICON_BY_ART: Record<string, string> = {
  cape_leaf_01: 'tool_torch',
  cape_glow_01: 'tool_wand',
  cloak_curator_01: 'tool_torch',
  cloak_ember_01: 'tool_wand',
  staff_bud_01: 'tool_bow',
  helm_salt_01: 'gauntlet_default',
  robe_moss_01: 'gauntlet_open',
  trinket_pearl_01: 'target_round_a',
  trinket_copper_01: 'dot_large',
  blade_tide_01: 'tool_sword_a',
  blade_ember_01: 'tool_sword_b',
  shield_bark_01: 'gauntlet_default',
  shield_ember_01: 'gauntlet_open',
};

/** Item art source for a `core.art` value, or undefined (render a placeholder). */
export function itemArtSource(itemArt: string): ImageSourcePropType | undefined {
  const file = ITEM_ICON_BY_ART[itemArt];
  return file ? art(`kenney-icons/${file}`) : undefined;
}

/** A raw Kenney Cursor Pack icon by file id (shop rows, misc UI). */
export function cursorIcon(file: string): ImageSourcePropType | undefined {
  return art(`kenney-icons/${file}`);
}

/* ----------------------------------------------------------------- towers --- */

export type TowerArtId = 'archer' | 'vine' | 'crystal';

/** Kenney TD tower art per job. Jobs, ranges and math are unchanged. */
const TOWER_TILE: Record<TowerArtId, number> = {
  archer: TD_TILE.towerArcher,
  vine: TD_TILE.towerVine,
  crystal: TD_TILE.towerCrystal,
};

/** Kenney TD sprite used as a tower on the pad. */
export function towerArtSource(kind: TowerArtId): ImageSourcePropType | undefined {
  return tdTile(TOWER_TILE[kind]);
}

/** Normal puff silhouette (Kenney TD unit). */
export const PUFF_ART: ImageSourcePropType | undefined = tdTile(TD_TILE.puff);

/* ---------------------------------------------------------------- avatars --- */

/**
 * One top-down soldier sprite for every Avatar (the TD pack has no per-hero
 * art). Identity still comes from `avatars.ts` (name/icon/colour); the board
 * draws this single sprite and rotates it toward the nearest foe.
 */
export function avatarSprite(): ImageSourcePropType | undefined {
  return tdTile(TD_TILE.avatar);
}

/* ----------------------------------------------------------------- primal --- */

/**
 * Board enemy roles (Kenney TD units). `final` is the heavy boss sprite; the
 * mid bands reuse the tank sprites at different scales.
 */
export type EnemyRole = 'puff' | 'runner' | 'tank' | 'tankAlt' | 'final';

const ENEMY_TILE: Record<EnemyRole, number> = {
  puff: TD_TILE.puff,
  runner: TD_TILE.runner,
  tank: TD_TILE.tank,
  tankAlt: TD_TILE.tankAlt,
  final: TD_TILE.final,
};

/** The Kenney TD sprite for an enemy role. */
export function enemyArtSource(role: EnemyRole): ImageSourcePropType | undefined {
  return tdTile(ENEMY_TILE[role]);
}

/**
 * Which enemy sprite plays each boss band (art only — bands/scaling unchanged).
 * Mini/scout use the tanks, semi the alt tank, the Final the heavy tile.
 */
export const ENEMY_CAST = {
  final: 'final',
  semi: 'tankAlt',
  scoutBoss: 'tank',
  scoutMini: 'tank',
  runner: 'runner',
} as const satisfies Record<string, EnemyRole>;

/** Projectile sprite for shot FX (optional polish). */
export const PROJECTILE_ART: ImageSourcePropType | undefined = tdTile(TD_TILE.projectile);
/** Coin sprite for reward FX (optional polish). */
export const COIN_ART: ImageSourcePropType | undefined = tdTile(TD_TILE.coin);
