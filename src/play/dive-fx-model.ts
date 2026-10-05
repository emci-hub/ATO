/**
 * Dive FX model (overhaul, 2026-09-29) — pure numbers the Dive scene draws
 * from. LOOKS ONLY: nothing here reads or changes the odds. The bust % the
 * scene reacts to is the SHOWN one (`run.bustPct`), passed in; the rolls stay
 * in `playStore.ts` / `dive-loot.ts` (`check:dive-fx` holds that line).
 *
 *   - rarity glow for a find (common / rare / epic);
 *   - the neon zone palette (Shallows light blue with rays, Reef teal,
 *     Trench navy, Abyss near-black with specks, Hadal violet-black);
 *   - how far the edges close in for a shown bust %, and when the slow
 *     heartbeat pulse starts (over 40%);
 *   - the find reveal's timing, kept inside the existing post-result
 *     cooldown so it never delays Surface or Deeper.
 */
import { ACTION_COOLDOWN_MS } from './action-pacing';
import { findKind } from './dive-loot';
import { getItemDef } from './items';
import { cosmeticById } from './pet-cosmetics';

export type FindGlow = 'common' | 'rare' | 'epic';

/** Rare-or-better: Rare gear and every Power; tint/badge cosmetics are rare,
 * rings and auras (Trench and deeper only) and Shine Stones are epic. Food
 * and shells are common. */
export function findGlow(id: string): FindGlow {
  const kind = findKind(id);
  if (kind === 'stone') return 'epic';
  if (kind === 'cosmetic') {
    const slot = cosmeticById(id)?.slot;
    return slot === 'ring' || slot === 'aura' ? 'epic' : 'rare';
  }
  if (kind === 'item') {
    const def = getItemDef(id);
    if (!def) return 'common';
    if (def.core.kind === 'power') return def.core.rarity === 'rare' ? 'epic' : 'rare';
    return def.core.rarity === 'rare' ? 'rare' : 'common';
  }
  return 'common';
}

export const GLOW_COLOR: Record<FindGlow, string> = {
  common: '#9FE7FF',
  rare: '#00EAFF',
  epic: '#FF23C9',
};

export function isRareOrBetter(glow: FindGlow): boolean {
  return glow !== 'common';
}

/** Zone colours top → bottom of each zone band (neon theme — no mustard or
 * olive). Index = depth (Deepers survived); 5 = Hadal (Oxygen). */
export const ZONE_BANDS: readonly { top: string; bottom: string }[] = [
  { top: '#8FDCFF', bottom: '#3AA6E2' }, // 0 Shallows — light blue, light rays
  { top: '#1FB8B0', bottom: '#0E8C8E' }, // 1 Reef — teal
  { top: '#0E8C8E', bottom: '#0A5F6E' }, // 2 Reef, deeper
  { top: '#0F2F63', bottom: '#0A1F45' }, // 3 Trench — navy
  { top: '#070A18', bottom: '#03040A' }, // 4 Abyss — near-black, specks
  { top: '#0C0520', bottom: '#05020D' }, // 5 Hadal — violet-black
];
export const DIVE_MAX_DEPTH = ZONE_BANDS.length - 1;

/** Light rays only in the sunlit water; drifting specks from the Abyss. */
export const RAYS_UNTIL_DEPTH = 1;
export const SPECKS_FROM_DEPTH = 4;

/** Heartbeat pulse over this SHOWN bust %. */
export const HEARTBEAT_OVER_PCT = 40;

/**
 * How much the edges close in for a shown bust % (0 = open, 1 = tight):
 * edge darkness and how far the clear centre shrinks. Null % (no Deeper on
 * offer) = open water.
 */
export function vignetteFor(bustPct: number | null): { edge: number; clear: number; pulse: boolean } {
  if (bustPct == null) return { edge: 0.15, clear: 0.8, pulse: false };
  const t = Math.max(0, Math.min(1, bustPct / 70));
  return {
    edge: 0.2 + t * 0.65,
    clear: 0.8 - t * 0.45,
    pulse: bustPct > HEARTBEAT_OVER_PCT,
  };
}

