import { useEffect, useRef } from 'react';

import { pushBuddyNote } from '@/lib/buddy/notes';
import { persistCelebratedMilestones } from '@/lib/me';
import { checkMilestones, type MilestoneDef } from '@/lib/milestones';
import { intakeStage } from '@/lib/questions/intake-stage';
import { axisVariant, bankTotalProgress } from '@/lib/questions/local';
import { INTAKE_REVEAL_MILESTONE_ID } from '@/lib/questions/progressive-unlock';
import { settledCount, type TraitTrack } from '@/lib/trait-stability';
import { TRAIT_AXES } from '@/lib/traits';

/**
 * The milestone crossing check, back from being parked (ISOLATION_PLAN Card D,
 * 2026-09-15) and now announced by the mini guy instead of a toast owned by
 * the Questions screen. Same `MILESTONE_DEFS`, same `checkMilestones`, same
 * `me.celebrated_milestone_ids` memory — only where it is said has moved.
 *
 * Every crossing is REMEMBERED. Not every crossing is SAID:
 * - The full-profile crossings (set 3) stay with the full-screen reveal, which
 *   already says them; a bubble under that card would be noise. Sage and
 *   Legends are placeholders, so their crossings are not said either.
 * - Per-trait "complete" crossings are remembered silently: their copy names
 *   the internal trait, which the app does not show people.
 */
const SILENT_IDS = new Set(['sage_unlocked', 'legends_unlocked']);

function isSaidAloud(def: MilestoneDef): boolean {
  if (def.id.startsWith('axis_complete_')) return false;
  if (SILENT_IDS.has(def.id)) return false;
  return def.id !== INTAKE_REVEAL_MILESTONE_ID;
}

function crossedProfileMilestones(tracks: readonly TraitTrack[], celebrated: readonly string[]): MilestoneDef[] {
  const percent = (settledCount(tracks) / TRAIT_AXES.length) * 100;
  return [
    ...checkMilestones('intakeStage', intakeStage(tracks), celebrated),
    ...checkMilestones('bankTotalProgress', bankTotalProgress(tracks).answered, celebrated),
    ...checkMilestones('profile_percent', percent, celebrated),
    ...TRAIT_AXES.flatMap((axis) => checkMilestones(`axisComplete:${axis}`, axisVariant(tracks, axis), celebrated)),
  ];
}

function announce(defs: readonly MilestoneDef[]): void {
  for (const def of defs) {
    if (isSaidAloud(def)) pushBuddyNote({ id: `milestone:${def.id}`, title: def.title, body: def.body, loud: true });
  }
}

interface Account {
  id: string;
  celebrated_milestone_ids?: string[] | null;
}

/**
 * Answer-progress milestones, for the Questions screen.
 *
 * The FIRST look at an account is silent: whatever it has already crossed is
 * marked as celebrated without a word, so an existing account does not get a
 * burst of old news the first time this runs. After that, each new crossing is
 * said once.
 */
export function useBuddyMilestones(input: {
  me: Account | null | undefined;
  tracks: readonly TraitTrack[];
  tracksReady: boolean;
  /** Moves when the account's data was replaced under the screen (dev Start over / jump). */
  resetKey?: number;
  onPersisted?: () => void | Promise<unknown>;
}): void {
  const { me, tracks, tracksReady, resetKey = 0, onPersisted } = input;
  // What this screen knows is celebrated, ahead of `me` catching up.
  const knownRef = useRef<{ userId: string; resetKey: number; ids: Set<string>; caughtUp: boolean } | null>(null);
  const userId = me?.id;
  const stored = me?.celebrated_milestone_ids;

  useEffect(() => {
    // No tracks yet is either a brand-new account (nothing to cross) or a load
    // that failed. Neither may spend the silent first look: a failed load would
    // otherwise turn the next good one into a burst of old milestones.
    if (!userId || !tracksReady || tracks.length === 0) return;
    if (knownRef.current?.userId !== userId || knownRef.current.resetKey !== resetKey) {
      // A different account, or this account's data was just rewritten: start
      // again from what is stored, with a fresh silent look.
      knownRef.current = { userId, resetKey, ids: new Set(stored ?? []), caughtUp: false };
    }
    const known = knownRef.current;
    for (const id of stored ?? []) known.ids.add(id);

    const crossed = crossedProfileMilestones(tracks, [...known.ids]);
    const firstLook = !known.caughtUp;
    known.caughtUp = true;
    if (crossed.length === 0) return;
    for (const def of crossed) known.ids.add(def.id);
    if (!firstLook) announce(crossed);

    persistCelebratedMilestones(userId, crossed.map((def) => def.id))
      .then(() => onPersisted?.())
      .catch((err) => {
        console.log('[buddy] milestone save error:', err);
      });
    // `stored` is read for freshness only; a new array identity must not re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, tracks, tracksReady, resetKey]);
}

/**
 * Day-streak milestones (3 / 7 / 21), for Home. The streak is the daily-line
 * streak: days in a row the app was opened. Said once each, ever.
 */
export function useBuddyStreak(input: {
  me: Account | null | undefined;
  streak: number | undefined;
  onPersisted?: () => void | Promise<unknown>;
}): void {
  const { me, streak, onPersisted } = input;
  const saidRef = useRef<{ userId: string; ids: Set<string> } | null>(null);
  const userId = me?.id;
  const stored = me?.celebrated_milestone_ids;

  useEffect(() => {
    if (!userId || streak === undefined) return;
    if (saidRef.current?.userId !== userId) saidRef.current = { userId, ids: new Set() };
    const said = saidRef.current.ids;
    const celebrated = [...(stored ?? []), ...said];
    const crossed = checkMilestones('current_streak', streak, celebrated);
    if (crossed.length === 0) return;
    for (const def of crossed) said.add(def.id);
    // Only the highest one: opening on day 7 should not also announce day 3.
    announce(crossed.slice(-1));
    persistCelebratedMilestones(userId, crossed.map((def) => def.id))
      .then(() => onPersisted?.())
      .catch((err) => {
        console.log('[buddy] streak save error:', err);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, streak]);
}
