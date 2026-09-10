/**
 * Grove — shell content (GAME_SPEC §3, §11 screen 1).
 *
 * Pure data + types only: placeholder copy and action tiles. The local economy
 * (tokens, dive charges, research) lives in `playStore.ts`; nothing here
 * touches Supabase, AsyncStorage, or any non-play module. Screens live in
 * `src/app/play.tsx`; this folder is the non-route home for the game so no
 * runnable screen ever sits under `games/grove/`.
 */
import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

export const GROVE_LEDE =
  'A quiet little corner of ATO — tend, dress, and defend your Basecore, whenever you like.';

export type GroveActionKind = 'dive' | 'dress' | 'defend' | 'shop';

export type GroveActionTile = {
  kind: GroveActionKind;
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  lede: string;
  /** "Soon" badge text; null = enabled since its step landed. */
  soon: string | null;
};

/** Dive + Dress + Defend board skeleton are live since steps 3–5a. */
export const GROVE_ACTION_TILES: GroveActionTile[] = [
  {
    kind: 'dive',
    icon: 'waves',
    title: 'Dive',
    lede: 'Push your luck for finds.',
    soon: null,
  },
  {
    kind: 'dress',
    icon: 'hanger',
    title: 'Dress',
    lede: 'Equip what you find.',
    soon: null,
  },
  {
    kind: 'defend',
    icon: 'shield-outline',
    title: 'Defend',
    lede: 'Protect the Basecore path.',
    soon: null,
  },
  {
    kind: 'shop',
    icon: 'storefront-outline',
    title: 'Shop',
    lede: 'Spend tokens — and what’s coming.',
    soon: null,
  },
];
