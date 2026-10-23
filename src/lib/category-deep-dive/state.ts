/**
 * Category deep dive — the phone copy's shape and its pure helpers (no I/O, so
 * the offline check can test them). Reading and writing live in `store.ts`.
 */
import { parseStoredDive, type CategoryDive } from './dive';

export const DEEP_DIVE_KEY = 'ato.categoryDeepDive.v1';

export interface DiveEntry {
  dive: CategoryDive;
  /** Local YYYY-MM-DD it was written. */
  madeOn: string;
  /** Shared library (wave93): the library card's id (for Report), absent for a one-person card. */
  libraryId?: string;
  /** "You and N others got this card" (only from 5 people up). */
  others?: number | null;
}

export interface DiveLocalState {
  userId: string;
  /** categoryId → its newest card. */
  dives: Record<string, DiveEntry>;
}

const CAT_RE = /^cat_[a-z]{2,20}$/;

export function emptyDiveState(userId: string): DiveLocalState {
  return { userId, dives: {} };
}

export function parseDiveEntry(raw: unknown): DiveEntry | null {
  if (typeof raw !== 'object' || raw == null) return null;
  const obj = raw as Record<string, unknown>;
  const dive = parseStoredDive(obj.dive);
  if (!dive || !CAT_RE.test(dive.categoryId)) return null;
  return {
    dive,
    madeOn: typeof obj.madeOn === 'string' ? obj.madeOn : '',
    ...(typeof obj.libraryId === 'string' && /^[0-9a-f-]{36}$/.test(obj.libraryId) ? { libraryId: obj.libraryId } : {}),
    ...(typeof obj.others === 'number' ? { others: obj.others } : {}),
  };
}

export function parseDiveState(raw: string | null, userId: string): DiveLocalState {
  if (!raw) return emptyDiveState(userId);
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (data.userId !== userId || typeof data.dives !== 'object' || data.dives == null) return emptyDiveState(userId);
    const dives: Record<string, DiveEntry> = {};
    for (const [id, value] of Object.entries(data.dives as Record<string, unknown>)) {
      const entry = parseDiveEntry(value);
      if (entry && entry.dive.categoryId === id) dives[id] = entry;
    }
    return { userId, dives };
  } catch {
    return emptyDiveState(userId);
  }
}

/** Newer wins per category (server rows fill what the phone lacks). */
export function mergeDives(
  server: readonly DiveEntry[],
  local: Readonly<Record<string, DiveEntry>>,
): Record<string, DiveEntry> {
  const out: Record<string, DiveEntry> = { ...local };
  for (const row of server) {
    const have = out[row.dive.categoryId];
    if (!have || row.madeOn > have.madeOn) out[row.dive.categoryId] = row;
  }
  return out;
}

/** True when a card was written today (the daily limit, as the phone sees it). */
export function madeToday(dives: Readonly<Record<string, DiveEntry>>, today: string): boolean {
  return Object.values(dives).some((row) => row.madeOn === today);
}

