/**
 * The Story — longer-form Sage prose from currently settled categories.
 * Own generation call and quota lane. No offline fallback.
 *
 * UNREVIEWED. Diagnosis-adjacent. Nothing here is shippable without emci's
 * direct read — same bar as the Crisis spec.
 */
import { AXIS_POLE_NAME, AXIS_SHORT_NAME } from '@/lib/axis-poles';
import {
  getCategoryDefs,
  categoriesFingerprint,
  readAllCategories,
  type CategoryId,
} from '@/lib/categories';
import { pickCategoryCard } from '@/lib/category-bank';
import { localYmd } from '@/lib/local-date';
import { AXIS_EDITOR_COPY } from '@/lib/sage-knows';
import {
  parseStoryThreadRecord,
  pickStoryThread,
  poleWord,
  threadAxes,
  type StoryThread,
  type StoryThreadRecord,
} from '@/lib/story-thread';
import { TRAIT_BAND_PHRASES } from '@/lib/trait-bands';
import type { AxisDivergence } from '@/lib/trait-history';
import { reachedFullProfile } from '@/lib/questions/intake-stage';
import { isThinProfile, settledCount, type TraitTrack } from '@/lib/trait-stability';
import { leanHighLow, type TraitAxis } from '@/lib/traits';
import { CLEAR_VOICE_RULES } from '@/lib/voice/clear-voice';
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';
import { jokeHasBannedTopic } from '@/lib/voice/card-joke';
import { parseStoredStoryCard, type StoryCard } from '@/lib/story-card';
import { MOMENT_VOICE_BLOCK, STORY_JOKE_RULES } from '@/lib/voice/moment-voice';

export const STORY_COPY_REVIEWED = false;
export const STORY_LABEL = 'The Story';
export const STORY_LEDE = "How it's looking.";

export interface SageStory {
  body: string;
  fingerprint: string;
  generatedOn: string;
  categoryIds: CategoryId[];
  /** Story v2: which 1–2 categories this story was about, so the next load takes a new angle. */
  thread?: StoryThreadRecord;
  /** Story v3 (2026-10-09): the card parts. Older stories have only `body`. */
  card?: StoryCard;
  /** Shared library (wave93): the library card's id (Report) and "you and N others". */
  libraryId?: string;
  others?: number | null;
}

export interface StorySample {
  shape: string;
  body: string;
}

/**
 * Drafts for emci's direct read. NOT shown in the app. NOT few-shots.
 * Flag every line. Do not treat as shippable.
 */
export const STORY_SAMPLES: readonly StorySample[] = [
  {
    shape: 'settled follow-through + own path',
    body:
      "You've been keeping the plan, even when you'd rather keep the room small. You'd rather pick the path yourself than take the one already sitting there. Sometimes a real check-in with someone is what makes the day land. Sometimes the day is fine without it. Both have shown up. Maybe it just depends on the week.",
  },
  {
    shape: 'thin — must not generate',
    body: '',
  },
];

/**
 * Told-vs-played tension. Soft, hedged, not an accusation, not smoothed over.
 * Drafts for emci's direct read. NOT shown in the app. NOT pasted into the
 * live prompt as templates. Flag every line. Do not treat as shippable.
 */
export const STORY_TENSION_SAMPLES: readonly string[] = [
  "You said one thing, but when it's not a big decision, you go a different way. Maybe you're just different depending on the moment — that's normal.",
  "You talk about a hard day one way. Then when it's just a quick pick, you move another. Maybe both are true — it just depends on the moment.",
  "When you had time to think, you went one way. When you didn't, you went another. Maybe you're just different depending on the moment — that's normal.",
];

/** Story-only. Talk still uses formatDivergenceNote. */
export function formatStoryTensionNote(rows: readonly AxisDivergence[]): string | null {
  if (rows.length === 0) return null;
  const first = rows[0]!;
  const phrases = TRAIT_BAND_PHRASES[first.axis];
  const told = phrases[leanHighLow(first.report)];
  const played = phrases[leanHighLow(first.game)];
  if (told === played) {
    return "You said one thing, but when it's not a big decision, you go a different way. Maybe you're just different depending on the moment — that's normal.";
  }
  return `You said one thing (${told}), but when it's not a big decision you go a different way (${played}). Maybe you're just different depending on the moment — that's normal.`;
}

export function storyFingerprint(
  tracks: readonly TraitTrack[],
  divergenceNote: string | null,
  now: Date = new Date(),
): string {
  return `${categoriesFingerprint(tracks, now)}#div:${divergenceNote ?? ''}`;
}

