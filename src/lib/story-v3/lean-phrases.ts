import { CATEGORY_DEFS, type CategoryId } from '@/lib/categories';
import type { TraitLean } from '@/lib/traits';

/**
 * Card 6 lean phrases (writer bible §3b).
 *
 * TODO(emci): cat_love, cat_independence, and cat_structure are map
 * categories. High/low here is provisional — the repo only defines high/low
 * per axis. Do not treat these three as signed off.
 */
export const STORY_MAP_CATEGORY_LEAN_TODO: readonly CategoryId[] = [
  'cat_love',
  'cat_independence',
  'cat_structure',
];

export const STORY_LEAN_PHRASES: Readonly<Record<CategoryId, Record<TraitLean, string>>> = {
  cat_steadiness: {
    high: 'you keep the plan and your voice level',
    low: 'you feel the bad text past lunch',
  },
  cat_openness: {
    high: 'you say yes before the plan has a name',
    low: 'you order the usual with people you know',
  },
  cat_drive: {
    high: 'you push until the work is done',
    low: 'you go at your pace and still finish',
  },
  cat_agency: {
    high: 'you change one piece and try it again',
    low: 'you leave the outcome to the day',
  },
  cat_social: {
    high: 'you get a quiet table talking',
    low: 'you stay with one person',
  },
  cat_communication: {
    high: 'you say the hard part, then ask what works',
    low: 'you step back and let them talk',
  },
  cat_love: {
    high: 'you sit close and text back',
    low: 'you like them and still leave a gap',
  },
  cat_independence: {
    high: 'you pick the route before they do',
    low: 'you take the plan they made',
  },
  cat_levity: {
    high: 'you joke, then say it plain',
    low: 'you keep a straight face through the hard talk',
  },
  cat_structure: {
    high: 'you write the list and follow it through',
    low: 'you change the plan as you go',
  },
  cat_resilience: {
    high: 'you stay and try again',
    low: 'the bad day stays, and you still finish',
  },
};

export function categoryCatalogName(id: CategoryId): string {
  return CATEGORY_DEFS.find((row) => row.id === id)?.name ?? id;
}

export function leanPhraseFor(id: CategoryId, lean: TraitLean): string {
  return STORY_LEAN_PHRASES[id][lean];
}
