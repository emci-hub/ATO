/**
 * Category deep dive — the phone's bucket key.
 *
 * The card assembles the story library itself. It does not ask the server
 * to serve or write a card.
 */
import { diveBucketKey } from '@/lib/ai-library/deep-dive';
import { LIBRARY_VERSION } from '@/lib/ai-library/types';

import type { DiveLean } from './dive';

/** The phone's fingerprint for a library card: a new one is offered when the bucket moves. */
export function diveLibraryKey(categoryId: string, leans: readonly DiveLean[]): string {
  return `${LIBRARY_VERSION.deep_dive}|${diveBucketKey(categoryId, leans)}`;
}
