/**
 * Turf War combat effects (step T5, 2026-10-17) — the pure rules, so `check:turf-war-layout` can import them.
 * Display only: nothing here feeds the engine, prices, waves or the one-leak loss.
 *
 * emci's picks at stop 1: archer = new magenta dart + star (`archer/*`), vine = library `root/*`,
 * crystal = library `spark/*`, death = new plum smoke pop (`pop/burst`) replacing the corpse at the same 1.1 s.
 */
import type { FxQuality } from '@/play/fx-quality';

/** Every tower kit draws a projectile + an impact from the streetwear fx sheets (`meta.fx` keys). */
export const TOWER_FX = {
  archer: { shot: 'archer/shot', hit: 'archer/hit' },
  vine: { shot: 'root/shot', hit: 'root/hit' },
  crystal: { shot: 'spark/shot', hit: 'spark/hit' },
} as const satisfies Record<'archer' | 'vine' | 'crystal', { shot: string; hit: string }>;

/** The fx sheet the death pop plays from. */
export const DEATH_POP_FX = 'pop/burst';

/** Effect timing table (ms). The check keeps every constant inside its [min, max]. */
export const HIT_FLASH_MS = 70;
export const CHIP_HOLD_MS = 80;
export const CHIP_DRAIN_MS = 220;
export const FLOATER_MERGE_MS = 150;
/** Same length as the corpse it replaces (`CREEP_CORPSE_MS`). */
export const DEATH_POP_MS = 1_100;
export const LEAK_PULSE_MS = 520;
export const LEAK_SHAKE_MS = 180;
export const HIT_STOP_MS = 60;
/** The hit-stop timer: the sim interval restarts after it (plus a React commit), so the extra freeze stays ≤ HIT_STOP_MS. */
export const HIT_STOP_TIMER_MS = 45;
/** A creep flashes at most once per this window (a DoT ticks every 100 ms — no strobe). */
export const FLASH_COOLDOWN_MS = 250;
export const EFFECT_DURATIONS: Record<string, { ms: number; min: number; max: number }> = {
  hitFlash: { ms: HIT_FLASH_MS, min: 60, max: 80 },
  chipTrail: { ms: CHIP_HOLD_MS + CHIP_DRAIN_MS, min: 150, max: 400 },
  floaterMerge: { ms: FLOATER_MERGE_MS, min: 150, max: 150 },
  deathPop: { ms: DEATH_POP_MS, min: 1_100, max: 1_100 },
  leakPulse: { ms: LEAK_PULSE_MS, min: 300, max: 700 },
  leakShake: { ms: LEAK_SHAKE_MS, min: 100, max: 250 },
  hitStop: { ms: HIT_STOP_MS, min: 1, max: 60 },
};
/** Impacts are 3–6 frames. */
export const IMPACT_FRAMES = { min: 3, max: 6 } as const;

/** Leak shake travel (pt) — small; it moves the board (stage content), never a region. */
export const LEAK_SHAKE_PT = 4;
/** Small sideways / up nudge for a new damage number (pt), so stacked numbers don't sit on one spot. */
export const FLOATER_JITTER_X = 6;
export const FLOATER_JITTER_Y = 4;
/** Hit flash: max white overlays alive at once (oldest dropped). */
export const MAX_FLASHES = 8;

export type CombatMotion = { vestibularSafe: boolean; cosmeticsStill: boolean };
export type CombatFxFlags = {
  /** 60–80 ms white tint on a hit creep. */
  flash: boolean;
  /** Board shake on a leak. */
  shake: boolean;
  /** ≤ 60 ms sim freeze on a kill by an ultimate. */
  hitStop: boolean;
  /** Death pop instead of the corpse. */
  pop: boolean;
  /** Red ring at the path end on a leak. */
  leakPulse: boolean;
};

/**
 * What plays, per Effects Quality and Motion.
 *   Off      — none (damage numbers still show; the corpse stays the death tell).
 *   Minimal  — flash, pop, leak pulse; no shake, no hit stop.
 *   Full     — everything.
 * Reduce Motion (OS or in-game Reduced) and Motion Off: never a shake, a flash or a hit stop.
 */
export function combatFxFlags(quality: FxQuality, motion: CombatMotion): CombatFxFlags {
  if (quality === 'off') return { flash: false, shake: false, hitStop: false, pop: false, leakPulse: false };
  const calm = motion.vestibularSafe || motion.cosmeticsStill;
  const full = quality === 'full';
  return {
    flash: !calm,
    shake: full && !calm,
    hitStop: full && !calm,
    pop: true,
    leakPulse: true,
  };
}

/** A creep's health bar shows only once it has taken damage. */
export function showHealthBar(hp: number, maxHp: number): boolean {
  return maxHp > 0 && hp < maxHp;
}

export type HpChip = { from: number; to: number; at: number };

/** A new hit on a creep: a chip still draining keeps its start (so steady damage never piles up a held chip);
 * otherwise a fresh chip starts at what the bar shows now. */
export function nextChip(prev: HpChip | undefined, shownPct: number, newPct: number, now: number): HpChip {
  if (prev && now - prev.at < CHIP_HOLD_MS + CHIP_DRAIN_MS) return { from: prev.from, to: newPct, at: prev.at };
  return { from: shownPct, to: newPct, at: now };
}

/** The pale chip behind the bar: holds at the old value, then drains fast to the new one. */
export function chipValue(chip: HpChip | undefined, pct: number, now: number): number {
  if (!chip) return pct;
  const age = now - chip.at;
  if (age >= CHIP_HOLD_MS + CHIP_DRAIN_MS) return pct;
  if (age <= CHIP_HOLD_MS) return Math.max(pct, chip.from);
  const t = (age - CHIP_HOLD_MS) / CHIP_DRAIN_MS;
  return Math.max(pct, chip.from + (chip.to - chip.from) * t);
}

/** Deterministic small offset in [-range, range] from an id (no Math.random in render). */
export function jitter(id: number, salt: number, range: number): number {
  let h = (id * 374761393 + salt * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (((h >>> 0) / 4294967295) * 2 - 1) * range;
}
