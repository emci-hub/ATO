/**
 * "Insights seen" on the phone (PHASE-09, v2 in PHASE-11e). The maths and the keys
 * live in `insight-collection.ts`. Each value carries its owner, so one account
 * never reads another's. The first read of v2 carries the v1 ids over.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ideaForTitle } from '@/lib/insight-bank';
import {
  INSIGHT_COLLECTION_KEY,
  INSIGHT_COLLECTION_KEY_V1,
  addToCollection,
  addToDeck,
  parseCollectionState,
  type CollectionState,
  type StoredCollection,
} from '@/lib/insight-collection';

function stored(userId: string, state: CollectionState): string {
  return JSON.stringify({ v: 2, userId, ids: state.ids, decks: state.decks } satisfies StoredCollection);
}

async function readState(userId: string): Promise<CollectionState> {
  try {
    const rawV2 = await AsyncStorage.getItem(INSIGHT_COLLECTION_KEY);
    let owner: unknown = null;
    try {
      owner = rawV2 ? (JSON.parse(rawV2) as { userId?: unknown } | null)?.userId : null;
    } catch {
      owner = null; // a corrupt v2 value: fall back to the v1 ids below
    }
    if (owner === userId) return parseCollectionState(rawV2, userId);
    // No v2 for this account yet: keep every v1 id, then use v2 from here on.
    const v1 = parseCollectionState(await AsyncStorage.getItem(INSIGHT_COLLECTION_KEY_V1), userId);
    if (v1.ids.length > 0) {
      try {
        await AsyncStorage.setItem(INSIGHT_COLLECTION_KEY, stored(userId, v1));
      } catch (err) {
        console.log('[insight-collection] migration write skipped:', err);
      }
    }
    return v1;
  } catch {
    return { ids: [], decks: {} };
  }
}

// Calls are chained so two quick records cannot both read the old set.
let queue: Promise<unknown> = Promise.resolve();
function inQueue<T>(work: () => Promise<T>): Promise<T> {
  const run = queue.then(work);
  queue = run.catch(() => {});
  return run;
}

export function loadCollection(userId: string): Promise<string[]> {
  return inQueue(async () => (await readState(userId)).ids);
}

/** Almanac deck cards seen so far, by `<eventId>:<year>`. */
export function loadDecks(userId: string): Promise<Record<string, string[]>> {
  return inQueue(async () => (await readState(userId)).decks);
}

/** Record the idea behind a loaded insight's title. Resolves to the set and whether it grew. */
export function recordInsightSeen(userId: string, title: string): Promise<{ ids: string[]; added: boolean }> {
  return inQueue(async () => {
    const current = await readState(userId);
    const match = ideaForTitle(title);
    if (!match) return { ids: current.ids, added: false };
    const next = addToCollection(current.ids, match.idea.id);
    if (next.added) {
      try {
        await AsyncStorage.setItem(INSIGHT_COLLECTION_KEY, stored(userId, { ids: next.ids, decks: current.decks }));
      } catch (err) {
        console.log('[insight-collection] write skipped:', err);
        return { ids: current.ids, added: false };
      }
    }
    return { ids: next.ids, added: next.added };
  });
}

/** Record an Almanac deck card as seen in its event's deck for the year. */
export function recordDeckCardSeen(
  userId: string,
  key: string,
  cardId: string,
): Promise<{ decks: Record<string, string[]>; added: boolean }> {
  return inQueue(async () => {
    const current = await readState(userId);
    const next = addToDeck(current.decks, key, cardId);
    if (next.added) {
      try {
        await AsyncStorage.setItem(INSIGHT_COLLECTION_KEY, stored(userId, { ids: current.ids, decks: next.decks }));
      } catch (err) {
        console.log('[insight-collection] deck write skipped:', err);
        return { decks: current.decks, added: false };
      }
    }
    return next;
  });
}
