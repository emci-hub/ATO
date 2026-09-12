/**
 * Gear Score + recommended GS (GAME_SPEC §9j; §18 lock formula — Phase D).
 *
 * GS is the readable "how overgeared am I?" number Defend setup compares
 * against a wave. The §18 locked formula:
 *
 *   GS = floor(100 × wave_power_eff × (1 + 0.02·avatar_level)
 *                × (1 + 0.03·avatar_stars))
 *
 * `wave_power_eff` is the equipped wave_power bucket AFTER §9c soft-caps —
 * callers pass `bucketMultiplier('wave_power', statSums)` so the "after
 * soft-caps" part lives with the gear caps, not here. Type match is combat
 * only (§18 lock: "Type match is combat only — not in GS"), so GS never reads
 * the cycle tint. Avatar level + stars use the locked constants, NOT the §9
 * combat curves, so GS is a stable index, not another damage formula.
 *
 * `recommendedGs(phase, wave, cyclePower)` is the "wave wants ~Y" figure:
 * base[wave] × cycle_power (§18 lock). waves.json only authors the four boss
 * bands, so base[wave] is DERIVED here from the same §9 wave formula the sim
 * fights with — puff count × hp_mult, normalized so Trial wave 1 ≈ 100, with
 * a damped count tail (extra puffs read, but towers/scrap/skill carry part of
 * late-wave bulk, not gear). Boss bands count their runner pack + fat-boss HP
 * so the setup card reads sensibly at 9/10/19/20; skip never auto-runs on
 * them either way. The derivation reads the Tune wave knobs, so a Brutal
 * preset makes waves want more GS exactly when they get harder. Content
 * numbers stay one-line changes here.
 */
import { getTune } from '@/play/tune';
import { ROLE_HP_MULT, waveDefFor } from '@/play/director';

import { bossBandFor } from './bands';

/** Locked level step in the GS formula (§18: +2% per Avatar level). */
export const GEAR_SCORE_LEVEL_STEP = 0.02;
/** Locked star step in the GS formula (§18: +3% per Avatar star). */
export const GEAR_SCORE_STAR_STEP = 0.03;
/** base[wave] at Trial wave 1 — a fresh Avatar with no gear reads ~102. */
export const RECOMMENDED_WAVE_ONE = 100;
/** Trial wave 1's puff count (floor(6 + 1×1.2)) — the base normalization. */
const WAVE_ONE_UNITS = 7;
/** Share of each extra bulk unit (past wave 1) that reads as GS — the rest is
 * carried by towers / scrap / skill, which are not gear. */
const COUNT_TAIL_WEIGHT = 0.2;

/**
 * §9 puff count for a NORMAL wave BEFORE cycle_power and the perf cap
 * (mirrors `defend.waveEnemyCount` at cyclePower 1 — kept here so gear-score
 * stays independent of the board module and can't create an import cycle).
 */
function basePuffCount(wave: number): number {
  const n = Math.max(1, Math.floor(wave));
  const count = Math.floor(6 + n * getTune().waveCountPerLevel);
  return Math.min(20, Math.max(1, count));
}

/** §9 hp_mult for a display wave (mirrors `defend.waveHpMult`). */
function hpMultOf(wave: number): number {
  const n = Math.max(1, Math.floor(wave));
  return 1 + (n - 1) * getTune().waveHpPerLevel;
}

/** Puff-equivalent count of one wave, read from the wave director's group
 * table: sum of each group's count × role HP (bosses count their full hp_mult).
 * Falls back to the §9 formula when a wave has no authored table. */
function waveUnits(phase: 'trial' | 'main', wave: number): number {
  const def = waveDefFor(phase, wave);
  if (def) {
    const band = bossBandFor(phase, wave);
    const bossHpMult = band?.boss.hp_mult ?? 1;
    let units = 0;
    for (const group of def.groups) {
      const hpMult = group.role === 'boss' ? bossHpMult : ROLE_HP_MULT[group.role];
      units += group.count * hpMult;
    }
    return Math.max(1, units);
  }
  return basePuffCount(wave);
}

/**
 * base[wave] in GS units — Trial wave 1 (7 puffs × ×1 hp) = 100. HP growth
 * does the heavy lifting; each extra bulk unit past the first 7 counts at
 * `COUNT_TAIL_WEIGHT` so fatter waves read higher without outrunning the gear
 * soft-caps.
 */
export function recommendedBase(phase: 'trial' | 'main', wave: number): number {
  const units = waveUnits(phase, wave);
  const damped = WAVE_ONE_UNITS + (Math.max(1, units) - WAVE_ONE_UNITS) * COUNT_TAIL_WEIGHT;
  return (RECOMMENDED_WAVE_ONE * hpMultOf(wave) * damped) / WAVE_ONE_UNITS;
}

/** recommended_GS(wave) = base[wave] × cycle_power (§18 lock), whole number. */
export function recommendedGs(
  phase: 'trial' | 'main',
  wave: number,
  cyclePower: number = 1,
): number {
  const n = Math.max(1, Math.floor(wave));
  const base = recommendedBase(phase, n);
  return Math.max(1, Math.round(base * Math.max(1, cyclePower)));
}

/**
 * GS for a player from the two Avatar knobs + the already-soft-capped
 * wave_power bucket (§18 locked formula — see the module doc). Whole number.
 */
export function gearScore(
  wavePowerEff: number,
  avatarLevel: number,
  avatarStars: number,
): number {
  const level = Math.max(1, Math.floor(avatarLevel));
  const stars = Math.max(0, Math.min(5, Math.floor(avatarStars)));
  return Math.floor(
    100 *
      Math.max(0, wavePowerEff) *
      (1 + GEAR_SCORE_LEVEL_STEP * level) *
      (1 + GEAR_SCORE_STAR_STEP * stars),
  );
}
