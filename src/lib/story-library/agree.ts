/**
 * Subject-verb agreement for story-library lines.
 *
 * The bank stores the base verb ("{Subj} still try"). `speak` fills the
 * pronoun, then this module adds -s for she/he. "Last time" lines are already
 * past tense in the bank and are left alone. "yourself" follows the pronoun
 * so a you-line can keep the reserved phrase "time to yourself".
 */
import type { PronounSet } from './types';

const ADVERBS = new Set([
  'still',
  'also',
  'often',
  'just',
  'really',
  'usually',
  'already',
  'only',
  'sometimes',
  'even',
]);

const MODALS = new Set(['will', 'can', 'could', 'might', 'would', 'may', 'must', 'shall', 'should', 'to', 'did']);

/** Present-tense base verbs that take -s for she/he. Past-only forms stay out. */
const THIRD: Record<string, string> = {
  try: 'tries',
  go: 'goes',
  do: 'does',
  have: 'has',
  stick: 'sticks',
  mix: 'mixes',
  see: 'sees',
  keep: 'keeps',
  plan: 'plans',
  look: 'looks',
  recharge: 'recharges',
  split: 'splits',
  state: 'states',
  weigh: 'weighs',
  shake: 'shakes',
  feel: 'feels',
  let: 'lets',
  stay: 'stays',
  put: 'puts',
  step: 'steps',
  push: 'pushes',
  protect: 'protects',
  follow: 'follows',
  trust: 'trusts',
  doubt: 'doubts',
  need: 'needs',
  want: 'wants',
  treat: 'treats',
  expect: 'expects',
  pause: 'pauses',
  take: 'takes',
  turn: 'turns',
  like: 'likes',
  give: 'gives',
  finish: 'finishes',
  choose: 'chooses',
  leave: 'leaves',
  say: 'says',
  check: 'checks',
};

const BASE = new Set(Object.keys(THIRD));
const THIRD_FORMS = new Set(Object.values(THIRD));

/** Present bases whose past tense is a different word. "split" / "put" / "let" are not here. */
const PRESENT_ONLY = new Set(
  Object.keys(THIRD).filter((verb) => !['split', 'put', 'let'].includes(verb)),
);

function word(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z]/g, '');
}

function finiteAfter(sentence: string, at: number, subject: string): string | null {
  const rest = sentence
    .slice(at + subject.length)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  let index = 0;
  while (index < rest.length && ADVERBS.has(word(rest[index]!))) index += 1;
  const next = rest[index];
  if (!next) return null;
  const verb = word(next);
  if (!verb || MODALS.has(verb)) return null;
  return verb;
}

function conjugateSentence(sentence: string): string {
  if (/^Last time\b/.test(sentence)) return sentence;
  // Stop before the next subject so "she like …, and she turn …" conjugates both verbs.
  return sentence.replace(/\b(She|He|she|he)\b((?:(?!\b(?:She|He|she|he)\b).)*)/g, (chunk: string, subject: string, tail: string) => {
    void chunk;
    const verb = finiteAfter(`${subject}${tail}`, 0, subject);
    if (!verb || !BASE.has(verb)) return `${subject}${tail}`;
    return `${subject}${tail.replace(new RegExp(`\\b${verb}\\b`), THIRD[verb]!)}`;
  });
}

/** Fill -s and the reflexive after the pronoun tokens are already replaced. */
export function agreeSpoken(text: string, pronoun: PronounSet): string {
  let out = text;
  if (pronoun.id === 'she') out = out.replaceAll('yourself', 'herself');
  else if (pronoun.id === 'he') out = out.replaceAll('yourself', 'himself');
  else if (pronoun.id === 'they') out = out.replaceAll('yourself', 'themselves');
  if (pronoun.verbForm !== 's') return out;
  return out
    .split(/(?<=[.?!])\s+/)
    .map((sentence) => conjugateSentence(sentence))
    .join(' ');
}

/**
 * A rendered line that still disagrees. Used by the story-library check on
 * every template, for you / she / he / they. Returns a short reason or null.
 */
export function subjectVerbMismatch(text: string): string | null {
  if (/before you pick one/i.test(text)) return 'before you pick one';
  const sentences = text.split(/(?<=[.?!])\s+/);
  for (const sentence of sentences) {
    const lastTime = /^Last time\b/.test(sentence);
    const subjects = sentence.matchAll(/\b(She|He|You|They|she|he|you|they)\b/g);
    for (const match of subjects) {
      const subject = match[1]!;
      const verb = finiteAfter(sentence, match.index ?? 0, subject);
      if (!verb) continue;
      const lower = subject.toLowerCase();
      const third = lower === 'she' || lower === 'he';
      if (lastTime && third && PRESENT_ONLY.has(verb)) return `past tense ${subject} ${verb}`;
      if (lastTime) continue;
      if (third && BASE.has(verb)) return `${subject} ${verb}`;
      if (!third && THIRD_FORMS.has(verb)) return `${subject} ${verb}`;
    }
    if (/\b(She|He|she|he|They|they)\b/.test(sentence) && /\byourself\b/.test(sentence)) return 'yourself';
    if (/\b(You|you)\b/.test(sentence) && /\b(herself|himself|themselves)\b/.test(sentence)) return 'reflexive';
  }
  return null;
}
