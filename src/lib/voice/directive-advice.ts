/**
 * Directive advice aimed at the reader (core content policy, emci 2026-10-20:
 * judge meaning, not the word). Surfaces that forbid advice (the Story, the deep
 * dive outside its one small step) used to reject any "should". The purpose was
 * "do not lecture the reader", so the rule now catches exactly that: an order or
 * obligation put on the reader ("you should…", "you need to…", "you'd better…").
 *
 * Passes: "The clock should have been faster.", "It should be illegal to schedule
 * a call at 8:01.", "Nobody should have to reread it.", a joke "should".
 */
const DIRECTIVE_AT_READER: readonly RegExp[] = [
  /\byou\s+(?:really\s+|definitely\s+|absolutely\s+|probably\s+|just\s+)?(?:should|shouldn['’]?t|ought\s+to|need\s+to|needn['’]?t|must|have\s+to|had\s+better)\b/i,
  /\byou['’](?:d\s+better|ll\s+want\s+to\s+make\s+sure)\b/i,
  /\b(?:should|shouldn['’]?t)\s+you\b/i,
  /\bwhy\s+(?:don['’]?t|not)\s+you\b/i,
];

/** Why a line gives the reader an order or an obligation, or null. */
export function directiveAdviceViolation(text: string): string | null {
  return DIRECTIVE_AT_READER.some((re) => re.test(text)) ? 'advice aimed at the reader' : null;
}
