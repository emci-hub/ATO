/**
 * Type match — Divecore soft elements (GAME_SPEC §9f §9h §9i; Phase C).
 *
 * Four tags (Tide / Ember / Root / Spark) drive a SOFT match, never immunity:
 * a cycle/boss carries one `type_tint`, and any equipped Power whose `type_tag`
 * matches that tint gets `type_match_bonus` (locked Sane +0.20, board-wide).
 * Mismatch = neutral (no −%). The chart (Tide → Ember → Root → Spark → Tide)
 * is display only — the combat rule is match-or-nothing, so a single match
 * never deletes the climb (cycle_power + soft-caps outpace it).
 *
 * Old ATO Ink/Paper/Steel/Bloom colors map 1:1 onto these four tags in the
 * Play JSON; ATO coach colors stay elsewhere. This module is leaf-ish on
 * purpose (tags + labels + the bonus value only) so both `items.ts` and
 * `playStore.ts` can read from it without a cycle.
 */
import { getTune } from '@/play/tune';

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

/** Tint color for bosses + preview chips (reads on light and dark boards). */
export const TAG_COLOR: Record<TypeTag, string> = {
  tide: '#38BDF8',
  ember: '#FB923C',
  root: '#34D399',
  spark: '#A78BFA',
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

/** Board-wide soft match bonus when a Power's type_tag == the cycle tint. */
export function typeMatchBonus(matched: boolean): number {
  return matched ? getTune().typeMatchBonus : 0;
}
