/**
 * "Insights seen" maths (PHASE-09): pure, so a check can pin it. The phone
 * storage around it is `insight-collection-store.ts`.
 */
import { ALL_IDEAS } from '@/lib/insight-bank';

/**
 * Its own key. The plan named `ato.insights.seen.v1`, but Home already keeps a
 * `{userId, ymd}` object there for Today's path (pinned by check:home-path).
 * It starts with `ato.`, so `clearLocalAccountData` removes it on sign-out.
 */
export const INSIGHT_COLLECTION_KEY = 'ato.insights.collection.v1';

/** Every stored idea in the bank. */
export const INSIGHT_COLLECTION_TOTAL = ALL_IDEAS.length;

export interface StoredCollection {
  userId: string;
  ids: string[];
}

/** Parse a stored value; anything odd, or someone else's, is an empty set. */
export function parseCollection(raw: string | null, userId: string): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as Partial<StoredCollection> | null;
    if (!v || typeof v !== 'object' || v.userId !== userId || !Array.isArray(v.ids)) return [];
    return [...new Set(v.ids.filter((x): x is string => typeof x === 'string'))];
  } catch {
    return [];
  }
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
