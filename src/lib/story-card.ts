/**
 * The Story as a card (emci, 2026-10-09: "reformat it so it's like how legends
 * and categorize deep dive are"). Same ONE call, same claim, same thread
 * picker — the answer is parts instead of one block:
 *
 *   title    — "the calm fixer" (shared title rules)
 *   scene    — one ordinary setting
 *   moment   — where the two sides meet
 *   handle   — how the person tends to handle it (optional)
 *   means    — what it means for them, plain and kind
 *   joke     — the Story's one joke line (its named exception), optional
 *
 * Why the rebuild: the one 90–160-word block mixed three voices, read as a
 * jumble, and trait words ("your Accountable side") leaked through because
 * only category names were checked. Now every part is checked, no trait or
 * category word may appear (`storyLabelLeak`), and optional parts that fail
 * are dropped instead of paid for twice. The traits behind it show as a
 * "Built from" label on the card, never in the text.
 *
 * Stories saved before this keep their `body` and render as before.
 */
import { AXIS_POLE_NAME, AXIS_SHORT_NAME } from '@/lib/axis-poles';
import { getCategoryDefs } from '@/lib/categories';
import { pickCategoryCard } from '@/lib/category-bank';
import { diveLineViolation } from '@/lib/category-deep-dive/dive';
import { CATEGORY_DISPLAY_NAMES } from '@/lib/category-labels';
import { titleViolation } from '@/lib/legend-figures/story';
import { localYmd } from '@/lib/local-date';
import type { StoryThread } from '@/lib/story-thread';
import type { TraitTrack } from '@/lib/trait-stability';
import { TRAIT_AXES, type TraitAxis, type TraitLean } from '@/lib/traits';
import { cardJokeViolation, jokeHasBannedTopic } from '@/lib/voice/card-joke';
import { MOMENT_VOICE_BLOCK, STORY_JOKE_RULES } from '@/lib/voice/moment-voice';

export interface StoryCard {
  title: string | null;
  scene: string;
  moment: string;
  handle: string | null;
  means: string;
  joke: string | null;
  /** Deeper Story (emci 2026-10-09), all optional: what the others noticed, */
  noticed?: string | null;
  /** how the reader's other side would have played the same moment, */
  otherWay?: string | null;
  /** and a teaser for the next story. */
  nextTime?: string | null;
}

export const STORY_NOTICED_WORDS = [10, 35] as const;
export const STORY_OTHER_WAY_WORDS = [12, 40] as const;
export const STORY_NEXT_WORDS = [5, 20] as const;
export const STORY_SCENE_WORDS = [12, 45] as const;
export const STORY_MOMENT_WORDS = [12, 45] as const;
export const STORY_HANDLE_WORDS = [10, 40] as const;
export const STORY_MEANS_WORDS = [15, 45] as const;

/** Every trait and category word that must never appear in the story text. */
const LABEL_WORDS: readonly string[] = [
  ...TRAIT_AXES.flatMap((axis) => [AXIS_POLE_NAME[axis].high, AXIS_POLE_NAME[axis].low, AXIS_SHORT_NAME[axis]]),
];

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
  // Friendly names ("How You Love", "When Things Get Hard") are everyday phrases in
  // lowercase, so only their title-case form counts as a label.
  for (const name of Object.values(CATEGORY_DISPLAY_NAMES)) {
    if (text.includes(name)) return 'names a category';
  }
  for (const name of getCategoryDefs().map((def) => def.name)) {
    if (/[\s/&]/.test(name)) {
      // Catalog multi-word names ("Openness to life", "Love / closeness") are never everyday phrases.
      if (lower.includes(name.toLowerCase())) return 'names a category';
    } else if (new RegExp(`(?<![.?:;]\\s)(?<!^)\\b${name}\\b`).test(text)) {
      // Single words ("Drive", "Levity") only as a capitalised label mid-sentence, so "drive" stays allowed.
      return 'names a category';
    }
  }
  return null;
}

/** One story line: the deep-dive line rules (no names, no counting, no clinical
 * words, no advice), the Story's banned topics, and no trait/category labels. */
