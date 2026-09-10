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
 * Tower bodies and the normal puff silhouette come from the Dungeon Legends
 * pack (towers) and the already-bundled Kenney shape family (puffs) —
 * `assets/kenney/shape/`, see `@/lib/kenney/generated-assets`.
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

/** Where the Dungeon Legends avatar packs live under `assets/play/`. */
const DUNGEON_LEGENDS_DIR = 'avatars/dungeon-legends';

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

/**
 * §19 cast lock — tower sprites come from the Dungeon Legends pack (a small
 * body reading south so the pad stays readable under the level badge). Jobs and
 * math are unchanged; this is an art swap over the old Kenney shape bodies.
 */
const TOWER_LEGEND: Record<TowerArtId, string> = {
  archer: '05_ARCANE_ENGINEER',
  vine: '06_DUNGEON_WITCH',
  crystal: '10_SERAPHIC_DUNGEON_CLERIC',
};

/** Dungeon Legends sprite used as a tower on the pad (south-facing). */
export function towerArtSource(kind: TowerArtId): ImageSourcePropType | undefined {
  return art(`${DUNGEON_LEGENDS_DIR}/${TOWER_LEGEND[kind]}/rotations/south`);
}

/** Kenney shape-character body for the normal puff silhouette. */
export const PUFF_ART: ImageSourcePropType | undefined = KENNEY_ASSETS['shape/body/circle.pink.png'];

/* ---------------------------------------------------------------- avatars --- */

/**
 * Avatar id → Dungeon Legends pack folder. Every legend ships 8 idle rotations
 * (no walk/attack sheets), so the board reads facing from `avatarRotation` and
 * a short tint/flash stands in for the attack (no Iron_Slash dependency).
 *
 * The starter keeps its legacy id `ava_sprout` so existing saves retain their
 * level/stars/park/equipped — only its identity + art changed (it is the Druid
 * now). The other nine are unlockable stubs.
 */
const AVATAR_PACK: Record<string, string> = {
  ava_sprout: '03_DUNGEON_DRUID', // starter — Dungeon Druid
  ava_assassin: '02_ABYSSAL_ASSASSIN',
  ava_champion: '04_DRAGONBLOOD_CHAMPION',
  ava_engineer: '05_ARCANE_ENGINEER',
  ava_witch: '06_DUNGEON_WITCH',
  ava_ratkin: '07_RATKIN_TREASURE_HUNTER',
  ava_berserker: '08_CRYSTAL_BERSERKER',
  ava_death_knight: '09_DEATH_KNIGHT',
  ava_cleric: '10_SERAPHIC_DUNGEON_CLERIC',
  ava_demon_guardian: '11_FREE_BONUS_ABYSSAL_DEMON_GUARDIAN',
};

/** Starter pack — the fallback for any unknown avatar id. */
const STARTER_PACK = AVATAR_PACK.ava_sprout!;

function avatarPack(avatarId: string): string {
  return AVATAR_PACK[avatarId] ?? STARTER_PACK;
}

/** The 8-way idle rotation for an avatar (the pack ships rotations only). */
export function avatarRotation(
  avatarId: string,
  dir: Dir8,
): ImageSourcePropType | undefined {
  return art(`${DUNGEON_LEGENDS_DIR}/${avatarPack(avatarId)}/rotations/${dir}`);
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
