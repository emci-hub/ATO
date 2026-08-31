/**
 * Offline fallback bands for category summaries. UNREVIEWED.
 * Same lane as IQ fallback bank / crisis copy. Not a lookup for live titles.
 */
import type { CategoryId } from '@/lib/categories';
import { readAllCategories } from '@/lib/categories';
import type { CategoryCopy } from '@/lib/sage-title';
import type { TraitTrack } from '@/lib/trait-stability';
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';

export const CATEGORY_BAND_COPY_REVIEWED = false;

export interface CategoryBand {
  /** Inclusive low, exclusive high except the last band. */
  min: number;
  max: number;
  lede: string;
}

/** 3–5 plain lines per category, keyed by bar 0–1 or map-quadrant score. */
export const CATEGORY_FALLBACK_BANDS: Record<CategoryId, readonly CategoryBand[]> = {
  cat_steadiness: [
    { min: 0, max: 0.35, lede: 'Plans stay loose. A small knock can sit for a while.' },
    { min: 0.35, max: 0.65, lede: 'Some follow-through, some wobble. It depends on the day.' },
    { min: 0.65, max: 1.01, lede: 'Sees a plan through and shakes a bad start off.' },
  ],
  cat_openness: [
    { min: 0, max: 0.35, lede: 'Prefers a known path and a quieter room.' },
    { min: 0.35, max: 0.65, lede: 'Mixes the familiar with the occasional different path.' },
    { min: 0.65, max: 1.01, lede: 'Curious about the untried option. People around tend to help.' },
  ],
  cat_drive: [
    { min: 0, max: 0.35, lede: 'A set path is fine. A hard task can make them pause.' },
    { min: 0.35, max: 0.65, lede: 'Some days they pick the path. Some days they take the one already there.' },
    { min: 0.65, max: 1.01, lede: 'Would rather do it their way, and feels they can handle the hard part.' },
  ],
  cat_agency: [
    { min: 0, max: 0.35, lede: 'A miss can feel closed. When it falls apart, it was bound to happen.' },
    { min: 0.35, max: 0.65, lede: 'Sometimes they look at what to change. Sometimes they let it be.' },
    { min: 0.65, max: 1.01, lede: 'After a miss they look at what they would change. A bigger ask feels doable.' },
  ],
  cat_social: [
    { min: 0, max: 0.35, lede: 'Quiet time is how they reset. Jokes can wait.' },
    { min: 0.35, max: 0.65, lede: 'People time and lightness come in when the day has room.' },
    { min: 0.65, max: 1.01, lede: 'Would rather make the room happen, and keep it a little light.' },
  ],
  cat_communication: [
    { min: 0, max: 0.35, lede: 'Steps back in a disagreement. Protects their outcome first.' },
    { min: 0.35, max: 0.65, lede: 'Sometimes they put a point on the table. Sometimes they leave room.' },
    { min: 0.65, max: 1.01, lede: 'Puts their point on the table and still looks for something the other person can live with.' },
  ],
  cat_love: [
    { min: 0, max: 0.35, lede: 'A slow reply is just a slow reply. Once they are in, they stay close.' },
    { min: 0.35, max: 0.65, lede: 'Wants a real check-in, and still keeps a little distance.' },
    { min: 0.65, max: 1.01, lede: 'A pause can start to feel like pulling away. Lighter, over text, is easier.' },
  ],
  cat_independence: [
    { min: 0, max: 0.35, lede: 'A path already set is fine. A day can land without much connection.' },
    { min: 0.35, max: 0.65, lede: 'Own way some days, a real check-in on others.' },
    { min: 0.65, max: 1.01, lede: 'Would rather pick the path, and still needs a real connection for a day to land.' },
  ],
};

export function fallbackBandFor(id: CategoryId, score: number): string {
  const bands = CATEGORY_FALLBACK_BANDS[id];
  const n = Number.isFinite(score) ? Math.min(1, Math.max(0, score)) : 0.5;
  const hit = bands.find((band) => n >= band.min && n < band.max) ?? bands[bands.length - 1]!;
  return hit.lede;
}

/** Map score: average of x and y so the same 3-band table can serve as a last resort. */
export function mapScore(x: number, y: number): number {
  return (x + y) / 2;
}

type MapQuad = 'low_low' | 'high_low' | 'low_high' | 'high_high';

/** UNREVIEWED map-quadrant lines. Used when both axes are independently stable. */
export const MAP_QUADRANT_BANDS: Record<'cat_love' | 'cat_independence', Record<MapQuad, string>> = {
  cat_love: {
    low_low: 'A slow reply is just a slow reply. Once they are in, they stay close.',
    high_low: 'A pause can start to feel like pulling away. Once they are in, they stay close.',
    low_high: 'A slow reply is just a slow reply. Lighter, with some distance, is easier.',
    high_high: 'A pause can start to feel like pulling away. Lighter, with some distance, is easier.',
  },
  cat_independence: {
    low_low: 'A path already set is fine. A day can land without much connection.',
    high_low: 'Would rather pick the path. A day can land without much connection.',
    low_high: 'A path already set is fine, and a real connection is how a day lands.',
    high_high: 'Would rather pick the path, and still needs a real connection for a day to land.',
  },
};

export function fallbackForReading(reading: {
  def: { id: CategoryId; shape: 'bar' | 'map' };
  bar: number | null;
  map: { x: number; y: number } | null;
}): string {
  if (reading.def.shape === 'map' && reading.map) {
    const quad: MapQuad = `${reading.map.x >= 0.5 ? 'high' : 'low'}_${reading.map.y >= 0.5 ? 'high' : 'low'}`;
    const table = MAP_QUADRANT_BANDS[reading.def.id as 'cat_love' | 'cat_independence'];
    if (table) return table[quad];
    return fallbackBandFor(reading.def.id, mapScore(reading.map.x, reading.map.y));
  }
  return fallbackBandFor(reading.def.id, reading.bar ?? 0.5);
}

export function fallbackCategoryCopies(
  tracks: readonly TraitTrack[],
): Partial<Record<CategoryId, CategoryCopy>> {
  const out: Partial<Record<CategoryId, CategoryCopy>> = {};
  for (const reading of readAllCategories(tracks)) {
    if (!reading.ready) continue;
    const line = fallbackForReading(reading);
    out[reading.def.id] = { line, full: line };
  }
  return out;
}

export function categoryBandCopyClean(): boolean {
  for (const bands of Object.values(CATEGORY_FALLBACK_BANDS)) {
    for (const band of bands) {
      if (containsFrameworkTerm(band.lede)) return false;
    }
  }
  for (const table of Object.values(MAP_QUADRANT_BANDS)) {
    for (const line of Object.values(table)) {
      if (containsFrameworkTerm(line)) return false;
    }
  }
  return true;
}
