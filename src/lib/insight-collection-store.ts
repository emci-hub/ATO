/**
 * "Insights seen" on the phone (PHASE-09). The maths and the key live in
 * `insight-collection.ts`. Each value carries its owner, so one account never
 * reads another's.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ideaForTitle } from '@/lib/insight-bank';
import {
  INSIGHT_COLLECTION_KEY,
  addToCollection,
  parseCollection,
  type StoredCollection,
} from '@/lib/insight-collection';

export async function loadCollection(userId: string): Promise<string[]> {
  try {
    return parseCollection(await AsyncStorage.getItem(INSIGHT_COLLECTION_KEY), userId);
  } catch {
    return [];
  }
}

// Calls are chained so two quick records cannot both read the old set.
let queue: Promise<unknown> = Promise.resolve();

/** Record the idea behind a loaded insight's title. Resolves to the set and whether it grew. */
export function recordInsightSeen(userId: string, title: string): Promise<{ ids: string[]; added: boolean }> {
  const run = queue.then(async () => {
    const current = await loadCollection(userId);
    const match = ideaForTitle(title);
    if (!match) return { ids: current, added: false };
    const next = addToCollection(current, match.idea.id);
    if (next.added) {
      try {
        await AsyncStorage.setItem(INSIGHT_COLLECTION_KEY, JSON.stringify({ userId, ids: next.ids } satisfies StoredCollection));
      } catch (err) {
        console.log('[insight-collection] write skipped:', err);
        return { ids: current, added: false };
      }
    }
    return next;
  });
  queue = run.catch(() => {});
  return run;
}
