/**
 * DropTable — weighted item drop tables (data stub; NOT wired yet).
 *
 * Rows are authored in `src/play/data/drops.json`: one table per drop
 * context (`drop_research`, `drop_dive_step`, …), each with weighted rolls
 * referencing stable item ids. Today's live find paths (`rollResearchFind` /
 * `rollPowerFind` / `rollMilestoneLook` in `items.ts`) still roll uniformly —
 * they stay untouched until the forever engine swaps them onto these tables.
 *
 * This module only types + validates the JSON and provides the weighted roll
 * the tables will be consumed through. Empty tables roll null (caller falls
 * back); weights are relative, not percentages.
 */
import rawDrops from '../data/drops.json';

export type DropRoll = {
  /** Item id to grant (must exist in items.json when the table is used). */
  id: string;
  /** Relative weight (≥ 0). Zero-weight rows never roll. */
  weight: number;
};

export type DropTable = {
  id: string;
  rolls: readonly DropRoll[];
};

function parseDrops(raw: unknown): readonly DropTable[] {
  if (!Array.isArray(raw)) return [];
  const tables: DropTable[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry == null) continue;
    const row = entry as Record<string, unknown>;
    if (typeof row.id !== 'string' || row.id.length === 0) continue;
    if (!Array.isArray(row.rolls)) continue;
    const rolls: DropRoll[] = [];
    for (const roll of row.rolls) {
      if (typeof roll !== 'object' || roll == null) continue;
      const r = roll as Record<string, unknown>;
      if (typeof r.id !== 'string' || r.id.length === 0) continue;
      const weight =
        typeof r.weight === 'number' && Number.isFinite(r.weight) ? r.weight : 0;
      if (weight > 0) rolls.push({ id: r.id, weight });
    }
    if (rolls.length > 0) tables.push({ id: row.id, rolls });
  }
  return tables;
}

/** All parsed drop tables, keyed by id for lookup. */
const TABLES: ReadonlyMap<string, DropTable> = new Map(
  parseDrops(rawDrops).map((table) => [table.id, table]),
);

/** The table with `id`, or undefined when unknown (caller falls back). */
export function getDropTable(id: string): DropTable | undefined {
  return TABLES.get(id);
}

/**
 * Roll one weighted id from a table. Null when the table is empty/unknown or
 * its total weight is 0 — callers fall back to a uniform roll.
 */
export function rollDropTable(
  table: DropTable | undefined,
  rng: () => number = Math.random,
): string | null {
  if (!table || table.rolls.length === 0) return null;
  let total = 0;
  for (const roll of table.rolls) total += roll.weight;
  if (total <= 0) return null;
  let cursor = rng() * total;
  for (const roll of table.rolls) {
    cursor -= roll.weight;
    if (cursor < 0) return roll.id;
  }
  return table.rolls[table.rolls.length - 1].id;
}

/** Weighted roll straight from a table id (null when unknown/empty). */
export function rollDropById(
  tableId: string,
  rng: () => number = Math.random,
): string | null {
  return rollDropTable(TABLES.get(tableId), rng);
}
