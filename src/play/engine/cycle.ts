/**
 * CycleScaler — forever-engine cycle power (data stubs; no systems wired).
 *
 * The forever engine paces long-term growth in "cycles": a conquered cycle
 * raises `cycle_power` multiplicatively for the next one. Sane formula:
 *
 *   cycle_power = 1 + conquered_cycles × cycle_power_step   (Sane step 0.12)
 *
 * The step is a Tune knob (`cyclePowerStep`, see `tune.ts`) so presets can
 * speed up or flatten forever growth without a recompile. This module is the
 * single math home for that formula; the persisted `cycle_power` default and
 * parse-time fallback in `playStore.ts` read it from here.
 */
import { getTune } from '@/play/tune';

/** The current cycle-power growth step from the Tune doc (Sane 0.12). */
export function cyclePowerStep(): number {
  return getTune().cyclePowerStep;
}

/**
 * `cycle_power` for a whole number of conquered cycles:
 * 1 + conquered × step. Negative/partial input floors to 0.
 */
export function cyclePower(conqueredCycles: number): number {
  const cycles = Math.max(0, Math.floor(conqueredCycles));
  return 1 + cycles * cyclePowerStep();
}

/** Fresh-start cycle_power (0 conquered cycles) — used by store defaults. */
export function defaultCyclePower(): number {
  return cyclePower(0);
}

/** Named alias matching the spec's CycleScaler vocabulary. */
export const CycleScaler = {
  step: cyclePowerStep,
  power: cyclePower,
};
