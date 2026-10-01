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

/* -------------------------------------------------- the sunken ruin (v25) --- */

/**
 * The Dive world (v25, 2026-09-30): a vertical shaft of Scribble Dungeons wall
 * tiles, tinted bluer and darker with depth, with props per zone. LOOKS ONLY —
 * props and the find chest are picked by band index, never by a roll.
 */
export type DiveProp = {
  /** A `PLAY_ART` key (existing files only). */
  art: string;
  /** Horizontal spot: 0 = the left wall ledge, 1 = the right wall ledge. */
  x: number;
  /** Down the band, 0..1. */
  y: number;
  size: number;
  /** Tint for the white line art (null = the art's own colours). */
  tint: string | null;
  opacity: number;
};

const SD = 'tiles/scribble-dungeons/';
const CP = 'craftpix-fields/props/';

/** Wall tint per band (depth): bluer and darker as you sink. */
export const SHAFT_TINT: readonly string[] = ['#CFEFFF', '#7FE3D6', '#4FB4B8', '#3F64A8', '#1E2C52', '#2A1850'];
export const SHAFT_OPACITY: readonly number[] = [0.55, 0.5, 0.45, 0.42, 0.3, 0.3];

/** Props per band (index = depth; 5 = Hadal). */
export const DIVE_PROPS: readonly (readonly DiveProp[])[] = [
  // 0 Shallows — sand, plants and stones in the sunlight.
  [
    { art: `${CP}grass1`, x: 0, y: 0.78, size: 34, tint: null, opacity: 0.9 },
    { art: `${CP}stone1`, x: 1, y: 0.7, size: 30, tint: null, opacity: 0.9 },
    { art: `${SD}plants`, x: 1, y: 0.3, size: 30, tint: '#E6FFF6', opacity: 0.6 },
  ],
  // 1–2 Reef — bushes and trees as kelp and coral, teal.
  [
    { art: `${CP}bush1`, x: 0, y: 0.45, size: 40, tint: '#2EE6C8', opacity: 0.55 },
    { art: `${CP}tree1`, x: 1, y: 0.62, size: 52, tint: '#FF7A9C', opacity: 0.45 },
  ],
  [
    { art: `${CP}tree2`, x: 0, y: 0.7, size: 52, tint: '#2EE6C8', opacity: 0.45 },
    { art: `${CP}bush2`, x: 1, y: 0.35, size: 38, tint: '#FF9E7A', opacity: 0.45 },
  ],
  // 3 Trench — the ruin: walls, chests, coffins, barrels, navy.
  [
    { art: `${SD}coffin`, x: 0, y: 0.4, size: 40, tint: '#8FB4F0', opacity: 0.45 },
    { art: `${SD}barrels`, x: 1, y: 0.72, size: 40, tint: '#8FB4F0', opacity: 0.45 },
    { art: `${SD}wall_damaged`, x: 1, y: 0.2, size: 36, tint: '#6F8FC8', opacity: 0.4 },
  ],
  // 4 Abyss — near-dark (the dragon is drawn on its own, huge and faint).
  [{ art: `${SD}barrel`, x: 0, y: 0.65, size: 30, tint: '#3A4F7A', opacity: 0.35 }],
  // 5 Hadal — violet-black, a stair down into nothing.
  [
    { art: `${SD}stairs_down`, x: 1, y: 0.55, size: 40, tint: '#8D5BFF', opacity: 0.3 },
    { art: `${SD}tiles_cracked`, x: 0, y: 0.3, size: 34, tint: '#8D5BFF', opacity: 0.25 },
  ],
];

/** The Shark Tide Knight glides past, faint, in the Reef and the Trench. */
export const SHARK_DEPTHS: readonly number[] = [1, 2, 3];
/** The dragon's huge faint shape: the Abyss. */
export const DRAGON_DEPTH = 4;

/** A find comes out of a crate in the light water, a chest in the ruin. */
export function findBoxArt(depth: number): string {
  return depth >= 3 ? `${SD}chest` : depth >= 1 ? `${SD}crate` : `${SD}crate_small`;
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
