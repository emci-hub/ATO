/**
 * Attack kits — EFFECTS_PLAN.md step 3 (data only; nothing reads a kit in combat
 * yet — that is step 4).
 *
 * Every hero and plain tower carries ONE behavior (how it attacks) + ONE
 * element (what the hit adds and how it looks). Ultimates later mix in a second
 * element at half strength; that is derived from these two fields, so no hero
 * ever needs its own code.
 *
 * Elements: the four locked `TypeTag`s (Tide / Ember / Root / Spark — the
 * match cycle, `engine/type-match.ts`) plus **Void**, which sits OUTSIDE that
 * cycle on purpose (emci, 2026-09-24): Void never gets the match bonus and is
 * never an enemy's weakness — its identity is reliable control. `TYPE_TAGS`
 * itself is not expanded, so gear rolls, cycle tints and the match chart are
 * untouched.
 *
 * Leaf module: imports only the type-match leaf, so `heroes-data`, `defend` and
 * the screens can all read it without a cycle.
 */
import { TAG_COLOR, TAG_ICON, TAG_LABEL, TYPE_TAGS, type TypeTag } from '@/play/engine/type-match';

/** How an attack behaves. Locked set — the plan's 6 archetypes. */
export const BEHAVIORS = ['burst', 'splash', 'dot', 'slow', 'chain', 'pull'] as const;
export type Behavior = (typeof BEHAVIORS)[number];

/** Attack elements: the 4 match-cycle tags + Void (outside the cycle). */
export const ELEMENTS = [...TYPE_TAGS, 'void'] as const;
export type Element = TypeTag | 'void';

/** A kit. `element: null` = a neutral attack (the plain Archer). */
export type Kit = { behavior: Behavior; element: Element | null };

export function isBehavior(value: unknown): value is Behavior {
  return typeof value === 'string' && (BEHAVIORS as readonly string[]).includes(value);
}

export function isElement(value: unknown): value is Element {
  return typeof value === 'string' && (ELEMENTS as readonly string[]).includes(value);
}

/** True for the 4 cycle elements — the only ones that can match a weakness. */
export function isCycleElement(element: Element | null): element is TypeTag {
  return element != null && element !== 'void';
}

export const ELEMENT_LABEL: Record<Element, string> = { ...TAG_LABEL, void: 'Void' };

/** Element colours (EFFECTS_PLAN): Ember orange, Tide blue, Root green, Spark
 * yellow, Void violet. The cycle four come straight from `TAG_COLOR`. */
export const ELEMENT_COLOR: Record<Element, string> = { ...TAG_COLOR, void: '#A78BFA' };

/** MaterialCommunityIcons names (same `as const` narrowing as `TAG_ICON`). */
export const ELEMENT_ICON = { ...TAG_ICON, void: 'orbit' } as const;

/** Player-facing behavior name. */
export const BEHAVIOR_LABEL: Record<Behavior, string> = {
  burst: 'Burst',
  splash: 'Splash',
  dot: 'Damage over time',
  slow: 'Slow',
  chain: 'Chain',
  pull: 'Pull',
};

/** Base range per behavior, board units (0..100; 1 tile ≈ 6.25). Chain reaches
 * furthest, pull is shortest. Not read by combat until step 4. */
export const BEHAVIOR_BASE_RANGE: Record<Behavior, number> = {
  burst: 20,
  splash: 16,
  dot: 18,
  slow: 17,
  chain: 22,
  pull: 14,
};

/** Splash blast radius and chain bounce reach, board units. */
export const SPLASH_RADIUS = 6;
export const CHAIN_BOUNCE_RANGE = 9;

/** No shooter fires faster than this (emci, 2026-09-24): speed past the floor
 * converts into damage, so DPS climbs but the number of drawn effects doesn't. */
export const ATTACK_COOLDOWN_FLOOR_MS = 600;

/** Plain tower kits. Keyed by the `TowerKind` strings (`defend.ts`) — spelled
 * out here rather than imported so this module stays a leaf. */
export const TOWER_KITS = {
  archer: { behavior: 'burst', element: null },
  vine: { behavior: 'slow', element: 'root' },
  crystal: { behavior: 'burst', element: 'spark' },
} as const satisfies Record<'archer' | 'vine' | 'crystal', Kit>;

/** One-line kit label for UI / reports, e.g. "Chain · Spark". */
export function kitLabel(kit: Kit): string {
  return kit.element
    ? `${BEHAVIOR_LABEL[kit.behavior]} · ${ELEMENT_LABEL[kit.element]}`
    : BEHAVIOR_LABEL[kit.behavior];
}
