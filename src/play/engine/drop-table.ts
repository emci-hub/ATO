/**
 * DropTable — weighted item drop tables (GAME_SPEC §9i §9l; Phase C).
 *
 * Rows are authored in `src/play/data/drops.json`: one table per drop context
 * (`drop_research`, `drop_dive_step`, `drop_defend_farm`, and the boss band
 * tables `drop_band_scout9/10`, `drop_band_final20`).
 * Each roll references a stable item id with a relative weight; `unique` rows
 * drop at most once per save (the caller passes already-owned unique ids to
 * exclude). `previewDropTable` is the honest "What can drop" surface (Farmable
 * vs Unique/Owned) that Defend setup + band select render.
 *
 * Weights are relative, not percentages. A table whose eligible rows are all
 * excluded rolls null (caller treats it as "no drop").
 */
import rawDrops from '../data/drops.json';

export type DropRoll = {
  /** Item id to grant (must exist in items.json when the table is used). */
  id: string;
  /** Relative weight (≥ 0). Zero-weight rows never roll. */
  weight: number;
  /** Unique rows drop once per save — excluded once owned. */
  unique: boolean;
};

export type DropTable = {
  id: string;
  rolls: readonly DropRoll[];
};

/** One honest preview row: what can drop, and its owned state (uniques only). */
export type DropPreviewRow = {
  id: string;
  /** True when this row is a once-per-save unique (else farmable). */
  unique: boolean;
  /** True when a unique has already been granted ("Owned — won't drop again"). */
  owned: boolean;
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
      if (weight > 0) {
        rolls.push({ id: r.id, weight, unique: r.unique === true });
      }
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

/** Is `id` a `unique` row in this table (used to mark a drop as owned). */
export function isUniqueDrop(tableId: string, id: string): boolean {
  const table = TABLES.get(tableId);
  if (!table) return false;
  return table.rolls.some((roll) => roll.id === id && roll.unique);
}

/** Honest preview rows for a table, marking owned uniques from `ownedIds`. */
export function previewDropTable(
  tableId: string,
  ownedUniqueIds: ReadonlySet<string> = new Set(),
): DropPreviewRow[] {
  const table = TABLES.get(tableId);
  if (!table) return [];
  return table.rolls.map((roll) => ({
    id: roll.id,
    unique: roll.unique,
    owned: roll.unique && ownedUniqueIds.has(roll.id),
  }));
}

/**
 * Roll one weighted id from a table. `excludeIds` removes unique rows that are
 * already owned (they "won't drop again"). Null when the table is empty/unknown
 * or every eligible row is excluded — callers fall back or grant nothing.
 */
export function rollDropTable(
  table: DropTable | undefined,
  rng: () => number = Math.random,
  excludeIds: ReadonlySet<string> = new Set(),
): string | null {
  if (!table || table.rolls.length === 0) return null;
  const eligible = table.rolls.filter(
    (roll) => !(roll.unique && excludeIds.has(roll.id)),
  );
  let total = 0;
  for (const roll of eligible) total += roll.weight;
  if (total <= 0) return null;
  let cursor = rng() * total;
  for (const roll of eligible) {
    cursor -= roll.weight;
    if (cursor < 0) return roll.id;
  }
  return eligible[eligible.length - 1].id;
}

/** Weighted roll straight from a table id (null when unknown/empty/excluded). */
export function rollDropById(
  tableId: string,
  rng: () => number = Math.random,
  excludeIds: ReadonlySet<string> = new Set(),
): string | null {
  return rollDropTable(TABLES.get(tableId), rng, excludeIds);
}
