/**
 * Legend defs — the elemental Legends the player picks between in Dress
 * (emci, 2026-09-28: Legends repurposed into one team per element).
 *
 * The ACTIVE Legend supplies the element to your Avatar's attack and to every
 * hero's attack (the hero keeps its own behavior — chain, splash, pull…), and
 * levelling it makes that element stronger. Towers keep their own fixed
 * element. Owning, level, stars, worn gear and park still live in `playStore`
 * avatar records keyed by these ids (the record shape is unchanged — the old
 * code name "avatar record" stays for save compatibility).
 *
 * Extensible: add a def here to add a Legend. `LEGACY_LEGEND_MAP` carries the
 * ten pre-2026-09-28 ids (one real starter + nine placeholders) onto the new
 * five, and `migrateLegendRecords` merges their progress — see there.
 *
 * Pure (no React / store imports) so `check:legends` can pin the migration and
 * the level curve.
 */
import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

import type { Element } from '@/play/kits';

export type AvatarIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export type AvatarDef = {
  id: string;
  name: string;
  /** The element this Legend gives every attack. */
  element: Element;
  /** One-line identity for the Legend card. */
  blurb: string;
  icon: AvatarIconName;
  /** Accent (matches the element colour family). */
  color: string;
};

/** The starter Legend — always owned, the seed record of every save. The
 * Dungeon Druid carries over as the nature (Root) Legend. */
export const STARTER_AVATAR_ID = 'legend_root';

/** A non-starter Legend (the dev "unlock a Legend" row uses it). */
export const STUB_AVATAR_ID = 'legend_ember';

const AVATAR_DEFS: readonly AvatarDef[] = [
  {
    id: STARTER_AVATAR_ID,
    name: 'Dungeon Druid',
    element: 'root',
    blurb: 'Root (nature) — snares foes and hits tanks harder.',
    icon: 'magic-staff',
    color: '#34D399',
  },
  {
    id: 'legend_ember',
    name: 'Dragonblood Champion',
    element: 'ember',
    blurb: 'Ember (fire) — sets foes alight so they burn over time.',
    icon: 'fire',
    color: '#FB923C',
  },
  {
    id: 'legend_tide',
    name: 'Crystal Berserker',
    element: 'tide',
    blurb: 'Tide (ice) — chills and slows every foe it hits.',
    icon: 'snowflake',
    color: '#38BDF8',
  },
  {
    id: 'legend_spark',
    name: 'Arcane Engineer',
    element: 'spark',
    blurb: 'Spark (lightning) — single hits jump to a second foe.',
    icon: 'lightning-bolt',
    color: '#FACC15',
  },
  {
    id: 'legend_void',
    name: 'Abyssal Assassin',
    element: 'void',
    blurb: 'Void — makes foes take more damage. Never resisted.',
    icon: 'orbit',
    color: '#A78BFA',
  },
];

const AVATAR_DEF_BY_ID: ReadonlyMap<string, AvatarDef> = new Map(
  AVATAR_DEFS.map((def) => [def.id, def]),
);

/** Display def for an id, or undefined when the def is unknown. */
export function avatarDef(id: string): AvatarDef | undefined {
  return AVATAR_DEF_BY_ID.get(id);
}

/** Every Legend, in picker order. */
export function allAvatarDefs(): readonly AvatarDef[] {
  return AVATAR_DEFS;
}

/** The element a Legend id gives; the starter's element for an unknown id. */
export function legendElementOf(id: string): Element {
  return AVATAR_DEF_BY_ID.get(id)?.element ?? AVATAR_DEF_BY_ID.get(STARTER_AVATAR_ID)!.element;
}

/** The Legend for an element (every element has exactly one). */
export function legendForElement(element: Element): AvatarDef {
  return AVATAR_DEFS.find((def) => def.element === element) ?? AVATAR_DEFS[0];
}

/* ------------------------------------------------------------ level curve --- */

/** Level at which a Legend's element reaches full strength. Levels keep rising
 * past it (xp still pays out); the element just stops growing. */
export const LEGEND_LEVEL_FULL = 20;

/** 0 at level 1 → 1 at `LEGEND_LEVEL_FULL`. */
export function legendProgress(level: number): number {
  return Math.max(0, Math.min(1, (Math.floor(level) - 1) / (LEGEND_LEVEL_FULL - 1)));
}

/** Element rider strength from the Legend's level: ×1.0 at Lv1 → ×1.5 at Lv20
 * (bigger burns, longer chills, longer snares, stronger arcs and shred). */
export function legendRiderScale(level: number): number {
  return 1 + 0.5 * legendProgress(level);
}