export function storyCardLineViolation(text: string): string | null {
  if (jokeHasBannedTopic(text)) return 'banned topic';
  // Niche phone details most people don't use or picture (emci, 2026-10-09).
  if (/\b(voice ?notes?|voice ?memos?|voicemails?|typing bubbles?|grey bubbles?|gray bubbles?|read receipts?)\b/i.test(text)) {
    return 'niche phone detail';
  }
  return storyLabelLeak(text) ?? diveLineViolation(text, '');
}

/** Share of `a`'s content words (5+ letters) that also appear in `b` — a part
 * that mostly repeats the one before it adds nothing to the story. */
export function storyOverlap(a: string, b: string): number {
  const bag = (text: string) => new Set((text.toLowerCase().match(/[a-z]{5,}/g) ?? []).map((w) => w.slice(0, 6)));
  const left = bag(a);
  if (left.size === 0) return 0;
  const right = bag(b);
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / left.size;
}

/** Above this, "how you handle it" is a repeat of "the moment" and is dropped. */
export const STORY_REPEAT_LIMIT = 0.5;

/** The byte-identical opening of every Story prompt (cache-friendly). */
export const STORY_CARD_PROMPT_STATIC = `Write as Sage in the ATO app. Not a doctor. This is The Story: ONE ordinary day, ONE setting, the same people
throughout, told as a short card in parts. The SIDES at the end say what to draw on; write from their meaning, never
their labels.

${MOMENT_VOICE_BLOCK}

RULES
- Second person ("you", "your"). A typical day, never a claimed event ("on a day like this", "you might").
- Never "you are", never "always", no "!", no emoji, no advice, no "should".
- Never name a trait, a category or a side, and never print any word listed in the SIDES (no "your Steady side").
  The one exception is the title, which may use a plain describing word.
- Use no quotation marks, and name no people, apps, brands or places.
- No counting and no exaggeration: never a number or a number word above two. Say "a few", "a couple" or nothing.
- Stay in the one setting: no second scene, no new set of people.
- Never leave square or angle brackets in the answer.

STYLE — CLEAR FIRST, MOMENT SECOND (this overrides "Describe the moment and stop" above, and the counts in the
register examples there are exactly what NOT to do here):
- Each part is short and plain, like a smart friend texting you what they noticed. Nobody should reread it to get it.
- Realistic everyday detail (the kind that happens every week), never a strange one-off scene or a riddle.
- A quiet or low side is a style with an upside, never a weakness.

SETTING (emci, 2026-10-09; this overrides the "how people live now" list in the VOICE block above — texts,
voice notes, typing bubbles and read receipts are NOT the default setting here)
- Pick a situation almost every adult knows: a plan with friends, a task at work, a weekend errand, a family visit,
  a shared chore, a busy commute. A phone can be a detail, but never voice notes, typing bubbles or read receipts.
- Keep it literal and easy to picture. If a detail needs explaining, cut it.

FLOW — ONE STORY, NOT SEPARATE BOXES (plan first, then write; every part follows from the one before)
"plan" — write this FIRST, four short lines, not shown to the reader:
  1. Situation: who is there and what needs to happen.
  2. Tension: what complicates it, in a way that tests SIDE A (and pulls against SIDE B, if there is one).
  3. Choice: what the reader does about it, and what happens because of it.
  4. Payoff: what that shows about them.
Then write the parts from the plan, in order:
"scene" — ${STORY_SCENE_WORDS[0]}–${STORY_SCENE_WORDS[1]} words: the situation (plan line 1). Who, where, and what needs to happen.
"moment" — ${STORY_MOMENT_WORDS[0]}–${STORY_MOMENT_WORDS[1]} words: the tension (plan line 2). It must grow out of the scene, and it is something that
  happens, not something the reader thinks about.
"handle" — ${STORY_HANDLE_WORDS[0]}–${STORY_HANDLE_WORDS[1]} words: the choice (plan line 3): the NEXT thing the reader does and what happens because of it
  ("you might", "usually"). Never repeat an action or phrase from "moment". If a TOLD-VS-PLAYED note is given, you may fold
  it in here, warmly, with no winner.
"means" — ${STORY_MEANS_WORDS[0]}–${STORY_MEANS_WORDS[1]} words: the payoff (plan line 4): one plain, kind line on what that choice says about the reader.
  Only this part explains.
"joke" — only when a JOKE TARGET is given. Exactly one sentence that CALLS BACK to one concrete detail from the scene
  (the best jokes land on something the reader already saw). It must make sense to someone who just read the story.
${STORY_JOKE_RULES}
"title" — written LAST: two to four lowercase words, starting with "the", that describe the reader plainly, the way a
  friend would sum them up after hearing this story: a kind describing word plus a role word (shape only: "the
  [describing word] [role]"). Someone who never read the story should still get it. No metaphors or objects
  ("the open door"), never about worry, doubt, loneliness or struggle.

"noticed" — ${STORY_NOTICED_WORDS[0]}–${STORY_NOTICED_WORDS[1]} words: what the other people in the scene probably noticed about the reader in that
  moment. Kind and specific, from their side.
"otherWay" — ${STORY_OTHER_WAY_WORDS[0]}–${STORY_OTHER_WAY_WORDS[1]} words: how the same moment might have gone if the reader had leaned the other way
  (the OTHER WAY given at the end). Interesting, never better or worse; no labels.
"nextTime" — ${STORY_NEXT_WORDS[0]}–${STORY_NEXT_WORDS[1]} words, one short question that teases a different everyday moment for the next story.

Return JSON only, exactly this shape:
{"plan": "<four short lines>", "scene": "...", "moment": "...", "handle": "...", "noticed": "...", "otherWay": "...", "means": "...", "joke": "<one sentence>", "nextTime": "<a question>", "title": "<the ...>"}`;

