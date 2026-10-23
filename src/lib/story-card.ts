/**
 * The Story as a swipe card (emci, 2026-10-13 redesign). Same one call, same
 * claim, same thread picker — the answer is six beats plus a nickname title:
 *
 *   hook       — cold open, mid-action
 *   twist      — it gets worse; one spoken line allowed
 *   move       — what the reader does (the trait, shown)
 *   punchline  — callback to the hook
 *   reveal     — one flattering trait line
 *   next       — cliffhanger statement
 *   title      — memorable nickname ("The Bread Basket Diplomat")
 *   otherWay   — optional Plot B, behind a tap
 *
 * v: 2 on every new card. Stories saved before this keep their v1
 * scene/moment/means parts and still render until a lazy rewrite lands.
 */
import { AXIS_POLE_NAME, AXIS_SHORT_NAME } from '@/lib/axis-poles';
import { getCategoryDefs } from '@/lib/categories';
import { CATEGORY_DISPLAY_NAMES } from '@/lib/category-labels';
import { TRAIT_AXES } from '@/lib/traits';
import {
  jokeCrossesBoundary,
  pickBestPunchline,
  punchlineCraftViolation,
  storyClicheViolation,
} from '@/lib/voice/card-joke';
import { CLINICAL_ADVICE, hasClinicalLabel } from '@/lib/voice/clinical';
import { directiveAdviceViolation } from '@/lib/voice/directive-advice';
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';

export const STORY_CARD_VERSION = 2 as const;

export type StoryScriptLine =
  | { kind: 'narrator'; text: string }
  | { kind: 'dialogue'; speaker: string; text: string };

export interface StoryCard {
  /** 3 = script templates. 2 = six-beat redesign. Missing / 1 = labelled card. */
  v?: 1 | 2 | 3;
  title: string | null;
  /** v2/v3 beats (v3 also has `lines` + `settingTag`). */
  hook?: string;
  twist?: string;
  move?: string;
  punchline?: string;
  reveal?: string;
  next?: string | null;
  /** Optional Plot B, behind a tap. */
  otherWay?: string | null;
  /** v3 script header: "Café. 7:02 PM. Friday." */
  settingTag?: string;
  lines?: {
    hook: StoryScriptLine[];
    twist: StoryScriptLine[];
    move: StoryScriptLine[];
    punchline: StoryScriptLine[];
  };
  card6?: {
    categoryName: string;
    leanPhrase: string;
    scoreLine?: string;
    evidence: string;
    tip: string;
  };
  romance?: boolean;
  topicId?: string;
  jokeLight?: { beat: string; line: number };
  jokeDark?: { beat: string; line: number };
  jokeDarkSecondary?: { beat: string; line: number };
  /** v1 parts (kept so old saved cards still read). */
  scene?: string;
  moment?: string;
  handle?: string | null;
  means?: string;
  joke?: string | null;
  noticed?: string | null;
  nextTime?: string | null;
  /** Pre-written bank vs a model vs a v3 template. Bank/template skip the AI badge. */
  source?: 'ai' | 'bank' | 'template';
  /** Hand-written bank id, when source is bank (so the next pick can skip it). */
  bankId?: string;
}

export const STORY_HOOK_WORDS = [8, 18] as const;
export const STORY_TWIST_WORDS = [12, 30] as const;
export const STORY_MOVE_WORDS = [15, 35] as const;
export const STORY_PUNCHLINE_WORDS = [6, 20] as const;
export const STORY_REVEAL_WORDS = [6, 14] as const;
export const STORY_NEXT_WORDS = [4, 12] as const;
export const STORY_TITLE_WORDS = [2, 5] as const;
export const STORY_TITLE_MAX_CHARS = 40;
export const STORY_OTHER_WAY_WORDS = [10, 35] as const;
export const STORY_OUTPUT_TOKENS = 800;

/** v1 limits — still used to read older saved cards, never to write new ones. */
export const STORY_NOTICED_WORDS = [10, 35] as const;
export const STORY_SCENE_WORDS = [12, 45] as const;
export const STORY_MOMENT_WORDS = [12, 45] as const;
export const STORY_HANDLE_WORDS = [10, 40] as const;
export const STORY_MEANS_WORDS = [15, 45] as const;

