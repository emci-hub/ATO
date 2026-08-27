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
export const NUDGE_LABEL = 'Nudge';

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

export const CONSENT_COACH_LINE = 'Sage is a coach in the app, not a person.';
