/**
 * Fallback lines for category summaries: what a category row on Explore says
 * until its AI card is loaded (and when AI is off). Written in the moment voice
 * (src/lib/voice/moment-voice.ts), second person, describing and never advising.
 * emci approved 2026-10-02.
 */
import type { CategoryId } from '@/lib/categories';
import { readAllCategories } from '@/lib/categories';
import type { CategoryCopy } from '@/lib/sage-title';
import type { TraitTrack } from '@/lib/trait-stability';
import { leanHighLow, TRAIT_BAND_HIGH_CUT, TRAIT_BAND_LOW_CUT } from '@/lib/traits';
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';

export const CATEGORY_BAND_COPY_REVIEWED = true;

export interface CategoryBand {
  /** Inclusive low, exclusive high except the last band. */
  min: number;
  max: number;
  lede: string;
}

/** 3–5 plain lines per category, keyed by bar 0–1 or map-quadrant score. */
export const CATEGORY_FALLBACK_BANDS: Record<CategoryId, readonly CategoryBand[]> = {
  cat_steadiness: [
    { min: 0, max: TRAIT_BAND_LOW_CUT, lede: 'Plans stay loose with you, and one small knock can stay for the afternoon.' },
    { min: TRAIT_BAND_LOW_CUT, max: TRAIT_BAND_HIGH_CUT, lede: 'Some days you follow through, some days you wobble. It depends which day you ask.' },
    { min: TRAIT_BAND_HIGH_CUT, max: 1.01, lede: 'You finish the plan and forget the bad morning by lunch.' },
  ],
  cat_openness: [
    { min: 0, max: TRAIT_BAND_LOW_CUT, lede: 'You like the known route and the quieter room, and you would pick both again.' },
    { min: TRAIT_BAND_LOW_CUT, max: TRAIT_BAND_HIGH_CUT, lede: 'Mostly the familiar, with the occasional detour when someone talks you into it.' },
    { min: TRAIT_BAND_HIGH_CUT, max: 1.01, lede: 'You said yes to the new thing, and it helped that people were going.' },
  ],
  cat_drive: [
    { min: 0, max: TRAIT_BAND_LOW_CUT, lede: 'A plan someone else made is fine by you, and a hard task gets a long look first.' },
    { min: TRAIT_BAND_LOW_CUT, max: TRAIT_BAND_HIGH_CUT, lede: 'Some days you pick the path. Some days you take the one already there.' },
    { min: TRAIT_BAND_HIGH_CUT, max: 1.01, lede: 'You want it done your way, and you figure you can handle the hard part.' },
  ],
  cat_agency: [
    { min: 0, max: TRAIT_BAND_LOW_CUT, lede: 'When it falls apart, you tend to figure it was going to, and that road can feel closed.' },
    { min: TRAIT_BAND_LOW_CUT, max: TRAIT_BAND_HIGH_CUT, lede: 'Sometimes you look for what to change. Sometimes you let it be.' },
    { min: TRAIT_BAND_HIGH_CUT, max: 1.01, lede: 'After a miss you go looking for what to change, and the bigger ask still looks doable.' },
  ],
  cat_social: [
    { min: 0, max: TRAIT_BAND_LOW_CUT, lede: 'Quiet is how you reset, and the jokes can wait until you have had some.' },
    { min: TRAIT_BAND_LOW_CUT, max: TRAIT_BAND_HIGH_CUT, lede: 'People and jokes come out when the day has room for them.' },
    { min: TRAIT_BAND_HIGH_CUT, max: 1.01, lede: 'You make the plans, fill the room, and keep it light while you do.' },
  ],
  cat_communication: [
    { min: 0, max: TRAIT_BAND_LOW_CUT, lede: 'In a disagreement you go quiet and hold on to what you came for.' },
    { min: TRAIT_BAND_LOW_CUT, max: TRAIT_BAND_HIGH_CUT, lede: 'Sometimes you say your piece. Sometimes you leave the room for theirs.' },
    { min: TRAIT_BAND_HIGH_CUT, max: 1.01, lede: 'You say your piece out loud and still look for the version they can live with.' },
  ],
  cat_love: [
    { min: 0, max: TRAIT_BAND_LOW_CUT, lede: 'A slow reply is just a slow reply to you, and once in, you stay close.' },
    { min: TRAIT_BAND_LOW_CUT, max: TRAIT_BAND_HIGH_CUT, lede: 'You want a real check-in and still keep a little room for yourself.' },
    { min: TRAIT_BAND_HIGH_CUT, max: 1.01, lede: 'A pause can feel like someone pulling away, and a text feels safer than a call.' },
  ],
  cat_independence: [
    { min: 0, max: TRAIT_BAND_LOW_CUT, lede: 'A plan someone else made suits you, and a day can go fine without much contact.' },
    { min: TRAIT_BAND_LOW_CUT, max: TRAIT_BAND_HIGH_CUT, lede: 'Your own way some days, a real check-in on others.' },
    { min: TRAIT_BAND_HIGH_CUT, max: 1.01, lede: 'You want to pick the path, and you still need someone real in the day for it to count.' },
  ],
  cat_levity: [
    { min: 0, max: TRAIT_BAND_LOW_CUT, lede: 'A hard talk is a job to you. The lightness can wait until it is done.' },
    { min: TRAIT_BAND_LOW_CUT, max: TRAIT_BAND_HIGH_CUT, lede: 'Sometimes you leave a little air in a hard talk. Sometimes you do not.' },
    { min: TRAIT_BAND_HIGH_CUT, max: 1.01, lede: 'Even your hard talks have a bit of air in them.' },
  ],
  cat_structure: [
    { min: 0, max: TRAIT_BAND_LOW_CUT, lede: 'The plan drifts once the day gets boring, and something new does not pull that hard either.' },
    { min: TRAIT_BAND_LOW_CUT, max: TRAIT_BAND_HIGH_CUT, lede: 'Some days the plan holds. Some days a new idea wins.' },
    { min: TRAIT_BAND_HIGH_CUT, max: 1.01, lede: 'You finish the plan even when it drags, and still keep a tab open for what is next.' },
  ],
  cat_resilience: [
    { min: 0, max: TRAIT_BAND_LOW_CUT, lede: 'A hard task can make you doubt yourself, and a miss can feel like the end of that road.' },
    { min: TRAIT_BAND_LOW_CUT, max: TRAIT_BAND_HIGH_CUT, lede: 'Some days the hard thing looks doable. A knock lingers, then fades.' },
    { min: TRAIT_BAND_HIGH_CUT, max: 1.01, lede: 'Hard things look handleable to you, a miss is a note for next time, and a knock is gone by lunch.' },
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

/** Map-quadrant lines. Used when both axes are independently stable. */
export const MAP_QUADRANT_BANDS: Record<
  'cat_love' | 'cat_independence' | 'cat_structure',
  Record<MapQuad, string>
> = {
  cat_love: {
    low_low: 'A slow reply is just a slow reply to you, and once in, you stay close.',
    high_low: 'A pause can feel like someone pulling away, and you move closer anyway.',
    low_high: 'A slow reply does not bother you, and you like a little distance of your own.',
    high_high: 'A pause can feel like someone pulling away, and you keep some distance just in case.',
  },
  cat_independence: {
    low_low: 'A plan someone else made suits you, and a day can go fine without much contact.',
    high_low: 'You pick your own path, and a day can go fine without much contact.',
    low_high: 'A plan someone else made suits you, as long as your people are in it.',
    high_high: 'You want to pick the path, and you still need someone real in the day for it to count.',
  },
  cat_structure: {
    low_low: 'You like a set path, and it still drifts once the day gets boring.',
    high_low: 'You trade the plan for something new quickly, and let the new thing drift just as fast.',
    low_high: 'You like a set path and you stay on it, even on the boring days.',
    high_high: 'You chase the new thing and still finish the plan you already made.',
  },
};

export function fallbackForReading(reading: {
  def: { id: CategoryId; shape: 'bar' | 'map' };
  bar: number | null;
  map: { x: number; y: number } | null;
}): string {
  if (reading.def.shape === 'map' && reading.map) {
    const quad: MapQuad = `${leanHighLow(reading.map.x)}_${leanHighLow(reading.map.y)}`;
    const table =
      MAP_QUADRANT_BANDS[reading.def.id as 'cat_love' | 'cat_independence' | 'cat_structure'];
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