/** One side of a Story, ready for the prompt: its lead lean and its stored lines. */
export interface StoryPromptSide {
  lead: { axis: TraitAxis; lean: TraitLean } | null;
  card: { summary: string; strength: string; watchOut: string } | null;
}

/**
 * The Story prompt from its parts (the shared library builds it from a bucket
 * key on the server, wave93). The told-vs-played line is NOT in it any more:
 * it is personal, so the phone shows it under the card instead.
 */
export function buildStoryPromptFromSides(input: {
  sides: readonly StoryPromptSide[];
  jokeTarget: { axis: TraitAxis; lean: TraitLean } | null;
  /** Shared library: the everyday setting this card is told in. */
  setting?: string | null;
}): string {
  const sides = input.sides.map((row, index) => {
    const label = index === 0 ? 'SIDE A' : 'SIDE B';
    const bits = [
      row.lead ? `- Lead lean, in one word (never print it): ${AXIS_POLE_NAME[row.lead.axis][row.lead.lean]}` : null,
      row.card ? `- How it tends to show: ${row.card.summary}` : null,
      row.card ? `- What it does well: ${row.card.strength}` : null,
      row.card ? `- Where it can catch: ${row.card.watchOut}` : null,
    ].filter((line): line is string => line != null);
    return `${label} (internal; never name it)\n${bits.join('\n') || '- (no stored lines)'}`;
  });
  const jokeTarget = input.jokeTarget;
  const otherWay = input.sides[0]?.lead ?? null;
  return `${STORY_CARD_PROMPT_STATIC}

${sides.join('\n\n')}

TOLD-VS-PLAYED: none. Do not invent a split.
${jokeTarget ? `JOKE TARGET: the ${AXIS_POLE_NAME[jokeTarget.axis][jokeTarget.lean]} side (never print that word).` : 'JOKE TARGET: none.'}
${otherWay ? `OTHER WAY (for "otherWay"; never print the word): ${AXIS_POLE_NAME[otherWay.axis][otherWay.lean === 'high' ? 'low' : 'high']}` : 'OTHER WAY: the opposite of SIDE A’s lead lean.'}${
    input.setting ? `\nSETTING FOR THIS STORY: ${input.setting}` : ''
  }`;
}

/** The Story card prompt for one person (older callers and the check): their
 * thread's sides, with this week's stored lines. */