/** Share of a bad-matchup penalty a Legend recovers: 0 at Lv1 → ½ at Lv20.
 * It never erases the penalty, so switching Legends stays worthwhile. */
export function legendResistRecovery(level: number): number {
  return 0.5 * legendProgress(level);
}

/** Hero affinity: a hero whose own element matches the active Legend deals
 * this much more damage. The LIVE value is the tune knob `heroAffinityBonus`
 * (so `sim:balance` can switch it off to measure it, and it can be tuned on a
 * phone); this is its Sane default, kept in step by `check:legends`. */
export const HERO_AFFINITY_BONUS = 0.15;

/** Gear match: a worn Power whose element matches the active Legend has its
 * OWN stats raised by this much (replaces the old board-wide +20% "type
 * match"; AFK-Arena-style faction gear bonus). Doubled by default: the first
 * value, +30%, measured only +6% board damage for a fully matched loadout
 * (`sim:balance`, 2026-09-29). Live value: tune knob `gearMatchBonus`; this is
 * its Sane default. */
export const GEAR_MATCH_BONUS = 1;

/* ---------------------------------------------------------- save migration --- */

/** Pre-2026-09-28 Legend ids → the new elemental Legend each folds into. The
 * starter (Dungeon Druid) becomes Root; placeholders go by their theme. */
export const LEGACY_LEGEND_MAP: Readonly<Record<string, string>> = {
  ava_sprout: 'legend_root',
  ava_ratkin: 'legend_root',
  ava_champion: 'legend_ember',
  ava_demon_guardian: 'legend_ember',
  ava_berserker: 'legend_tide',
  ava_death_knight: 'legend_tide',
  ava_engineer: 'legend_spark',
  ava_cleric: 'legend_spark',
  ava_assassin: 'legend_void',
  ava_witch: 'legend_void',
};

/** The subset of a saved Legend record the migration reads and writes. */
export type LegendRecordLike = {
  id: string;
  xp: number;
  level: number;
  stars: number;
  equipped: unknown;
  park: unknown;
};

/**
 * Carry old Legend records onto the new elemental ids (save v18 → v19).
 *
 * - Every old id maps through `LEGACY_LEGEND_MAP`; new ids pass through;
 *   anything unknown is dropped.
 * - When several old records land on the same new Legend, they MERGE: the
 *   highest level wins together with its xp, stars take the max, and the worn
 *   gear + park come from the record the player had ACTIVE if it is in the
 *   group (so the loadout they were using is the one they keep), otherwise
 *   from the highest-level record.
 * - WORN GEAR IS NOT IN THE BAG — equipping takes the copy out of the
 *   inventory. So every loadout the merge does NOT keep (a merged-away record,
 *   or a record with an unknown id) is handed back in `returnedEquipped`, and
 *   the caller must put those items back in the bag, or they would vanish
 *   (caught in review, 2026-09-28).
 * - The active id follows its record to the new id.
 *
 * Returns rows in first-seen order; the caller still guarantees the starter.
 */
export function migrateLegendRecords<T extends LegendRecordLike>(
  rows: readonly T[],
  activeId: string | null,
): { rows: T[]; activeId: string | null; returnedEquipped: unknown[] } {
  const known = new Set(AVATAR_DEFS.map((def) => def.id));
  const groups = new Map<string, T[]>();
  const returnedEquipped: unknown[] = [];
  const seenIds = new Set<string>();
  for (const row of rows) {
    // A corrupt save with a repeated id: keep the first, ignore the rest
    // (as `parseAvatars` always did) — returning a duplicate's gear to the
    // bag would duplicate items.
    if (seenIds.has(row.id)) continue;
    seenIds.add(row.id);
    const target = LEGACY_LEGEND_MAP[row.id] ?? (known.has(row.id) ? row.id : null);
    if (!target) {
      returnedEquipped.push(row.equipped);
      continue;
    }
    const list = groups.get(target) ?? [];
    list.push(row);
    groups.set(target, list);
  }
  const out: T[] = [];
  for (const [target, list] of groups) {
    const top = list.reduce((a, b) => (b.level > a.level || (b.level === a.level && b.xp > a.xp) ? b : a));
    const loadout = list.find((row) => row.id === activeId) ?? top;
    for (const row of list) if (row !== loadout) returnedEquipped.push(row.equipped);
    out.push({
      ...top,
      id: target,
      stars: Math.max(...list.map((row) => row.stars)),
      equipped: loadout.equipped,
      park: loadout.park,
    });
  }
  const mappedActive =
    activeId == null
      ? null
      : (LEGACY_LEGEND_MAP[activeId] ?? (known.has(activeId) ? activeId : null));
  return { rows: out, activeId: mappedActive, returnedEquipped };
}
