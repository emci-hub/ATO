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
 * fetch lands, so without it this would report "finished" nonsense off an
 * empty array. It returns **false** while not ready, which is the same value
 * as "locked" — so a screen that must tell those two apart (a cold open, or a
 * failed fetch) needs its own third state; Home has one. Pass the screen's own
 * tracks-loaded flag, and never treat `false` alone as "they haven't answered".
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
  'Locked — finish every question in the Questions tab to unlock this.';

/** The locked line with the count, where the screen has tracks to count from. */
export function fullProfileLockedLine(progress: FullProfileProgress, unlocks = 'this'): string {
  if (progress.total <= 0) return FULL_PROFILE_LOCKED_COPY;
  return `Locked — finish all ${progress.total} questions in the Questions tab to unlock ${unlocks} (${progress.answered} of ${progress.total} done).`;
}
