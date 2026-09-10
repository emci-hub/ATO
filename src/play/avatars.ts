/**
 * Avatar defs — the roster the player swaps between in Dress (Avatar swap).
 *
 * Each def is a stable `id` plus a display identity (name / icon / color).
 * Owning, level, stars, equipped and park state live in `playStore` avatar
 * records keyed by that id; this module is read-only content. A future Hero
 * ally (IAP) reuses the same picker shape — nothing here is Hero-specific.
 */
import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

export type AvatarIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export type AvatarDef = {
  id: string;
  name: string;
  /** One-line identity for the picker row. */
  blurb: string;
  icon: AvatarIconName;
  /** Board/hub accent (decorative — readable on light + dark boards). */
  color: string;
};

/** The starter Avatar — always owned, the seed record of every save. Its id is
 * legacy (`ava_sprout`) so existing saves keep their level/stars/park; the
 * identity + art are the Dungeon Druid (§19 cast lock). */
export const STARTER_AVATAR_ID = 'ava_sprout';

/** First unlockable stub. "Starter + stubs unlock OK": the Dress picker's
 * unlock is a free stub until Hero/IAP lands — no real cost yet. */
export const STUB_AVATAR_ID = 'ava_assassin';

const AVATAR_DEFS: readonly AvatarDef[] = [
  {
    id: STARTER_AVATAR_ID,
    name: 'Dungeon Druid',
    blurb: 'Starter Legend — the grove’s first keeper.',
    icon: 'magic-staff',
    color: '#4ADE80',
  },
  {
    id: STUB_AVATAR_ID,
    name: 'Abyssal Assassin',
    blurb: 'Stub Legend — unlock shape only, no IAP yet.',
    icon: 'sword-cross',
    color: '#A78BFA',
  },
  {
    id: 'ava_champion',
    name: 'Dragonblood Champion',
    blurb: 'Stub Legend — unlock shape only, no IAP yet.',
    icon: 'shield-crown',
    color: '#F97316',
  },
  {
    id: 'ava_engineer',
    name: 'Arcane Engineer',
    blurb: 'Stub Legend — unlock shape only, no IAP yet.',
    icon: 'wrench',
    color: '#FBBF24',
  },
  {
    id: 'ava_witch',
    name: 'Dungeon Witch',
    blurb: 'Stub Legend — unlock shape only, no IAP yet.',
    icon: 'broom',
    color: '#C084FC',
  },
  {
    id: 'ava_ratkin',
    name: 'Ratkin Treasure Hunter',
    blurb: 'Stub Legend — unlock shape only, no IAP yet.',
    icon: 'rodent',
    color: '#A8A29E',
  },
  {
    id: 'ava_berserker',
    name: 'Crystal Berserker',
    blurb: 'Stub Legend — unlock shape only, no IAP yet.',
    icon: 'axe',
    color: '#22D3EE',
  },
  {
    id: 'ava_death_knight',
    name: 'Death Knight',
    blurb: 'Stub Legend — unlock shape only, no IAP yet.',
    icon: 'skull-crossbones',
    color: '#94A3B8',
  },
  {
    id: 'ava_cleric',
    name: 'Seraphic Cleric',
    blurb: 'Stub Legend — unlock shape only, no IAP yet.',
    icon: 'cross-celtic',
    color: '#FDE68A',
  },
  {
    id: 'ava_demon_guardian',
    name: 'Abyssal Demon Guardian',
    blurb: 'Stub Legend — unlock shape only, no IAP yet.',
    icon: 'bat',
    color: '#EF4444',
  },
];

const AVATAR_DEF_BY_ID: ReadonlyMap<string, AvatarDef> = new Map(
  AVATAR_DEFS.map((def) => [def.id, def]),
);

/** Display def for an id, or undefined when the def is unknown. */
export function avatarDef(id: string): AvatarDef | undefined {
  return AVATAR_DEF_BY_ID.get(id);
}

/** Every known Avatar def, in picker order (owned first is a UI choice). */
export function allAvatarDefs(): readonly AvatarDef[] {
  return AVATAR_DEFS;
}
