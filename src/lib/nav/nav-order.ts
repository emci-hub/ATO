import type { Href } from 'expo-router';

/**
 * Persisted 5-slot bottom-nav layout, per user (`me.nav_layout` jsonb).
 *
 * Slot 5 is always "More" — fixed, not draggable, never reorderable. Slots
 * 1–4 always contain Home and Sage exactly once each, in user-draggable
 * positions; the remaining two slots hold pool tabs. The pool is the whole
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
  | 'circle';

/** The two always-present tabs (not pool tabs; can never leave slots 1–4). */
export type PinnedTabId = 'home' | 'sage';

/** Anything that can occupy one of slots 1–4. */
export type BarSlotId = PinnedTabId | ReorderableTabId;

export interface NavUnlockContext {
  /** True once this account has at least one Circle connection. */
  hasCircle: boolean;
}

export interface NavTabMeta {
  label: string;
  /** expo-router href for the tab route (Home/Sage are handled separately). */
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
  circle: {
    label: 'Circle',
    href: '/circle',
    icon: 'account-group',
    isUnlocked: (ctx) => ctx.hasCircle,
    unlockReason: 'Scan a friend to unlock Circle.',
  },
  questions: { label: 'Questions', href: '/intake-sweep', icon: 'comment-question-outline' },
  legends: { label: 'Legends', href: '/legends', icon: 'book-open-page-variant-outline' },
};

export const NAV_TAB_IDS = Object.keys(NAV_TABS) as ReorderableTabId[];

export const PINNED_IDS: readonly PinnedTabId[] = ['home', 'sage'];

/** Slots 1–4 count (slot 5 is the fixed "More"). */
export const SLOT_COUNT = 4;

/** How many of slots 1–4 hold pool tabs (the other 2 are Home + Sage). */
export const POOL_SLOTS = 2;

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

export interface NavLayout {
  /** Exactly SLOT_COUNT entries: home + sage once each, plus POOL_SLOTS pool ids. */
  slots: BarSlotId[];
}

export const DEFAULT_NAV_LAYOUT: NavLayout = {
  slots: ['home', 'explore', 'sage', 'you'],
};

function isValidPoolId(value: unknown): value is ReorderableTabId {
  return typeof value === 'string' && (NAV_TAB_IDS as readonly string[]).includes(value);
}

/** The pool tabs currently occupying slots 1–4, in left-to-right order. */
export function poolIdsInLayout(layout: NavLayout): ReorderableTabId[] {
  return layout.slots.filter((id): id is ReorderableTabId => id !== 'home' && id !== 'sage');
}

/**
 * Coerce arbitrary storage into a valid NavLayout: home + sage exactly once
 * each (their interleaving preserved), plus exactly POOL_SLOTS distinct valid
 * pool ids. Duplicate/invalid entries are dropped; gaps backfill from the
 * default layout first, then the registry. Accepts both the stored
 * `{ slots: [...] }` object shape and a bare array for robustness.
 */
export function normalizeNavLayout(raw: unknown): NavLayout {
  let incoming: unknown = raw;
  if (
    raw &&
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    Array.isArray((raw as { slots?: unknown }).slots)
  ) {
    incoming = (raw as { slots: unknown[] }).slots;
  }

  const ordered: BarSlotId[] = [];
  if (Array.isArray(incoming)) {
    const seen = new Set<BarSlotId>();
    for (const value of incoming) {
      if (value === 'home' || value === 'sage' || isValidPoolId(value)) {
        const id = value as BarSlotId;
        if (!seen.has(id)) {
          seen.add(id);
          ordered.push(id);
        }
      }
    }
  }

  // No valid incoming slots (null / unset / empty / all-invalid) → the default
  // layout, exactly as specified (Home / Explore / Sage / You).
  if (ordered.length === 0) {
    return { slots: [...DEFAULT_NAV_LAYOUT.slots] };
  }

  // Preserve interleaving while enforcing home/sage once each and POOL_SLOTS pool ids.
  const slots: BarSlotId[] = [];
  let home = 0;
  let sage = 0;
  let pool = 0;
  for (const id of ordered) {
    if (id === 'home') {
      if (home === 0) {
        slots.push(id);
        home += 1;
      }
      continue;
    }
    if (id === 'sage') {
      if (sage === 0) {
        slots.push(id);
        sage += 1;
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
  if (sage === 0) {
    const homeIdx = slots.indexOf('home');
    slots.splice(homeIdx >= 0 ? homeIdx + 1 : 0, 0, 'sage');
  }
  if (pool < POOL_SLOTS) {
    const have = new Set<BarSlotId>(slots);
    for (const id of [...DEFAULT_NAV_LAYOUT.slots, ...NAV_TAB_IDS]) {
      if (id === 'home' || id === 'sage' || have.has(id)) continue;
      slots.push(id);
      have.add(id);
      pool += 1;
      if (pool >= POOL_SLOTS) break;
    }
  }

  return { slots: slots.slice(0, SLOT_COUNT) };
}