/** Find reveal: rise → (rare: flash + a short hold) → fly to the haul row.
 * The whole reveal fits inside the post-result cooldown the buttons already
 * wait for, so it never holds Surface or Deeper back. */
export const REVEAL_RISE_MS = 260;
export const REVEAL_HOLD_RARE_MS = 160;
export const REVEAL_FLY_MS = 220;
export const REVEAL_FLASH_MS = 240;

export function revealMs(glow: FindGlow): number {
  return REVEAL_RISE_MS + (isRareOrBetter(glow) ? REVEAL_HOLD_RARE_MS : 0) + REVEAL_FLY_MS;
}

/** Pinned: every reveal ends before the cooldown does. */
export const REVEAL_BUDGET_MS = ACTION_COOLDOWN_MS;

/* --------------------------------------- pixel dive (phases 3–4) --- */

/**
 * The Dive world is pixel scenery from the underwater atlas (`pixel-atlas.tsx`).
 * LOOKS ONLY — props and the find chest are picked by band index, never by a roll.
 * Deeper bands use pre-recolored frames. Nothing here is a runtime tint or an
 * alpha wash over the art.
 */
export type DiveProp = {
  /** A frame in `DIVE_FRAMES`. */
  frame: string;
  /** Horizontal spot: 0 = the left side, 1 = the right side. */
  x: 0 | 1;
  /** Down the band, 0..1. The sprite's bottom sits here. */
  y: number;
};

/**
 * Opaque ink behind each depth's background art (and the colour the scene
 * falls back to). Darker as you sink. Not drawn over the pixels.
 */
export const DIVE_DEPTH_INK: readonly string[] = [
  '#4d9be6',
  '#0b8a8f',
  '#0b5e65',
  '#313638',
  '#2e222f',
  '#1a1420',
];

/** Props per band (index = depth; 5 = Hadal). Seaweed, coral, kelp. */
export const DIVE_PROPS: readonly (readonly DiveProp[])[] = [
  [
    { frame: 'weed', x: 0, y: 0.86 },
    { frame: 'coral', x: 1, y: 0.8 },
  ],
  [
    { frame: 'coral', x: 0, y: 0.72 },
    { frame: 'weed', x: 1, y: 0.84 },
  ],
  [
    { frame: 'weed', x: 0, y: 0.78 },
    { frame: 'coral', x: 1, y: 0.66 },
  ],
  [
    { frame: 'weed-deep', x: 0, y: 0.74 },
    { frame: 'coral-deep', x: 1, y: 0.82 },
  ],
  [{ frame: 'weed-deep', x: 1, y: 0.7 }],
  [
    { frame: 'coral-deep', x: 0, y: 0.68 },
    { frame: 'weed-deep', x: 1, y: 0.84 },
  ],
];

/** The Shark Tide Knight glides past, faint, in the Reef and the Trench. */
export const SHARK_DEPTHS: readonly number[] = [1, 2, 3];
/** The dragon's huge faint shape: the Abyss. */
export const DRAGON_DEPTH = 4;

/** A find comes out of a crate in the light water, a chest in the ruin. */
export function findBoxArt(depth: number): 'crate-small' | 'crate' | 'chest' {
  if (depth >= 3) return 'chest';
  if (depth >= 1) return 'crate';
  return 'crate-small';
}

/**
 * What the Dive world draws. The cut order for slow phones (Effects Low) is
 * shark → dragon → parallax → props → bubble trail; reduced motion keeps
 * the still scenery (walls, props, dragon) but drops everything that moves on
 * its own (shark, parallax, the jump arc, the bob, the chest shake).
 */
export type DiveWorldCuts = {
  shark: boolean;
  dragon: boolean;
  parallax: boolean;
  props: boolean;
  trail: boolean;
  motion: boolean;
};
export const DIVE_CUT_ORDER = ['shark', 'dragon', 'parallax', 'props', 'trail'] as const;

export function diveWorldCuts(fxLevel: 'full' | 'low', reduceMotion: boolean): DiveWorldCuts {
  const full = fxLevel === 'full';
  return {
    shark: full && !reduceMotion,
    dragon: full,
    parallax: full && !reduceMotion,
    props: true,
    trail: full && !reduceMotion,
    motion: !reduceMotion,
  };
}
