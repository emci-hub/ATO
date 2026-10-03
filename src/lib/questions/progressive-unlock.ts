/**
 * Progressive unlock (trait-system redesign §6; staged intake 2026-10-02) —
 * Sage unlocks when set 2 is done (every trait has 2 answers), Legends at the
 * full profile (every trait has 3). Both also open on the old 50, so nobody
 * who finished the old intake loses one. Live-derived,
 * never stored: per-trait `answerCount` only grows, so "unlocked" is
 * permanent without a separate stored flag.
 *
 * Per emci's explicit call the intake alone unlocks Legends, not
 * isProfileSettled (see PROJECT_CONTEXT.md). Nothing here re-locks once
 * crossed.
 */
import {
  FULL_PROFILE_STAGE,
  INTAKE_TOTAL,
  intakeStage,
  reachedFullProfile,
} from './intake-stage';
import { nextRoundLabel, roundCapLine, STAGED_INTAKE_COPY_REVIEWED } from './staged-intake-copy';
import { ONGOING_ROUND_SIZE } from './tiered-axis-plan';
import { ATO_TOKEN_EARN, ROUND_PAYOUTS_PER_DAY } from '@/lib/ato-tokens';
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
/** Sage: set 2 done (every trait has 2), or the full profile. */
export const SAGE_UNLOCK_STAGE = 2;
/** Legends: the full profile (all 48, or the old 50). */
export const LEGENDS_UNLOCK_STAGE = FULL_PROFILE_STAGE;

/**
 * The unlock table. Each line matches a real gate:
 *   - finishing the intake is `isFullProfileDone` (lib/full-profile-gate.ts):
 *     Home "Load insight", Explore categories, Questions "Next 16 questions";
 *   - Story is offered then too, but `storyReady` decides when it has enough;
 *   - Sage and Legends open nothing yet.
 * emci approved the 50-era table 2026-10-02; the staged-intake rewording is a
 * draft again until emci reads it (docs/copy-review.md, Staged intake).
 */
export const UNLOCK_COPY_REVIEWED = STAGED_INTAKE_COPY_REVIEWED;

/** Milestone def (lib/milestones.ts) the after-intake reveal takes its title and body from. */
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
  `${nextRoundLabel(ONGOING_ROUND_SIZE)}, here`,
];

export const NEXT_ROUND_HEADING = `What your next ${ONGOING_ROUND_SIZE} are for`;
export const NEXT_ROUND_UNLOCKS: readonly string[] = [
  `Another look at the traits that are still settling or pulled two ways, out of your ${TRAIT_AXES.length}`,
  'Your Story on Home, as more traits settle',
  'More categories on Explore',
  `+${ATO_TOKEN_EARN.ongoing_round_complete} ATO tokens`,
];

export const COMING_LATER_HEADING = 'Not open yet';
export const COMING_LATER_LINE = 'Sage and Legends are being rebuilt. Nothing you do here unlocks them yet.';

export const INTAKE_TOKENS_PAID_LINE = `+${ATO_TOKEN_EARN.full_profile_complete} ATO tokens, in your balance on You`;

export const SETTLED_EXPLAINER = `A trait settles after three answers. All ${INTAKE_TOTAL} give every trait three; a trait whose answers pulled two ways gets asked again next round.`;

export const ROUND_COMPLETE_TITLE = 'Round complete';

/** Where the profile stands after a round, and what the next one does. */
export function roundStandingLine(tracks: readonly TraitTrack[]): string {
  const next = isProfileSettled(tracks)
    ? 'Every round from here sharpens your reads.'
    : `Your next ${ONGOING_ROUND_SIZE} keep settling the rest.`;
  return `${settledAxisLabel(tracks)}. ${next}`;
}

/**
 * The round-end toast body. The +21 is only named once the server paid it; a
 * round past the daily payout cap says so (wave81) instead of staying silent.
 */
export function roundCompleteBody(tracks: readonly TraitTrack[], paid: boolean, capped = false): string {
  const tokens = paid
    ? `+${ATO_TOKEN_EARN.ongoing_round_complete} ATO tokens. `
    : capped
      ? `${roundCapLine(ROUND_PAYOUTS_PER_DAY)} `
      : '';
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

/**
 * Set 2 done, or the full profile. No old-25 clause: counted against the old
 * caps it would open at 31 answers for a new account, and Sage is a
 * placeholder that opens nothing, so an old mid-intake account loses nothing.
 */
export function sageUnlocked(tracks: readonly TraitTrack[]): boolean {
  return intakeStage(tracks) >= SAGE_UNLOCK_STAGE || reachedFullProfile(tracks);
}

export function legendsUnlocked(tracks: readonly TraitTrack[]): boolean {
  return reachedFullProfile(tracks);
}
