/**
 * "The funny part" — one joke line on a Legends card or a category deep dive
 * (emci, 2026-10-08: "dark jokes, or any kind of jokes … to have variety").
 *
 * The same named exception the Story's joke has (`STORY_JOKE_RULES` in
 * moment-voice.ts): this ONE sentence may be drier or darker than the moment
 * voice's "tease kindly", within the same hard bans. The style is picked by
 * the app per card (seeded), never by the model, so two cards in a row differ.
 * Written in the same AI call as the card: no extra cost.
 */
import { fnv1a } from '@/lib/daily-line/bank';

import { STORY_JOKE_BANS } from './moment-voice';

export const CARD_JOKE_STYLES = [
  'dry',
  'deadpan',
  'absurd scenario (one everyday situation taken one step too far)',
  'self-aware (the reader catching themselves in the act)',
  'mild gallows humour about everyday absurdity (never death, dying or real harm)',
] as const;
export type CardJokeStyle = (typeof CARD_JOKE_STYLES)[number];

export const CARD_JOKE_MAX_CHARS = 140;

/**
 * The hard bans as keywords — a backstop for the prompt, not the whole rule.
 * Word-bounded so "deadline", "deadpan" and "skill" stay allowed. Shared with
 * the Story (`storyHasBannedTopic`).
 */
export const JOKE_BANNED_TOPIC: readonly RegExp[] = [
  /\b(die|dies|died|dying|dead|death|deaths)\b/i,
  /\bkill(s|ed|ing)?\b/i,
  /\bsuicid/i,
  /\bself[- ]harm/i,
  /\bdepress(ed|ion|ing)?\b/i,
  /\banxiety\b/i,
  /\btherap(y|ist|ists)\b/i,
  /\bdrunk\b/i,
  /\bsex(y|ual|ually)?\b/i,
  /\b(fuck|shit|bitch|asshole)/i,
];

export function jokeHasBannedTopic(text: string): boolean {
  return JOKE_BANNED_TOPIC.some((re) => re.test(text));
}

/** The style for one card, seeded (same card → same style; neighbours differ). */
export function cardJokeStyle(seed: string): CardJokeStyle {
  return CARD_JOKE_STYLES[fnv1a(seed) % CARD_JOKE_STYLES.length]!;
}

/** The prompt rules for the one joke line. Static (cache-friendly): the style
 * for this card is given at the very end of the prompt as "JOKE STYLE". */
export const CARD_JOKE_RULES = `"funny" — THE ONE JOKE (a named exception to "tease kindly": this single sentence may be drier or darker).
  Use the JOKE STYLE given at the end. One sentence, under ${CARD_JOKE_MAX_CHARS} characters, about a situation the reader's
  side lands them in. Joke about the situation, never the person. Clearly funny on its own, not a riddle.
  Never, whatever the style:
${STORY_JOKE_BANS.map((line) => `  - ${line}`).join('\n')}`;

/** Why a joke line may not be shown (the card's own line rules still apply on top). */
export function cardJokeViolation(text: string): string | null {
  const line = text.trim();
  if (!line) return 'empty';
  if (line.length > CARD_JOKE_MAX_CHARS) return 'too long';
  if ((line.match(/[.?]\s+\S/g) ?? []).length > 0) return 'more than one sentence';
  if (jokeHasBannedTopic(line)) return 'banned topic';
  if (/#/.test(line)) return 'hashtag';
  return null;
}
