/**
 * Turf War boss effects (step T6, 2026-10-17) — the pure rules, so `check:turf-war-layout` can import them.
 * Display only: nothing here feeds the engine, prices, waves, the enrage or the one-leak loss.
 *
 * emci's picks at stop 1: entrance = new magenta sigil + light column (`summon/burst`), enrage warning = new red
 * sigil (`enrage/burst`) with NO rule change (the warning starts as the boss nears its enrage HP line), death = new
 * plum blast (`bossko/burst`), boss bar = the name over a thin bar inside the wave chip's box.
 */
import type { BoundBossSkillId } from '@/play/engine/bound-boss';
import type { FxQuality } from '@/play/fx-quality';
import type { CombatMotion } from '@/play/turf-combat-fx-rules';

/** The fx sheets the boss effects play from (`meta.fx` keys, all one-shots). */
export const BOSS_FX = {
  summon: 'summon/burst',
  enrage: 'enrage/burst',
  death: 'bossko/burst',
} as const;

/** Timing table (ms). The check keeps every constant inside its [min, max]. */
/** The entrance sigil: 10 frames @ 12 fps, then its last frame (the sigil alone) holds and fades. */
export const BOSS_SUMMON_MS = 830;
export const BOSS_SUMMON_FADE_MS = 500;
/** 14 frames @ 12 fps. */
export const BOSS_DEATH_MS = 1_170;
/** A boss hit flashes longer and brighter than a creep's (T5 `HIT_FLASH_MS` = 70). */
export const BOSS_FLASH_MS = 110;
export const BOSS_FLASH_OPACITY = 1;
/** Boss death: a short, small board shake (stage content only) + the 60 ms hit stop. */
export const BOSS_DEATH_SHAKE_MS = 220;
export const BOSS_DEATH_SHAKE_PT = 5;
/** A telegraph fades this fast once its ability went off. */
export const TELEGRAPH_FADE_MS = 250;
/** Every boss ability telegraph shows its wind-up for at least this long before it can end. */
export const TELEGRAPH_MIN_MS = 600;
export const BOSS_EFFECT_DURATIONS: Record<string, { ms: number; min: number; max: number }> = {
  summon: { ms: BOSS_SUMMON_MS + BOSS_SUMMON_FADE_MS, min: 800, max: 1_600 },
  bossFlash: { ms: BOSS_FLASH_MS, min: 90, max: 140 },
  bossDeath: { ms: BOSS_DEATH_MS, min: 900, max: 1_400 },
  bossDeathShake: { ms: BOSS_DEATH_SHAKE_MS, min: 100, max: 250 },
};

/** The enrage warning starts this far (of max HP) above the boss's enrage line (`burst.hp_pct`). */
export const ENRAGE_WARN_BAND = 0.15;

/** Every boss ability: the enemy boss's enrage (calls runners at the spawn) and the Bound Boss echo skills (§9d
 * closed set — only `burst` has content today; the other two are ready for the next pack). */
export type BossAbility = 'enrage' | BoundBossSkillId;
export type TelegraphLook = 'sigil' | 'fill' | 'close' | 'lock';
export const BOSS_TELEGRAPHS: Record<BossAbility, { look: TelegraphLook; color: string; what: string }> = {
  /** Red sigil charging at the spawn (the runners come out there) + a still red glow under the boss. */
  enrage: { look: 'sigil', color: '#EF4444', what: 'red sigil at the spawn + red glow under the boss' },
  /** Sovereign Nova: an amber disc fills the real blast radius around the pad. */
  burst: { look: 'fill', color: '#FBBF24', what: 'amber disc fills the blast radius' },
  /** Slow pulse: a cyan ring closes in on the radius. */
  slow_pulse: { look: 'close', color: '#22D3EE', what: 'cyan ring closes in' },
  /** Focus beam: a magenta lock-on ring with four ticks narrows on the pad. */
  focus_beam: { look: 'lock', color: '#FF3DF2', what: 'magenta lock-on ring narrows' },
};
export const BOSS_ABILITIES = Object.keys(BOSS_TELEGRAPHS) as BossAbility[];

/** The enrage sigil's own length (12 frames @ 12 fps): its wind-up. */
export const ENRAGE_WINDUP_MS = 1_000;

/** Sim ms per real tick at a speed (the sim steps `tickMs × speed` every `tickMs` real ms). */
export function simStepMs(tickMs: number, speed: number): number {
  return tickMs * speed;
}

