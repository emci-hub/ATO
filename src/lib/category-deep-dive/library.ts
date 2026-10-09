/**
 * Category deep dive — library first (wave93, emci 2026-10-09).
 *
 *   openLibraryDive   free: an unseen card from the reader's bucket
 *   writeNewDive      5 tokens: the SERVER writes two cards for the bucket
 *                     (two angles); the reader gets one, the other waits in
 *                     the library for the next person
 *
 * The phone sends the bucket key only, never text. With wave93 not live yet
 * ('missing'), the card falls back to the old one-person path (generate.ts).
 */
import { DEEP_DIVE_LIBRARY, diveBucketKey } from '@/lib/ai-library/deep-dive';
import { serveLibraryCard, writeLibraryCard, type LibraryServed } from '@/lib/ai-library/client';
import { LIBRARY_VERSION } from '@/lib/ai-library/types';

import type { CategoryDive, DiveLean } from './dive';

/** The phone's fingerprint for a library card: a new one is offered when the bucket moves. */
export function diveLibraryKey(categoryId: string, leans: readonly DiveLean[]): string {
  return `${LIBRARY_VERSION.deep_dive}|${diveBucketKey(categoryId, leans)}`;
}

export type LibraryDiveOutcome =
  | { ok: true; served: LibraryServed<CategoryDive> }
  | { ok: false; reason: 'empty' | 'daily' | 'crisis' | 'tokens' | 'quota' | 'consent' | 'missing' | 'failed' };

export async function openLibraryDive(categoryId: string, leans: readonly DiveLean[]): Promise<LibraryDiveOutcome> {
  if (leans.length === 0) return { ok: false, reason: 'failed' };
  const res = await serveLibraryCard('deep_dive', diveBucketKey(categoryId, leans), DEEP_DIVE_LIBRARY.readCard);
  return res.ok ? { ok: true, served: res.served } : { ok: false, reason: res.reason };
}

export async function writeNewDive(categoryId: string, leans: readonly DiveLean[]): Promise<LibraryDiveOutcome> {
  if (leans.length === 0) return { ok: false, reason: 'failed' };
  const res = await writeLibraryCard('deep_dive', diveBucketKey(categoryId, leans), 'paid', DEEP_DIVE_LIBRARY.readCard);
  if (!res.ok) return { ok: false, reason: res.reason === 'bucket' ? 'failed' : res.reason };
  return res.served ? { ok: true, served: res.served } : { ok: false, reason: 'failed' };
}
