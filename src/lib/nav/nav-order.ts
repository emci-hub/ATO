import type { Href } from 'expo-router';

/**
 * Persisted bottom-nav layout, per user (`me.nav_layout` jsonb).
 *
 * The last button is always "More" — fixed, not draggable, never reorderable.
 * The layout always contains Home and Insights exactly once each, in
 * user-draggable positions; the remaining POOL_SLOTS entries hold pool tabs. The pool is the whole
 * `NAV_TABS` registry (Explore / You / Questions / Around / Legends / Circle),
 * so a future tab is added with one registry entry — the slot/drag/edit logic
 * is generic over the registry and never hardcoded to today's set.
 */

/** Pool tabs a user can place into slots 1–4 (and see in More). Extensible. */
export type ReorderableTabId =
  | 'explore'
  | 'you'
  | 'questions'
  | 'around'
  | 'legends'
  | 'circle'
  | 'play';

/** The two always-present tabs (not pool tabs; can never leave slots 1–4). */
export type PinnedTabId = 'home' | 'insights';

/** Anything that can occupy one of slots 1–4. */
export type BarSlotId = PinnedTabId | ReorderableTabId;

export interface NavUnlockContext {
  /** True once this account has at least one Circle connection. */
  hasCircle: boolean;
}

export interface NavTabMeta {
  label: string;
  /** expo-router href for the tab route (Home/Insights are handled separately). */
  href: Href;
  /** MaterialCommunityIcons glyph name. */
  icon: string;
  /**
   * Optional gate. When this returns false, the tab is omitted from the bar,
   * More, and the edit pool, and Edit Navigation shows it in "Not unlocked
   * yet". Omit for tabs that are always available.
   */
  isUnlocked?: (ctx: NavUnlockContext) => boolean;
  /** Shown under the locked row. Required when `isUnlocked` is set. */
  unlockReason?: string;
}

/**
 * Registry of pool tabs. Adding a new tab = add one entry here (plus its route
 * file). Nothing else in the slot/drag/edit logic references tab ids directly.
 */
export const NAV_TABS: Record<ReorderableTabId, NavTabMeta> = {
  explore: { label: 'Explore', href: '/explore', icon: 'compass-outline' },
  around: { label: 'Around', href: '/around', icon: 'map-marker-radius-outline' },
  you: { label: 'You', href: '/you', icon: 'account' },
  // Not gated on a friend: Add by handle lives inside this tab, so a gate would lock out the first friend.
  circle: { label: 'Circle', href: '/circle', icon: 'account-group' },
  questions: { label: 'Questions', href: '/intake-sweep', icon: 'comment-question-outline' },
  legends: { label: 'Legends', href: '/legends', icon: 'book-open-page-variant-outline' },
  // Play (Divecore) is a root Stack screen, not a tab route: its bar slot pushes /play (app-tabs.tsx).
  play: { label: 'Play', href: '/play', icon: 'play-circle' },
};

/** Pool ids whose destination is a pushed root screen, so they get no tab trigger. */
export const PUSHED_TAB_IDS: readonly ReorderableTabId[] = ['play'];

export const NAV_TAB_IDS = Object.keys(NAV_TABS) as ReorderableTabId[];

/**
 * Tabs whose screens are PARKED behind `RebuiltNotice` (ISOLATION_PLAN §7
 * Card F, emci 2026-09-15: "hide parked tabs from the tab bar").
 *
 * They stay in the registry and stay registered as routes — removing a route
 * would mean a native build, and every deep link into one must still land
 * somewhere, which is the notice. What this list does is keep them out of the
 * bar, out of More, and out of the edit pool, so nobody navigates into a
 * placeholder by accident and nobody can pin one to a slot.
 *
 * `PARKED_PINNED_IDS` holds parked PINNED ids (there are none right now) —
 * a pinned id needs its own list because the slot engine always places one
 * in slots 1–4 regardless of the pool, so `app-tabs` has to render it as a
 * hidden trigger instead of a button when parked.
 *
 * Un-parking a screen = delete its id from here. Nothing else changes.
 *
 * **`sage` and `legends` were UN-PARKED 2026-09-15** (emci: restore both tabs
 * with their original icons/labels; each still opens only its RebuiltNotice —
 * no backend or AI code revived, only visibility changed). `around` stays
 * parked and hidden. `circle` was un-parked 2026-10-21 (plain friend list + Message).
 */
