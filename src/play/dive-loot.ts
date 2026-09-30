/**
 * Dive loot + Dive progression (v22, Part B) — pure rules, no React/storage.
 *
 * Depth tiers (`data/dive-loot.json`): what a find can be depends on where it
 * is found. Depth = Deepers survived when the find lands (the first card is 0).
 *   depth 0 → Shallows, 1-2 → Reef, 3 → Trench, 4 → Abyss, 5 → Hadal (Oxygen).
 * Deeper tiers hold more Powers and the only rings/auras; items never change
 * stats by depth, so TD gear power is untouched (only how often Powers come).
 *
 * A find id is one of:
 *   item_*    → a bag item (items.json)
 *   food_*    → the pet pantry (max 8, fed only when you tap Feed)
 *   shells_N  → N shells (the Dive-gear currency)
 *   cos_*     → a pet cosmetic (pet-cosmetics.ts)
 *
 * Two paths per Deeper: Safer (bust −8 points, finds from one tier shallower)
 * or Richer (bust +8 points, one tier deeper). Both show their exact %.
 *
 * Dive gear (permanent, bought with shells): Lamp (see both paths' next find
 * before you choose — they are rolled in advance and saved, so the preview is
 * exactly what you get), Net (+1 find when you surface from depth 2 or
 * deeper), Oxygen (a 5th Deeper into the Hadal tier).
 *
 * Free dives (no charges left): no gear, food or cosmetics are kept — only
 * mood, shells (falling off with each free dive that day) and Logbook
 * sightings. Normal bust rules. They never count toward the Deep form.
 */
import rawLoot from '@/play/data/dive-loot.json';
import { getItemDef } from '@/play/items';
import { cosmeticById } from '@/play/pet-cosmetics';

/* ------------------------------------------------------------ tiers --- */

export const DIVE_TIERS = ['shallows', 'reef', 'trench', 'abyss', 'hadal'] as const;
export type DiveTier = (typeof DIVE_TIERS)[number];

export const DIVE_TIER_LABEL: Record<DiveTier, string> = {
  shallows: 'Shallows',
  reef: 'Reef',
  trench: 'Trench',
  abyss: 'Abyss',
  hadal: 'Hadal',
};

type LootRoll = { id: string; weight: number };

function parseTiers(raw: unknown): Record<DiveTier, LootRoll[]> {
  const out = { shallows: [], reef: [], trench: [], abyss: [], hadal: [] } as Record<DiveTier, LootRoll[]>;
  const tiers = (raw as { tiers?: unknown })?.tiers;
  if (!Array.isArray(tiers)) return out;
  for (const tier of tiers) {
    const id = (tier as { id?: unknown })?.id;
    const rolls = (tier as { rolls?: unknown })?.rolls;
    if (typeof id !== 'string' || !(DIVE_TIERS as readonly string[]).includes(id) || !Array.isArray(rolls)) continue;
    out[id as DiveTier] = rolls
      .filter(
        (r): r is LootRoll =>
          typeof r === 'object' && r != null && typeof r.id === 'string' && typeof r.weight === 'number' && r.weight > 0,
      )
      .filter((r) => findKind(r.id) !== 'unknown');
  }
  return out;
}

// Parsed on first use: `findKind` (below) needs FOODS, which is declared
// later in this module — parsing at load time would read it too early.
let tierRollsCache: Record<DiveTier, LootRoll[]> | null = null;
function tierRolls(): Record<DiveTier, LootRoll[]> {
  if (!tierRollsCache) tierRollsCache = parseTiers(rawLoot);
  return tierRollsCache;
}

export function diveTierRolls(tier: DiveTier): readonly LootRoll[] {
  return tierRolls()[tier];
}

/** Depth (Deepers survived) → tier index 0..4. */
export function tierIndexAt(depth: number): number {
  if (depth <= 0) return 0;
  if (depth <= 2) return 1;
  if (depth === 3) return 2;
  if (depth === 4) return 3;
  return 4;
}

export function tierAt(depth: number): DiveTier {
  return DIVE_TIERS[tierIndexAt(depth)];
}

/** One weighted roll from a tier. */
export function rollTier(tier: DiveTier, rng: () => number = Math.random): string {
  const rolls = tierRolls()[tier];
  const total = rolls.reduce((a, r) => a + r.weight, 0);
  let x = rng() * total;
  for (const r of rolls) {
    x -= r.weight;
    if (x < 0) return r.id;
  }
  return rolls[rolls.length - 1]?.id ?? 'shells_2';
}

/* ------------------------------------------------------------- finds --- */

export type FindKind = 'item' | 'food' | 'shells' | 'cosmetic' | 'unknown';

export const FOODS = {
  food_kelp: { name: 'Kelp snack', hearts: 1 },
  food_shrimp: { name: 'Glow shrimp', hearts: 2 },
} as const;
export type FoodId = keyof typeof FOODS;
export const FOOD_IDS = Object.keys(FOODS) as FoodId[];

export function isFoodId(id: string): id is FoodId {
  return Object.prototype.hasOwnProperty.call(FOODS, id);
}

export function shellsOf(id: string): number {
  const m = /^shells_(\d+)$/.exec(id);
  return m ? Number(m[1]) : 0;
}

