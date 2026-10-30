/**
 * "Insights seen" maths (PHASE-09): pure, so a check can pin it. The phone
 * storage around it is `insight-collection-store.ts`.
 */
import { ALL_IDEAS } from '@/lib/insight-bank';

/**
 * Its own key. The plan named `ato.insights.seen.v1`, but Home already keeps a
 * `{userId, ymd}` object there for Today's path (pinned by check:home-path).
 * It starts with `ato.`, so `clearLocalAccountData` removes it on sign-out.
 *
 * v2 (PHASE-11e) adds the Almanac's per-event decks beside the same `ids`. The
 * v1 key is read once and its ids carried over; it is never written again.
 */
export const INSIGHT_COLLECTION_KEY_V1 = 'ato.insights.collection.v1';
export const INSIGHT_COLLECTION_KEY = 'ato.insights.collection.v2';

/** Every stored idea in the bank. */
export const INSIGHT_COLLECTION_TOTAL = ALL_IDEAS.length;

export interface StoredCollection {
  v: 2;
  userId: string;
  /** Insight-bank ideas (`ftw_*`): the "Insights seen" count. */
  ids: string[];
  /** Almanac deck cards seen, by `<eventId>:<year>`. A new year starts a new deck, so a missed card returns. */
  decks: Record<string, string[]>;
}

export interface CollectionState {
  ids: string[];
  decks: Record<string, string[]>;
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? [...new Set(value.filter((x): x is string => typeof x === 'string'))] : [];

/**
 * Parse a stored v1 or v2 value; anything odd, or someone else's, is empty.
 * A v1 value (`{userId, ids}`) reads as the same ids with no decks: the migration.
 */
export function parseCollectionState(raw: string | null, userId: string): CollectionState {
  const empty: CollectionState = { ids: [], decks: {} };
  if (!raw) return empty;
  try {
    const v = JSON.parse(raw) as Partial<StoredCollection> | null;
    if (!v || typeof v !== 'object' || v.userId !== userId || !Array.isArray(v.ids)) return empty;
    const decks: Record<string, string[]> = {};
    if (v.decks && typeof v.decks === 'object' && !Array.isArray(v.decks)) {
      for (const [key, cards] of Object.entries(v.decks)) decks[key] = strings(cards);
    }
    return { ids: strings(v.ids), decks };
  } catch {
    return empty;
  }
}

/** Parse a stored value; anything odd, or someone else's, is an empty set. */
export function parseCollection(raw: string | null, userId: string): string[] {
  return parseCollectionState(raw, userId).ids;
}

export const deckKey = (eventId: string, year: number) => `${eventId}:${year}`;

/** Add a deck card: returns the new decks and whether it was new. */
export function addToDeck(
  decks: Readonly<Record<string, readonly string[]>>,
  key: string,
  cardId: string,
): { decks: Record<string, string[]>; added: boolean } {
  const current = decks[key] ?? [];
  const copy: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(decks)) copy[k] = [...v];
  if (current.includes(cardId)) return { decks: copy, added: false };
  copy[key] = [...current, cardId];
  return { decks: copy, added: true };
}

/** Add an idea: returns the new set and whether it was new. */
export function addToCollection(ids: readonly string[], ideaId: string): { ids: string[]; added: boolean } {
  if (ids.includes(ideaId)) return { ids: [...ids], added: false };
  return { ids: [...ids, ideaId], added: true };
}

/** Whole-number percent, 0..100. */
export function collectionPercent(seen: number, total: number = INSIGHT_COLLECTION_TOTAL): number {
  if (!(total > 0) || !(seen > 0)) return 0;
  return Math.min(100, Math.round((seen / total) * 100));
}