/** How early (sim ms of skill cooldown left) a Bound Boss skill telegraph starts, so the wind-up the player SEES
 * is ≥ TELEGRAPH_MIN_MS real ms at any speed: the first tick that sees the cooldown at or below the lead can be one
 * sim step late. */
export function telegraphLeadSimMs(tickMs: number, speed: number): number {
  return (TELEGRAPH_MIN_MS + tickMs) * speed;
}

/** Called each tick for a Bound Boss skill: the real wind-up (ms) to start now, or null. Starts once (while none is
 * showing) on the first tick the cooldown is at or below the lead. After a cast the cooldown is back to full, far
 * above the lead, so every cast after the first gets the whole wind-up. A cooldown already at 0 (charged, waiting
 * for a creep in range) shows the telegraph full at once (0 ms). */
export function telegraphStart(showing: boolean, cdSim: number, tickMs: number, speed: number): number | null {
  if (showing || cdSim > telegraphLeadSimMs(tickMs, speed)) return null;
  return Math.max(0, cdSim / Math.max(1, speed));
}

/** The enemy boss is in its enrage-warning band (HP close to, not yet below, the line; not fired yet). */
export function enrageWarning(hp: number, maxHp: number, burstHpPct: number | null, fired: boolean): boolean {
  if (burstHpPct == null || fired || maxHp <= 0) return false;
  return hp <= maxHp * (burstHpPct + ENRAGE_WARN_BAND);
}

export type BossFxFlags = {
  /** Entrance sigil: 'anim' plays the strip; 'still' only the sigil (no light column), fading in and out. */
  summon: 'anim' | 'still' | null;
  /** Telegraphs always show (they are information, like the boss bar); 'still' = no growing / closing motion. */
  telegraph: 'anim' | 'still';
  /** Death blast: 'full', 'soft' (starts after the white flash frames), or none (the T5 rules then apply). */
  death: 'full' | 'soft' | null;
  /** The bigger boss hit flash. */
  flash: boolean;
  /** Board shake on the boss death. */
  shake: boolean;
  /** 60 ms hit stop on the boss death. */
  hitStop: boolean;
};

/**
 * What plays, per Effects Quality and Motion (same shape as T5 `combatFxFlags`).
 *   Off      — no entrance sigil, no death blast, no flash / shake / hit stop; telegraphs stay as still shapes,
 *              the boss bar and the lane notice stay (numbers still readable).
 *   Minimal  — sigil, telegraphs, death blast, boss flash; no shake, no hit stop.
 *   Full     — everything.
 * Reduce Motion (OS or in-game Reduced) and Motion Off: never a shake, a flash or a hit stop; still sigil, soft death.
 */
export function bossFxFlags(quality: FxQuality, motion: CombatMotion): BossFxFlags {
  const calm = motion.vestibularSafe || motion.cosmeticsStill;
  if (quality === 'off') return { summon: null, telegraph: 'still', death: null, flash: false, shake: false, hitStop: false };
  const full = quality === 'full';
  return {
    summon: calm ? 'still' : 'anim',
    telegraph: calm ? 'still' : 'anim',
    death: calm ? 'soft' : 'full',
    flash: !calm,
    shake: full && !calm,
    hitStop: full && !calm,
  };
}

/** The first frame the 'soft' death plays from (frames 0–2 are the white flash). */
export const BOSS_DEATH_SOFT_FROM = 3;

export type BossBar = { id: number; name: string; pct: number; enrageAt: number | null };

/** The boss bar for the top bar's wave chip box: the live boss with the most HP left (bands have one), or null. */
export function bossBar(
  puffs: readonly { id: number; kind: string; hp: number; maxHp: number; burstHpPct?: number | null }[],
  name: string | undefined,
): BossBar | null {
  let best: (typeof puffs)[number] | null = null;
  for (const p of puffs) if (p.kind === 'boss' && (!best || p.hp > best.hp)) best = p;
  if (!best || best.maxHp <= 0) return null;
  return {
    id: best.id,
    name: name && name.length > 0 ? name : 'Boss',
    pct: Math.max(0, Math.min(1, best.hp / best.maxHp)),
    enrageAt: best.burstHpPct ?? null,
  };
}

/** The wave chip / boss bar box (pt): one fixed size in both states, so the top bar never re-lays out. */
export const WAVE_CHIP_BOX = { width: 132, height: 32 } as const;
