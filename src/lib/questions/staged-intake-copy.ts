/**
 * Every new string from the staged intake (48 = 3 sets of 16) and the
 * adaptive rounds of 16, in one place so emci can read them together
 * (docs/copy-review.md §"Staged intake"). Moment voice
 * (src/lib/voice/moment-voice.ts) where a line has room for a moment; plain
 * labels where it is a label.
 *
 * Imports nothing on purpose: trait-stability.ts reads the mixed-trait line
 * from here, and anything heavier would make an import cycle.
 */

/** Draft until emci reads it; shows the draft badge while PRE_LAUNCH_DEV. */
export const STAGED_INTAKE_COPY_REVIEWED = false;

/** Questions header for the set in progress. */
export function intakeSetHeader(set: number, sets: number): string {
  return `Set ${set} of ${sets} · one question for each trait`;
}

/** The mini guy's line when a set is finished (index 0 = set 1). */
export const INTAKE_SET_PAYOFF_TITLES: readonly string[] = [
  'First read',
  'Two of three',
  'Full profile',
];
export const INTAKE_SET_PAYOFF_LINES: readonly string[] = [
  'Sixteen down — quicker than you answer most texts. Every trait has a first lean now.',
  'Thirty-two. More answers than your last group-chat poll got. One more set.',
  'All 48. You finished something without leaving it in a tab. Your full profile is open.',
];

/** A trait with three or more answers that pulled different ways. */
export const MIXED_TRAIT_LINE =
  'Settled, loosely — your answers pulled two ways. The next round checks again.';

/** Round size in every "next N" label. */
export function nextRoundLabel(size: number): string {
  return `Next ${size} questions`;
}

/** The after-intake reveal's title. */
export function intakeRevealTitle(total: number): string {
  return `You finished all ${total}`;
}

/**
 * For an account that finished the old 50 and still has restored third
 * questions to answer. Optional: nothing it opened goes anywhere.
 */
export const LEGACY_NEW_QUESTIONS_LINE =
  "Ten traits got a third question. Optional — nothing you've opened goes anywhere.";

/** A closed category names the trait it is waiting on instead of reading blank. */
export function categoryWaitingLine(traitNames: readonly string[]): string {
  if (traitNames.length === 0) return '';
  const list =
    traitNames.length === 1
      ? traitNames[0]!
      : `${traitNames.slice(0, -1).join(', ')} and ${traitNames[traitNames.length - 1]}`;
  return `Waiting on ${list}. Your next round asks.`;
}
