import { JOKE_HARM_FILTER } from '@/lib/voice/card-joke';
import { hasClinicalLabel } from '@/lib/voice/clinical';

/**
 * Writer bible §2 + §5. Used by CI and the polish prompt.
 * Humor is 18+ (emci, 2026-10-19): no topic is banned by itself; only the
 * shared narrow harm filter (encouraging harm, slurs, sexually explicit).
 */
export const STORY_BANNED_TOPICS: readonly RegExp[] = JOKE_HARM_FILTER;

export const STORY_BANNED_CLICHES: readonly RegExp[] = [
  /\blittle did they know\b/i,
  /\bin a world\b/i,
  /\bchaos ensued\b/i,
  /\bplot twist\b/i,
  /\bthe rest is history\b/i,
  /\band that(?:'|’)s okay\b/i,
  /\bjourney\b/i,
  /\bvibe check\b/i,
  /\bmain character energy\b/i,
  /\bit(?:'|’)s giving\b/i,
  /\bslay\b/i,
  /\bunhinged\b/i,
  /\bwe(?:'|’)ve all been there\b/i,
  /\bplot armor\b/i,
  /\bliving rent-free\b/i,
  /\babsolute legend\b/i,
];

/** Therapy-speak phrases (clinical advice in disguise), not single words: "healing cut" and "the property boundaries" pass. */
const CARD6_THERAPY_SPEAK =
  /\b(?:healing (?:journey|process|work)|(?:your|own) healing|(?:set|setting|hold|holding|need|needs|healthy|enforce|enforcing) (?:\w+ )?boundaries)\b/i;

/**
 * Card 6 / daily-insight lines: therapy-speak and labels on the reader, not
 * vocabulary (emci 2026-10-19, round 3: context, not blanket bans). The label
 * and diagnosis rule is the shared reader-directed one (src/lib/voice/clinical.ts):
 * "Your trauma explains the group chat" and "That is so bipolar of you" fail,
 * "a toxic group chat" and "trauma-bonded by a bad haircut" pass. Therapy-speak
 * ("set boundaries", "your healing journey") stays refused as clinical advice.
 * Same `.test(text)` shape as the RegExp it replaced.
 */
export const STORY_CLINICAL_CARD6: { test: (text: string) => boolean } = {
  test: (text: string): boolean => CARD6_THERAPY_SPEAK.test(text) || hasClinicalLabel(text),
};
export const STORY_HOROSCOPE_CARD6 = /\b(the universe|energy is shifting|you may find that)\b/i;

export const STORY_GENDERED_PRONOUNS = /\b(he|she|him|her|his|hers|himself|herself)\b/i;
export const STORY_ROMANCE_LABELS = /\b(girlfriend|boyfriend|wife|husband|birthday girl|two-man)\b/i;
