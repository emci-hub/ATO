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
    high: 'you stay even when things wobble',
    low: 'you feel the wobble, then ride it',
  },
  cat_openness: {
    high: 'you say yes to the untried path',
    low: 'you like the known path, done well',
  },
  cat_drive: {
    high: 'you push until it\'s done',
    low: 'you go at your own pace and still get there',
  },
  cat_agency: {
    high: 'you treat the outcome as yours to shape',
    low: 'you roll with what the day deals',
  },
  cat_social: {
    high: 'people charge you up, even strangers',
    low: 'you recharge in quieter company',
  },
  cat_communication: {
    high: 'you say the hard thing, and keep it kind',
    low: 'you\'d rather step back than push',
  },
  cat_love: {
    high: 'you lean in close',
    low: 'you keep a little room, even with people you like',
  },
  cat_independence: {
    high: 'you like doing things your own way',
    low: 'you\'re happy sharing someone else\'s path',
  },
  cat_levity: {
    high: 'you reach for the lighter take',
    low: 'you keep a straight face and get it done',
  },
  cat_structure: {
    high: 'you like a plan and follow it through',
    low: 'you keep plans loose and change them as you go',
  },
  cat_resilience: {
    high: 'pressure makes you sharper',
    low: 'pressure hits hard, but you find a side door',
  },
};

export function categoryCatalogName(id: CategoryId): string {
  return CATEGORY_DEFS.find((row) => row.id === id)?.name ?? id;
}

export function leanPhraseFor(id: CategoryId, lean: TraitLean): string {
  return STORY_LEAN_PHRASES[id][lean];
}
