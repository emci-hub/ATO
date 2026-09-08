/**
 * Grove — Step 1 shell content (GAMES_SPEC §3, §11 screen 1).
 *
 * Pure data + types only: placeholder copy and stub numbers that Step 2
 * (`playStore`) replaces with a real local economy. Nothing here touches
 * Supabase, AsyncStorage, or any non-play module. Screens live in
 * `src/app/play.tsx`; this folder is the non-route home for the game so no
 * runnable screen ever sits under `games/grove/`.
 */
import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

export const GROVE_LEDE =
  'A quiet little corner of ATO. Tend it, dress it, defend it — whenever you like.';

/** Preview wallet. Step 2 wires tokens into playStore; this is just the shell. */
export const PREVIEW_START_TOKENS = 0;
export const PREVIEW_CLAIM_TOKENS = 15;

/** Preview research row. Real 30-min / 10h-cap cycles arrive in Step 2. */
export const RESEARCH_PREVIEW_TITLE = 'Your grove is ready.';
export const RESEARCH_PREVIEW_BODY = 'Claim to gather what it found while you were away.';

export type GroveActionKind = 'dive' | 'dress' | 'defend';

export type GroveActionTile = {
  kind: GroveActionKind;
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  lede: string;
  soon: string;
};

/** Dive / Dress / Defend are "soon" until their own steps land. */
export const GROVE_ACTION_TILES: GroveActionTile[] = [
  {
    kind: 'dive',
    icon: 'waves',
    title: 'Dive',
    lede: 'Push your luck for finds.',
    soon: 'Soon',
  },
  {
    kind: 'dress',
    icon: 'hanger',
    title: 'Dress',
    lede: 'Equip what you find.',
    soon: 'Soon',
  },
  {
    kind: 'defend',
    icon: 'shield-outline',
    title: 'Defend',
    lede: 'Protect the grove path.',
    soon: 'Soon',
  },
];