/** Every trait and category word that must never appear in the story text. */
const LABEL_WORDS: readonly string[] = [
  ...TRAIT_AXES.flatMap((axis) => [AXIS_POLE_NAME[axis].high, AXIS_POLE_NAME[axis].low, AXIS_SHORT_NAME[axis]]),
];

/**
 * Labels applied to the reader, not vocabulary (emci 2026-10-19, round 3:
 * src/lib/voice/clinical.ts). Everyday and contextual words pass ("a toxic
 * group chat", "trauma-bonded by a bad haircut", "the group chat needs therapy").
 * Refused: a label or diagnosis pinned on the reader ("Your avoidant attachment
 * kicks in", "That is so bipolar of you"), any diagnosis claim, and clinical
 * advice (get therapy, stop your meds). The theory name "attachment style" is a
 * framework term (framework-fence).
 */
const CLINICAL = {
  test: (text: string): boolean => hasClinicalLabel(text) || CLINICAL_ADVICE.test(text),
};

const GENERIC_CAPS = new Set([
  'Mom',
  'Dad',
  'Grandma',
  'Grandpa',
  'Nana',
  'Papa',
  'Uncle',
  'Aunt',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]);

/**
 * A trait or category label leaked into the text: "your Accountable side",
 * a capitalised trait word mid-sentence ("the Steady one"), a short trait
 * name used as a label, or a category name (catalog or friendly). Plain
 * lowercase use of an everyday word ("a quiet café") is fine.
 */
export function storyLabelLeak(text: string): string | null {
  const lower = text.toLowerCase();
  for (const word of LABEL_WORDS) {
    const w = word.toLowerCase().replace(/[-]/g, '[- ]');
    if (new RegExp(`\\b(your|the|their|that)\\s+${w}\\s+side\\b`).test(lower)) return `side label`;
    if (new RegExp(`(?<![.?:;]\\s)(?<!^)\\b${word.replace(/-/g, '-')}\\b`).test(text)) return 'capitalised trait word';
  }
  for (const name of Object.values(CATEGORY_DISPLAY_NAMES)) {
    if (text.includes(name)) return 'names a category';
  }
  for (const name of getCategoryDefs().map((def) => def.name)) {
    if (/[\s/&]/.test(name)) {
      if (lower.includes(name.toLowerCase())) return 'names a category';
    } else if (new RegExp(`(?<![.?:;]\\s)(?<!^)\\b${name}\\b`).test(text)) {
      return 'names a category';
    }
  }
  return null;
}

