/**
 * How the fixed question bank is served (emci 2026-10-06).
 *
 * Every Questions visit is a set of 16: one question per trait, random order,
 * each a random pick from that trait's questions the person has not answered.
 * 25 per trait means up to 25 sets, no repeats, no cooldown. The SERVER picks
 * the set (`serve_bank_set`, wave85) and scores every answer; the pure
 * functions here mirror its rules so the screen can say where someone is and
 * `check:question-bank` can prove the rules hold.
 *
 *   sets 1-3   first read — profile unlocks (3 answers per trait, as before)
 *   sets 4-8   full profile — complete and accurate after set 8
 *   sets 9-25  bonus — sharpens it, still pays like the old rounds
 *   after 25   per-trait retest (answers replace the old ones) and Start Fresh
 */
import { effectiveStability, MIXED_STABILITY_BELOW, type TraitTrack } from '@/lib/trait-stability';
import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';

import { BANK_BY_TRAIT, BANK_PER_TRAIT, type BankQuestion } from './bank/index';

/**
 * The 352 new bank questions and this screen's copy have not had emci's read
 * yet (the 48 intake questions inside the bank are the already-approved
 * wording). Flip after review.
 */
export const BANK_COPY_REVIEWED = false;

export const BANK_SET_SIZE = TRAIT_AXES.length;
export const BANK_SET_COUNT = BANK_PER_TRAIT;
export const FIRST_READ_SETS = 3;
export const FULL_PROFILE_SETS = 8;

/** "Firm" (soft indicator): about 6 answers that mostly agree. */
export const FIRM_MIN_ANSWERS = 6;
export const FIRM_MIN_STABILITY = 0.6;
/** Near the middle: the leaning is too close to call. */
export const NEAR_MIDDLE_WITHIN = 0.1;
export const RETEST_MIN = 5;

export type BankStage = 'first_read' | 'full_profile' | 'bonus' | 'complete';

export interface BankProgress {
  answeredIds: ReadonlySet<string>;
  answeredByAxis: Readonly<Record<TraitAxis, number>>;
  /** Sets finished = the fewest answered on any trait. */
  completedSets: number;
  /** 1-25 while sets remain, null once every question is answered. */
  currentSet: number | null;
  stage: BankStage;
  /** How many times this account has used Start Fresh. */
  freshStarts: number;
}

export function bankProgressFrom(ids: readonly string[], freshStarts = 0): BankProgress {
  const answeredIds = new Set(ids);
  const answeredByAxis = {} as Record<TraitAxis, number>;
  for (const axis of TRAIT_AXES) {
    answeredByAxis[axis] = BANK_BY_TRAIT[axis].filter((q) => answeredIds.has(q.id)).length;
  }
  const completedSets = Math.min(...TRAIT_AXES.map((axis) => answeredByAxis[axis]));
  const remaining = TRAIT_AXES.some((axis) => answeredByAxis[axis] < BANK_PER_TRAIT);
  const currentSet = remaining ? Math.min(completedSets + 1, BANK_SET_COUNT) : null;
  return { answeredIds, answeredByAxis, completedSets, currentSet, stage: stageFor(completedSets, remaining), freshStarts };
}

export function stageFor(completedSets: number, remaining = true): BankStage {
  if (!remaining) return 'complete';
  if (completedSets < FIRST_READ_SETS) return 'first_read';
  if (completedSets < FULL_PROFILE_SETS) return 'full_profile';
  return 'bonus';
}

export const BANK_STAGE_LABEL: Readonly<Record<BankStage, string>> = {
  first_read: 'First read',
  full_profile: 'Full profile',
  bonus: 'Bonus round',
  complete: 'All 25 sets done',
};

/** One line under the set header. */
export function bankStageLine(progress: BankProgress): string {
  const set = progress.currentSet;
  switch (progress.stage) {
    case 'first_read':
      return `Set ${set} of ${FIRST_READ_SETS}. Your profile opens after set ${FIRST_READ_SETS}.`;
    case 'full_profile':
      return `Set ${set}. Your profile is complete after set ${FULL_PROFILE_SETS}.`;
    case 'bonus':
      return `Set ${set} of ${BANK_SET_COUNT}. Optional — each one sharpens your profile.`;
    case 'complete':
      return `You answered all ${BANK_SET_COUNT * BANK_SET_SIZE}.`;
  }
}

