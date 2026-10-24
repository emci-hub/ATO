/**
 * The Story card's saved shape and its small helpers.
 *
 * The Story is free templates (story-v3 / story-bank), shown on Insights. The AI writer
 * that used to live here (the "Write as Sage" prompt, the model-answer parser, the
 * samples and `STORY_COPY_REVIEWED`) was removed in roadmap A5 (2026-10-23): no model
 * writes a Story. What stays is what the card still reads: labels, the saved
 * `SageStory` shape and its parser, the told-vs-played note, and the ready check.
 */
import {
  getCategoryDefs,
  categoriesFingerprint,
  readAllCategories,
  type CategoryId,
} from '@/lib/categories';
import { parseStoryThreadRecord, type StoryThreadRecord } from '@/lib/story-thread';
import { TRAIT_BAND_PHRASES } from '@/lib/trait-bands';
import type { AxisDivergence } from '@/lib/trait-history';
import { reachedFullProfile } from '@/lib/questions/intake-stage';
import { isThinProfile, settledCount, type TraitTrack } from '@/lib/trait-stability';
import { leanHighLow } from '@/lib/traits';
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';
import { parseStoredStoryCard, type StoryCard } from '@/lib/story-card';

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
