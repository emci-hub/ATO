/**
 * Category deep dive — the old one-person writer is closed.
 *
 * The phone no longer calls a model for this card. While `STORY_LIBRARY_RUNTIME`
 * is off, the card uses the shared library (`openLibraryDive` / `writeNewDive`).
 * While it is on, the card assembles approved Story Library copy and does not
 * reach this function. A missing library used to fall through to `generateText`;
 * that fallback is gone, and this function does not claim a token.
 */
import type { CategoryDive, DiveSpec } from './dive';

export type DiveOutcome =
  | { ok: true; dive: CategoryDive; extra: CategoryDive | null }
  | { ok: false; reason: 'consent' | 'no_leanings' | 'used' | 'tokens' | 'unavailable' | 'failed' };

export async function writeCategoryDeepDive(input: {
  main: DiveSpec;
  /** The next card to write in the same call (opens tomorrow), or none. */
  extra: DiveSpec | null;
  /** The person said yes to AI (the server refuses without it anyway). */
  consentGranted: boolean;
}): Promise<DiveOutcome> {
  if (!input.consentGranted) return { ok: false, reason: 'consent' };
  if (input.main.leans.length === 0) return { ok: false, reason: 'no_leanings' };
  return { ok: false, reason: 'unavailable' };
}
