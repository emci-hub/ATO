/**
 * Jargon guard — keyword/phrase list on Sage's generated output, same
 * deterministic pattern as crisis detection. Auditable. Expand from real
 * misses (logged on ai_usage). Not a second model call.
 *
 * Do not put this list into the generate prompt.
 */

export const JARGON_KEYWORDS: readonly string[] = [
  'introvert',
  'extrovert',
  'extravert',
  'ambivert',
  'personality type',
  'your type',
  "that's who you are",
  'thats who you are',
  'this is who you are',
  'who you are as a person',
  'you are the kind of',
  "you're the kind of",
  'coping mechanism',
  'maladaptive',
  'inner child',
  'love language',
  'narcissist',
  'gaslight',
  'diagnosed',
  'a diagnosis',
  'your diagnosis',
  'attachment style',
  'growth mindset',
  'fixed mindset',
  'locus of control',
  'self-efficacy',
  'self efficacy',
  'you are an',
  "you're an",
];

export const JARGON_FALLBACK_READ = "Logged. That's the note for today.";
export const JARGON_FALLBACK_DO = 'After you get up, do one small next step.';
export const JARGON_FALLBACK_TALK = 'I might have this wrong. Say the part that actually happened.';

const NORMALIZE = /[^a-z0-9]+/g;

export function normalizeJargon(text: string): string {
  return text.toLowerCase().replace(NORMALIZE, ' ').trim();
}

/** First matching phrase, or null. Fail toward swapping the line. */
export function matchingJargonTerm(text: string | null | undefined): string | null {
  if (!text) return null;
  const normalized = normalizeJargon(text);
  for (const keyword of JARGON_KEYWORDS) {
    if (normalized.includes(normalizeJargon(keyword))) return keyword;
  }
  return null;
}

export function containsJargon(text: string | null | undefined): boolean {
  return matchingJargonTerm(text) != null;
}

export function jargonInCard(card: { read: string; do: string; nudge?: string | null }): string | null {
  return (
    matchingJargonTerm(card.read) ??
    matchingJargonTerm(card.do) ??
    matchingJargonTerm(card.nudge)
  );
}

export function applyJargonFallback(card: {
  read: string;
  do: string;
  nudge?: string | null;
}): { read: string; do: string; nudge: string | null } {
  return {
    read: containsJargon(card.read) ? JARGON_FALLBACK_READ : card.read,
    do: containsJargon(card.do) ? JARGON_FALLBACK_DO : card.do,
    nudge: containsJargon(card.nudge) ? null : (card.nudge ?? null),
  };
}
