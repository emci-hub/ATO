/**
 * Grove item defs (Play step 2b — GAME_DATA "Item (Core + Mult A + Mult B)").
 *
 * `data/items.json` is the authoring surface: one JSON row per item, stable
 * `id`; code reads ids only. This module types those rows, validates them once
 * at load (a bad def fails loudly, per GAME_DATA "dangling refs = fail"), and
 * exposes the only item operations v0 needs today: rolling one research-bag
 * find and turning an id into a display name.
 *
 * v0 scope: 10 stubs — 6 Looks (both mults null) + 4 Powers (mult_a set, mix
 * of wave_power / tower_speed / token_earn / dive_luck / research_yield).
 * There is no loot_tables.json yet, so a research find rolls uniformly across
 * the stub table; Dive (step 3) brings its own weighted odds.
 */
import rawItems from './data/items.json';

export const ITEM_SLOTS = ['weapon', 'armor', 'cloak', 'trinket'] as const;
export type ItemSlot = (typeof ITEM_SLOTS)[number];

export const ITEM_RARITIES = ['common', 'rare'] as const;
export type ItemRarity = (typeof ITEM_RARITIES)[number];

export const ITEM_KINDS = ['look', 'power'] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

/** Multiplier span keys — every stat on a Power must be one of these. */
export const ITEM_STATS = [
  'wave_power',
  'tower_speed',
  'token_earn',
  'dive_luck',
  'research_yield',
] as const;
export type ItemStat = (typeof ITEM_STATS)[number];

export type StatMult = {
  stat: ItemStat;
  value: number;
};

export type ItemDef = {
  id: string;
  core: {
    slot: ItemSlot;
    rarity: ItemRarity;
    kind: ItemKind;
    name: string;
    art: string;
    type_tag: string;
  };
  /** Look items keep both null; a Power always carries at least mult_a. */
  mult_a: StatMult | null;
  /** Rarity gates whether a second mult can roll: common powers never have one. */
  mult_b: StatMult | null;
};

const ITEMS: readonly ItemDef[] = loadItems(rawItems);

const ITEM_BY_ID: ReadonlyMap<string, ItemDef> = new Map(
  ITEMS.map((item) => [item.id, item]),
);

/**
 * Roll one research-bag find — a uniform draw over the stub table. Uniform is
 * placeholder until loot_tables.json lands with Dive's weighted odds. Dive
 * (step 3) reuses the same stub-table roll for its finds until then.
 */
export function rollResearchFind(rng: () => number = Math.random): string {
  const ids = ITEMS.map((item) => item.id);
  return ids[Math.floor(rng() * ids.length)];
}

/** Roll one Power item id — uniform over the kind: power rows. */
export function rollPowerFind(rng: () => number = Math.random): string {
  const powers = ITEMS.filter((item) => item.core.kind === 'power');
  return powers[Math.floor(rng() * powers.length)].id;
}

/** A stable common Look — the Dev kit's junk-fill fodder (auto-sell source). */
export function junkLookId(): string {
  const junk =
    ITEMS.find((item) => item.core.kind === 'look' && item.core.rarity === 'common') ?? ITEMS[0];
  return junk?.id ?? '';
}

/** Display name for an id, or null when the id is not a def (dangling). */
export function itemName(id: string): string | null {
  return ITEM_BY_ID.get(id)?.core.name ?? null;
}

/** Full def for an id (find cards / Dress later); undefined when dangling. */
export function getItemDef(id: string): ItemDef | undefined {
  return ITEM_BY_ID.get(id);
}

/** Stat-key → readable label for the find card's mult lines. */
const STAT_LABELS: Record<ItemStat, string> = {
  wave_power: 'wave power',
  tower_speed: 'tower speed',
  token_earn: 'token gain',
  dive_luck: 'dive luck',
  research_yield: 'research yield',
};

/** "+8% wave power" style line, e.g. for a Power find's card. */
export function formatMult(mult: StatMult): string {
  const pct = Math.round(mult.value * 100);
  return `+${pct}% ${STAT_LABELS[mult.stat]}`;
}

function loadItems(raw: unknown): readonly ItemDef[] {
  const problems = validateItems(raw);
  if (problems.length > 0) {
    throw new Error(`Grove items.json is invalid — fix the defs:\n  ${problems.join('\n  ')}`);
  }
  return raw as readonly ItemDef[];
}

function validateItems(raw: unknown): string[] {
  const problems: string[] = [];
  if (!Array.isArray(raw)) {
    return ['items.json must be a top-level array of item defs'];
  }
  const ids = new Set<string>();
  raw.forEach((row, index) => {
    const at = `items.json[${index}]`;
    if (!isRecord(row)) {
      problems.push(`${at}: not an object`);
      return;
    }
    if (typeof row.id !== 'string' || row.id.length === 0) {
      problems.push(`${at}: missing id`);
    } else if (ids.has(row.id)) {
      problems.push(`${at}: duplicate id "${row.id}"`);
    } else {
      ids.add(row.id);
    }

    const core = row.core;
    if (!isRecord(core)) {
      problems.push(`${at}: core must be an object`);
      return;
    }
    if (!ITEM_SLOTS.includes(core.slot as ItemSlot)) {
      problems.push(`${at}: core.slot must be one of ${ITEM_SLOTS.join('/')}`);
    }
    if (!ITEM_RARITIES.includes(core.rarity as ItemRarity)) {
      problems.push(`${at}: core.rarity must be one of ${ITEM_RARITIES.join('/')}`);
    }
    if (typeof core.name !== 'string' || core.name.length === 0) {
      problems.push(`${at}: core.name missing`);
    }
    if (typeof core.art !== 'string' || core.art.length === 0) {
      problems.push(`${at}: core.art missing`);
    }
    if (typeof core.type_tag !== 'string' || core.type_tag.length === 0) {
      problems.push(`${at}: core.type_tag missing`);
    }

    if (core.kind === 'look') {
      if (row.mult_a != null || row.mult_b != null) {
        problems.push(`${at}: look items must keep both mults null`);
      }
    } else if (core.kind === 'power') {
      if (!isStatMult(row.mult_a)) {
        problems.push(`${at}: power items need mult_a as { stat, value }`);
      }
      if (row.mult_b != null && !isStatMult(row.mult_b)) {
        problems.push(`${at}: mult_b must be null or { stat, value }`);
      }
      if (row.mult_b != null && core.rarity === 'common') {
        problems.push(`${at}: common powers never carry a second mult (mult_b)`);
      }
    } else {
      problems.push(`${at}: core.kind must be look or power`);
    }
  });
  return problems;
}

function isStatMult(value: unknown): value is StatMult {
  if (!isRecord(value)) return false;
  return (
    ITEM_STATS.includes(value.stat as ItemStat) &&
    typeof value.value === 'number' &&
    Number.isFinite(value.value) &&
    value.value > 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
