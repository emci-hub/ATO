/**
 * Pet cosmetics (v22, Part B) — existing art only, emci-approved kinds:
 *   - badge: a Look's item art, drawn small on the pet's shoulder;
 *   - tint:  the colour wash over the sprite (replaces the branch wash — the
 *            form still reads from the ring colour and the title);
 *   - ring:  the ring's style (the colour stays the branch colour);
 *   - aura:  a soft glow in a Legend element colour, at any stage.
 * Tints and badges can be bought with tokens (a token sink). Rings are Dive
 * finds from the Trench down, auras from the Abyss down — Dive-only.
 * Pure data + rules, no React.
 */
import type { Element } from '@/play/kits';

export const COSMETIC_SLOTS = ['badge', 'tint', 'ring', 'aura'] as const;
export type CosmeticSlot = (typeof COSMETIC_SLOTS)[number];

export type RingStyle = 'double' | 'dashed' | 'thick';

export type CosmeticDef = {
  id: string;
  slot: CosmeticSlot;
  name: string;
  /** Token price in the Wardrobe; null = Dive-only. */
  price: number | null;
  /** badge → the Look item whose art is the badge. */
  itemId?: string;
  /** tint → wash colour. */
  color?: string;
  /** ring → style. */
  ring?: RingStyle;
  /** aura → element colour. */
  element?: Element;
};

/** Duplicate cosmetic finds turn into this many shells. */
export const COSMETIC_DUPE_SHELLS = 5;

export const COSMETICS: readonly CosmeticDef[] = [
  { id: 'cos_badge_leaf', slot: 'badge', name: 'Leaf badge', price: 80, itemId: 'item_leaf_cape_01' },
  { id: 'cos_badge_pearl', slot: 'badge', name: 'Pearl badge', price: 80, itemId: 'item_deep_pearl_01' },
  { id: 'cos_badge_helm', slot: 'badge', name: 'Salt helm badge', price: 80, itemId: 'item_salt_helm_01' },
  { id: 'cos_badge_veil', slot: 'badge', name: 'Glowveil badge', price: 80, itemId: 'item_glowveil_cloak_01' },
  { id: 'cos_tint_coral', slot: 'tint', name: 'Coral tint', price: 60, color: '#FF7F6B' },
  { id: 'cos_tint_kelp', slot: 'tint', name: 'Kelp tint', price: 60, color: '#5FD068' },
  { id: 'cos_tint_ice', slot: 'tint', name: 'Ice tint', price: 60, color: '#9FE7FF' },
  { id: 'cos_tint_violet', slot: 'tint', name: 'Violet tint', price: 60, color: '#B58CFF' },
  { id: 'cos_tint_gold', slot: 'tint', name: 'Gold tint', price: 60, color: '#FFC857' },
  { id: 'cos_ring_double', slot: 'ring', name: 'Double ring', price: null, ring: 'double' },
  { id: 'cos_ring_dashed', slot: 'ring', name: 'Dashed ring', price: null, ring: 'dashed' },
  { id: 'cos_ring_thick', slot: 'ring', name: 'Heavy ring', price: null, ring: 'thick' },
  { id: 'cos_aura_ember', slot: 'aura', name: 'Ember aura', price: null, element: 'ember' },
  { id: 'cos_aura_tide', slot: 'aura', name: 'Tide aura', price: null, element: 'tide' },
  { id: 'cos_aura_spark', slot: 'aura', name: 'Spark aura', price: null, element: 'spark' },
  { id: 'cos_aura_root', slot: 'aura', name: 'Root aura', price: null, element: 'root' },
  { id: 'cos_aura_void', slot: 'aura', name: 'Void aura', price: null, element: 'void' },
];

const BY_ID = new Map(COSMETICS.map((c) => [c.id, c]));

export function cosmeticById(id: string): CosmeticDef | undefined {
  return BY_ID.get(id);
}

/** What the pet wears, one per slot (null = nothing). */
export type PetWear = Record<CosmeticSlot, string | null>;

export const NO_WEAR: PetWear = { badge: null, tint: null, ring: null, aura: null };

/** The worn cosmetics resolved to their defs (for drawing). */
export type WornLook = {
  badgeItemId: string | null;
  tint: string | null;
  ring: RingStyle | null;
  aura: Element | null;
};

export function wornLook(wear: PetWear): WornLook {
  const badge = wear.badge ? cosmeticById(wear.badge) : undefined;
  const tint = wear.tint ? cosmeticById(wear.tint) : undefined;
  const ring = wear.ring ? cosmeticById(wear.ring) : undefined;
  const aura = wear.aura ? cosmeticById(wear.aura) : undefined;
  return {
    badgeItemId: badge?.itemId ?? null,
    tint: tint?.color ?? null,
    ring: ring?.ring ?? null,
    aura: aura?.element ?? null,
  };
}

export function parsePetWear(raw: unknown, owned: readonly string[]): PetWear {
  const out: PetWear = { ...NO_WEAR };
  if (typeof raw !== 'object' || raw == null) return out;
  const row = raw as Record<string, unknown>;
  for (const slot of COSMETIC_SLOTS) {
    const id = row[slot];
    if (typeof id !== 'string') continue;
    const def = cosmeticById(id);
    if (def && def.slot === slot && owned.includes(id)) out[slot] = id;
  }
  return out;
}

export function parseOwnedCosmetics(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((id): id is string => typeof id === 'string' && BY_ID.has(id)))];
}
