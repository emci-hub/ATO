/**
 * What a person sees as a category's name (emci, 2026-10-08), on Home and
 * Explore alike. Display only: the catalog's own names (`category_defs`) stay
 * as they are, and the AI prompts keep using them.
 *
 * "How You Love" (attachment) and "Space vs. Together" (autonomy vs.
 * connection) are built from different traits, so they stay two categories.
 */
import { codeForAxis } from '@/lib/axis-codes';
import type { CategoryDef, CategoryId } from '@/lib/categories';

export const CATEGORY_DISPLAY_NAMES: Record<CategoryId, string> = {
  cat_steadiness: 'Your Calm Core',
  cat_openness: 'Your Sense of Adventure',
  cat_drive: 'What Fuels You',
  cat_agency: 'Taking the Wheel',
  cat_social: 'Your Social Battery',
  cat_communication: 'How You Speak Up',
  cat_love: 'How You Love',
  cat_independence: 'Space vs. Together',
  cat_levity: 'Your Sense of Humor',
  cat_structure: 'Planner or Free Spirit',
  cat_resilience: 'When Things Get Hard',
};

/** The friendly name, or the catalog name for a category added later. */
export function categoryDisplayName(def: Pick<CategoryDef, 'id' | 'name'>): string {
  return CATEGORY_DISPLAY_NAMES[def.id] ?? def.name;
}

/** The traits a category is built from as two-letter codes ("OP·CO"), the small legend beside its name. */
export function categoryAxisCodes(def: Pick<CategoryDef, 'axes'>): string {
  return def.axes.map((axis) => codeForAxis(axis)).join('·');
}