export function storyReady(tracks: readonly TraitTrack[], now: Date = new Date()): boolean {
  // A finished intake (every trait at 3 answers, or the old 50) is enough on
  // its own: three answers per trait cap the stability sum near 5.9, under the
  // thin line (6.4 of 16), so Story was never ready right after the 48 even
  // though the app said the full profile unlocked it (found 2026-10-06).
  if (!reachedFullProfile(tracks) && isThinProfile(settledCount(tracks, now))) return false;
  return readAllCategories(tracks, now).some((row) => row.ready);
}

export function parseSageStory(raw: unknown): SageStory | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const body = typeof row.body === 'string' ? row.body.trim() : '';
  const fingerprint = typeof row.fingerprint === 'string' ? row.fingerprint : '';
  const generatedOn = typeof row.generatedOn === 'string' ? row.generatedOn : '';
  if (!body || !fingerprint || !generatedOn) return null;
  if (containsFrameworkTerm(body)) return null;
  if (storyNamesACategory(body)) return null;
  const categoryIds: CategoryId[] = [];
  if (Array.isArray(row.categoryIds)) {
    for (const item of row.categoryIds) {
      if (typeof item === 'string' && getCategoryDefs().some((def) => def.id === item)) {
        categoryIds.push(item as CategoryId);
      }
    }
  }
  const thread = parseStoryThreadRecord(row.thread);
  const card = parseStoredStoryCard(row.card);
  return {
    body,
    fingerprint,
    generatedOn,
    categoryIds,
    ...(thread ? { thread } : {}),
    ...(card ? { card } : {}),
    ...(typeof row.libraryId === 'string' && /^[0-9a-f-]{36}$/.test(row.libraryId) ? { libraryId: row.libraryId } : {}),
    ...(typeof row.others === 'number' ? { others: row.others } : {}),
  };
}

export const STORY_MAX_WORDS = 180;
export const STORY_MAX_PARAGRAPHS = 3;
export const STORY_JOKE_MAX_CHARS = 120;

/** The hard joke bans as keywords (Story v2 §7), shared with the cards' joke line. */
export function storyHasBannedTopic(text: string): boolean {
  return jokeHasBannedTopic(text);
}

/** Labels the model's plan line must never echo: category names, axis labels and ids, short trait names. */
function threadNamesALabel(text: string): boolean {
  const lower = text.toLowerCase();
  for (const def of getCategoryDefs()) if (lower.includes(def.name.toLowerCase())) return true;
  for (const [axis, copy] of Object.entries(AXIS_EDITOR_COPY)) {
    if (lower.includes(copy.label.toLowerCase())) return true;
    if (lower.includes(axis.replace(/_/g, ' '))) return true;
  }
  for (const name of Object.values(AXIS_SHORT_NAME)) if (lower.includes(name.toLowerCase())) return true;
  return false;
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function paragraphCount(text: string): number {
  // Any line break counts: the fold renders single newlines as breaks too.
  return text.split(/\n+/).filter((part) => part.trim()).length;
}

/** Why a story body may not be shown, or null if it may. */
export function storyBodyViolation(body: string): string | null {
  if (!body) return 'empty';
  if (wordCount(body) > STORY_MAX_WORDS) return 'too long';
  if (paragraphCount(body) > STORY_MAX_PARAGRAPHS) return 'too many paragraphs';
  if (containsFrameworkTerm(body)) return 'framework term';
  if (storyNamesACategory(body)) return 'names a category';
  if (/\byou are\b/i.test(body)) return 'says "you are"';
  if (/\balways\b/i.test(body)) return 'says "always"';
  if (body.includes('!')) return 'says "!"';
  if (storyHasBannedTopic(body)) return 'banned topic';
  return null;
}

export interface StoryAnswer {
  body: string;
  /** The joke sentence, only when it is short and actually in the body. */
  joke: string | null;
  /** The model's one-line plan, only when it names no category or trait label. */
  thread: string | null;
}

export function parseStoryAnswer(text: string): StoryAnswer | null {
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    const row = JSON.parse(text.slice(start, end + 1)) as { body?: unknown; joke?: unknown; thread?: unknown };
    const body = typeof row.body === 'string' ? row.body.trim() : '';
    if (storyBodyViolation(body)) return null;
    const rawJoke = typeof row.joke === 'string' ? row.joke.trim() : '';
    const joke = rawJoke && rawJoke.length < STORY_JOKE_MAX_CHARS && body.includes(rawJoke) ? rawJoke : null;
    const rawThread = typeof row.thread === 'string' ? row.thread.trim() : '';
    const thread = rawThread && !threadNamesALabel(rawThread) ? rawThread : null;
    return { body: body.slice(0, 1600), joke, thread };
  } catch {
    return null;
  }
}

export function parseStoryBody(text: string): string | null {
  return parseStoryAnswer(text)?.body ?? null;
}

