/**
 * Sage UI copy. Floor requirement: labeled "coach" in the UI itself, never
 * implied to be a person — except the Home card in Quest appearance, which
 * uses SAGE_NPC_LABEL and does not require the disclosure sentence.
 * Talk, Dawn, consent, crisis, morning push, and widget stay SAGE_COACH_LABEL.
 * Widget Swift duplicates SAGE_COACH_LABEL (native surface).
 */

export const SAGE_COACH_LABEL = 'Sage · coach';

/** Home card in Quest mode only. Lowercase npc; do not uppercase this string. */
export const SAGE_NPC_LABEL = 'Sage · npc';

export const SAGE_NOT_A_PERSON = 'Sage is a coach, not a person.';

export const HOME_SAGE_LEDE =
  "Today's Read and Do from Sage, a coach \u2014 not a person.";

/** Quest Home: no coach disclosure on that card. Read/Do labels stay. */
export const HOME_SAGE_LEDE_QUEST = "Today's Read and Do.";

/** Home-only third daily category. Never Circle, widget, or morning push. */
export const NUDGE_LABEL = 'Bump';

export function homeSageLabel(appearanceId: string): string {
  return appearanceId === 'quest' ? SAGE_NPC_LABEL : SAGE_COACH_LABEL;
}

export function homeSageLede(appearanceId: string): string {
  return appearanceId === 'quest' ? HOME_SAGE_LEDE_QUEST : HOME_SAGE_LEDE;
}

export const DAWN_SAGE_LEDE =
  'Sage is a coach, not a person. Today\u2019s Read and Do, before the day gets loud.';

export const TALK_LEDE =
  'Sage is a coach in the app, not a person. Talk it out \u2014 Sage replies in your style.';

export const TALK_EMPTY =
  'Say hi, or tap a chip to get started. Sage is a coach, not someone in the chat.';

export const TALK_COMPOSER_PLACEHOLDER = 'Talk it out\u2026';

export const TALK_WRITING = 'Drafting a reply\u2026';

export const TALK_TRY_AGAIN = 'Sage couldn\u2019t reply. Try again.';

export const CONSENT_COACH_LINE = 'Sage is a coach in the app, not a person.';

/** Recurring trait check-in. Own surface — never a Talk reply. */
export const SAGE_KNOWS_LABEL = 'Does Sage know you?';

/** Home-only daily tap-to-open. Never Circle, widget, or morning push. */
export const REVEAL_LABEL = 'Note';

/** Visible when the pool is empty — never a sealed object, never quota cadence. */
export const REVEAL_EMPTY = 'Nothing extra to notice today.';

/** Optional-depth forced ranking. One axis, most-me to least-me. */
export const RANKING_LABEL = 'Most me';

export const RANKING_LEDE = "Drag these into order — the one that's most you goes on top.";

export const RANKING_SAVE = "That's me";

export const RANKING_SKIP = 'Not this week';

/** Optional-depth scenario swipe. One extra axis, inferred self_game. */
export const SCENARIO_LABEL = 'Gut call';

export const SCENARIO_LEDE = 'Swipe or tap. One pick.';

/** Home inner tab — periodic Sage observations. Not a daily card. */
export { EXPLORE_LABEL, TODAY_LABEL } from '@/lib/explore/copy';
export { QUESTIONS_LABEL } from '@/lib/questions/copy';
