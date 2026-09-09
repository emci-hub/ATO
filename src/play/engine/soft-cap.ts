/**
 * SoftCap — diminishing soft-cap math (data stub; the live §9c gear caps still
 * live in `playStore.bucketMultiplier`, which stays the source of truth until
 * the forever engine consolidates every economy number onto these helpers).
 *
 * The shape used across the economy: a stat/value is "capped" at an additive
 * ceiling, and anything past the cap still contributes at a flat diminishing
 * rate instead of being wasted or counting in full. For a multiplier bucket:
 *
 *   cap = cap_mult - 1  (the additive ceiling — Sane wave_power ×2.0 → +1.0)
 *   effective_add = min(raw, cap) + rate × max(0, raw - cap)
 *   multiplier    = 1 + effective_add
 *
 * Rate is the Sane 0.25 "diminishing after cap" knob. Negative raw floors to
 * 0 so a helper can never subtract from a bucket.
 */
export type SoftCap = {
  /** Multiplier cap the bucket approaches (e.g. 2.0 → additive cap 1.0). */
  cap: number;
  /** Strength of contributions past the cap (Sane 0.25 = quarter strength). */
  rate: number;
};

/** Default Sane soft-cap shape (cap ×2.0, quarter strength past it). */
export const DEFAULT_SOFT_CAP: SoftCap = { cap: 2.0, rate: 0.25 };

/** Diminished ADDITIVE contribution of `raw` under a cap (never negative). */
export function diminishAdd(
  raw: number,
  cap: number,
  rate: number = DEFAULT_SOFT_CAP.rate,
): number {
  const value = Math.max(0, raw);
  const addCap = Math.max(0, cap - 1);
  return Math.min(value, addCap) + rate * Math.max(0, value - addCap);
}

/** 1 + diminished additive — the multiplier a raw sum actually provides. */
export function softCapMultiplier(
  raw: number,
  cap: number,
  rate: number = DEFAULT_SOFT_CAP.rate,
): number {
  return 1 + diminishAdd(raw, cap, rate);
}

/** Convenience for a stat capped by one named SoftCap shape. */
export function applySoftCap(raw: number, softCap: SoftCap = DEFAULT_SOFT_CAP): number {
  return softCapMultiplier(raw, softCap.cap, softCap.rate);
}
