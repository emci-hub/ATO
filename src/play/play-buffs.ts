/**
 * Medal buffs (v26, Part C) — Monster Hunter meal / Stardew food style: a
 * mini-game medal gives one short buff. Pure rules; playStore applies them.
 *
 *   Catch Gold   → Hearty meal: +1 find on your next 3 charged-dive surfaces
 *   Catch Silver → Snack:       −2 bust points for your whole next dive (the
 *                               half-table floor still holds; the shown %
 *                               includes it)
 *   Train Gold   → Pumped:      pounce ×1.25 for the next 5 cleared TD waves,
 *                               capped at PET_POUNCE_CAP so the pet's in-run
 *                               TD help stays inside the 3-8% band (sim: a God
 *                               Battle pet with Pumped = 6.68%, same as today).
 *                               When the cap leaves it nothing to add, it is a
 *                               "Maxed aura" instead: a gold glow, no pounce
 *                               change, and no use spent.
 *   Train Silver → Focused:     the next expedition is 25% shorter
 *
 * Rules: one of each at a time; a new medal REFRESHES the uses (never stacks).
 * A Gold round gives only the Gold buff. Buffs count USES, not time, so the
 * phone clock can't touch them. They belong to you, not the pet: they carry
 * through release and rebirth, and only spend a use when they actually apply
 * (Pumped needs a pounce, Focused a trip you send).
 */
import type { Medal } from '@/play/game-records';

export const BUFF_IDS = ['hearty', 'snack', 'pumped', 'focused'] as const;
export type BuffId = (typeof BUFF_IDS)[number];
export type Buffs = Record<BuffId, number>;

export const NO_BUFFS: Buffs = { hearty: 0, snack: 0, pumped: 0, focused: 0 };

/** Uses each buff starts with. */
export const BUFF_USES: Buffs = { hearty: 3, snack: 1, pumped: 5, focused: 1 };

export const BUFF_LABEL: Record<BuffId, string> = {
  hearty: 'Hearty meal',
  snack: 'Snack',
  pumped: 'Pumped',
  focused: 'Focused',
};
export const BUFF_ICON: Record<BuffId, string> = { hearty: '🍖', snack: '🍪', pumped: '💪', focused: '🎯' };

/** Snack: bust points off every Deeper of one dive. */
export const SNACK_BUST_PP = 2;
/** Pumped: pounce multiplier, and the hard cap on the pounce base (sim:
 * any base up to 8.6 keeps a God Battle pet at 6.68%; 8.7 jumps to 8.64%). */
export const PUMPED_MULT = 1.25;
export const PET_POUNCE_CAP = 8.6;
/** Pumped adding less than this much pounce damage is a "Maxed aura" (it
 * would change nothing in TD) — no change, no use spent. */
export const PUMPED_MIN_GAIN = 0.5;
/** The band the pet's (and Dive's) in-run TD help must stay inside — the
 * share less damage a board needs (sim:balance holds it). */
export const TD_HELP_BAND = { min: 0.03, max: 0.08 } as const;
/** Focused: the next trip's length multiplier. */
export const FOCUSED_TRIP_MULT = 0.75;

/** Which buff a medal gives (Gold beats Silver; Bronze gives none). */
export function buffForMedal(game: 'catch' | 'train', medal: Medal | null): BuffId | null {
  if (medal === 'gold') return game === 'catch' ? 'hearty' : 'pumped';
  if (medal === 'silver') return game === 'catch' ? 'snack' : 'focused';
  return null;
}

/** Grant a buff: refresh to full uses (never stack). */
export function grantBuff(b: Buffs, id: BuffId): Buffs {
  return { ...b, [id]: BUFF_USES[id] };
}

/** Spend one use (never below 0). */
export function spendBuff(b: Buffs, id: BuffId): Buffs {
  return b[id] > 0 ? { ...b, [id]: b[id] - 1 } : b;
}

export type PumpedState = {
  /** The pounce TD uses right now. */
  pounce: number;
  /** Pumped is active and changes the pounce (a wave will spend a use). */
  boosted: boolean;
  /** Pumped is active but the cap leaves it nothing to add: Maxed aura. */
  maxed: boolean;
};

/** The pounce with Pumped applied (base = the pet's own pounce, 0 = none). */
export function pumpedPounce(base: number, pumpedUses: number): PumpedState {
  if (base <= 0 || pumpedUses <= 0) return { pounce: base, boosted: false, maxed: false };
  const up = Math.min(PET_POUNCE_CAP, base * PUMPED_MULT);
  if (up - base < PUMPED_MIN_GAIN) return { pounce: base, boosted: false, maxed: true };
  return { pounce: up, boosted: true, maxed: false };
}

export function parseBuffs(raw: unknown): Buffs {
  const out: Buffs = { ...NO_BUFFS };
  if (typeof raw !== 'object' || raw == null) return out;
  const row = raw as Record<string, unknown>;
  for (const id of BUFF_IDS) {
    const n = row[id];
    if (typeof n === 'number' && Number.isFinite(n)) out[id] = Math.max(0, Math.min(BUFF_USES[id], Math.floor(n)));
  }
  return out;
}

/** One line per buff for banners and the Guide — built from the constants. */
export const BUFF_HOW: Record<BuffId, string> = {
  hearty: `+1 find on each of your next ${BUFF_USES.hearty} charged-dive surfaces.`,
  snack: `−${SNACK_BUST_PP} bust points on every Deeper of your next dive.`,
  pumped: `Pounce ×${PUMPED_MULT} for the next ${BUFF_USES.pumped} cleared TD waves (max ${PET_POUNCE_CAP}).`,
  focused: `Your next expedition is ${Math.round((1 - FOCUSED_TRIP_MULT) * 100)}% shorter.`,
};