export function findKind(id: string): FindKind {
  if (id.startsWith('item_')) return getItemDef(id) ? 'item' : 'unknown';
  if (isFoodId(id)) return 'food';
  if (shellsOf(id) > 0) return 'shells';
  if (id.startsWith('cos_')) return cosmeticById(id) ? 'cosmetic' : 'unknown';
  return 'unknown';
}

/** Display name for any find id. */
export function findName(id: string): string {
  const kind = findKind(id);
  if (kind === 'item') return getItemDef(id)?.core.name ?? id;
  if (kind === 'food') return FOODS[id as FoodId].name;
  if (kind === 'shells') return `${shellsOf(id)} shells`;
  if (kind === 'cosmetic') return cosmeticById(id)?.name ?? id;
  return 'Unknown find';
}

/** Every collectible Dive find (no shells), deepest-first tiers last — the
 * Logbook's slots. */
export function diveCollectibleIds(): string[] {
  const seen = new Set<string>();
  for (const tier of DIVE_TIERS) {
    for (const r of tierRolls()[tier]) if (findKind(r.id) !== 'shells') seen.add(r.id);
  }
  return [...seen];
}

/** The shallowest tier a find can come from (for the Logbook hint). */
export function firstTierOf(id: string): DiveTier | null {
  for (const tier of DIVE_TIERS) if (tierRolls()[tier].some((r) => r.id === id)) return tier;
  return null;
}

/* ------------------------------------------------------------- paths --- */

export const DIVE_PATHS = ['safe', 'rich'] as const;
export type DivePath = (typeof DIVE_PATHS)[number];
export const DIVE_PATH_LABEL: Record<DivePath, string> = { safe: 'Safer', rich: 'Richer' };

/** Bust points added (Richer) or taken off (Safer) the table value. */
export const DIVE_PATH_SHIFT = 0.08;

/** Base bust chance (before gear luck, the pet and the floor) for a path. */
export function pathBaseBust(tableBust: number, path: DivePath): number {
  const shifted = tableBust + (path === 'rich' ? DIVE_PATH_SHIFT : -DIVE_PATH_SHIFT);
  return Math.min(0.9, Math.max(0.05, shifted));
}

/** The tier a path's find comes from when it lands at `depth`. */
export function pathTier(depth: number, path: DivePath, oxygen: boolean): DiveTier {
  const t = tierIndexAt(depth);
  const max = oxygen ? 4 : 3;
  const i = path === 'safe' ? Math.max(0, t - 1) : Math.min(max, t + 1);
  return DIVE_TIERS[i];
}

/* -------------------------------------------------------------- gear --- */

export const DIVE_GEAR = ['lamp', 'net', 'oxygen'] as const;
export type DiveGear = (typeof DIVE_GEAR)[number];
export type DiveGearOwned = Record<DiveGear, boolean>;
export const NO_DIVE_GEAR: DiveGearOwned = { lamp: false, net: false, oxygen: false };

/** Shell prices (tuned in T-B9: a light pet-only or TD-only player buys the
 * Lamp in about 3 days). */
export const DIVE_GEAR_COST: Record<DiveGear, number> = {
  lamp: 60,
  net: 150,
  oxygen: 300,
};

export const DIVE_GEAR_LABEL: Record<DiveGear, string> = {
  lamp: 'Lamp',
  net: 'Net',
  oxygen: 'Oxygen',
};

export const DIVE_GEAR_BLURB: Record<DiveGear, string> = {
  lamp: 'See what each path’s next find is before you choose.',
  net: '+1 find when you surface from depth 2 or deeper.',
  oxygen: 'A 5th Deeper, into the Hadal — the deepest finds.',
};

/** Net: surfacing from this depth or deeper adds one find. */
export const NET_MIN_DEPTH = 2;

/** Oxygen's 5th Deeper bust chance (table value, before path/luck/pet). */
export const DIVE_OXYGEN_BUST = 0.65;

/* ------------------------------------------------------- shells + free --- */

/** TD: shells per cleared wave (campaign / band replay). */
export const SHELLS_PER_CLEAR = 4;
export const SHELLS_PER_REPLAY = 1;

/** Pantry: at most this much food; a find that doesn't fit becomes a shell. */
export const PANTRY_MAX = 8;
export const PANTRY_OVERFLOW_SHELLS = 1;

/** Free dives: surfacing pays (base + depth) shells, full for the first
 * `FREE_DIVE_FULL` free dives of a device-local day, then ×0.7 each. */
export const FREE_DIVE_BASE_SHELLS = 2;
export const FREE_DIVE_FULL = 10;
export const FREE_DIVE_DECAY = 0.7;

/** Shells a free-dive surface pays: `n` = free dives started earlier today. */
export function freeDiveShells(depth: number, n: number): number {
  const mult = n < FREE_DIVE_FULL ? 1 : Math.pow(FREE_DIVE_DECAY, n - FREE_DIVE_FULL + 1);
  return Math.round((FREE_DIVE_BASE_SHELLS + Math.max(0, depth)) * mult);
}

/** Expedition (v22): half the time a Power, else a Shallows find. */
export const EXPEDITION_POWER_CHANCE = 0.5;
