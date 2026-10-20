/**
 * Jargon guard on generated output (Explore, Story, generated questions). Same
 * deterministic idea as before (auditable, not a second model call), but since
 * 2026-10-20 it judges MEANING in context, not keywords (docs/copy-review-rules.md:
 * "no word or topic is a reason to reject by itself").
 *
 * What it refuses is a psychological VERDICT about the reader, an addressed person
 * or a real third person ("you're an introvert", "your boss is a narcissist",
 * "that's your inner child", "your love language is...", "you were diagnosed", "you
 * gaslight people") and a fixed-identity claim ("that's who you are"). What passes:
 *   - discussing the term:    "introverts need quiet", "love languages are a pop idea"
 *   - reported speech:        "she called him a narcissist"
 *   - figure / joke:          "my cat is a narcissist", "gaslit by the thermostat",
 *                             "the group chat needs therapy"
 *   - behaviour:              "he talks about himself nonstop", "you are an early riser"
 * Which of those a regex CAN and CANNOT tell apart is written on `labelVerdictHit` in
 * clinical.ts (class by class). Short version: discussion and behaviour yes; reported
 * speech by a named speaker verb; a joke only when its subject is not a person role. A
 * human-role joke ("my ex is a narcissist, said the plant") is flagged: the safe side.
 *
 * Two behaviours per surface (emci 2026-10-20):
 *   - generated output: `matchingJargonTerm` rejects only a verdict (class 5);
 *   - stored / hand-written copy: the same call, PLUS `jargonReviewTerms` lists the
 *     watched words that appear without a verdict, for a human to look at (never a
 *     failure by itself).
 * The framework names that used to live here (attachment style, growth mindset,
 * locus of control, self-efficacy) moved to framework-fence.ts under rule D6.
 *
 * Do not put this list into the generate prompt.
 */
import {
  VERDICT_PIECES,
  isReportedSpeech,
  labelVerdictHit,
  thirdPartyVerdictRes,
} from './clinical';

const { FILL, YOU_ARE, YOUR_TAIL, YOUR_VERB } = VERDICT_PIECES;

/** The watched vocabulary (review list). A word here is NOT a reason to reject; see `matchingJargonTerm`. */
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
];

export const JARGON_FALLBACK_READ = "Logged. That's the note for today.";
export const JARGON_FALLBACK_DO = 'After you get up, do one small next step.';
export const JARGON_FALLBACK_TALK = 'I might have this wrong. Say the part that actually happened.';

const NORMALIZE = /[^a-z0-9]+/g;

export function normalizeJargon(text: string): string {
  return text.toLowerCase().replace(NORMALIZE, ' ').trim();
}

/** Trait-label words: a verdict when pinned on a person. `term` is what `matchingJargonTerm` returns. */
const LABEL_TERMS: readonly { term: string; label: string; third: boolean }[] = [
  // `third`: also a verdict on a real third person. "My friend is an introvert" is a description, not a diagnosis.
  { term: 'introvert', label: String.raw`introvert(?:ed|s)?`, third: false },
  { term: 'extrovert', label: String.raw`extrovert(?:ed|s)?`, third: false },
  { term: 'extravert', label: String.raw`extravert(?:ed|s)?`, third: false },
  { term: 'ambivert', label: String.raw`ambivert(?:ed|s)?`, third: false },
  { term: 'narcissist', label: String.raw`narcissists?|narcissistic`, third: true },
  { term: 'gaslight', label: String.raw`gaslighters?|gaslighting`, third: true },
  { term: 'maladaptive', label: String.raw`maladaptive`, third: false },
];

function labelForms(label: string, third: boolean): RegExp[] {
  return [
    // "you are an introvert", "you're so extroverted", "you come across as a bit of a narcissist".
    new RegExp(`${YOU_ARE}${FILL}(?:${label})(?![-\\w])`, 'i'),
    // "people like you are introverts".
    new RegExp(String.raw`\bpeople like you (?:are|get|tend to be|can be|seem)\s+${FILL}(?:${label})(?![-\w])`, 'i'),
    // "your introverted side is showing", "your narcissist streak wins".
    new RegExp(String.raw`\byour (?:own |inner |classic |usual |old |little |whole )?(?:${label})${YOUR_TAIL}${YOUR_VERB}`, 'i'),
    // "so narcissistic of you".
    new RegExp(String.raw`(?<![-\w])(?:${label})\s+(?:(?:move|thing|behaviou?r)\s+)?of you\b`, 'i'),
    // "As an introvert, you ...": takes it for granted that the reader is one.
    new RegExp(String.raw`\bas (?:an?|the) (?:${label})\b[^.!?]{0,40}\byou\b`, 'i'),
    // A real person who is not the reader: "your boss is a narcissist", "she's an introvert" (clinical labels only in clinical.ts; here the jargon labels).
    ...(third ? thirdPartyVerdictRes(label) : []),
  ];
}

