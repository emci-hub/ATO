/**
 * Progressive unlock (trait-system redesign §6) — Sage unlocks at question
 * 25 of the frozen intake, Legends at question 50. Live-derived, same
 * pattern `isProfileSettled` already uses for Legends today (never stored):
 * `bankTotalProgress(tracks).answered` only grows as answers are recorded,
 * so "unlocked" is automatically permanent without a separate stored flag.
 *
 * Per emci's explicit call: Q50 alone unlocks Legends now, REPLACING the
 * prior isProfileSettled gate (see PROJECT_CONTEXT.md) — the tiered intake
 * alone does not satisfy isProfileSettled for every axis (10 of 16 axes only
 * reach 2 answers from the intake, below STABILITY_FLOOR_N's 3-answer floor),
 * so keeping isProfileSettled as the Legends gate would have made "answer 50
 * questions" not actually unlock Legends for most users.
 *
 * Applies only to the first-50 intake, per §6 — nothing here re-locks once
 * crossed, since `answered` never decreases.
 */
import { bankTotalProgress } from './local';
import type { TraitTrack } from '@/lib/trait-stability';

export const SAGE_UNLOCK_THRESHOLD = 25;
export const LEGENDS_UNLOCK_THRESHOLD = 50;

export function sageUnlocked(tracks: readonly TraitTrack[]): boolean {
  return bankTotalProgress(tracks).answered >= SAGE_UNLOCK_THRESHOLD;
}

export function legendsUnlocked(tracks: readonly TraitTrack[]): boolean {
  return bankTotalProgress(tracks).answered >= LEGENDS_UNLOCK_THRESHOLD;
}
