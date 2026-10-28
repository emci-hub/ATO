/**
 * Almanac seen-set (PHASE-11a). One list per surface, capped at 400, stamped
 * with the owner and a version (red team M3). The repeat window itself is sized
 * to the pool in select.ts (min(pool, 90) days). Stored under `ato.almanac.seen.v1`,
 * which `clearLocalAccountData` wipes on sign-out (deny-by-default rule).
 *
 * The store is injected (AsyncStorage on the phone), so everything here runs
 * offline in the check. A reinstall loses the set; tomorrow's card may then
 * differ from what it would have been (red team M4, accepted).
 */
import { ALMANAC_SURFACES, type AlmanacSurface, type KeyValueStore, type SeenEntry } from './types';

export const ALMANAC_SEEN_KEY = 'ato.almanac.seen.v1';
export const ALMANAC_SEEN_VERSION = 1;
export const ALMANAC_SEEN_CAP = 400;

export interface SeenState {
  v: typeof ALMANAC_SEEN_VERSION;
  userId: string;
  surfaces: Partial<Record<AlmanacSurface, SeenEntry[]>>;
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function emptySeen(userId: string): SeenState {
  return { v: ALMANAC_SEEN_VERSION, userId, surfaces: {} };
}

function isEntry(value: unknown): value is SeenEntry {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === 'string' && row.id.length > 0 && typeof row.ymd === 'string' && YMD_RE.test(row.ymd);
}

/** Read stored JSON. Anything wrong (other owner, old version, bad rows) gives an empty set. */
export function parseSeen(raw: string | null, userId: string): SeenState {
  if (!raw) return emptySeen(userId);
  try {
    const parsed = JSON.parse(raw) as Partial<SeenState> | null;
    if (!parsed || parsed.v !== ALMANAC_SEEN_VERSION || parsed.userId !== userId) return emptySeen(userId);
    const surfaces: SeenState['surfaces'] = {};
    for (const surface of ALMANAC_SURFACES) {
      const rows = (parsed.surfaces as Record<string, unknown> | undefined)?.[surface];
      if (Array.isArray(rows)) surfaces[surface] = rows.filter(isEntry).slice(-ALMANAC_SEEN_CAP);
    }
    return { v: ALMANAC_SEEN_VERSION, userId, surfaces };
  } catch {
    return emptySeen(userId);
  }
}

export function seenFor(state: SeenState, surface: AlmanacSurface): readonly SeenEntry[] {
  return state.surfaces[surface] ?? [];
}

/** Record today's card. One entry per day per surface; oldest dropped past the cap. */
export function addSeen(state: SeenState, surface: AlmanacSurface, entry: SeenEntry): SeenState {
  const rows = seenFor(state, surface).filter((row) => row.ymd !== entry.ymd);
  rows.push(entry);
  rows.sort((a, b) => (a.ymd < b.ymd ? -1 : a.ymd > b.ymd ? 1 : 0));
  return { ...state, surfaces: { ...state.surfaces, [surface]: rows.slice(-ALMANAC_SEEN_CAP) } };
}

export async function loadSeen(store: KeyValueStore, userId: string): Promise<SeenState> {
  try {
    return parseSeen(await store.getItem(ALMANAC_SEEN_KEY), userId);
  } catch {
    return emptySeen(userId);
  }
}

export async function saveSeen(store: KeyValueStore, state: SeenState): Promise<void> {
  try {
    await store.setItem(ALMANAC_SEEN_KEY, JSON.stringify(state));
  } catch (e) {
    console.log('[almanac] seen save failed', e instanceof Error ? e.message : 'unknown');
  }
}
