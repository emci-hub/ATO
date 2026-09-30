/**
 * Expedition ladder (v25, 2026-09-30) — expeditions are no longer once a day:
 * each trip today is longer than the last, and longer trips pay more.
 *
 *   step  trip    brings back
 *   1     1 min   Kelp snack or 1 shell
 *   2     5 min   Kelp, Glow shrimp or 2 shells
 *   3     15 min  Glow shrimp or 4 shells
 *   4     30 min  a Shallows find (never a Power)
 *   5     1 h     a Reef find (never a Power)
 *   6     2 h     20% a Power, else a Reef find
 *   7     4 h     35% a Power, else a Trench find
 *
 * The ladder ENDS after the 4h trip (it doesn't repeat) and starts again at
 * the local day reset — so Powers from expeditions stay ≈ 0.55 a day, next to
 * 0.5 a day under the old once-a-day rule: no new TD power. Trips are timed in
 * the pet's own counted time (the clock guard), like before.
 *
 * Phone notifications: only for trips of 30 min or longer (and only with the
 * toggle on); shorter trips just show the in-app banner.
 */
import { rollTier, type DiveTier } from './dive-loot';
import { getItemDef, rollPowerFind } from './items';

const MIN = 60 * 1000;
export const EXPEDITION_LADDER_MS: readonly number[] = [1 * MIN, 5 * MIN, 15 * MIN, 30 * MIN, 60 * MIN, 120 * MIN, 240 * MIN];
export const EXPEDITION_STEPS = EXPEDITION_LADDER_MS.length;
/** A trip from before the ladder (v24 and older): the old 1h rule. */
export const LEGACY_EXPEDITION_MS = 60 * MIN;
/** Phone notification only for trips this long or longer. */
export const EXPEDITION_NOTICE_MIN_MS = 30 * MIN;
/** Power chance for the 2h and 4h trips. */
export const EXPEDITION_POWER_BY_STEP: Readonly<Record<number, number>> = { 5: 0.2, 6: 0.35 };

export function expeditionLengthMs(step: number): number {
  return EXPEDITION_LADDER_MS[Math.max(0, Math.min(EXPEDITION_STEPS - 1, step))];
}

/** "1m", "15m", "1h", "4h". */
export function tripLabel(ms: number): string {
  const m = Math.round(ms / MIN);
  return m >= 60 ? `${m / 60}h` : `${m}m`;
}

/** A tier roll that never lands on a Power (re-rolled; shells at worst). */
export function rollNoPower(tier: DiveTier, rng: () => number): string {
  for (let i = 0; i < 24; i += 1) {
    const id = rollTier(tier, rng);
    if (getItemDef(id)?.core.kind !== 'power') return id;
  }
  return 'shells_2';
}

/** What a finished trip of ladder `step` (0-based; -1 = a legacy trip) brings back. */
export function rollExpeditionReward(step: number, rng: () => number = Math.random): string {
  const r = rng();
  switch (step) {
    case 0:
      return r < 0.5 ? 'food_kelp' : 'shells_1';
    case 1:
      return r < 1 / 3 ? 'food_kelp' : r < 2 / 3 ? 'food_shrimp' : 'shells_2';
    case 2:
      return r < 0.5 ? 'food_shrimp' : 'shells_4';
    case 3:
      return rollNoPower('shallows', rng);
    case 4:
      return rollNoPower('reef', rng);
    case 5:
      return r < EXPEDITION_POWER_BY_STEP[5] ? rollPowerFind(rng) : rollNoPower('reef', rng);
    case 6:
      return r < EXPEDITION_POWER_BY_STEP[6] ? rollPowerFind(rng) : rollNoPower('trench', rng);
    default:
      // A trip from before the ladder keeps the old reward: half the time a Power.
      return r < 0.5 ? rollPowerFind(rng) : rollTier('shallows', rng);
  }
}

/** Expected Powers a day from a full ladder (the TD-balance guard). */
export function expectedPowersPerDay(): number {
  return Object.values(EXPEDITION_POWER_BY_STEP).reduce((a, b) => a + b, 0);
}
