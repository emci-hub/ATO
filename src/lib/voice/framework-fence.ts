/**
 * Runtime reject for generated Read / Do / Nudge and for Teach-Sage facts.
 * Separate from scripts/intake-check.ts (that one is UI copy). This one runs
 * in the router and addFact so a model echo cannot reach Circle, widget, push,
 * or later cards via a stored fact.
 *
 * Do not put this term list into the model prompt — listing them teaches the
 * tokens. The prompt paraphrases behavior; this fence is the backstop.
 */

export const FACT_FRAMEWORK_MESSAGE =
  "That line names a type or label Sage will not store. Try saying it in your own words.";

const TYPE_CODES = [
  'INTJ',
  'INTP',
  'ENTJ',
  'ENTP',
  'INFJ',
  'INFP',
  'ENFJ',
  'ENFP',
  'ISTJ',
  'ISFJ',
  'ESTJ',
  'ESFJ',
  'ISTP',
  'ISFP',
  'ESTP',
  'ESFP',
];

const PHRASES = [
  '16personalities',
  'myers-briggs',
  'myers briggs',
  'thomas-kilmann',
  'thomas kilmann',
  'fearful-avoidant',
  'fearful avoidant',
  'attachment style',
  'big five',
];

const WORDS = [
  'mbti',
  'ocean',
  'neuroticism',
  'neurotic',
  'tipi',
  'ecr',
  'tki',
  'secure',
  'anxious',
  'avoidant',
  'collaborative',
  'compromising',
  'competitive',
  'accommodating',
];

const PHRASE_RE = new RegExp(PHRASES.map(escapeRegExp).join('|'), 'i');
const WORD_RE = new RegExp(`\\b(?:${WORDS.join('|')})\\b`, 'i');
const TYPE_RE = new RegExp(`\\b(?:${TYPE_CODES.join('|')})\\b`, 'i');

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** True when generated copy or a stored fact names a framework / type / diagnostic category. */
export function containsFrameworkTerm(text: string | null | undefined): boolean {
  if (!text) return false;
  return PHRASE_RE.test(text) || WORD_RE.test(text) || TYPE_RE.test(text);
}

export function sanitizeFacts(facts: unknown): string[] {
  if (!Array.isArray(facts)) return [];
  return facts.filter(
    (fact): fact is string => typeof fact === 'string' && fact.trim().length > 0 && !containsFrameworkTerm(fact),
  );
}
