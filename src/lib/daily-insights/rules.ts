/**
 * Copy rules for the daily-insights banks (docs/daily-insights/README.md).
 * Run by check:daily-insights-bank over every stored line, and by the picker
 * over the composed "Why you" line. Pure — no React Native, no network.
 */
import {
  STORY_CLINICAL_CARD6,
  STORY_GENDERED_PRONOUNS,
  STORY_ROMANCE_LABELS,
} from '@/lib/story-v3/banned';
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';

/** Rule 1 — "you" only. Extends the story lists with the extra words. */
const EXTRA_GENDERED = /\b(man|woman|men|women|guy|guys|girl|girls)\b/i;
/** Rule 4 — no claims of measured ability. */
const ABILITY_CLAIMS = /\b(gifted|genius|iq|talent score|you are the best)\b/i;
/** Rule 5 — no clinical or medical advice. */
const CLINICAL_EXTRA = /\b(therapy|therapist|diagnos\w*|medication|anxiety attack)\b/i;
/** Rule 6 — dark humour stays gentle. */
const DARK_BANNED = /\b(die|dies|died|dying|dead|death|kill|kills|killed|suicide|suicidal|funeral)\b/i;
/** Rule 10 — safety: no money, driving, alcohol, quitting or exes. */
const SAFETY_BANNED = /\b(drunk|shot|shots|bet|bets|quit|ex|alcohol|driving|gamble|money)\b/i;

export const INSIGHT_LINE_MAX_WORDS = 20;
export const INSIGHT_SUB_MAX_WORDS = 16;
export const INSIGHT_TITLE_MAX_WORDS = 4;
export const WHY_LINE_MAX_WORDS = 22;

export function wordCount(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((token) => /[A-Za-z0-9]/.test(token)).length;
}

/**
 * Every violation in one user-facing string (empty = clean). `maxWords: null`
 * skips the length rule.
 */
export function validateInsightLine(text: string, opts: { maxWords: number | null }): string[] {
  const out: string[] = [];
  if (!text.trim()) out.push('empty');
  if (opts.maxWords != null && wordCount(text) > opts.maxWords) {
    out.push(`over ${opts.maxWords} words (${wordCount(text)})`);
  }
  if (STORY_GENDERED_PRONOUNS.test(text) || STORY_ROMANCE_LABELS.test(text) || EXTRA_GENDERED.test(text)) {
    out.push('gendered word');
  }
  if (containsFrameworkTerm(text)) out.push('framework term');
  if (ABILITY_CLAIMS.test(text)) out.push('ability claim');
  if (STORY_CLINICAL_CARD6.test(text) || CLINICAL_EXTRA.test(text)) out.push('clinical word');
  if (DARK_BANNED.test(text)) out.push('banned dark word');
  if (SAFETY_BANNED.test(text)) out.push('safety word');
  if ((text.match(/!/g) ?? []).length > 1) out.push('more than one exclamation mark');
  return out;
}

/** Sentence-case title: first letter capital, later words lower (bar "I"). */
export function titleViolation(title: string): string | null {
  if (wordCount(title) > INSIGHT_TITLE_MAX_WORDS) return `title over ${INSIGHT_TITLE_MAX_WORDS} words`;
  const words = title.trim().split(/\s+/);
  if (!/^[A-Z]/.test(words[0] ?? '')) return 'title must start with a capital';
  for (const word of words.slice(1)) {
    if (/^[A-Z]/.test(word) && word !== 'I') return `title not sentence case ("${word}")`;
  }
  return null;
}

/** Split into sentences and normalize, for the duplicate tag-phrase rule. */
export function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.!?:])\s+/)
    .map((s) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9' ]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean);
}

/** Sentences of 2+ words that appear in more than one string of a bank. */
export function duplicateSentences(texts: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const text of texts) {
    for (const sentence of new Set(sentencesOf(text))) {
      if (sentence.split(' ').length < 2) continue;
      counts.set(sentence, (counts.get(sentence) ?? 0) + 1);
    }
  }
  return [...counts.entries()].filter(([, n]) => n > 1).map(([s]) => s);
}

/** Rule 11 — one apostrophe style across a bank. */
export function mixedApostrophes(texts: readonly string[]): boolean {
  const joined = texts.join(' ');
  return joined.includes("'") && joined.includes('’');
}
