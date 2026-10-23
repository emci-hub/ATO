/**
 * ⚡ Superpower / 🪫 Kryptonite — no randomness. Ready BAR categories only.
 * Highest bar is the superpower, lowest is the kryptonite. Each half shows
 * only when its score is really on that side of 0.5 (emci 2026-10-14):
 * superpower strictly above, kryptonite strictly below. Ties go to catalog
 * order (the first one wins), and one category is never both halves.
 */
import type { CategoryReading } from '@/lib/categories';

import { superpowerLineFor } from './superpower-bank';
import type { SuperpowerLine } from './types';

/** The middle of every bar. A score exactly here is on neither side. */
export const SUPERPOWER_MIDPOINT = 0.5;

export interface SuperpowerPick {
  superpower: SuperpowerLine | null;
  kryptonite: SuperpowerLine | null;
}

/** Rounded so float noise (0.5000000001) never flips a side. */
function sideOf(bar: number): 'high' | 'low' | 'middle' {
  const delta = Math.round((bar - SUPERPOWER_MIDPOINT) * 1e9) / 1e9;
  if (delta > 0) return 'high';
  if (delta < 0) return 'low';
  return 'middle';
}

/**
 * `readings` in catalog order (`getCategoryDefs()` / `readyCategories`).
 * Null when no ready bar exists or neither half qualifies — never a faked card.
 */
export function pickSuperpower(readings: readonly CategoryReading[]): SuperpowerPick | null {
  const bars = readings.filter(
    (row): row is CategoryReading & { bar: number } =>
      row.ready && row.def.shape === 'bar' && typeof row.bar === 'number' && Number.isFinite(row.bar),
  );
  if (bars.length === 0) return null;
  let top = bars[0]!;
  let bottom = bars[0]!;
  for (const row of bars) {
    if (row.bar > top.bar) top = row;
    if (row.bar < bottom.bar) bottom = row;
  }
  const superpower = sideOf(top.bar) === 'high' ? superpowerLineFor(top.def.id, 'superpower') : null;
  // One bar on its own can only be one side, so it never fills both halves.
  const kryptonite = sideOf(bottom.bar) === 'low' ? superpowerLineFor(bottom.def.id, 'kryptonite') : null;
  if (!superpower && !kryptonite) return null;
  return { superpower, kryptonite };
}
