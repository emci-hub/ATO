/**
 * Play art accessors — the single place code turns a stable id (item icon,
 * misc UI) into a bundled `require()` source. Packs live under `assets/play/`
 * (see GAME_SPEC §19); keys are emitted by `scripts/play-art-prep.ts` into
 * `generated-play-assets.ts`.
 *
 * Board ENTITIES (terrain, towers, units, FX) do NOT live here — they are
 * addressed through the skin contract in `src/play/skin.ts` (role → art key),
 * so screens never reference a raw tile id. This module keeps only the
 * non-entity art: item/shop icons.
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
