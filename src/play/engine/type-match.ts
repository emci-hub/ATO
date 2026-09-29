/**
 * Type match — Divecore soft elements (GAME_SPEC §9f §9h §9i; Phase C).
 *
 * Four tags (Tide / Ember / Root / Spark) plus Void (`kits.ts`, outside this
 * cycle). The chart (Tide → Ember → Root → Spark → Tide: each beats the next)
 * drives the ONE element-matchup rule (2026-09-28, `kit-combat.ts`
 * `matchupMult`): a stage's element is weak to the one before it (+25%) and
 * resists itself (−25%, softened by a levelled Legend). The old board-wide
 * +20% "gear tag matches the cycle tint" bonus is gone — a worn Power whose
 * tag matches the active LEGEND now gets its own stats raised instead
 * (`playStore.ts` `gearMatchesLegend`).
 *
 * Old ATO Ink/Paper/Steel/Bloom colors map 1:1 onto these four tags in the
 * Play JSON; ATO coach colors stay elsewhere. This module is leaf-ish on
 * purpose (tags + labels only) so both `items.ts` and
 * `playStore.ts` can read from it without a cycle.
 */

/** Canonical element tags (locked set — never expand without a version bump). */
export const TYPE_TAGS = ['tide', 'ember', 'root', 'spark'] as const;
export type TypeTag = (typeof TYPE_TAGS)[number];

/** Loose guard for reading a raw tag off JSON / a store field. */
export function isTypeTag(value: unknown): value is TypeTag {
  return typeof value === 'string' && (TYPE_TAGS as readonly string[]).includes(value);
}

/** Chart order (display only): Tide → Ember → Root → Spark → Tide. */
export const TYPE_MATCH_CYCLE: readonly TypeTag[] = ['tide', 'ember', 'root', 'spark'];

/** Player-facing tag name (Dress / preview / chart). */
export const TAG_LABEL: Record<TypeTag, string> = {
  tide: 'Tide',
  ember: 'Ember',
  root: 'Root',
  spark: 'Spark',
};

/** Tint color for bosses + preview chips (reads on light and dark boards).
 * Spark is electric yellow since 2026-09-24 (EFFECTS_PLAN decision 2) so the
 * violet is free for Void, the 5th attack element (`kits.ts`, outside this
 * cycle). */
export const TAG_COLOR: Record<TypeTag, string> = {
  tide: '#38BDF8',
  ember: '#FB923C',
  root: '#34D399',
  spark: '#FACC15',
};

/** MaterialCommunityIcons name per tag (preview + chart). Narrowed with
 * `as const` so it typechecks against the icon's name union without pulling
 * the icon component into this pure engine module. */
export const TAG_ICON = {
  tide: 'waves',
  ember: 'fire',
  root: 'sprout',
  spark: 'lightning-bolt',
} as const;
