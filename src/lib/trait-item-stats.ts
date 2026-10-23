/**
 * Item agreement and retest stability for the trait questions.
 *
 * Pure. The runner is `scripts/trait-item-stats.ts` (`npm run trait:item-stats`).
 * Nothing here retires a question or writes a score.
 */

/** About how many people before the live report is worth reading. */
export const TRAIT_ITEM_STATS_MIN_PEOPLE = 300;

export function pearson(xs: readonly number[], ys: readonly number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i += 1) {
    sumX += xs[i]!;
    sumY += ys[i]!;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i += 1) {
    const a = xs[i]! - meanX;
    const b = ys[i]! - meanY;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (dx <= 0 || dy <= 0) return null;
  return num / Math.sqrt(dx * dy);
}

function sampleVariance(values: readonly number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / n;
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1);
}

/**
 * Cronbach's alpha for a people × items matrix. Null when there are fewer
 * than 2 people, fewer than 2 items, or the total score does not vary.
 */
export function cronbachAlpha(matrix: readonly (readonly number[])[]): number | null {
  const people = matrix.length;
  if (people < 2) return null;
  const items = matrix[0]?.length ?? 0;
  if (items < 2) return null;
  if (matrix.some((row) => row.length !== items)) return null;
  let itemVariance = 0;
  for (let item = 0; item < items; item += 1) {
    itemVariance += sampleVariance(matrix.map((row) => row[item]!));
  }
  const totalVariance = sampleVariance(matrix.map((row) => row.reduce((sum, value) => sum + value, 0)));
  if (totalVariance <= 0) return null;
  return (items / (items - 1)) * (1 - itemVariance / totalVariance);
}

/** Correlation of each item with the sum of the other items. */
export function itemTotalCorrelations(matrix: readonly (readonly number[])[]): (number | null)[] {
  const items = matrix[0]?.length ?? 0;
  const out: (number | null)[] = [];
  for (let item = 0; item < items; item += 1) {
    const column = matrix.map((row) => row[item]!);
    const rest = matrix.map((row) => row.reduce((sum, value, index) => (index === item ? sum : sum + value), 0));
    out.push(pearson(column, rest));
  }
  return out;
}

/** Correlation of the same people's scores about two weeks apart. */
export function retestStability(earlier: readonly number[], later: readonly number[]): number | null {
  return pearson(earlier, later);
}