export const PARKED_TAB_IDS: readonly ReorderableTabId[] = ['around'];

/**
 * Parked pinned tabs. Same rule, different slot type. Empty since 2026-10-14:
 * the parked Sage placeholder was replaced by Insights, which is a real tab.
 */
export const PARKED_PINNED_IDS: readonly PinnedTabId[] = [];

export function isTabParked(id: BarSlotId): boolean {
  return (
    (PARKED_TAB_IDS as readonly string[]).includes(id) ||
    (PARKED_PINNED_IDS as readonly string[]).includes(id)
  );
}


export const PINNED_IDS: readonly PinnedTabId[] = ['home', 'insights'];

/**
 * Entries in a layout: Home + Insights + POOL_SLOTS pool tabs. The bar SHOWS
 * VISIBLE_SLOT_COUNT tabs, then the fixed "More" — five buttons in all.
 */
export const SLOT_COUNT = 4;

/** How many entries hold pool tabs (the other 2 are Home + Insights). */
export const POOL_SLOTS = 2;

/**
 * Saved layouts written before 2026-10-14 name the old `sage` tab. Read and
 * write both map it to `insights` in place, so the user's order is kept.
 */
export const LEGACY_TAB_ID_MAP: Readonly<Record<string, PinnedTabId>> = { sage: 'insights' };

function isPinnedId(value: unknown): value is PinnedTabId {
  return value === 'home' || value === 'insights';
}

/** Buttons the bar actually draws before "More" (parked pinned ids draw none). */
export const VISIBLE_SLOT_COUNT = SLOT_COUNT - PARKED_PINNED_IDS.length;

/** Tabs whose `isUnlocked` check fails. Tabs without a check are always open. */
export function lockedTabIds(ctx: NavUnlockContext): ReorderableTabId[] {
  return NAV_TAB_IDS.filter((id) => {
    const check = NAV_TABS[id].isUnlocked;
    return check ? !check(ctx) : false;
  });
}

export function isTabUnlocked(id: ReorderableTabId, ctx: NavUnlockContext): boolean {
  const check = NAV_TABS[id].isUnlocked;
  return check ? check(ctx) : true;
}

/**
 * Layout version stored INSIDE the layout JSON (`me.nav_layout`, no schema change).
 * A saved layout with an older or missing version resets ONCE to the default on
 * read (IA phase P3: the bar became Home · Insights · You · Play · More); a layout
 * saved from the edit screen is stamped with the current version, so later edits
 * are kept.
 */
export const NAV_LAYOUT_VERSION = 3;

export interface NavLayout {
  /** Exactly SLOT_COUNT entries: home + insights once each, plus POOL_SLOTS pool ids. */
  slots: BarSlotId[];
  /** Absent on the in-code default and on layouts saved before P3. */
  version?: number;
}

/**
 * `you` swapped for `legends` in the default pool slots 2026-09-15, same day
 * `legends` was un-parked — restoring it as a visible bar tab needed one of
 * the 2 pool slots, and `you` (parked down to sign out / delete account / AI
 * consent / build info) was the lower-cost tab to move into More; it stays
 * fully reachable there. This does not touch any user's SAVED layout — only
 * the fallback a fresh account or a corrupted layout falls back to.
 */
/*
 * 2026-10-14 (emci): Insights replaces the parked Sage tab and sits on the bar
 * next to Home. The bar keeps five buttons, so the default pool is Questions +
 * Explore; You moves to More.
 */
/*
 * 2026-10-26 (IA phase P3): the default bar is Home · Insights · You · Play · More.
 * Questions, Explore, Legends and Circle live in More.
 */
export const DEFAULT_NAV_LAYOUT: NavLayout = {
  slots: ['home', 'insights', 'you', 'play'],
};

function isValidPoolId(value: unknown): value is ReorderableTabId {
  return typeof value === 'string' && (NAV_TAB_IDS as readonly string[]).includes(value);
}

/** The pool tabs currently occupying slots 1–4, in left-to-right order. */
export function poolIdsInLayout(layout: NavLayout): ReorderableTabId[] {
  return layout.slots.filter((id): id is ReorderableTabId => !isPinnedId(id));
}