/** Distinctive multi-word category labels only — short English words stay allowed. */
export function storyNamesACategory(body: string): boolean {
  const lower = body.toLowerCase();
  for (const def of getCategoryDefs()) {
    const name = def.name.toLowerCase();
    if (name.includes(' ') || name.includes('/')) {
      if (lower.includes(name)) return true;
    }
  }
  return false;
}

/**
 * Story v2 prompt (emci 2026-10-08): one day, one setting, the 1–2 categories
 * the thread picked, grounded in their stored card copy. Nothing about any
 * other category goes in. The tension line is used only when its axis is
 * inside the thread.
 */
export function buildStoryPrompt(input: {
  tracks: readonly TraitTrack[];
  divergenceNote: string | null;
  divergenceAxis?: TraitAxis | null;
  /** The picked thread. Omitted: pick the best one now, with no joke (a caller that does not know the crisis state). */
  thread?: StoryThread | null;
  userId?: string;
  ymd?: string;
}): string {
  const thread =
    input.thread !== undefined
      ? input.thread
      : pickStoryThread({ tracks: input.tracks, last: null, crisisToday: true });
  const ymd = input.ymd ?? localYmd(new Date(), 'UTC');
  const userId = input.userId ?? '';

  const sides: string[] = [];
  (thread?.categories ?? []).forEach((row, index) => {
    const label = index === 0 ? 'SIDE A' : 'SIDE B';
    const card = pickCategoryCard({ userId, reading: row.reading, ymd });
    const bits = [
      row.lead ? `- Lead lean, in one word (never print it): ${poleWord(row.lead)}` : null,
      card ? `- How it tends to show: ${card.summary}` : null,
      card ? `- What it does well: ${card.strength}` : null,
      card ? `- Where it can catch: ${card.watchOut}` : null,
    ].filter((line): line is string => line != null);
    sides.push(`${label} (internal; never name it)\n${bits.join('\n') || '- (no stored lines)'}`);
  });
  const twoSides = sides.length === 2;

  const axes = thread ? threadAxes(thread) : [];
  const tensionOn =
    !!input.divergenceNote && !!input.divergenceAxis && axes.includes(input.divergenceAxis);
  const tension = tensionOn
    ? `TOLD-VS-PLAYED (optional; use it only if it fits the day. Say it like a friend would: warm, not an accusation, no winner)\n- ${input.divergenceNote}`
    : 'TOLD-VS-PLAYED: none. Do not invent a split.';

  const joke = thread?.joke
    ? `JOKE TARGET: the ${AXIS_POLE_NAME[thread.joke.axis][thread.joke.lean]} side (never print that word). Write exactly one joke about the situation it lands them in.\n${STORY_JOKE_RULES}`
    : 'JOKE: none this time. Write no joke, and return "joke" as an empty string.';

  const meaningRules = CLEAR_VOICE_RULES.filter((rule) =>
    /^(Hedge:|Kind to both poles|Not a therapist)/.test(rule),
  );

  return `Write as Sage in the ATO app. Not a doctor. This is The Story: ONE ordinary day, ONE setting, the same people throughout. Not a list of moments.

INPUT (internal; write from the meaning, never the labels)
${sides.join('\n\n') || '- none'}

${tension}

${joke}

SHAPE (90–160 words, at most 3 short paragraphs, second person)
1. A short setup: one setting on a typical day.
2. The moment ${twoSides ? 'where SIDE A and SIDE B meet and pull against each other' : 'where SIDE A shows'}.
3. How they tend to handle it.
4. One plain closing line that says what it all means. Only this line explains; the rest shows.

RULES
1. A typical day, never a claimed event: "on a day like this", "you might". Reflect as maybes, not facts.
2. Never "you are", never "always", never "!". No type codes, no psychology words.
3. Do not name categories or traits, and never print the lean words above.
4. Stay in the one setting. No second scene, no second place, no new set of people.

VOICE FOR THE SCENES AND THE JOKE (the moment voice. Here "describe the moment and stop" means every sentence stays concrete; the story still runs setup, moment, handling, meaning)
${MOMENT_VOICE_BLOCK}

VOICE FOR THE CLOSING MEANING LINE (the clear voice: plain, kind, "tend to" / "usually", no labels)
${meaningRules.map((rule) => `- ${rule}`).join('\n')}

Plan first, then write. Respond with JSON only:
{"thread":"<one sentence: what this story is about, no labels>","joke":"<the joke sentence exactly as it appears in the body, or empty>","body":"<the story>"}`;
}

export function storyCopyClean(): boolean {
  const lines = [
    STORY_LABEL,
    STORY_LEDE,
    ...STORY_SAMPLES.map((row) => row.body),
    ...STORY_TENSION_SAMPLES,
  ];
  return lines.every((line) => !line || !containsFrameworkTerm(line));
}
