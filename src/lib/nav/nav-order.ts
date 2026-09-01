import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Href } from 'expo-router';

/**
 * Persisted nav order for the custom tab bar.
 *
 * Home and Sage are pinned (never in `main`/`more`, never into More) and are
 * only swappable with each other via `homeFirst`. More is the fixed rightmost
 * slot whose contents are `more`. Everything else (Explore / Around / You /
 * Circle, and future tabs) is freely reorderable and movable between `main`
 * and `more`.
 *
 * Same AsyncStorage pattern as appearance (`ato.appearance.mode`) so the order
 * survives restarts, not just the session.
 */

export type ReorderableTabId = 'explore' | 'around' | 'you' | 'circle';

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
   * Optional gate. When this returns false, the tab is omitted from the bar
   * and More, and Edit Navigation shows it in "Not unlocked yet" — no Bar/More
   * toggle. Omit for tabs that are always available.
   */
  isUnlocked?: (ctx: NavUnlockContext) => boolean;
  /** Shown under the locked row. Required when `isUnlocked` is set. */
  unlockReason?: string;
}

/** Registry of reorderable tabs. Adding a new tab = add an entry here. */
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
};

export const NAV_TAB_IDS = Object.keys(NAV_TABS) as ReorderableTabId[];

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

export interface NavOrder {
  /** true = [Home, Sage], false = [Sage, Home]. Home/Sage never leave the bar. */
  homeFirst: boolean;
  /** Reorderable tabs on the main bar (between the pinned group and More). */
  main: ReorderableTabId[];
  /** Reorderable tabs inside the fixed rightmost More slot. */
  more: ReorderableTabId[];
}

export const DEFAULT_NAV_ORDER: NavOrder = {
  homeFirst: true,
  // Main bar = Home + Sage + Explore + You + More (5 items). Around is a
  // secondary "room opened on purpose", so it defaults into More.
  main: ['explore', 'you'],
  more: ['around', 'circle'],
};

const NAV_ORDER_KEY = 'ato.nav.order.v1';

function isValidTabId(value: unknown): value is ReorderableTabId {
  return typeof value === 'string' && (NAV_TAB_IDS as readonly string[]).includes(value);
}

/** Drops unknown/duplicate ids, preserving order of the first occurrence. */
function normalizeIds(raw: unknown): ReorderableTabId[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<ReorderableTabId>();
  const out: ReorderableTabId[] = [];
  for (const value of raw) {
    if (isValidTabId(value) && !seen.has(value)) {
      seen.add(value);
      out.push(value);
    }
  }
  return out;
}

/**
 * Coerces arbitrary storage into a valid NavOrder. Guarantees every known tab
 * appears exactly once: `main` wins over `more` for duplicates, and any tab
 * missing from storage (e.g. a newly-added tab) is appended to `more`.
 */
export function normalizeNavOrder(raw: unknown): NavOrder {
  let homeFirst = true;
  let main: ReorderableTabId[] = [];
  let more: ReorderableTabId[] = [];

  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const row = raw as Record<string, unknown>;
    if (typeof row.homeFirst === 'boolean') homeFirst = row.homeFirst;
    main = normalizeIds(row.main);
    more = normalizeIds(row.more);
  }

  const mainSet = new Set(main);
  const dedupedMore = more.filter((id) => !mainSet.has(id));

  // Fill any tab not present anywhere into More (new tabs land in More).
  const present = new Set([...main, ...dedupedMore]);
  for (const id of NAV_TAB_IDS) {
    if (!present.has(id)) dedupedMore.push(id);
  }

  return { homeFirst, main, more: dedupedMore };
}

export async function loadNavOrder(): Promise<NavOrder> {
  try {
    const raw = await AsyncStorage.getItem(NAV_ORDER_KEY);
    if (!raw) return DEFAULT_NAV_ORDER;
    return normalizeNavOrder(JSON.parse(raw));
  } catch {
    return DEFAULT_NAV_ORDER;
  }
}

export async function saveNavOrder(order: NavOrder): Promise<void> {
  await AsyncStorage.setItem(NAV_ORDER_KEY, JSON.stringify(normalizeNavOrder(order)));
}
