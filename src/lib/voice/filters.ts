import { containsFrameworkTerm } from './framework-fence';
import type { DropReason, VoiceCard } from './types';

const VAGUE_DO_PHRASES = [
  'be productive',
  'do your best',
  'try to',
  'try harder',
  'make sure you',
  'stay focused',
  'get stuff done',
  'get things done',
  'just do it',
  'work hard',
  'be more',
  'do something',
  'maybe',
  'somehow',
  'be better',
  'stay motivated',
];

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
  if (VAGUE_DO_PHRASES.some((phrase) => lower.includes(phrase))) return true;
  return !ACTION_VERBS.some((verb) => lower.includes(verb));
}

/** Phrases that attack the person rather than the habit — always dropped. */
const CRUEL_PHRASES = [
  'you are lazy',
  "you're lazy",
  'lazy person',
  'you are a failure',
  'you failed',
  'worthless',
  'hopeless',
  'a loser',
  'you suck',
  'pathetic',
  'useless',
  "you can't do anything",
  'you never do anything',
  'give up',
  'no point trying',
  'you always fail',
  'you always quit',
  "you're a",
  'you are a',
  'disappointment',
  'embarrassment',
  'what is wrong with you',
];

/** Catches intensified attacks like "you're SO lazy" that substring checks miss. */
const CRUEL_PATTERNS: RegExp[] = [
  /you'?re\s+(?:so|really|just|too|that)\s+lazy/i,
  /you\s+are\s+(?:so|really|just|too|that)\s+lazy/i,
  /you'?re\s+(?:so|really|just|too)\s+(?:a\s+)?(?:failure|loser|disappointment|embarrassment|joke)/i,
  /you\s+are\s+(?:so|really|just|too)\s+(?:a\s+)?(?:failure|loser|disappointment|embarrassment|joke)/i,
];

/** A cut that names a skip is fine; a cut that calls the person worthless is not. */
export function isCruelCut(readText: string): boolean {
  const lower = readText.toLowerCase();
  return CRUEL_PHRASES.some((phrase) => lower.includes(phrase)) || CRUEL_PATTERNS.some((re) => re.test(lower));
}

/**
 * Signals that a read is a cut — i.e. it calls out the USER's skipped habit.
 * Deliberately not bare "skip"/"skips": sage.txt's even×even line ("some did,
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
  /** No cut may be shown after a crisis. */
  crisisToday: boolean;
  /** The last shown card was a cut — no two cuts in a row. */
  previousHadCut: boolean;
}

/** Returns the reason a card must be dropped, or null if it's safe to show. */
export function filterCard(card: VoiceCard, ctx: FilterContext): DropReason | null {
  if (isRepeat(card, ctx.shownCards)) return 'repeat';
  if (isTopicalRepeat(card, ctx.shownCards)) return 'topic-repeat';
  if (isVagueDo(card.do)) return 'vague-do';
  if (isCruelCut(card.read)) return 'cruel-cut';
  if (ctx.crisisToday && hasCut(card.read)) return 'cut-after-crisis';
  if (ctx.previousHadCut && hasCut(card.read)) return 'cut-streak';
  if (containsFrameworkTerm(card.read) || containsFrameworkTerm(card.do) || containsFrameworkTerm(card.nudge)) {
    return 'framework-echo';
  }
  return null;
}