const LABEL_TERM_FORMS = LABEL_TERMS.map((entry) => ({ term: entry.term, res: labelForms(entry.label, entry.third) }));

/** Concept words pinned on the reader: "your love language is...", "that's your inner child". */
const CONCEPT_TERMS: readonly { term: string; word: string }[] = [
  { term: 'love language', word: String.raw`love languages?` },
  { term: 'coping mechanism', word: String.raw`coping mechanisms?` },
  { term: 'inner child', word: String.raw`inner child` },
];

const CONCEPT_FORMS = CONCEPT_TERMS.map((entry) => ({
  term: entry.term,
  res: [
    new RegExp(String.raw`\byour (?:own |primary |main |go-to |usual |old |little |secret )?(?:${entry.word})${YOUR_VERB}`, 'i'),
    new RegExp(String.raw`\byou(?:['’]ve| have| had| use| used| rely on| developed| built| are using|['’]re using)\s+(?:an? |some |the )?(?:\w+ ){0,2}(?:${entry.word})\b`, 'i'),
    new RegExp(String.raw`\b(?:that|this|it)(?:['’]s| is)(?: just| probably| clearly| basically)? (?:your |a |an |the )?(?:${entry.word})\b`, 'i'),
  ],
}));

/** "You gaslight people", "you always gaslight yourself": an accusation of abuse about the reader. */
const GASLIGHT_YOU = /\byou (?:always |keep |just |sometimes |constantly |literally )?gaslight(?:s|ed)?\b/i;

/**
 * Fixed-identity claims about the reader. Not a psychological label, but an unsupported
 * certainty ("never invent certainty"): the sentence says what the reader IS, as a fact.
 */
const IDENTITY_VERDICTS: readonly { term: string; re: RegExp }[] = [
  { term: "that's who you are", re: /\bthat(?:'|’)?s who you are\b/i },
  { term: 'thats who you are', re: /\bthats who you are\b/i },
  { term: 'this is who you are', re: /\bthis is who you are\b/i },
  { term: 'who you are as a person', re: /\bwho you are as a person\b/i },
  { term: 'your personality type', re: /\byour personality type\b/i },
  { term: 'your type', re: /\byour type (?:is|are|means|says|explains|shows|tells)\b/i },
];

/**
 * The first jargon VERDICT in `text`, or null. Reported speech is skipped sentence by
 * sentence (`isReportedSpeech`). The returned string names the term, as before.
 */
export function matchingJargonTerm(text: string | null | undefined): string | null {
  if (!text) return null;
  const normalizedApostrophes = text.replace(/[‘’]/g, "'");
  for (const sentence of normalizedApostrophes.split(/(?<=[.!?])\s+|\n+/)) {
    if (!sentence.trim() || isReportedSpeech(sentence)) continue;
    for (const { term, res } of LABEL_TERM_FORMS) {
      if (res.some((re) => re.test(sentence))) return term;
    }
    for (const { term, res } of CONCEPT_FORMS) {
      if (res.some((re) => re.test(sentence))) return term;
    }
    if (GASLIGHT_YOU.test(sentence)) return 'gaslight';
    for (const { term, re } of IDENTITY_VERDICTS) {
      if (re.test(sentence)) return term;
    }
  }
  // Clinical labels and diagnosis claims (readerLabelHit + third person), named like the old keywords.
  const verdict = labelVerdictHit(normalizedApostrophes);
  if (verdict) {
    if (verdict !== 'diagnosis') return verdict;
    if (/\bdiagnosed\b/i.test(text)) return 'diagnosed';
    if (/\byour diagnosis\b/i.test(text)) return 'your diagnosis';
    return 'a diagnosis';
  }
  return null;
}

export function containsJargon(text: string | null | undefined): boolean {
  return matchingJargonTerm(text) != null;
}

/**
 * Stored / hand-written copy: watched words that appear WITHOUT a verdict, for a human
 * to read ("introverts need rest" lands here, not in a failure). Empty when there is
 * nothing to look at or when the line is already a verdict (that is `matchingJargonTerm`).
 */
export function jargonReviewTerms(text: string | null | undefined): string[] {
  if (!text || matchingJargonTerm(text)) return [];
  const normalized = normalizeJargon(text);
  return JARGON_KEYWORDS.filter((keyword) => normalized.includes(normalizeJargon(keyword)));
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
