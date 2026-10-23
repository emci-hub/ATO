/**
 * Hand-written Story bank (emci, 2026-10-13). Instant fallback when AI fails,
 * times out, is offline or is over budget; also the first paint while a
 * library/AI card is still loading (serve first, then upgrade).
 *
 * Same validators as a model card (`parseStoryCardAnswer`). Placeholder slots
 * are only the safe ones below (`{friend}` / `{sibling}`). Copy is unreviewed.
 */
import type { StoryAngle } from '@/lib/ai-library/story';
import { categoryById, type CategoryId } from '@/lib/categories';
import { fnv1a } from '@/lib/daily-line/bank';
import {
  parseStoryCardAnswer,
  STORY_HOOK_VARIETY_LIMIT,
  storyOverlap,
  type StoryCard,
} from '@/lib/story-card';
import type { TraitLean } from '@/lib/traits';

import { bankIdsToSkip } from './history';
import raw from './stories.json';

export const STORY_BANK_COPY_REVIEWED = true; // emci accepted 2026-10-23 (roadmap A4)

export interface StoryBankEntry {
  id: string;
  categoryId: CategoryId;
  setting: StoryAngle;
  lean: TraitLean;
  title: string;
  hook: string;
  twist: string;
  move: string;
  punchline: string;
  reveal: string;
  next: string;
  otherWay?: string;
}

const SAFE_SLOTS: Readonly<Record<string, string>> = {
  friend: 'your friend',
  sibling: 'your sibling',
};

export function fillStoryPlaceholders(text: string): string {
  return text.replace(/\{([a-z]+)\}/g, (full, key: string) => SAFE_SLOTS[key] ?? full);
}

function asEntry(row: unknown): StoryBankEntry | null {
  if (typeof row !== 'object' || row == null) return null;
  const obj = row as Record<string, unknown>;
  const str = (k: string) => (typeof obj[k] === 'string' && obj[k].trim() ? (obj[k] as string).trim() : null);
  const categoryId = str('categoryId');
  const setting = str('setting');
  const lean = str('lean');
  const id = str('id');
  if (!id || !categoryId || !categoryById(categoryId as CategoryId)) return null;
  if (setting !== 'friends' && setting !== 'work' && setting !== 'home') return null;
  if (lean !== 'high' && lean !== 'low') return null;
  const title = str('title');
  const hook = str('hook');
  const twist = str('twist');
  const move = str('move');
  const punchline = str('punchline');
  const reveal = str('reveal');
  const next = str('next');
  if (!title || !hook || !twist || !move || !punchline || !reveal || !next) return null;
  return {
    id,
    categoryId: categoryId as CategoryId,
    setting,
    lean,
    title,
    hook,
    twist,
    move,
    punchline,
    reveal,
    next,
    ...(str('otherWay') ? { otherWay: str('otherWay')! } : {}),
  };
}

const LOADED: StoryBankEntry[] = (Array.isArray(raw) ? raw : [])
  .map(asEntry)
  .filter((row): row is StoryBankEntry => row != null);

export const STORY_BANK: readonly StoryBankEntry[] = LOADED;

export function bankEntryToCard(entry: StoryBankEntry): StoryCard | null {
  const filled = {
    title: fillStoryPlaceholders(entry.title),
    hook: fillStoryPlaceholders(entry.hook),
    twist: fillStoryPlaceholders(entry.twist),
    move: fillStoryPlaceholders(entry.move),
    punchline: fillStoryPlaceholders(entry.punchline),
    reveal: fillStoryPlaceholders(entry.reveal),
    next: fillStoryPlaceholders(entry.next),
    ...(entry.otherWay ? { otherWay: fillStoryPlaceholders(entry.otherWay) } : {}),
  };
  const parsed = parseStoryCardAnswer(JSON.stringify(filled), { allowExampleHooks: false });
  if (!parsed.card) return null;
  return { ...parsed.card, source: 'bank', bankId: entry.id };
}

export function pickStoryBankCard(opts: {
  categoryId: string;
  setting: StoryAngle;
  lean?: TraitLean | null;
  seenIds?: readonly string[];
  recentHooks?: readonly string[];
  seed?: string;
}): StoryCard | null {
  const seen = opts.seenIds ?? [];
  const recent = opts.recentHooks ?? [];
  const usableIn = (rows: StoryBankEntry[]) => {
    const inPool = seen.filter((id) => rows.some((row) => row.id === id));
    const skip = new Set(bankIdsToSkip(inPool, rows.length));
    return rows.filter((row) => {
      if (skip.has(row.id)) return false;
      if (recent.some((hook) => storyOverlap(row.hook, hook) >= STORY_HOOK_VARIETY_LIMIT)) return false;
      return bankEntryToCard(row) != null;
    });
  };
  const pools: StoryBankEntry[][] = [
    usableIn(
      STORY_BANK.filter(
        (row) => row.categoryId === opts.categoryId && row.setting === opts.setting && (!opts.lean || row.lean === opts.lean),
      ),
    ),
    usableIn(STORY_BANK.filter((row) => row.categoryId === opts.categoryId && row.setting === opts.setting)),
    usableIn(STORY_BANK.filter((row) => row.categoryId === opts.categoryId)),
    usableIn(STORY_BANK.filter((row) => row.setting === opts.setting)),
    usableIn([...STORY_BANK]),
  ];
  const pool = pools.find((rows) => rows.length > 0) ?? [];
  if (pool.length === 0) return null;
  const index = fnv1a(`${opts.seed ?? 'bank'}|${opts.categoryId}|${opts.setting}`) % pool.length;
  const entry = pool[index]!;
  return bankEntryToCard(entry);
}

/** For the check: every raw row, including ones `asEntry` dropped. */
export function rawStoryBank(): unknown {
  return raw;
}
