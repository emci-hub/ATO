/**
 * Shared UI copy. The module keeps its old `sage-copy` name until the module
 * rename PR (2026-10-14: Sage was replaced by Insights); every string a user
 * can see says Insights or ATO, never Sage (`check:no-sage-copy`).
 * Talk and Dawn copy were deleted with Sage. The installed widget's own native
 * header is a separate binary and changes only with a native build.
 */

/** The Insights screen's kicker. (Was 'Sage · coach'.) */
export const SAGE_COACH_LABEL = 'Insights';

/**
 * The Home insight card's kicker (emci, 2026-10-07; was 'Sage · npc'). The
 * card's one chip row of trait tags sits right under it.
 */
export const SAGE_NPC_LABEL = 'Focus · try · watch';

/** Under the Insights title: where everything on that screen comes from. */
export const SAGE_NOT_A_PERSON = 'Picked from your answers. No AI writes anything here.';

/**
 * The small line under Home's title. Home no longer carries the Story, so the
 * coach disclosure went with it (2026-10-14).
 */
export const HOME_SAGE_LEDE = 'Today at a glance.';

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

/** Recurring trait check-in. Own surface. */
export const SAGE_KNOWS_LABEL = 'Does ATO know you?';

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

/** Home inner tab — periodic observations. Not a daily card. */
export { EXPLORE_LABEL, TODAY_LABEL } from '@/lib/explore/copy';
