/**
 * Ground point (aura/holo rework, SPEC §2). One rule for every pet and floor
 * effect: the point a pet's weight rests on, not its lowest pixel.
 *
 * In the ¾ low top-down camera the floor shows at half depth, so the lowest
 * opaque row is the toe edge and the footprint's middle sits higher. Measured
 * on Kael: figure 106 px, toe edge row 147, footprint middle ≈ 4 px above it
 * (≈ 4 % of the figure height). Auras, glimmer rings, the room floor ring and
 * the nameplate offset centre on this row, never on `footAt`.
 *
 * Pure and dependency-free so `scripts/art-pack.ts` and `check:pet-holo` can
 * import it in plain Node.
 */

/** Share of the figure height between the toe edge and the footprint middle. */
export const GROUND_FRACTION = 0.04;

/** Rows from the toe edge up to the ground point (standing figures; ≥ 1). */
export function groundInset(bodyH: number): number {
  return Math.max(1, Math.round(GROUND_FRACTION * bodyH));
}

/**
 * Ground row for a figure whose feet line (lowest opaque row + 1) is `feet`
 * and whose visible height is `bodyH`, in the same units.
 */
export function groundRow(feet: number, bodyH: number): number {
  return feet - groundInset(bodyH);
}

/**
 * Quadrupeds stand on four paws: the midpoint between the front-paw and the
 * back-paw contact rows (each a feet line). Falls back to the standing rule.
 */
export function quadrupedGroundRow(frontFeet: number, backFeet: number): number {
  return (frontFeet + backFeet) / 2;
}
