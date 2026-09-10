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

/** The starter Avatar — always owned, the seed record of every save. */
export const STARTER_AVATAR_ID = 'ava_sprout';

/** Stub unlockable Avatar. "Starter + 1 stub unlock OK": the unlock path in
 * the Dress picker is a free stub until Hero/IAP lands — no real cost yet. */
export const STUB_AVATAR_ID = 'ava_ember';

const AVATAR_DEFS: readonly AvatarDef[] = [
  {
    id: STARTER_AVATAR_ID,
    name: 'Sprout',
    blurb: 'The Grove’s first keeper.',
    icon: 'sprout',
    color: '#38BDF8',
  },
  {
    id: STUB_AVATAR_ID,
    name: 'Emberkin',
    blurb: 'Stub Avatar — unlock shape only, no IAP yet.',
    icon: 'fire',
    color: '#FB923C',
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
