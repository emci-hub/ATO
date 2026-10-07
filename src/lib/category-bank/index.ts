/**
 * Stored category cards (emci, 2026-10-07). Replace the AI-written category
 * statements on Explore: tapping a category shows the stored card for the cell
 * its reading falls in. No model call, no DB write, no consent gate.
 *
 * Every old `category_statements` row is AI-written, so every one is hidden
 * from every history surface (`visibleStatementHistory`). The rows stay in the
 * database; nothing is deleted.
 *
 * UNREVIEWED: CATEGORY_BANK_COPY_REVIEWED stays false until emci ticks
 * docs/category-bank-review.md. Nothing in the app renders the flag (emci,
 * 2026-10-07: no draft badge for this bank).
 */
import { AXIS_POLE_NAME, AXIS_SHORT_NAME } from '@/lib/axis-poles';
import type { CategoryDef, CategoryId, CategoryReading } from '@/lib/categories';
import { fnv1a } from '@/lib/daily-line/bank';
import { isShareableLean } from '@/lib/legends64/identity';
import { trackFor, type TraitTrack } from '@/lib/trait-stability';
import { traitBand } from '@/lib/traits';

import { CAT_AGENCY } from './cat_agency';
import { CAT_COMMUNICATION } from './cat_communication';
import { CAT_DRIVE } from './cat_drive';
import { CAT_INDEPENDENCE } from './cat_independence';
import { CAT_LEVITY } from './cat_levity';
import { CAT_LOVE } from './cat_love';
import { CAT_OPENNESS } from './cat_openness';
import { CAT_RESILIENCE } from './cat_resilience';
import { CAT_SOCIAL } from './cat_social';
import { CAT_STEADINESS } from './cat_steadiness';
import { CAT_STRUCTURE } from './cat_structure';
import type { BarCell, CardCell, CardPart, CategoryCardBank, MapCell } from './define';

export type { BarCell, CardCell, CardPart, CategoryCardBank, MapCell } from './define';

export const CATEGORY_BANK_COPY_REVIEWED = false;

export const CATEGORY_BANK: Readonly<Record<CategoryId, CategoryCardBank>> = {
  cat_steadiness: CAT_STEADINESS,
  cat_openness: CAT_OPENNESS,
  cat_drive: CAT_DRIVE,
  cat_agency: CAT_AGENCY,
  cat_social: CAT_SOCIAL,
  cat_communication: CAT_COMMUNICATION,
  cat_love: CAT_LOVE,
  cat_independence: CAT_INDEPENDENCE,
  cat_levity: CAT_LEVITY,
  cat_structure: CAT_STRUCTURE,
  cat_resilience: CAT_RESILIENCE,
};

/** The card for a category id, or null for an id the bank does not know (a catalog row added later). */
export function bankForCategory(id: string): CategoryCardBank | null {
  return Object.prototype.hasOwnProperty.call(CATEGORY_BANK, id) ? CATEGORY_BANK[id as CategoryId] : null;
}

/** Which cell a ready reading falls in, or null when it has no number yet. */
export function cellForReading(reading: CategoryReading): BarCell | MapCell | null {
  if (!reading.ready) return null;
  if (reading.def.shape === 'map') {
    if (!reading.map) return null;
    return `${reading.map.x >= 0.5 ? 'h' : 'l'}${reading.map.y >= 0.5 ? 'h' : 'l'}` as MapCell;
  }
  return traitBand(reading.bar);
}

function ymdDayNumber(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return Math.floor(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / 86_400_000);
}

/** Weeks since 1970, turning over on Mondays (1970-01-05 was the first Monday). */
export function isoWeekIndex(ymd: string): number {
  return Math.floor((ymdDayNumber(ymd) + 3) / 7);
}

export interface StoredCategoryCard {
  cell: BarCell | MapCell;
  summary: string;
  strength: string;
  watchOut: string;
  tryThis: string;
}

/**
 * The stored card one account sees for one category this week. Pure. Each
 * part turns to its next wording every Monday, offset per account, so two
 * friends with the same reading do not read the same card the same week.
 */
export function pickCategoryCard(input: {
  userId: string;
  reading: CategoryReading;
  ymd: string;
}): StoredCategoryCard | null {
  const { userId, reading, ymd } = input;
  const bank = bankForCategory(reading.def.id);
  if (!bank || bank.shape !== reading.def.shape) return null;
  const cell = cellForReading(reading);
  if (!cell) return null;
  const cells = bank.cells as Record<string, CardCell | undefined>;
  const parts = cells[cell];
  if (!parts) return null;
  const week = isoWeekIndex(ymd);
  const variant = (part: CardPart) => (fnv1a(`${userId}|${reading.def.id}|${cell}|${part}`) + week) % 3;
  return {
    cell,
    summary: parts.summary[variant('summary')]!,
    strength: parts.strength[variant('strength')]!,
    watchOut: parts.watchOut[variant('watchOut')]!,
    tryThis: parts.tryThis[variant('tryThis')]!,
  };
}

function axisBand(tracks: readonly TraitTrack[], axis: CategoryDef['axes'][number]) {
  const row = trackFor(tracks, axis, 'report');
  if (!row || row.answerCount < 1 || !Number.isFinite(row.value)) return null;
  return traitBand(row.value);
}

/**
 * The card's one chip row: a chip per trait the category is built from.
 * "Confidence: Assured" when that trait sits clearly low or high, the trait's
 * name alone ("Independence") when it sits in the middle. No band word, no
 * sentence, never an internal trait id.
 */
export function categoryTags(def: Pick<CategoryDef, 'axes'>, tracks: readonly TraitTrack[]): string[] {
  return def.axes.map((axis) => {
    const band = axisBand(tracks, axis);
    return band === 'low' || band === 'high' ? `${AXIS_SHORT_NAME[axis]}: ${AXIS_POLE_NAME[axis][band]}` : AXIS_SHORT_NAME[axis];
  });
}

/**
 * Whether this card's tags may leave the app (a push or a share). Same rule
 * as everything else that leaves: every trait that shows a side must pass
 * `isShareableLean`. A trait shown by name only reveals no side.
 */
export function categoryTagsShareable(def: Pick<CategoryDef, 'axes'>, tracks: readonly TraitTrack[]): boolean {
  return def.axes.every((axis) => {
    const band = axisBand(tracks, axis);
    return band === 'low' || band === 'high' ? isShareableLean(axis, band) : true;
  });
}

/**
 * Archived category statements a history surface may show: none. Every
 * `category_statements` row was written by the old AI generator (emci,
 * 2026-10-07). A UI filter only; the rows are kept.
 */
export function visibleStatementHistory<T>(_rows: readonly T[]): T[] {
  return [];
}
