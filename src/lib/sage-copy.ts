/**
 * Sage UI copy. Floor requirement: labeled "coach" in the UI itself, never
 * implied to be a person. The Home insight card is stored copy since
 * 2026-10-07 (not Sage, not AI), so its kicker is SAGE_NPC_LABEL, which now
 * reads "Focus · try · watch" in every appearance.
 * Talk, Dawn, consent, crisis, morning push, and widget stay SAGE_COACH_LABEL.
 * Widget Swift duplicates SAGE_COACH_LABEL (native surface).
 */

export const SAGE_COACH_LABEL = 'Sage · coach';

/**
 * The Home insight card's kicker (emci, 2026-10-07; was 'Sage · npc'). The
 * card's one chip row of trait tags sits right under it.
 */
export const SAGE_NPC_LABEL = 'Focus · try · watch';

export const SAGE_NOT_A_PERSON = 'Sage is a coach, not a person.';

/**
 * The small line under Home's title (2026-10-07). The Story on Home is still
 * Sage, so the coach disclosure stays. (Was "Today's Read and Do from Sage…".)
 */
export const HOME_SAGE_LEDE = 'Sage is a coach, not a person.';

/** Same line in Quest mode; kept as its own name so the theme lab still reads it. */
export const HOME_SAGE_LEDE_QUEST = HOME_SAGE_LEDE;

/** Home-only third daily category. Never Circle, widget, or morning push. */
export const NUDGE_LABEL = 'Bump';

/** Same in every appearance: the card is stored copy, not a coach talking. */
export function homeSageLabel(_appearanceId: string): string {
  return SAGE_NPC_LABEL;
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
