import { containsFrameworkTerm } from './framework-fence';
import type { DropReason, VoiceCard } from './types';

/**
 * Generic self-help filler that names no concrete action. Applies to a TASK
 * (the Do text) only, because its purpose is "a task must be concrete" — never
 * to an observation, so "maybe it is just Monday" in a Read or an insight is
 * honest uncertainty and passes (core content policy, emci 2026-10-20).
 * Whole-phrase matches only.
 */
const VAGUE_DO_PHRASES = [
  'be productive',
  'do your best',
  'try harder',
  'make sure you',
  'stay focused',
  'get stuff done',
  'get things done',
  'just do it',
  'work hard',
  'do something',
  'somehow',
  'be better',
  'stay motivated',
];

/**
 * Vague only in the shape that carries no action: an opener ("Maybe do
 * something nice", "Be more present") or a "try to" followed by a state, not a
 * deed ("Try to be calm"). "Try to text one friend back before lunch" and
 * "Call your mom, maybe for five minutes" name a concrete action and pass.
 */
const VAGUE_DO_SHAPES: readonly RegExp[] = [
  /(?:^|[.!?]\s+)(?:just\s+)?maybe\b/i,
  /(?:^|[.!?]\s+)(?:just\s+)?be more\b/i,
  /\btry to\s+(?:just\s+)?(?:be|stay|feel|think|relax|focus|remember|do better|get better|improve)\b/i,
];

function phraseIn(lower: string, phrase: string): boolean {
  return new RegExp(`\\b${phrase.replace(/\s+/g, '\\s+')}\\b`).test(lower);
}

const ACTION_VERBS = [
  'write', 'say', 'start', 'open', 'pick', 'knock', 'sit', 'go', 'move',
  'call', 'text', 'send', 'put', 'make', 'turn', 'close', 'set', 'read',
  'give', 'take', 'do', 'finish', 'plan', 'name', 'list', 'walk', 'drink',
  'clear', 'break',
];

/** Generic self-help filler that names no concrete action. */
export function isVagueDo(doText: string): boolean {
  const text = doText.trim();
  const lower = text.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 5) return true;
  if (VAGUE_DO_PHRASES.some((phrase) => phraseIn(lower, phrase))) return true;
  if (VAGUE_DO_SHAPES.some((re) => re.test(text))) return true;
  return !ACTION_VERBS.some((verb) => lower.includes(verb));
}

/**
 * A degrading verdict aimed at the reader (core content policy, emci
 * 2026-10-20: targeted degradation is the problem, not the word). The old list
 * matched substrings with no target ("give up", "useless", "a loser",
 * "you're a"), which rejected "give up the third tab", "a useless umbrella" and
 * "a loser of a wifi signal". The target now has to be the reader.
 * Diagnosis-style labels are clinical.ts's job (`readerLabelHit`), not repeated here.
 */
const DEGRADING =
  '(?:a |an )?(?:lazy(?: person| human)?|worthless|hopeless|useless|pathetic|stupid|dumb|idiot|moron|failure|loser|disappointment|embarrassment|joke|burden|waste of (?:space|time|oxygen))';