/**
 * Coerce arbitrary storage into a valid NavLayout: home + insights exactly once
 * each (their interleaving preserved), plus exactly POOL_SLOTS distinct valid
 * pool ids. Duplicate/invalid entries are dropped; gaps backfill from the
 * default layout first, then the registry. Accepts both the stored
 * `{ slots: [...] }` object shape and a bare array for robustness.
 */
export function normalizeNavLayout(raw: unknown, opts: { resetShort?: boolean } = {}): NavLayout {
  // On READ (the default) a layout with fewer than POOL_SLOTS pool tabs is an old
  // one and resets to the new default. On WRITE the caller passes
  // `resetShort: false`, so a bar the user just edited is padded, never thrown away.
  const resetShort = opts.resetShort !== false;
  let incoming: unknown = raw;
  let incomingVersion: unknown;
  if (
    raw &&
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    Array.isArray((raw as { slots?: unknown }).slots)
  ) {
    incoming = (raw as { slots: unknown[] }).slots;
    incomingVersion = (raw as { version?: unknown }).version;
  }
  // A saved layout from before the current version resets ONCE to the default on
  // read. The write path (`resetShort: false`) is a layout the user just edited,
  // which is stamped below and never thrown away.
  if (resetShort && Array.isArray(incoming) && incomingVersion !== NAV_LAYOUT_VERSION) {
    return { slots: [...DEFAULT_NAV_LAYOUT.slots], version: NAV_LAYOUT_VERSION };
  }

  const ordered: BarSlotId[] = [];
  if (Array.isArray(incoming)) {
    const seen = new Set<BarSlotId>();
    for (const entry of incoming) {
      const value =
        typeof entry === 'string' && Object.prototype.hasOwnProperty.call(LEGACY_TAB_ID_MAP, entry)
          ? LEGACY_TAB_ID_MAP[entry]
          : entry;
      if (isPinnedId(value) || isValidPoolId(value)) {
        const id = value as BarSlotId;
        if (!seen.has(id)) {
          seen.add(id);
          ordered.push(id);
        }
      }
    }
  }

  // No valid incoming slots (null / unset / empty / all-invalid) → the default
  // layout, exactly as specified (Home / Insights / Questions / Explore).
  if (ordered.length === 0) {
    return { slots: [...DEFAULT_NAV_LAYOUT.slots], version: NAV_LAYOUT_VERSION };
  }

  // A saved layout from before 2026-10-01 holds 2 pool tabs; the bar now holds
  // POOL_SLOTS. Anything short of a full set resets ONCE to the new default
  // rather than being padded into a bar nobody chose. A layout saved from the
  // edit screen always has the full set, so a real choice is never overridden.
  if (resetShort && ordered.filter((id) => !isPinnedId(id)).length < POOL_SLOTS) {
    return { slots: [...DEFAULT_NAV_LAYOUT.slots], version: NAV_LAYOUT_VERSION };
  }

  // Preserve interleaving while enforcing home/insights once each and POOL_SLOTS pool ids.
  const slots: BarSlotId[] = [];
  let home = 0;
  let insights = 0;
  let pool = 0;
  for (const id of ordered) {
    if (id === 'home') {
      if (home === 0) {
        slots.push(id);
        home += 1;
      }
      continue;
    }
    if (id === 'insights') {
      if (insights === 0) {
        slots.push(id);
        insights += 1;
      }
      continue;
    }
    if (pool < POOL_SLOTS) {
      slots.push(id);
      pool += 1;
    }
  }

  // Backfill any missing pinned, then any missing pool ids (default first, then registry).
  if (home === 0) slots.unshift('home');
  if (insights === 0) {
    const homeIdx = slots.indexOf('home');
    slots.splice(homeIdx >= 0 ? homeIdx + 1 : 0, 0, 'insights');
  }
  if (pool < POOL_SLOTS) {
    const have = new Set<BarSlotId>(slots);
    for (const id of [...DEFAULT_NAV_LAYOUT.slots, ...NAV_TAB_IDS]) {
      if (isPinnedId(id) || have.has(id)) continue;
      slots.push(id);
      have.add(id);
      pool += 1;
      if (pool >= POOL_SLOTS) break;
    }
  }

  return { slots: slots.slice(0, SLOT_COUNT), version: NAV_LAYOUT_VERSION };
}
