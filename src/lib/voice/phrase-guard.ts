/**
 * Phrase-pattern guard — regex backstop for Sage constructions the keyword
 * list cannot catch. Auditable. Expand from real misses (logged on
 * ai_usage.phrase_flag). Not a second model call.
 *
 * Do not put these patterns into the generate prompt.
 */

export const PHRASE_FLAG_REFRAME = 'reframe';
export const PHRASE_FLAG_CLOSING = 'closing';
export const PHRASE_FLAG_TYPE = 'type-of-person';

export type PhraseFlag =
  | typeof PHRASE_FLAG_REFRAME
  | typeof PHRASE_FLAG_CLOSING
  | typeof PHRASE_FLAG_TYPE;

const REFRAME_THAT = /\bthat(?:'s| is) not\b[\s\S]{0,60}?,\s*that(?:'s| is)\b/i;
const REFRAME_ISNT = /\bisn(?:'t|\s+not)\b[\s\S]{0,40}?,\s*it(?:'s| is)\b/i;

const CLOSING_BUILT =
  /(?:[.!?…]|[—–-]|\s-\s)\s*that(?:'s| is) just how you(?:'re| are) built\b/i;
const CLOSING_WHO =
  /(?:[.!?…]|[—–-]|\s-\s)\s*that(?:'s| is) just who you are\b/i;

const TYPE_OF_PERSON = /\byou(?:'re| are) the type of person who\b/i;

/** First matching pattern id, or null. Fail toward swapping the line. */
export function matchingPhrasePattern(text: string | null | undefined): PhraseFlag | null {
  if (!text) return null;
  if (REFRAME_THAT.test(text) || REFRAME_ISNT.test(text)) return PHRASE_FLAG_REFRAME;
  if (CLOSING_BUILT.test(text) || CLOSING_WHO.test(text)) return PHRASE_FLAG_CLOSING;
  if (TYPE_OF_PERSON.test(text)) return PHRASE_FLAG_TYPE;
  return null;
}

export function containsPhrasePattern(text: string | null | undefined): boolean {
  return matchingPhrasePattern(text) != null;
}
