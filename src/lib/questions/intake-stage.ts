/**
 * Where a person is in the intake, computed from real per-trait answer counts
 * (staged intake, emci 2026-10-02). Never stored: `answerCount` only grows, so
 * a stage once reached stays reached.
 *
 *   stage 0 — not every trait has an answer yet
 *   stage 1 — first read: every trait has 1 (set 1 of 16 done)
 *   stage 2 — every trait has 2 (set 2 done)
 *   stage 3 — full profile: every trait has 3 (all 48), which is what
 *             `isFullProfileDone` gates on and what a trait needs to settle
 *
 * The stage is the LOWEST per-trait count, capped at 3. So a person who
 * answered 6 on one trait and 0 on another is still at stage 0, and the short
 * trait simply gets its question next — nobody redoes anything.
 *
 * Old accounts: the tiered 50 gave ten traits only 2 answers. Anyone whose
 * counts fill that old shape (`LEGACY_INTAKE_AXIS_COUNTS`) keeps every unlock
 * the old 50 gave, via `finishedLegacyIntake`. Their short traits still get
 * their third question (intake page, then the adaptive round planner puts
 * every trait under 3 first).
 */
import { trackFor, type TraitTrack } from '@/lib/trait-stability';
import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';

import { LEGACY_INTAKE_AXIS_COUNTS, LEGACY_INTAKE_PROMPTS, PROMPT_REWORDS } from './bank';
import { QUESTIONS_BANK_V1 } from './bank-v1';

/** One question per trait per set. */
export const INTAKE_SET_SIZE = TRAIT_AXES.length;
/** Three sets: 3 answers per trait = STABILITY_FLOOR_N. */
export const INTAKE_SETS = 3;
export const FIRST_READ_STAGE = 1;
export const FULL_PROFILE_STAGE = INTAKE_SETS;
/** 48 today. Derived, so a 17th trait does not need a new literal. */
export const INTAKE_TOTAL = INTAKE_SET_SIZE * INTAKE_SETS;

/** The old intake's total (50). */
export const LEGACY_INTAKE_TOTAL = Object.values(LEGACY_INTAKE_AXIS_COUNTS).reduce(
  (sum, n) => sum + n,
  0,
);

export type IntakeStage = 0 | 1 | 2 | 3;

function reportCount(tracks: readonly TraitTrack[], axis: TraitAxis): number {
  const row = trackFor(tracks, axis, 'report');
  return row ? Math.max(0, row.answerCount) : 0;
}

/** The lowest per-trait answer count, capped at 3. */
export function intakeStage(tracks: readonly TraitTrack[]): IntakeStage {
  let low = INTAKE_SETS;
  for (const axis of TRAIT_AXES) low = Math.min(low, reportCount(tracks, axis));
  return Math.max(0, Math.min(INTAKE_SETS, low)) as IntakeStage;
}

/**
 * The set being worked on (1..3) and how many of its 16 are done, or null once
 * every trait has 3. A trait already past this set counts as done in it.
 */
export function currentIntakeSet(
  tracks: readonly TraitTrack[],
): { set: number; answered: number; size: number } | null {
  const stage = intakeStage(tracks);
  if (stage >= INTAKE_SETS) return null;
  const set = stage + 1;
  const answered = TRAIT_AXES.filter((axis) => reportCount(tracks, axis) >= set).length;
  return { set, answered, size: INTAKE_SET_SIZE };
}

/** "N of 48" — each trait counts up to 3. For progress copy only. */
export function intakeProgress(tracks: readonly TraitTrack[]): { answered: number; total: number } {
  let answered = 0;
  for (const axis of TRAIT_AXES) answered += Math.min(reportCount(tracks, axis), INTAKE_SETS);
  return { answered, total: INTAKE_TOTAL };
}

/** The old intake's own count: each trait counts up to its old tier size. */
export function legacyIntakeAnswered(tracks: readonly TraitTrack[]): number {
  let answered = 0;
  for (const axis of TRAIT_AXES) {
    answered += Math.min(reportCount(tracks, axis), LEGACY_INTAKE_AXIS_COUNTS[axis] ?? 0);
  }
  return answered;
}

/** Filled the old tiered 50. Keeps every unlock the old 50 gave. */
export function finishedLegacyIntake(tracks: readonly TraitTrack[]): boolean {
  return legacyIntakeAnswered(tracks) >= LEGACY_INTAKE_TOTAL;
}

/** The full-profile gate's rule: all 48, or the old 50. */
export function reachedFullProfile(tracks: readonly TraitTrack[]): boolean {
  return intakeStage(tracks) >= FULL_PROFILE_STAGE || finishedLegacyIntake(tracks);
}

/**
 * Old-50 accounts with intake questions still open (the restored third
 * drafts). They see them as optional; nothing is locked.
 */
export function hasOptionalLegacyQuestions(tracks: readonly TraitTrack[]): boolean {
  return finishedLegacyIntake(tracks) && intakeStage(tracks) < FULL_PROFILE_STAGE;
}

/**
 * Prompts this account already answered in the OLD intake that are no longer
 * intake questions (the moved extras). Rounds exclude every current intake
 * prompt already; these have to be excluded per account, because the old
 * intake was answered on the phone and never landed in `question_items`.
 * Answering N on a trait in the old intake meant seeing that trait's first N
 * old drafts, so exactly those are returned. It cannot tell an old account
 * from a new one whose count grew through rounds, so a new account may skip
 * a moved extra it never saw — fewer bank candidates, never wrong data.
 */
export function legacyIntakeExclusions(tracks: readonly TraitTrack[]): string[] {
  // Compared in the old wording (bank-v1.ts), so the 2026-10-05 rewrite moves nothing.
  const current = new Set(QUESTIONS_BANK_V1.map((row) => row.prompt));
  const seenPerAxis = new Map<TraitAxis, number>();
  const out: string[] = [];
  for (const row of LEGACY_INTAKE_PROMPTS) {
    const axis = row.axis as TraitAxis;
    const index = seenPerAxis.get(axis) ?? 0;
    seenPerAxis.set(axis, index + 1);
    if (current.has(row.prompt)) continue;
    if (index < reportCount(tracks, axis)) {
      out.push(row.prompt);
      // The pool row now carries the new wording (wave84); keep it out too.
      const reworded = PROMPT_REWORDS[row.prompt];
      if (reworded) out.push(reworded);
    }
  }
  return out;
}
