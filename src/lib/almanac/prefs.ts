/**
 * Almanac seasonal preferences (ATO-BUILD PHASE-11f). Device-local, one key,
 * never leaves the phone. Hemisphere is NOT stored here: `locale.ts` already owns
 * it (`ato.almanac.locale.v1`), so Settings calls `setAlmanacHemisphere` below.
 *
 * Master off turns off every event and micro-event, personal ones included
 * (emci 2026-10-28). "Use my birthday" is a second switch under the master.
 */
import type { Hemisphere } from './events';
import { ALMANAC_TODAY_KEY } from './cache';
import { setHemisphere } from './locale';
import type { EventPrefs } from './calendar';
import type { KeyValueStore } from './types';

export const ALMANAC_PREFS_KEY = 'ato.almanac.prefs.v1';
export const ALMANAC_PREFS_VERSION = 1;

export interface AlmanacPrefs {
  v: typeof ALMANAC_PREFS_VERSION;
  seasonal: boolean;
  /** Per-event choice for `cultural` events. Missing = the calendar's regional default. */
  cultural: Record<string, boolean>;
  birthday: boolean;
}

export const DEFAULT_ALMANAC_PREFS: AlmanacPrefs = {
  v: ALMANAC_PREFS_VERSION,
  seasonal: true,
  cultural: {},
  birthday: true,
};

export function parseAlmanacPrefs(raw: string | null): AlmanacPrefs {
  if (!raw) return { ...DEFAULT_ALMANAC_PREFS, cultural: {} };
  try {
    const row = JSON.parse(raw) as Partial<AlmanacPrefs> | null;
    if (!row || row.v !== ALMANAC_PREFS_VERSION) return { ...DEFAULT_ALMANAC_PREFS, cultural: {} };
    const cultural: Record<string, boolean> = {};
    if (row.cultural && typeof row.cultural === 'object') {
      for (const [id, value] of Object.entries(row.cultural)) {
        if (typeof value === 'boolean') cultural[id] = value;
      }
    }
    return {
      v: ALMANAC_PREFS_VERSION,
      seasonal: row.seasonal !== false,
      cultural,
      birthday: row.birthday !== false,
    };
  } catch {
    return { ...DEFAULT_ALMANAC_PREFS, cultural: {} };
  }
}

/** The calendar's view of the prefs. */
export function eventPrefsOf(prefs: AlmanacPrefs): EventPrefs {
  return { seasonal: prefs.seasonal, cultural: prefs.cultural, birthday: prefs.birthday };
}

export async function loadAlmanacPrefs(store: KeyValueStore): Promise<AlmanacPrefs> {
  try {
    return parseAlmanacPrefs(await store.getItem(ALMANAC_PREFS_KEY));
  } catch {
    return { ...DEFAULT_ALMANAC_PREFS, cultural: {} };
  }
}

type Listener = () => void;
const listeners = new Set<Listener>();

/** Screens that built a calendar re-read the prefs when Settings changes them. */
export function subscribeAlmanacPrefs(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const listener of listeners) listener();
}

type RemovableStore = KeyValueStore & { removeItem?: (key: string) => Promise<void> };

/** Today's cached cards were chosen under the old prefs, so drop them (a cache only). */
async function dropTodayCache(store: RemovableStore): Promise<void> {
  try {
    await store.removeItem?.(ALMANAC_TODAY_KEY);
  } catch {
    // A cache that stays one more day is harmless.
  }
}

export async function saveAlmanacPrefs(store: RemovableStore, next: AlmanacPrefs): Promise<AlmanacPrefs> {
  try {
    await store.setItem(ALMANAC_PREFS_KEY, JSON.stringify(next));
  } catch {
    // Storage can fail; the chosen value still applies until the app restarts.
  }
  await dropTodayCache(store);
  notify();
  return next;
}

/** Settings override for the hemisphere (stored in locale.ts's key), then tell the screens. */
export async function setAlmanacHemisphere(
  store: RemovableStore,
  choice: Hemisphere | 'auto',
  zone: string | null | undefined,
): Promise<Hemisphere> {
  const next = await setHemisphere(store, choice, zone);
  await dropTodayCache(store);
  notify();
  return next.hemisphere;
}
