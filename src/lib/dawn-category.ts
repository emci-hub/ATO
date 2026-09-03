/**
 * Dawn Read may draw from at most one of Steadiness / Agency / Drive,
 * and only when that category is settled on the report track.
 * New users with none of the three ready keep knock / fact / focus exactly.
 *
 * Do's if-then / morning_cue path is not selected here.
 * Anti-repeat and cut/crisis gates live on the generated card in filterCard —
 * same function, same reasons, no source-based bypass.
 */
import {
  getCategoryDefs,
  categoryById,
  readCategory,
  type CategoryId,
  type CategoryReading,
} from '@/lib/categories';
import type { TraitTrack } from '@/lib/trait-stability';

export const DAWN_READ_CATEGORY_IDS = [
  'cat_steadiness',
  'cat_agency',
  'cat_drive',
] as const satisfies readonly CategoryId[];

export type DawnReadCategoryId = (typeof DAWN_READ_CATEGORY_IDS)[number];

export const DAWN_CATEGORY_COPY_REVIEWED = false;

/**
 * Prompt-only. Never render. UNREVIEWED.
 * Meaning of each Dawn-eligible merge, without naming leftover axes.
 */
export const DAWN_CATEGORY_GROUNDING: Record<DawnReadCategoryId, string> = {
  cat_steadiness:
    'how they hold a plan and a knock — follow-through, going along, how fast a bad start fades',
  cat_agency:
    'what they tell themselves after a miss, and whether a bigger ask feels like theirs to figure out',
  cat_drive:
    'how they pick a path, handle a hard task, and whether a real connection is part of that',
};

export interface DawnReadCategory {
  id: DawnReadCategoryId;
  name: string;
  lean: 'higher' | 'lower';
  meaning: string;
}

export function isDawnReadCategoryId(id: string): id is DawnReadCategoryId {
  return (DAWN_READ_CATEGORY_IDS as readonly string[]).includes(id);
}

export function settledDawnReadCategories(
  tracks: readonly TraitTrack[],
  now: Date = new Date(),
): CategoryReading[] {
  const out: CategoryReading[] = [];
  for (const id of DAWN_READ_CATEGORY_IDS) {
    const def = categoryById(id);
    if (!def) continue;
    const reading = readCategory(def, tracks, now);
    if (reading.ready) out.push(reading);
  }
  return out;
}

/**
 * One settled Dawn category, or null. Rotates by calendar day so Read
 * does not lock onto the first of the three.
 */
export function pickDawnReadCategory(
  tracks: readonly TraitTrack[] | undefined,
  day: number,
  now: Date = new Date(),
): DawnReadCategory | null {
  if (!tracks || tracks.length === 0) return null;
  const ready = settledDawnReadCategories(tracks, now);
  if (ready.length === 0) return null;
  const index = (Math.max(1, day) - 1) % ready.length;
  const reading = ready[index]!;
  const id = reading.def.id as DawnReadCategoryId;
  const bar = reading.bar ?? 0.5;
  return {
    id,
    name: reading.def.name,
    lean: bar >= 0.5 ? 'higher' : 'lower',
    meaning: DAWN_CATEGORY_GROUNDING[id],
  };
}

export function dawnCategoryPromptBlock(pick: DawnReadCategory | null): string {
  if (!pick) return '';
  return `DAWN CATEGORY — optional Read angle only. At most this ONE settled merge. Do not name it. Do not pull other categories or leftover raw axes. Do stays the morning-cue if-then, unchanged.
- ${pick.name} (internal id ${pick.id}): leaning ${pick.lean}. Meaning: ${pick.meaning}.
`;
}

/** Catalog lock: Dawn's three ids must stay real bar categories. */
export function dawnReadCategoriesAreBars(): boolean {
  return DAWN_READ_CATEGORY_IDS.every((id) => {
    const def = getCategoryDefs().find((row) => row.id === id);
    return def?.shape === 'bar';
  });
}