function properNameLeak(text: string): string | null {
  const re = /(^|[.?:;][”"’)]?\s+|\n\s*|[“"(—–-]\s*)?(?<![\p{L}’'])(\p{Lu}[\p{L}’'-]*)/gu;
  for (const m of text.matchAll(re)) {
    const word = m[2]!;
    const sentenceStart = m[1] != null || m.index === 0;
    if (sentenceStart) continue;
    if (word === 'I' || GENERIC_CAPS.has(word)) continue;
    return `proper name: ${word}`;
  }
  return null;
}

export function quotedLineCount(text: string): number {
  return (text.match(/[“"]([^”"]+)[”"]/g) ?? []).length;
}

/** One story line: safety + voice, with numbers, one quote, and unnamed side characters allowed. */
export function storyCardLineViolation(text: string, opts: { allowYouAre?: boolean } = {}): string | null {
  if (jokeCrossesBoundary(text)) return 'crosses a boundary';
  // Core content policy (2026-10-20): voice notes, read receipts and typing bubbles are
  // preferred moments in moment-voice.ts, so they are no longer rejected here.
  if (/!/.test(text)) return 'exclamation';
  if (/[[\]<>]/.test(text)) return 'template left in';
  if (/\p{Extended_Pictographic}/u.test(text)) return 'emoji';
  if (/\balways\b/i.test(text)) return 'always';
  if (!opts.allowYouAre && /\byou(?:'|’)?re\b|\byou are\b/i.test(text)) return 'you are';
  if (directiveAdviceViolation(text)) return 'advice';
  if (CLINICAL.test(text)) return 'clinical word';
  if (/\byou might\b/i.test(text)) return 'hedge';
  if (/\bon a day like this\b/i.test(text)) return 'hedge';
  const cliche = storyClicheViolation(text);
  if (cliche) return cliche;
  const leak = storyLabelLeak(text);
  if (leak) return leak;
  if (containsFrameworkTerm(text)) return 'framework term';
  return properNameLeak(text);
}

/** Share of `a`'s content words (5+ letters) that also appear in `b`. */
export function storyOverlap(a: string, b: string): number {
  const bag = (text: string) => new Set((text.toLowerCase().match(/[a-z]{5,}/g) ?? []).map((w) => w.slice(0, 6)));
  const left = bag(a);
  if (left.size === 0) return 0;
  const right = bag(b);
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / left.size;
}

/** Above this, one beat is a repeat of another and the card is rejected. */
export const STORY_REPEAT_LIMIT = 0.5;
/** Hook vs the last few stories (or the few-shots): too similar, try again. */
export const STORY_HOOK_VARIETY_LIMIT = 0.6;

export function storyTitleViolation(title: string): string | null {
  const t = title.trim();
  if (t.length > STORY_TITLE_MAX_CHARS) return 'title: too long';
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length < STORY_TITLE_WORDS[0] || parts.length > STORY_TITLE_WORDS[1]) return 'title: length';
  if (!parts.every((p) => /^[A-Z][A-Za-z'’-]*$/.test(p))) return 'title: shape';
  if (
    /\b(Anxi|Worr|Lonel|Alone|Sad|Fear|Struggl|Broken|Overthink|Doubt|Nerv|Insecur|Clingy|Needy|Lost|Fragile|Timid|Shy|Avoidant|Attach)/.test(
      t,
    )
  ) {
    return 'title: tone';
  }
  return storyLabelLeak(t);
}

export interface StoryFewShot {
  title: string;
  hook: string;
  twist: string;
  move: string;
  punchline: string;
  reveal: string;
  next: string;
}

/** Three few-shots from the approved redesign. Match the energy, never the content. */
export const STORY_FEW_SHOTS: readonly StoryFewShot[] = [
  {
    title: 'The Bread Basket Diplomat',
    hook: 'Friday, 8:40. Your table has been staring at the kitchen door like it owes them money.',
    twist: 'The server arrives empty-handed. "So the kitchen lost your slip." Your friend\'s eye starts to twitch. Someone opens a delivery app under the table.',
    move: 'You slide the bread basket to the middle like a peace treaty, order whatever is fastest plus fries for the hostages, and start a ranking of everyone\'s worst-ever restaurant disaster.',
    punchline: 'By the time the food lands, nobody wants it. They want round two of the rankings. And more bread.',
    reveal: 'When plans break, you quietly turn the delay into the good part.',
    next: 'Next time: you\'re first at the cinema. Your friends are not.',
  },
  {
    title: 'The Spreadsheet Whisperer',
    hook: 'The projector cuts out four minutes before the client walks in.',
    twist: 'Your boss mouths "slides?" across the room. The backup laptop asks for an update. All 212 of them.',
    move: 'You already printed the deck just in case. You hand out copies still warm from the printer and run the meeting like it was meant to be paper.',
    punchline: 'The client asks if printed decks are new. Your boss has never said yes faster.',
    reveal: 'Your just in case is the room\'s rescue.',
    next: 'Next: a group trip, and you\'re not the one planning it.',
  },
  {
    title: 'The Detour Captain',
    hook: 'The hardware store is closed. The sign says back in 10 and it is clearly been weeks.',
    twist: 'Your sibling wants to go home. The shelf you promised Mom is still in pieces in the trunk. "We are not driving across town," they say.',
    move: 'You turn toward the flea market. Twenty minutes later you haggle for a vintage drill with a man named only by his hat.',
    punchline: 'The shelf goes up crooked. Mom loves it. She loves the hat guy\'s drill more.',
    reveal: 'A closed door just looks like a side quest to you.',
    next: 'Next time: someone else picks the restaurant. Brave.',
  },
];

export function words(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function within(text: string, [min, max]: readonly [number, number]): boolean {
  const n = words(text);
  return n >= min && n <= max;
}

export function isStoryV2(card: Pick<StoryCard, 'v' | 'hook' | 'twist' | 'move' | 'punchline' | 'reveal'>): boolean {
  return card.v === 2 && !!(card.hook && card.twist && card.move && card.punchline && card.reveal);
}

export function isStoryV3(card: Pick<StoryCard, 'v' | 'settingTag' | 'lines' | 'hook'>): boolean {
  return card.v === 3 && !!(card.settingTag && (card.lines?.hook?.length || card.hook));
}

export interface StoryCardResult {
  card: StoryCard | null;
  /** Why it was rejected (reason only, for the log). */
  reason: string | null;
}

function beatsOverlap(parts: readonly string[]): string | null {
  for (let i = 0; i < parts.length; i += 1) {
    for (let j = i + 1; j < parts.length; j += 1) {
      if (storyOverlap(parts[i]!, parts[j]!) > STORY_REPEAT_LIMIT) return 'repeat';
    }
  }
  return null;
}

/**
 * Parse + check the model's answer. Core v2 beats must pass or it is rejected
 * (one retry). otherWay is dropped when it fails. Punchline candidates are
 * reranked locally.
 */
export function parseStoryCardAnswer(
  raw: string,
  opts: { jokeAsked?: boolean; recentHooks?: readonly string[]; allowExampleHooks?: boolean } = {},
): StoryCardResult {
  const reject = (reason: string): StoryCardResult => ({ card: null, reason });
  let data: unknown;
  try {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) return reject('not json');
    data = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return reject('not json');
  }
  if (typeof data !== 'object' || data == null) return reject('not an object');
  const obj = data as Record<string, unknown>;

  const required = {
    hook: STORY_HOOK_WORDS,
    twist: STORY_TWIST_WORDS,
    move: STORY_MOVE_WORDS,
    reveal: STORY_REVEAL_WORDS,
  } as const;
  const core: Record<keyof typeof required, string> = { hook: '', twist: '', move: '', reveal: '' };
  for (const key of Object.keys(required) as (keyof typeof required)[]) {
    const value = obj[key];
    if (typeof value !== 'string') return reject(`${key} missing`);
    const line = value.trim();
    if (!within(line, required[key])) return reject(`${key}: length`);
    const bad = storyCardLineViolation(line, { allowYouAre: key === 'reveal' });
    if (bad) return reject(`${key}: ${bad}`);
    core[key] = line;
  }

  if (typeof obj.title !== 'string') return reject('title missing');
  const title = obj.title.trim();
  const titleBad = storyTitleViolation(title);
  if (titleBad) return reject(titleBad);

  const candidatePunchlines: string[] = [];
  if (typeof obj.punchline === 'string' && obj.punchline.trim()) candidatePunchlines.push(obj.punchline.trim());
  if (Array.isArray(obj.punchlines)) {
    for (const item of obj.punchlines) {
      if (typeof item === 'string' && item.trim()) candidatePunchlines.push(item.trim());
    }
  }
  const punchline = pickBestPunchline(candidatePunchlines, core, (line) => {
    if (!within(line, STORY_PUNCHLINE_WORDS)) return false;
    if (storyCardLineViolation(line)) return false;
    if (punchlineCraftViolation(line)) return false;
    return true;
  });
  if (!punchline) return reject('punchline');

  const optional = (value: unknown, limit: readonly [number, number], allowYouAre = false): string | null => {
    if (typeof value !== 'string') return null;
    const line = value.trim();
    return within(line, limit) && !storyCardLineViolation(line, { allowYouAre }) ? line : null;
  };
  const nextRaw = optional(obj.next, STORY_NEXT_WORDS, true);
  const next = nextRaw && !/\?$/.test(nextRaw) ? nextRaw : null;
  const otherWay = optional(obj.otherWay, STORY_OTHER_WAY_WORDS);

  const allBeats = [core.hook, core.twist, core.move, punchline, core.reveal, next, otherWay].filter(
    (part): part is string => !!part,
  );
  if (quotedLineCount(allBeats.join('\n')) > 1) return reject('too many quotes');
  const overlap = beatsOverlap(allBeats);
  if (overlap) return reject(overlap);

  const recent = [
    ...(opts.recentHooks ?? []),
    ...(opts.allowExampleHooks ? [] : STORY_FEW_SHOTS.map((row) => row.hook)),
  ];
  if (recent.some((hook) => storyOverlap(core.hook, hook) >= STORY_HOOK_VARIETY_LIMIT)) {
    return reject('hook: too similar');
  }

  return {
    card: {
      v: STORY_CARD_VERSION,
      title,
      hook: core.hook,
      twist: core.twist,
      move: core.move,
      punchline,
      reveal: core.reveal,
      next,
      otherWay,
      source: 'ai',
    },
    reason: null,
  };
}

/** The card as one block, for older readers of `story.body` (Explore, Rolls). */
export function storyCardBody(card: StoryCard): string {
  if (isStoryV3(card) && card.lines) {
    const texts = [...card.lines.hook, ...card.lines.twist, ...card.lines.move, ...card.lines.punchline].map((line) =>
      line.kind === 'dialogue' ? line.text : line.text,
    );
    return [...texts, card.reveal, card.next].filter(Boolean).join(' ');
  }
  if (isStoryV2(card) || isStoryV3(card)) {
    return [card.hook, card.twist, card.move, card.punchline, card.reveal, card.next].filter(Boolean).join(' ');
  }
  return [card.scene, card.moment, card.handle, card.means].filter(Boolean).join(' ');
}

function s(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/** Loose read of a saved card (v1 or v2). */
export function parseStoredStoryCard(raw: unknown): StoryCard | null {
  if (typeof raw !== 'object' || raw == null) return null;
  const obj = raw as Record<string, unknown>;
  const hook = s(obj.hook);
  const twist = s(obj.twist);
  const move = s(obj.move);
  const punchline = s(obj.punchline);
  const reveal = s(obj.reveal);
  if (obj.v === 3 || (obj.v === 2 && hook && twist && move && punchline && reveal) || (hook && twist && move && punchline && reveal)) {
    if (!hook || !twist || !move || !punchline || !reveal) return null;
    const source = obj.source === 'bank' ? 'bank' : obj.source === 'template' ? 'template' : 'ai';
    const lines = obj.lines && typeof obj.lines === 'object' ? (obj.lines as StoryCard['lines']) : undefined;
    const card6 = obj.card6 && typeof obj.card6 === 'object' ? (obj.card6 as StoryCard['card6']) : undefined;
    return {
      v: obj.v === 3 ? 3 : 2,
      title: s(obj.title),
      hook,
      twist,
      move,
      punchline,
      reveal,
      next: s(obj.next),
      otherWay: s(obj.otherWay),
      settingTag: s(obj.settingTag) ?? undefined,
      ...(lines ? { lines } : {}),
      ...(card6 ? { card6 } : {}),
      source,
      ...(typeof obj.bankId === 'string' && obj.bankId.trim() ? { bankId: obj.bankId.trim() } : {}),
      ...(typeof obj.topicId === 'string' ? { topicId: obj.topicId } : {}),
      ...(obj.romance === true ? { romance: true } : {}),
    };
  }
  const scene = s(obj.scene);
  const moment = s(obj.moment);
  const means = s(obj.means);
  if (!scene || !moment || !means) return null;
  return {
    v: 1,
    title: s(obj.title),
    scene,
    moment,
    handle: s(obj.handle),
    means,
    joke: s(obj.joke),
    noticed: s(obj.noticed),
    otherWay: s(obj.otherWay),
    nextTime: s(obj.nextTime),
  };
}
