/**
 * Shared library — the Story (wave93).
 *
 * Bucket: the 1–2 categories the app picked (each with its stored-card cell
 * and its lead lean) + the joke target. The told-vs-played line is personal,
 * so it is no longer in the prompt: the phone shows it under the card.
 *
 * Angles = the everyday setting (friends / work / home), and each angle reads
 * a different wording of the stored category lines, so two people in the same
 * bucket get different stories.
 */
import { bankForCategory, cellForReading } from '@/lib/category-bank';
import type { CardCell } from '@/lib/category-bank/define';
import { categoryById } from '@/lib/categories';
import { storyNamesACategory } from '@/lib/sage-story';
import {
  buildStoryPromptFromSides,
  parseStoredStoryCard,
  parseStoryCardAnswer,
  storyCardBody,
  type StoryCard,
  type StoryPromptSide,
} from '@/lib/story-card';
import type { StoryThread } from '@/lib/story-thread';
import { TRAIT_AXES, type TraitAxis, type TraitLean } from '@/lib/traits';
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';
import { matchingJargonTerm } from '@/lib/voice/jargon';

import type { LibraryKindSpec, LibraryParse } from './types';

export const STORY_ANGLES = {
  friends: 'a plan with friends',
  work: 'a task at work or school',
  home: 'a weekend at home, an errand or a family visit',
} as const;
export type StoryAngle = keyof typeof STORY_ANGLES;
const ANGLE_IDS = Object.keys(STORY_ANGLES) as StoryAngle[];

type Lean = { axis: TraitAxis; lean: TraitLean };

export interface StorySideBucket {
  categoryId: string;
  cell: string;
  lead: Lean | null;
}

export interface StoryBucket {
  key: string;
  sides: StorySideBucket[];
  joke: Lean | null;
}

const BAR = ['low', 'mid', 'high'];
const MAP = ['hh', 'hl', 'lh', 'll'];

function leanPart(row: Lean | null): string {
  return row ? `${row.axis}.${row.lean === 'high' ? 'h' : 'l'}` : '-';
}

function readLean(part: string): Lean | null | undefined {
  if (part === '-') return null;
  const m = /^([a-z_]+)\.([hl])$/.exec(part);
  if (!m || !(TRAIT_AXES as readonly string[]).includes(m[1]!)) return undefined;
  return { axis: m[1] as TraitAxis, lean: m[2] === 'h' ? 'high' : 'low' };
}

/** The reader's Story bucket for the thread the app picked. Null when a side has no stored cell. */
export function storyBucketKey(thread: StoryThread): string | null {
  const sides: string[] = [];
  for (const row of thread.categories) {
    const cell = cellForReading(row.reading);
    if (!cell) return null;
    sides.push(`${row.reading.def.id}:${cell}:${leanPart(row.lead ? { axis: row.lead.axis, lean: row.lead.lean } : null)}`);
  }
  if (sides.length === 0 || sides.length > 2) return null;
  // Same as the old prompt: the thread's joke target, else SIDE A's lead lean.
  const joke = thread.joke ?? thread.categories[0]?.lead ?? null;
  return `st|${sides.join('|')}|j:${leanPart(joke ? { axis: joke.axis, lean: joke.lean } : null)}`;
}

export function parseStoryBucket(key: string): StoryBucket | null {
  const parts = key.split('|');
  if (parts[0] !== 'st' || parts.length < 3 || parts.length > 4) return null;
  const jokePart = parts[parts.length - 1]!;
  if (!jokePart.startsWith('j:')) return null;
  const joke = readLean(jokePart.slice(2));
  if (joke === undefined) return null;
  const sides: StorySideBucket[] = [];
  for (const part of parts.slice(1, -1)) {
    const m = /^(cat_[a-z]{2,20}):([a-z]{2,4}):(.+)$/.exec(part);
    if (!m) return null;
    const def = categoryById(m[1]!);
    if (!def) return null;
    if (!(def.shape === 'map' ? MAP : BAR).includes(m[2]!)) return null;
    const lead = readLean(m[3]!);
    if (lead === undefined || (lead && !def.axes.includes(lead.axis))) return null;
    if (sides.some((row) => row.categoryId === def.id)) return null;
    sides.push({ categoryId: def.id, cell: m[2]!, lead });
  }
  // The joke is always about a side inside the story.
  if (joke && !sides.some((row) => categoryById(row.categoryId)!.axes.includes(joke.axis))) return null;
  return { key, sides, joke };
}

function promptSides(bucket: StoryBucket, angle: string): StoryPromptSide[] {
  const variant = Math.max(0, ANGLE_IDS.indexOf(angle as StoryAngle)) % 3;
  return bucket.sides.map((row) => {
    const bank = bankForCategory(row.categoryId);
    const cell = bank ? ((bank.cells as Record<string, CardCell | undefined>)[row.cell] ?? null) : null;
    return {
      lead: row.lead,
      card: cell ? { summary: cell.summary[variant]!, strength: cell.strength[variant]!, watchOut: cell.watchOut[variant]! } : null,
    };
  });
}

export const STORY_LIBRARY: LibraryKindSpec<StoryBucket, StoryCard> = {
  kind: 'story',
  parseBucket: parseStoryBucket,
  angles: () => ANGLE_IDS,
  cardsPerCall: 1,
  buildPrompt(bucket, angles) {
    const angle = angles[0] ?? 'friends';
    return {
      prompt: buildStoryPromptFromSides({
        sides: promptSides(bucket, angle),
        jokeTarget: bucket.joke,
        setting: STORY_ANGLES[angle as StoryAngle] ?? null,
      }),
      maxOutputTokens: 700,
    };
  },
  parse(raw, _bucket, angles): LibraryParse<StoryCard> {
    const parsed = parseStoryCardAnswer(raw, { jokeAsked: true });
    const c = parsed.card;
    if (!c) return { cards: [], reason: parsed.reason ?? 'no card' };
    // Every shown part, not just the body: the deeper parts and the title/joke too.
    const joined = [storyCardBody(c), c.noticed, c.otherWay, c.nextTime, c.joke, c.title].filter(Boolean).join(' ');
    if (containsFrameworkTerm(joined) || matchingJargonTerm(joined) || storyNamesACategory(joined)) {
      return { cards: [], reason: 'framework or jargon' };
    }
    return { cards: [{ angle: angles[0] ?? 'friends', card: c }], reason: null };
  },
  readCard: parseStoredStoryCard,
};