const INSULT_NOUN = '(?:idiot|moron|loser|failure|disappointment|embarrassment|waste of (?:space|time|oxygen))';
const CRUEL_PATTERNS: RegExp[] = [
  // "What a loser you are." / "Such an idiot you are." (insult first, reader last).
  new RegExp(`\\b(?:what|such)\\s+(?:a|an)\\s+${INSULT_NOUN}\\s+you(?:['’]re| are| were)\\b`, 'i'),
  // "you are a loser", "you're SO lazy", "you're a total embarrassment", "people like you are useless".
  new RegExp(
    `\\b(?:you(?:['’]re| are| were|['’]ve been| have been)|people like you (?:are|get))\\s+(?:(?:so|really|just|too|that|such|utterly|completely|totally|a total|clearly|honestly|actually|still)\\s+){0,2}${DEGRADING}(?![-\\w])`,
    'i',
  ),
  /\byou suck\b/i,
  /\bwhat is wrong with you\b/i,
  /\byou(?:['’]ve)? failed (?:at everything|everyone|again(?: and again)?|as a (?:person|friend|partner|human))\b/i,
  /\byou (?:can['’]?t|cannot) do anything\b|\byou never do anything\b|\byou always (?:fail|quit)\b/i,
  // Telling the reader to give up on themselves; "give up the third tab" is a different sentence.
  /\bgive up on (?:yourself|you)\b|\b(?:just|might as well|time to|you should|better) give up\b(?!\s+(?:the|a|an|your|on the|on a|on your)\b)/i,
  /\byou give up\s+(?:easily|too (?:soon|easily)|every time|always)\b/i,
  /\bno point (?:in )?(?:you )?trying(?:\s+(?:again|anymore|any more|at this|at all))?\s*(?:[.,;!?]|$)/i,
];

/** A cut that names a skip is fine; a cut that calls the person worthless is not. */
export function isCruelCut(readText: string): boolean {
  return CRUEL_PATTERNS.some((re) => re.test(readText));
}

/**
 * Signals that a read is a cut — i.e. it calls out the USER's skipped habit.
 * Deliberately not bare "skip"/"skips": the old voice file's even×even line ("some did,
 * some skip") describes a normal week and is not a cut.
 */
const CUT_SIGNALS = [
  'two skips', 'three skips', 'couple of skips', 'a few skips', 'few skips',
  'skips in it', 'the skips', 'your skips', 'these skips', 'those skips',
  'skips are', 'skipped', 'missed', "didn't show", 'didn’t show',
  'fell off', 'no show', 'not shown up', 'not a bad stretch', 'not a verdict',
  'broke the streak', 'streak break', 'slip',
];

export function hasCut(readText: string): boolean {
  const lower = readText.toLowerCase();
  return CUT_SIGNALS.some((signal) => lower.includes(signal));
}

export function normalizeForCompare(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function isRepeat(card: VoiceCard, shown: Array<{ read: string; do: string }>): boolean {
  const readN = normalizeForCompare(card.read);
  const doN = normalizeForCompare(card.do);
  return shown.some(
    (s) => normalizeForCompare(s.read) === readN || normalizeForCompare(s.do) === doN,
  );
}

const TOPIC_STOP = new Set([
  'that', 'this', 'with', 'from', 'have', 'been', 'they', 'their', 'them',
  'your', 'just', 'about', 'after', 'before', 'today', 'week', 'days',
  'thing', 'things', 'still', 'really', 'into', 'when', 'what', 'then',
  'than', 'also', 'some', 'most', 'more', 'only', 'even', 'over', 'once',
  'like', 'make', 'made', 'does', 'doing', 'done', 'logged', 'nothing',
  'something', 'pattern', 'worth', 'naming', 'plainly', 'honestly',
  'those', 'these', 'here', 'there', 'were', 'will', 'would', 'could',
  'should', 'again',
]);

/** Content words for topical compare. Short/function words dropped. */
export function contentTokens(text: string): Set<string> {
  return new Set(
    normalizeForCompare(text)
      .split(/\s+/)
      .filter((word) => word.length >= 4 && !TOPIC_STOP.has(word)),
  );
}

/** 0–1 overlap of content words (intersection / smaller set). */
export function topicalOverlap(a: string, b: string): number {
  const left = contentTokens(a);
  const right = contentTokens(b);
  if (left.size === 0 || right.size === 0) return 0;
  let hit = 0;
  for (const token of left) {
    if (right.has(token)) hit += 1;
  }
  return hit / Math.min(left.size, right.size);
}

const TOPIC_REPEAT_THRESHOLD = 0.5;

/**
 * Same angle, different wording — the exact-string gate misses this.
 * Compares Read only: Dos all share the morning-cue prefix.
 */
export function isTopicalRepeat(
  card: VoiceCard,
  shown: Array<{ read: string; do: string }>,
): boolean {
  return shown.some((prior) => topicalOverlap(card.read, prior.read) >= TOPIC_REPEAT_THRESHOLD);
}

export interface FilterContext {
  /** Cards already shown (previous checks + the prior bank day), to drop repeats. */
  shownCards: Array<{ read: string; do: string }>;
  /** The last shown card was a cut — no two cuts in a row. */
  previousHadCut: boolean;
}

/** Returns the reason a card must be dropped, or null if it's safe to show. */
export function filterCard(card: VoiceCard, ctx: FilterContext): DropReason | null {
  if (isRepeat(card, ctx.shownCards)) return 'repeat';
  if (isTopicalRepeat(card, ctx.shownCards)) return 'topic-repeat';
  if (isVagueDo(card.do)) return 'vague-do';
  if (isCruelCut(card.read)) return 'cruel-cut';
  if (ctx.previousHadCut && hasCut(card.read)) return 'cut-streak';
  if (containsFrameworkTerm(card.read) || containsFrameworkTerm(card.do) || containsFrameworkTerm(card.nudge)) {
    return 'framework-echo';
  }
  return null;
}
