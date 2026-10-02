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
import { ATO_TOKEN_EARN } from '@/lib/ato-tokens';
import { isProfileSettled, settledAxisLabel, type TraitTrack } from '@/lib/trait-stability';
import { TRAIT_AXES } from '@/lib/traits';
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';

/**
 * NOT live gates (2026-10-01). Sage and Legends are both placeholders
 * (`RebuiltNotice`), so nothing opens at these counts today; the thresholds
 * survive for dev tooling and the parked rolls composer. What a person
 * actually gets, and when, is the unlock table below — the one place the
 * reveal, the round toast and any locked line read it from.
 */
export const SAGE_UNLOCK_THRESHOLD = 25;
export const LEGENDS_UNLOCK_THRESHOLD = 50;

/**
 * The unlock table. Each line matches a real gate:
 *   - finishing the 50 is `isFullProfileDone` (lib/full-profile-gate.ts): Home
 *     "Load insight", Explore categories, Questions "Next 25 questions";
 *   - Story is offered at 50 too, but `storyReady` needs more settled axes than
 *     the intake can give (ten axes stop at 2 answers), so it belongs to the
 *     next round, not to "open now";
 *   - Sage and Legends open nothing yet.
 * Draft copy until emci reads it.
 */
// emci approved 2026-10-02.
export const UNLOCK_COPY_REVIEWED = true;

/** Milestone def (lib/milestones.ts) the after-50 reveal takes its title and body from. */
export const INTAKE_REVEAL_MILESTONE_ID = 'profile_fully_unlocked';
/**
 * The id the reveal is remembered under in `me.celebrated_milestone_ids`.
 * Deliberately NOT the milestone id above: the old toast queue wrote that one
 * at the same 50-answer crossing, so an account that finished while it was
 * live already holds it and would never see the reveal.
 */
export const INTAKE_REVEAL_SEEN_ID = 'intake_reveal_seen';

export const INTAKE_UNLOCKED_HEADING = 'Open now';
export const INTAKE_UNLOCKED: readonly string[] = [
  'Your daily insight, on Home',
  'Categories, on Explore',
  'Your next 25 questions, here',
];

export const NEXT_ROUND_HEADING = 'What your next 25 are for';
export const NEXT_ROUND_UNLOCKS: readonly string[] = [
  `A third answer on each of your ${TRAIT_AXES.length} traits, which is what a trait needs to settle`,
  'Your Story on Home, which needs more settled traits first',
  'More categories on Explore',
  `+${ATO_TOKEN_EARN.ongoing_round_complete} ATO tokens`,
];

export const COMING_LATER_HEADING = 'Not open yet';
export const COMING_LATER_LINE = 'Sage and Legends are being rebuilt. Nothing you do here unlocks them yet.';

export const INTAKE_TOKENS_PAID_LINE = `+${ATO_TOKEN_EARN.full_profile_complete} ATO tokens, in your balance on You`;

export const SETTLED_EXPLAINER =
  'A trait settles after three answers that agree. The 50 give most traits two, so they read as still settling until your next 25.';

export const ROUND_COMPLETE_TITLE = 'Round complete';

/** Where the profile stands after a round, and what the next one does. */
export function roundStandingLine(tracks: readonly TraitTrack[]): string {
  const next = isProfileSettled(tracks)
    ? 'Every round from here sharpens your reads.'
    : 'Your next 25 keep settling the rest.';
  return `${settledAxisLabel(tracks)}. ${next}`;
}

/** The round-end toast body. The +21 is only named once the server paid it. */
export function roundCompleteBody(tracks: readonly TraitTrack[], paid: boolean): string {
  const tokens = paid ? `+${ATO_TOKEN_EARN.ongoing_round_complete} ATO tokens. ` : '';
  return `${tokens}${roundStandingLine(tracks)}`;
}

export function unlockCopyClean(): boolean {
  const lines = [
    INTAKE_UNLOCKED_HEADING,
    ...INTAKE_UNLOCKED,
    NEXT_ROUND_HEADING,
    ...NEXT_ROUND_UNLOCKS,
    COMING_LATER_HEADING,
    COMING_LATER_LINE,
    INTAKE_TOKENS_PAID_LINE,
    SETTLED_EXPLAINER,
    ROUND_COMPLETE_TITLE,
  ];
  return lines.every((line) => !containsFrameworkTerm(line));
}

export function sageUnlocked(tracks: readonly TraitTrack[]): boolean {
  return bankTotalProgress(tracks).answered >= SAGE_UNLOCK_THRESHOLD;
}

export function legendsUnlocked(tracks: readonly TraitTrack[]): boolean {
  return bankTotalProgress(tracks).answered >= LEGENDS_UNLOCK_THRESHOLD;
}
