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
 * Tower / puff bodies reuse the already-bundled Kenney shape-character family
 * (`assets/kenney/shape/`, see `@/lib/kenney/generated-assets`): the incoming
 * Play pack drop had no separate shape zip, and this keeps one copy on disk.
 */
import type { ImageSourcePropType } from 'react-native';

import { KENNEY_ASSETS } from '@/lib/kenney/generated-assets';
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

/** A 4-way facing (only the animation folders ship 4 dirs). */
export type Dir4 = 'north' | 'east' | 'south' | 'west';

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

export function dir4FromDelta(dx: number, dy: number): Dir4 {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'east' : 'west';
  return dy >= 0 ? 'south' : 'north';
}

/** Collapse an 8-way facing to the nearest 4-way animation folder. */
export function dir4(dir: Dir8): Dir4 {
  switch (dir) {
    case 'east':
    case 'north-east':
    case 'south-east':
      return 'east';
    case 'west':
    case 'north-west':
    case 'south-west':
      return 'west';
    case 'north':
      return 'north';
    default:
      return 'south';
  }
}

function art(key: string): ImageSourcePropType | undefined {
  return PLAY_ART[key];
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

/** A Scribble Dungeons 64px tile by stable id. */
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

const TOWER_SHAPE: Record<TowerArtId, string> = {
  archer: 'shape/body/square.green.png',
  vine: 'shape/body/circle.green.png',
  crystal: 'shape/body/rhombus.purple.png',
};

/** Kenney shape-character body used as a tower sprite. */
export function towerArtSource(kind: TowerArtId): ImageSourcePropType | undefined {
  return KENNEY_ASSETS[TOWER_SHAPE[kind]];
}

/** Kenney shape-character body for the normal puff silhouette. */
export const PUFF_ART: ImageSourcePropType | undefined = KENNEY_ASSETS['shape/body/circle.pink.png'];

/* ---------------------------------------------------------------- avatars --- */

/** Avatar id → pack folder. Unknown ids fall back to the starter. */
const AVATAR_PACK: Record<string, string> = {
  ava_sprout: 'avatars/masterpiece',
  ava_ember: 'avatars/cozy-girl',
};

const AVATAR_ATTACK_ANIM: Record<string, string> = {
  'avatars/masterpiece': 'Iron_Slash',
  'avatars/cozy-girl': 'Pick_Up_item',
};

export const AVATAR_IDLE_FRAMES = 4;
export const AVATAR_ATTACK_FRAMES = 9;

function avatarPack(avatarId: string): string {
  return AVATAR_PACK[avatarId] ?? 'avatars/masterpiece';
}

/** One idle-breath frame for an avatar, facing `dir`. */
export function avatarIdleFrame(
  avatarId: string,
  dir: Dir4,
  frame: number,
): ImageSourcePropType | undefined {
  const n = ((frame % AVATAR_IDLE_FRAMES) + AVATAR_IDLE_FRAMES) % AVATAR_IDLE_FRAMES;
  return art(`${avatarPack(avatarId)}/animations/Breathing_Idle/${dir}/frame_00${n}`);
}

/** One attack (slash / pickup) frame for an avatar, facing `dir`. */
export function avatarAttackFrame(
  avatarId: string,
  dir: Dir4,
  frame: number,
): ImageSourcePropType | undefined {
  const n = Math.max(0, Math.min(AVATAR_ATTACK_FRAMES - 1, frame));
  const anim = AVATAR_ATTACK_ANIM[avatarPack(avatarId)] ?? 'Iron_Slash';
  return art(`${avatarPack(avatarId)}/animations/${anim}/${dir}/frame_00${n}`);
}

/** The 8-way resting rotation for an avatar (used under reduce-motion). */
export function avatarRotation(
  avatarId: string,
  dir: Dir8,
): ImageSourcePropType | undefined {
  return art(`${avatarPack(avatarId)}/rotations/${dir}`);
}

/* ----------------------------------------------------------------- primal --- */

export type PrimalBeast =
  | 'jaguar_sun_guardian'
  | 'panther_shadowblade'
  | 'lynx_huntress'
  | 'raven_deathcaller'
  | 'mammoth_warchief'
  | 'cobra_oracle'
  | 'gorilla_titan'
  | 'rhino_juggernaut'
  | 'buffalo_earthshaker'
  | 'shark_tide_knight';

/** One 8-way idle rotation for a Primal Dynasties beast. */
export function primalRotation(
  beast: PrimalBeast,
  dir: Dir8,
): ImageSourcePropType | undefined {
  return art(`primal/${beast}/Idle/rotations/${dir}`);
}

/** The §19 cast lock: which beast stands in for which board role. */
export const PRIMAL_CAST = {
  final: 'jaguar_sun_guardian',
  semi: 'mammoth_warchief',
  scoutBoss: 'raven_deathcaller',
  scoutMini: 'panther_shadowblade',
  runner: 'lynx_huntress',
} as const satisfies Record<string, PrimalBeast>;