/** True once sets 1-8 are done: the profile is complete and accurate. */
export function isProfileComplete(progress: BankProgress): boolean {
  return progress.completedSets >= FULL_PROFILE_SETS;
}

/**
 * The server's pick, in TS (pure; `rng` is injectable for tests): one
 * unanswered question per trait that still has one, in random order.
 */
export function pickBankSet(answeredIds: ReadonlySet<string>, rng: () => number = Math.random): BankQuestion[] {
  const picks: BankQuestion[] = [];
  for (const axis of TRAIT_AXES) {
    const open = BANK_BY_TRAIT[axis].filter((q) => !answeredIds.has(q.id));
    if (open.length === 0) continue;
    picks.push(open[Math.floor(rng() * open.length)]!);
  }
  for (let i = picks.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [picks[i], picks[j]] = [picks[j]!, picks[i]!];
  }
  return picks;
}

// --- Confidence, firm, retest ------------------------------------------------

export type TraitConfidence = 'firm' | 'settled' | 'mixed' | 'early';

export function traitConfidence(track: TraitTrack | null, now: Date = new Date()): TraitConfidence {
  if (!track || track.answerCount < 3) return 'early';
  if (track.stability < MIXED_STABILITY_BELOW) return 'mixed';
  if (isTraitFirm(track, now)) return 'firm';
  return 'settled';
}

/** About 6 answers that mostly agree. Soft: never gates anything. */
export function isTraitFirm(track: TraitTrack | null, now: Date = new Date()): boolean {
  if (!track || track.answerCount < FIRM_MIN_ANSWERS) return false;
  return effectiveStability(track, now) >= FIRM_MIN_STABILITY;
}

export const TRAIT_CONFIDENCE_LABEL: Readonly<Record<TraitConfidence, string>> = {
  firm: 'Firm',
  settled: 'Settled',
  mixed: 'Mixed answers',
  early: 'Still early',
};

/** The trait-card button, and what it says once pressed (tap again to undo). */
export const NOT_ME_LABEL = 'This isn’t me';
export const NOT_ME_ON_LINE = 'Flagged as not you · first in line for a retest. Tap to undo.';

export type RetestReason = 'flagged' | 'mixed' | 'low_confidence' | 'near_middle';

export const RETEST_REASON_LABEL: Readonly<Record<RetestReason, string>> = {
  flagged: 'You said this isn’t you',
  mixed: 'Your answers pulled both ways',
  low_confidence: 'Not much agreement yet',
  near_middle: 'Too close to call',
};

export interface RetestPick {
  axis: TraitAxis;
  reason: RetestReason;
}

/**
 * Which traits to retest, most worth it first: flagged "this isn't me",
 * then mixed answers, then low confidence, then a leaning near the middle.
 */
export function retestRecommendations(
  tracks: readonly TraitTrack[],
  flagged: ReadonlySet<TraitAxis>,
  now: Date = new Date(),
): RetestPick[] {
  const byAxis = new Map(tracks.filter((t) => t.track === 'report').map((t) => [t.axis, t]));
  const rank: Record<RetestReason, number> = { flagged: 0, mixed: 1, low_confidence: 2, near_middle: 3 };
  const out: RetestPick[] = [];
  for (const axis of TRAIT_AXES) {
    const track = byAxis.get(axis) ?? null;
    let reason: RetestReason | null = null;
    if (flagged.has(axis)) reason = 'flagged';
    else if (track && track.answerCount >= 3 && track.stability < MIXED_STABILITY_BELOW) reason = 'mixed';
    else if (track && effectiveStability(track, now) < 0.4) reason = 'low_confidence';
    else if (track && Math.abs(track.value - 0.5) < NEAR_MIDDLE_WITHIN) reason = 'near_middle';
    if (reason) out.push({ axis, reason });
  }
  return out.sort((a, b) => rank[a.reason] - rank[b.reason]);
}

/** Retest size choices for a trait: 5 up to what they answered (max 25). */
export function retestSizes(answered: number): number[] {
  const max = Math.min(BANK_PER_TRAIT, answered);
  if (max < RETEST_MIN) return [];
  const sizes = [5, 10, 15, 20, 25].filter((n) => n <= max);
  if (!sizes.includes(max)) sizes.push(max);
  return sizes;
}
