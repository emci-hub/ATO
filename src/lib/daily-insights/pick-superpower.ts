/**
 * ⚡ Superpower / 🪫 Kryptonite — no randomness. Ready BAR categories only.
 * Highest bar is the superpower (shown only when it leans high), lowest is
 * the kryptonite (shown only when it leans low). Ties go to catalog order.
 */
import type { CategoryReading } from '@/lib/categories';
import { leanHighLow } from '@/lib/traits';

import { superpowerLineFor } from './superpower-bank';
import type { SuperpowerLine } from './types';

export const SUPERPOWER_MIN_BARS = 3;
export const SUPERPOWER_MIN_SPREAD = 0.1;

export interface SuperpowerPick {
  superpower: SuperpowerLine | null;
  kryptonite: SuperpowerLine | null;
}

/**
 * `readings` in catalog order (`getCategoryDefs()` / `readyCategories`).
 * Null when fewer than 3 bars are ready, the spread is under 0.10, or
 * neither half qualifies — never a faked card.
 */
export function pickSuperpower(readings: readonly CategoryReading[]): SuperpowerPick | null {
  const bars = readings.filter(
    (row): row is CategoryReading & { bar: number } =>
      row.ready && row.def.shape === 'bar' && typeof row.bar === 'number' && Number.isFinite(row.bar),
  );
  if (bars.length < SUPERPOWER_MIN_BARS) return null;
  let top = bars[0]!;
  let bottom = bars[0]!;
  for (const row of bars) {
    if (row.bar > top.bar) top = row;
    if (row.bar < bottom.bar) bottom = row;
  }
  // Rounded so float noise (0.6 - 0.5 = 0.0999…) never flips the rule.
  if (Math.round((top.bar - bottom.bar) * 1e9) / 1e9 < SUPERPOWER_MIN_SPREAD) return null;
  const superpower = leanHighLow(top.bar) === 'high' ? superpowerLineFor(top.def.id, 'superpower') : null;
  const kryptonite = leanHighLow(bottom.bar) === 'low' ? superpowerLineFor(bottom.def.id, 'kryptonite') : null;
  if (!superpower && !kryptonite) return null;
  return { superpower, kryptonite };
}