export function buildStoryCardPrompt(input: {
  tracks: readonly TraitTrack[];
  divergenceNote: string | null;
  divergenceAxis?: TraitAxis | null;
  thread: StoryThread;
  userId: string;
  ymd?: string;
}): string {
  const { thread } = input;
  const ymd = input.ymd ?? localYmd(new Date(), 'UTC');
  return buildStoryPromptFromSides({
    sides: thread.categories.map((row) => ({
      lead: row.lead ? { axis: row.lead.axis, lean: row.lead.lean } : null,
      card: pickCategoryCard({ userId: input.userId, reading: row.reading, ymd }),
    })),
    // Every Story gets its joke now (emci 2026-10-09): the thread's target, else SIDE A's lead lean.
    jokeTarget: thread.joke ?? thread.categories[0]?.lead ?? null,
  });
}

function words(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function within(text: string, [min, max]: readonly [number, number]): boolean {
  const n = words(text);
  return n >= min && n <= max;
}

export interface StoryCardResult {
  card: StoryCard | null;
  /** Why it was rejected (reason only, for the log). */
  reason: string | null;
}

/**
 * Parse + check the model's answer. The core (scene, moment, means) must pass
 * or it is rejected (one retry); the title, "how you handle it" and the joke
 * are dropped when they fail — never shown, never a second paid call.
 */
export function parseStoryCardAnswer(raw: string, opts: { jokeAsked: boolean }): StoryCardResult {
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

  const core: Record<'scene' | 'moment' | 'means', string> = { scene: '', moment: '', means: '' };
  const limits = { scene: STORY_SCENE_WORDS, moment: STORY_MOMENT_WORDS, means: STORY_MEANS_WORDS } as const;
  for (const key of ['scene', 'moment', 'means'] as const) {
    const value = obj[key];
    if (typeof value !== 'string') return reject(`${key} missing`);
    const line = value.trim();
    if (!within(line, limits[key])) return reject(`${key}: length`);
    const bad = storyCardLineViolation(line);
    if (bad) return reject(`${key}: ${bad}`);
    core[key] = line;
  }

  const optional = (value: unknown, limit: readonly [number, number]): string | null => {
    if (typeof value !== 'string') return null;
    const line = value.trim();
    return within(line, limit) && !storyCardLineViolation(line) ? line : null;
  };
  const handleRaw = optional(obj.handle, STORY_HANDLE_WORDS);
  // "How you handle it" must move the story on, not restate the moment.
  const handle = handleRaw && storyOverlap(handleRaw, core.moment) <= STORY_REPEAT_LIMIT ? handleRaw : null;

  let title: string | null = null;
  if (typeof obj.title === 'string') {
    const t = obj.title.trim().toLowerCase();
    // A plain describing word is the point of the title now ("the warm straight talker", emci
    // 2026-10-09); the tone rules and "your X side" still apply.
    if (!titleViolation(t, '') && !storyLabelLeak(t)) title = t;
  }

  let joke: string | null = null;
  if (opts.jokeAsked && typeof obj.joke === 'string') {
    const line = obj.joke.trim();
    if (!cardJokeViolation(line) && !storyCardLineViolation(line)) joke = line;
  }

  const noticed = optional(obj.noticed, STORY_NOTICED_WORDS);
  const otherWay = optional(obj.otherWay, STORY_OTHER_WAY_WORDS);
  const nextRaw = optional(obj.nextTime, STORY_NEXT_WORDS);
  const nextTime = nextRaw && /\?$/.test(nextRaw) ? nextRaw : null;
  return {
    card: { title, scene: core.scene, moment: core.moment, handle, means: core.means, joke, noticed, otherWay, nextTime },
    reason: null,
  };
}

/** The card as one block, for older readers of `story.body` (Explore, Rolls). */
export function storyCardBody(card: StoryCard): string {
  return [card.scene, card.moment, card.handle, card.means].filter(Boolean).join(' ');
}

/** Loose read of a saved card. */
export function parseStoredStoryCard(raw: unknown): StoryCard | null {
  if (typeof raw !== 'object' || raw == null) return null;
  const obj = raw as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const scene = s(obj.scene);
  const moment = s(obj.moment);
  const means = s(obj.means);
  if (!scene || !moment || !means) return null;
  return {
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
