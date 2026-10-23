/**
 * Play art accessors — the single place code turns a stable id (item icon,
 * misc UI) into a bundled `require()` source. Packs live under `assets/play/`
 * (see GAME_SPEC §19); keys are emitted by `scripts/play-art-prep.ts` into
 * `generated-play-assets.ts`.
 *
 * Board ENTITIES (terrain, towers, units, FX) do NOT live here — they are
 * addressed through the skin contract in `src/play/skin.ts` (role → art key),
 * so screens never reference a raw tile id. This module keeps only the
 * non-entity art: item icons (through the art library) and the Kenney cursor icons the shop
 * rows still fall back to.
 */
import type { ImageSourcePropType } from 'react-native';

import { ART, getArtSource } from '@/art/art';
import type { ArtId } from '@/art/generated-art';
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

/**
 * One Streetwear 32 px icon per item (Divecore finish step 7, 2026-10-19), named through the
 * art library (`icons/items/streetwear/`), keyed by `items.json` `core.art`. Replaces the shared
 * stand-in stickers and the Kenney item fallback. The two other looks per item sit unused in
 * the library (`ART.icon.items.<name>B` / `C`); there is no player switch.
 */
const ITEM_ICON_ID_BY_ART: Record<string, ArtId> = {
  cape_leaf_01: ART.icon.items.streetwear.leafCape,
  cape_glow_01: ART.icon.items.streetwear.glowveil,
  cloak_curator_01: ART.icon.items.streetwear.curatorCloak,
  cloak_ember_01: ART.icon.items.streetwear.emberMantle,
  staff_bud_01: ART.icon.items.streetwear.budStaff,
  helm_salt_01: ART.icon.items.streetwear.saltcrestHelm,
  robe_moss_01: ART.icon.items.streetwear.mossHabit,
  trinket_pearl_01: ART.icon.items.streetwear.deepPearl,
  trinket_copper_01: ART.icon.items.streetwear.copperKeeper,
  blade_tide_01: ART.icon.items.streetwear.tideBlade,
  blade_ember_01: ART.icon.items.streetwear.emberEdge,
  shield_bark_01: ART.icon.items.streetwear.barkAegis,
  shield_ember_01: ART.icon.items.streetwear.emberWard,
};

/** Item art source for a `core.art` value, or undefined (render a placeholder). */
export function itemArtSource(itemArt: string): ImageSourcePropType | undefined {
  const id = ITEM_ICON_ID_BY_ART[itemArt];
  return id ? getArtSource(id) : undefined;
}

/** A raw Kenney Cursor Pack icon by file id (shop rows, misc UI). */
export function cursorIcon(file: string): ImageSourcePropType | undefined {
  return art(`kenney-icons/${file}`);
}
