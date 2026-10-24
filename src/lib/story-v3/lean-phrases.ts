import { CATEGORY_DEFS, type CategoryId } from '@/lib/categories';
import type { TraitLean } from '@/lib/traits';

/**
 * Card 6 lean phrases. Plain meaning of the category lean.
 * cat_love, cat_independence, and cat_structure stay provisional.
 */
export const STORY_MAP_CATEGORY_LEAN_TODO: readonly CategoryId[] = [
  'cat_love',
  'cat_independence',
  'cat_structure',
];

export const STORY_LEAN_PHRASES: Readonly<Record<CategoryId, Record<TraitLean, string>>> = {
  cat_steadiness: {
    high: 'you shake a bad day off and keep going',
    low: 'you feel a bad day for longer',
  },
  cat_openness: {
    high: 'you try something new',
    low: 'you stick with what you already like',
  },
  cat_drive: {
    high: 'you push until the work is done',
    low: 'you go at your own pace and still finish',
  },
  cat_agency: {
    high: 'you change one piece and try it again',
    low: 'you leave the outcome to the day',
  },
  cat_social: {
    high: 'you want time with other people',
    low: 'you want less time in a crowd',
  },
  cat_communication: {
    high: 'you say the hard part, then look for what works for both of you',
    low: 'you step back and let the other person talk',
  },
  cat_love: {
    high: 'you stay close and answer',
    low: 'you care and still leave a little room',
  },
  cat_independence: {
    high: 'you choose the way before anyone else does',
    low: 'you take a plan someone else already made',
  },
  cat_levity: {
    high: 'you lighten a hard thing, then say it plain',
    low: 'you take a hard talk straight',
  },
  cat_structure: {
    high: 'you make a plan and follow it through',
    low: 'you change the plan as you go',
  },
  cat_resilience: {
    high: 'you stay and try again after a miss',
    low: 'a bad day stays with you and you still finish',
  },
};

export function categoryCatalogName(id: CategoryId): string {
  return CATEGORY_DEFS.find((row) => row.id === id)?.name ?? id;
}

export function leanPhraseFor(id: CategoryId, lean: TraitLean): string {
  return STORY_LEAN_PHRASES[id][lean];
}
