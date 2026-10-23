/**
 * Shared library — category deep dives (wave93).
 *
 * Bucket: the category + each of its traits as one of three states: leans to
 * the high side (h), leans to the low side (l), or in the middle (m, under
 * 60%). 207 buckets across the 11 categories, so the library can fill. The
 * exact "Adventurous 78%" stays on the reader's own phone, above the card.
 *
 * One AI call writes TWO cards for the same bucket from two different angles
 * (with people / at work / in your own time), so people side by side in the
 * same bucket get different cards.
 */
import { categoryById } from '@/lib/categories';
import {
  buildDiveBundlePrompt,
  diveOutputTokens,
  parseDiveCard,
  parseStoredDive,
  type CategoryDive,
  type DiveLean,
  type DiveSpec,
} from '@/lib/category-deep-dive/dive';
import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';
import { cardJokeStyle } from '@/lib/voice/card-joke';

import { LIBRARY_VERSION, type LibraryKindSpec, type LibraryParse } from './types';

/** Under this (50–100 scale) a trait counts as "in the middle". */
export const DIVE_MIDDLE_BELOW = 60;

export type DiveAxisState = 'h' | 'l' | 'm';

export const DIVE_ANGLES = {
  people: 'with other people: friends, family, a group',
  work: 'at work, at school or in a shared task',
  solo: 'in the reader’s own time: errands, hobbies, a free evening',
} as const;
export type DiveAngle = keyof typeof DIVE_ANGLES;
const ANGLE_IDS = Object.keys(DIVE_ANGLES) as DiveAngle[];

export interface DiveBucket {
  key: string;
  categoryId: string;
  states: { axis: TraitAxis; state: DiveAxisState }[];
}

export function diveAxisState(lean: Pick<DiveLean, 'lean' | 'pct'>): DiveAxisState {
  if (lean.pct < DIVE_MIDDLE_BELOW) return 'm';
  return lean.lean === 'high' ? 'h' : 'l';
}

/** The reader's bucket in one category (from the same leanings the rows show). */
export function diveBucketKey(categoryId: string, leans: readonly DiveLean[]): string {
  const parts = [...leans]
    .sort((a, b) => TRAIT_AXES.indexOf(a.axis) - TRAIT_AXES.indexOf(b.axis))
    .map((row) => `${row.axis}:${diveAxisState(row)}`);
  return `dd|${categoryId}|${parts.join(',')}`;
}

/** Every bucket a category can have (for the root seed run): 3^traits. */
export function allDiveBuckets(categoryId: string): string[] {
  const def = categoryById(categoryId);
  if (!def) return [];
  const axes = [...def.axes].sort((a, b) => TRAIT_AXES.indexOf(a) - TRAIT_AXES.indexOf(b));
  let combos: string[][] = [[]];
  for (const axis of axes) {
    combos = combos.flatMap((row) => (['h', 'l', 'm'] as const).map((state) => [...row, `${axis}:${state}`]));
  }
  return combos.map((row) => `dd|${categoryId}|${row.join(',')}`);
}

export function parseDiveBucket(key: string): DiveBucket | null {
  const m = /^dd\|(cat_[a-z]{2,20})\|([a-z_]+:[hlm](?:,[a-z_]+:[hlm]){0,5})$/.exec(key);
  if (!m) return null;
  const def = categoryById(m[1]!);
  if (!def) return null;
  const states = m[2]!.split(',').map((part) => {
    const [axis, state] = part.split(':') as [string, DiveAxisState];
    return { axis: axis as TraitAxis, state };
  });
  // Exactly the category's own traits, each once, in trait order: one key per bucket.
  const want = [...def.axes].sort((a, b) => TRAIT_AXES.indexOf(a) - TRAIT_AXES.indexOf(b));
  if (states.length !== want.length || states.some((row, i) => row.axis !== want[i])) return null;
  return { key, categoryId: def.id, states };
}

/** The leanings the prompt sees: leaning traits first, middle ones after. */
function bucketLeans(bucket: DiveBucket): DiveLean[] {
  const leaning = bucket.states.filter((row) => row.state !== 'm');
  const middle = bucket.states.filter((row) => row.state === 'm');
  return [
    ...leaning.map((row) => ({ axis: row.axis, lean: row.state === 'h' ? ('high' as const) : ('low' as const), pct: 70 })),
    ...middle.map((row) => ({ axis: row.axis, lean: 'high' as const, pct: 55, middle: true })),
  ];
}

function specFor(bucket: DiveBucket, angle: string): DiveSpec {
  const def = categoryById(bucket.categoryId)!;
  return {
    def,
    leans: bucketLeans(bucket),
    // Seeded by the bucket and angle, never the person: the card is shared.
    jokeStyle: cardJokeStyle(`${bucket.key}|${angle}`),
    angle: DIVE_ANGLES[angle as DiveAngle] ?? undefined,
  };
}

export const DEEP_DIVE_LIBRARY: LibraryKindSpec<DiveBucket, CategoryDive> = {
  kind: 'deep_dive',
  parseBucket: parseDiveBucket,
  angles: () => ANGLE_IDS,
  cardsPerCall: 2,
  buildPrompt(bucket, angles) {
    const specs = angles.map((angle) => specFor(bucket, angle));
    return { prompt: buildDiveBundlePrompt(specs), maxOutputTokens: diveOutputTokens(specs.length) };
  },
  parse(raw, bucket, angles): LibraryParse<CategoryDive> {
    let data: unknown;
    try {
      data = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ''));
    } catch {
      return { cards: [], reason: 'not json' };
    }
    const list = (data as { cards?: unknown } | null)?.cards;
    const items: unknown[] = Array.isArray(list) ? list : [data];
    const cards: LibraryParse<CategoryDive>['cards'] = [];
    let reason: string | null = null;
    angles.forEach((angle, i) => {
      const res = parseDiveCard(items[i], specFor(bucket, angle));
      if (res.dive) {
        cards.push({ angle, card: { ...res.dive, leansKey: `${LIBRARY_VERSION.deep_dive}|${bucket.key}` } });
      } else {
        reason ??= res.reason;
      }
    });
    return { cards, reason: cards.length > 0 ? null : (reason ?? 'no card') };
  },
  readCard: parseStoredDive,
};
