/**
 * Today's Almanac card per surface (PHASE-11a). Keyed by
 * {userId, ymd, surface, bankVersion} so reopening the app or an OTA landing
 * mid-day never swaps the card (red team M4). Stored under `ato.almanac.today.v1`,
 * wiped on sign-out by `clearLocalAccountData` (deny-by-default rule).
 */
import type { AlmanacSurface, KeyValueStore } from './types';

export const ALMANAC_TODAY_KEY = 'ato.almanac.today.v1';
export const ALMANAC_TODAY_VERSION = 1;
/** Days kept, so a phone left open past midnight still finds yesterday's entry. */
export const ALMANAC_TODAY_KEEP_DAYS = 3;

export type CachedResult =
  | { source: 'card'; cardId: string; text: string; usedAlt: boolean }
  | { source: 'rotation'; pickIndex: number };

export interface CachedEntry {
  ymd: string;
  surface: AlmanacSurface;
  bankVersion: number;
  result: CachedResult;
}

export interface TodayCache {
  v: typeof ALMANAC_TODAY_VERSION;
  userId: string;
  entries: CachedEntry[];
}

export function cacheKey(userId: string, ymd: string, surface: AlmanacSurface, bankVersion: number): string {
  return `${userId}|${ymd}|${surface}|${bankVersion}`;
}

export function emptyTodayCache(userId: string): TodayCache {
  return { v: ALMANAC_TODAY_VERSION, userId, entries: [] };
}

function isResult(value: unknown): value is CachedResult {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  if (r.source === 'card') {
    return typeof r.cardId === 'string' && typeof r.text === 'string' && typeof r.usedAlt === 'boolean';
  }
  return r.source === 'rotation' && typeof r.pickIndex === 'number' && Number.isInteger(r.pickIndex);
}

function isEntry(value: unknown): value is CachedEntry {
  if (!value || typeof value !== 'object') return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.ymd === 'string' &&
    typeof e.surface === 'string' &&
    typeof e.bankVersion === 'number' &&
    isResult(e.result)
  );
}

export function parseTodayCache(raw: string | null, userId: string): TodayCache {
  if (!raw) return emptyTodayCache(userId);
  try {
    const parsed = JSON.parse(raw) as Partial<TodayCache> | null;
    if (!parsed || parsed.v !== ALMANAC_TODAY_VERSION || parsed.userId !== userId) return emptyTodayCache(userId);
    const entries = Array.isArray(parsed.entries) ? parsed.entries.filter(isEntry) : [];
    return { v: ALMANAC_TODAY_VERSION, userId, entries };
  } catch {
    return emptyTodayCache(userId);
  }
}

export function readCached(
  cache: TodayCache,
  ymd: string,
  surface: AlmanacSurface,
  bankVersion: number,
): CachedResult | null {
  const key = cacheKey(cache.userId, ymd, surface, bankVersion);
  const hit = cache.entries.find((e) => cacheKey(cache.userId, e.ymd, e.surface, e.bankVersion) === key);
  return hit ? hit.result : null;
}

/** Store today's entry, replacing the same key, keeping only the latest few days. */
export function writeCached(cache: TodayCache, entry: CachedEntry): TodayCache {
  const key = cacheKey(cache.userId, entry.ymd, entry.surface, entry.bankVersion);
  const others = cache.entries.filter(
    (e) => cacheKey(cache.userId, e.ymd, e.surface, e.bankVersion) !== key,
  );
  const entries = [...others, entry];
  const days = [...new Set(entries.map((e) => e.ymd))].sort().slice(-ALMANAC_TODAY_KEEP_DAYS);
  return { ...cache, entries: entries.filter((e) => days.includes(e.ymd)) };
}

export async function loadTodayCache(store: KeyValueStore, userId: string): Promise<TodayCache> {
  try {
    return parseTodayCache(await store.getItem(ALMANAC_TODAY_KEY), userId);
  } catch {
    return emptyTodayCache(userId);
  }
}

export async function saveTodayCache(store: KeyValueStore, cache: TodayCache): Promise<void> {
  try {
    await store.setItem(ALMANAC_TODAY_KEY, JSON.stringify(cache));
  } catch (e) {
    console.log('[almanac] today cache save failed', e instanceof Error ? e.message : 'unknown');
  }
}
