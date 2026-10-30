/**
 * Quests copy fence (ATO-BUILD PHASE-12, R14). No Quests banned list existed, so
 * this is it. It fences only psychology jargon and the words "test", "diagnosis"
 * and "score" in Quests copy (no trait words on screen). The core content policy
 * (docs/copy-review-rules.md: meaning over keywords) is unchanged; framework
 * claims are still judged by `containsFrameworkTerm`.
 */
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';

export const QUEST_BANNED_JARGON: readonly RegExp[] = [
  /\bbig (?:five|5)\b/i,
  /\bmbti\b/i,
  /\bpersonality\b/i,
  /\btraits?\b/i,
  /\b(?:introver(?:t|ts|ted|sion)|extraver(?:t|ts|ted|sion)|extrovert(?:s|ed)?|neurotic|neuroticism)\b/i,
  /\bconscientious(?:ness)?\b/i,
  /\bagreeableness\b/i,
  /\bopenness\b/i,
  /\bself[- ]efficacy\b/i,
  /\blocus of control\b/i,
  /\battachment (?:style|theory)\b/i,
  /\bgrowth mindset\b/i,
  /\bassertiveness\b/i,
  /\bautonomy\b/i,
];

/** The three words the spec bans outright in Quests copy. */
export const QUEST_BANNED_WORDS: readonly RegExp[] = [
  /\btests?\b/i,
  /\bdiagnos(?:is|es|ed|e|ing|tic)\b/i,
  /\bscor(?:e|es|ed|ing)\b/i,
];

/** The banned patterns found in `text` (empty = clean). Labels are the matched text. */
export function questCopyHits(text: string): string[] {
  const hits: string[] = [];
  for (const re of [...QUEST_BANNED_JARGON, ...QUEST_BANNED_WORDS]) {
    const m = text.match(re);
    if (m && !hits.includes(m[0].toLowerCase())) hits.push(m[0].toLowerCase());
  }
  if (containsFrameworkTerm(text)) hits.push('framework claim');
  return hits;
}
