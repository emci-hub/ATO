/**
 * The ONE "full profile is done" signal.
 *
 * Decided by emci 2026-09-15 (ISOLATION_PLAN §7.1 decision 8, Q2): the gate is
 * **every question in the local bank answered** — nothing else. Before this
 * module there were two signals that disagreed: Home derived completeness from
 * `bankTotalProgress`, while Story / Categories / Explore gated on
 * axis-*settledness* (`storyReady`, `settledAxisLabel`). Under the tap-gated
 * flow both gate the SAME four unlocks (Home "Load insight", Home "Load
 * story", Questions "next 25 questions", Explore "Load categories"), so a
 * split signal would light up a button that then had nothing to say — or
 * disable one after the user had answered every question we asked for.
 *
 * Stability/settledness is still real, but it is **content readiness**, judged
 * inside each generator (see `storyReady` in `lib/sage-story.ts`), never a gate
 * on whether the button is offered. A generator that lacks data says "not
 * ready yet" without calling a model.
 *
 * Deliberately derived, not persisted: `tracks` is already fetched on every
 * screen that needs this, and a stored boolean would be a second source of
 * truth to keep in sync. There is no server column for it and none is wanted.
 */
import { bankTotalProgress } from '@/lib/questions/local';
import type { TraitTrack } from '@/lib/trait-stability';

export interface FullProfileProgress {
  answered: number;
  total: number;
}

/** Raw "N of M bank questions answered", for progress copy. */
export function fullProfileProgress(tracks: readonly TraitTrack[]): FullProfileProgress {
  return bankTotalProgress(tracks);
}

/**
 * The gate. `tracksReady` is not optional sugar: `tracks` is empty until the
 * fetch lands, so without it someone who HAS finished would see the locked
 * state for a beat before it corrected itself — the same flash already fixed
 * on Legends and Roll. Pass the screen's own tracks-loaded flag.
 */
export function isFullProfileDone(
  tracks: readonly TraitTrack[],
  tracksReady: boolean,
): boolean {
  if (!tracksReady) return false;
  const { answered, total } = fullProfileProgress(tracks);
  return total > 0 && answered >= total;
}

/** Shown wherever an unlock is still locked. One string, so it reads the same everywhere. */
export const FULL_PROFILE_LOCKED_COPY =
  'Answer the questions first — then this unlocks.';
