/**
 * Eight profile categories. Math reads the self-report track only.
 * Gut-call never enters a bar or a map — Sage-divergence stays intact.
 * Confirm-upgrade does not change numbers, so it does not change category math.
 */
import {
  effectiveStability,
  trackFor,
  type TraitTrack,
} from '@/lib/trait-stability';
import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';

export const CATEGORY_COPY_REVIEWED = false;

export type CategoryId =
  | 'cat_steadiness'
  | 'cat_openness'
  | 'cat_drive'
  | 'cat_agency'
  | 'cat_social'
  | 'cat_communication'
  | 'cat_love'
  | 'cat_independence';

export type CategoryShape = 'bar' | 'map';

export interface CategoryDef {
  id: CategoryId;
  name: string;
  shape: CategoryShape;
  /** Report-track axes that enter the number. Equal weights unless noted. */
  axes: readonly TraitAxis[];
  weights: Partial<Record<TraitAxis, number>>;
  minStable: number;
  /** Shown as texture under a map. Never part of the math. */
  texture: readonly TraitAxis[];
}

export const CATEGORY_DEFS: readonly CategoryDef[] = [
  {
    id: 'cat_steadiness',
    name: 'Steadiness',
    shape: 'bar',
    axes: ['conscientiousness', 'agreeableness', 'steadiness'],
    weights: { conscientiousness: 1, agreeableness: 1, steadiness: 1 },
    minStable: 2,
    texture: [],
  },
  {
    id: 'cat_openness',
    name: 'Openness to life',
    shape: 'bar',
    axes: ['openness', 'extraversion'],
    weights: { openness: 1, extraversion: 1 },
    minStable: 2,
    texture: [],
  },
  {
    id: 'cat_drive',
    name: 'Drive',
    shape: 'bar',
    axes: ['autonomy', 'competence', 'relatedness'],
    weights: { autonomy: 1, competence: 1, relatedness: 1 },
    minStable: 2,
    texture: [],
  },
  {
    id: 'cat_agency',
    name: 'Agency',
    shape: 'bar',
    axes: ['growth_mindset', 'locus_of_control', 'self_efficacy'],
    weights: { growth_mindset: 1, locus_of_control: 1, self_efficacy: 1 },
    minStable: 2,
    texture: [],
  },
  {
    id: 'cat_social',
    name: 'Everyday social energy',
    shape: 'bar',
    axes: ['extraversion', 'agreeableness', 'playfulness'],
    weights: { extraversion: 1, agreeableness: 1, playfulness: 1 },
    minStable: 2,
    texture: [],
  },
  {
    id: 'cat_communication',
    name: 'Communication',
    shape: 'bar',
    axes: ['conflict_assertiveness', 'conflict_cooperativeness'],
    weights: { conflict_assertiveness: 1, conflict_cooperativeness: 1 },
    minStable: 2,
    texture: [],
  },
  {
    id: 'cat_love',
    name: 'Love / closeness',
    shape: 'map',
    axes: ['attachment_anxiety', 'attachment_avoidance'],
    weights: { attachment_anxiety: 1, attachment_avoidance: 1 },
    minStable: 2,
    texture: ['conflict_assertiveness', 'conflict_cooperativeness'],
  },
  {
    id: 'cat_independence',
    name: 'Independence & closeness',
    shape: 'map',
    axes: ['autonomy', 'relatedness'],
    weights: { autonomy: 1, relatedness: 1 },
    minStable: 2,
    texture: [],
  },
];

export function categoryById(id: string): CategoryDef | null {
  return CATEGORY_DEFS.find((row) => row.id === id) ?? null;
}

function reportStable(
  tracks: readonly TraitTrack[],
  axis: TraitAxis,
  now: Date = new Date(),
): { value: number; stability: number } | null {
  const row = trackFor(tracks, axis, 'report');
  if (!row) return null;
  const stability = effectiveStability(row, now);
  if (stability <= 0) return null;
  return { value: row.value, stability };
}

export interface CategoryReading {
  def: CategoryDef;
  ready: boolean;
  /** Weighted mean of stable report-track axes. Null when not ready. */
  bar: number | null;
  /** Map x/y from the two axes in def.axes order. Null when the map must not render. */
  map: { x: number; y: number } | null;
  stableAxes: TraitAxis[];
  texture: Array<{ axis: TraitAxis; value: number }>;
}

/**
 * Bars: enough listed axes past the existing stability floor.
 * Maps: BOTH axes must independently clear the floor or the map does not render.
 * Game track is never read.
 */
export function readCategory(
  def: CategoryDef,
  tracks: readonly TraitTrack[],
  now: Date = new Date(),
): CategoryReading {
  const stable: Array<{ axis: TraitAxis; value: number; stability: number }> = [];
  for (const axis of def.axes) {
    const hit = reportStable(tracks, axis, now);
    if (hit) stable.push({ axis, ...hit });
  }
  const texture: Array<{ axis: TraitAxis; value: number }> = [];
  for (const axis of def.texture) {
    const hit = reportStable(tracks, axis, now);
    if (hit) texture.push({ axis, value: hit.value });
  }

  if (def.shape === 'map') {
    if (stable.length < 2) {
      return { def, ready: false, bar: null, map: null, stableAxes: stable.map((row) => row.axis), texture };
    }
    const x = stable.find((row) => row.axis === def.axes[0]);
    const y = stable.find((row) => row.axis === def.axes[1]);
    if (!x || !y) {
      return { def, ready: false, bar: null, map: null, stableAxes: stable.map((row) => row.axis), texture };
    }
    return {
      def,
      ready: true,
      bar: null,
      map: { x: x.value, y: y.value },
      stableAxes: [x.axis, y.axis],
      texture,
    };
  }

  const ready = stable.length >= def.minStable;
  if (!ready) {
    return { def, ready: false, bar: null, map: null, stableAxes: stable.map((row) => row.axis), texture };
  }
  let num = 0;
  let den = 0;
  for (const row of stable) {
    const w = def.weights[row.axis] ?? 1;
    num += row.value * w;
    den += w;
  }
  return {
    def,
    ready: true,
    bar: den > 0 ? num / den : null,
    map: null,
    stableAxes: stable.map((row) => row.axis),
    texture,
  };
}

export function readAllCategories(
  tracks: readonly TraitTrack[],
  now: Date = new Date(),
): CategoryReading[] {
  return CATEGORY_DEFS.map((def) => readCategory(def, tracks, now));
}

export function readyCategories(
  tracks: readonly TraitTrack[],
  now: Date = new Date(),
): CategoryReading[] {
  return readAllCategories(tracks, now).filter((row) => row.ready);
}

export function allCategoriesReady(tracks: readonly TraitTrack[], now: Date = new Date()): boolean {
  return readAllCategories(tracks, now).every((row) => row.ready);
}

export function categoriesFingerprint(tracks: readonly TraitTrack[], now: Date = new Date()): string {
  return readAllCategories(tracks, now)
    .map((row) => {
      if (!row.ready) return `${row.def.id}:0`;
      if (row.map) return `${row.def.id}:m:${row.map.x.toFixed(2)}:${row.map.y.toFixed(2)}`;
      return `${row.def.id}:b:${(row.bar ?? 0).toFixed(2)}`;
    })
    .join('|');
}

export function categoriesTiedToAxes(axes: readonly TraitAxis[]): CategoryId[] {
  const out: CategoryId[] = [];
  for (const def of CATEGORY_DEFS) {
    if (def.axes.some((axis) => axes.includes(axis))) out.push(def.id);
  }
  return out;
}

/** ~1 in 4 fully random among ready; otherwise prefer categories tied to signal axes. */
export function pickTeaserCategory(
  ready: readonly CategoryReading[],
  signalAxes: readonly TraitAxis[],
  roll: number,
): CategoryId | null {
  if (ready.length === 0) return null;
  const ids = ready.map((row) => row.def.id);
  const n = ids.length;
  const randomPick = ids[Math.min(n - 1, Math.floor(Math.max(0, Math.min(0.999, roll)) * n))]!;
  if (roll < 0.25 || signalAxes.length === 0) return randomPick;
  const tied = ids.filter((id) => {
    const def = categoryById(id);
    return def ? def.axes.some((axis) => signalAxes.includes(axis)) : false;
  });
  if (tied.length === 0) return randomPick;
  const t = (roll - 0.25) / 0.75;
  return tied[Math.min(tied.length - 1, Math.floor(Math.max(0, Math.min(0.999, t)) * tied.length))]!;
}

export function nextSpotlight(
  ready: readonly CategoryReading[],
  lastId: string | null,
): CategoryId | null {
  if (ready.length === 0) return null;
  const ids = ready.map((row) => row.def.id);
  if (!lastId) return ids[0]!;
  const at = ids.indexOf(lastId as CategoryId);
  return ids[(at + 1) % ids.length]!;
}

export function categoryCopyClean(): boolean {
  return CATEGORY_DEFS.every((row) => !containsFrameworkTerm(row.name));
}

export function parseSpotlight(raw: unknown): { weekKey: string; categoryId: CategoryId } | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const weekKey = typeof row.weekKey === 'string' ? row.weekKey : '';
  const categoryId = typeof row.categoryId === 'string' ? row.categoryId : '';
  if (!weekKey || !categoryById(categoryId)) return null;
  return { weekKey, categoryId: categoryId as CategoryId };
}

/** Stable 0–1 roll from a daily seed so the teaser does not change on app-open. */
export function dailyTeaserRoll(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

export function signalAxesFrom(
  touched: Record<string, string> | undefined,
  extra: readonly string[] = [],
): TraitAxis[] {
  const out: TraitAxis[] = [];
  const seen = new Set<string>();
  const push = (value: string | null | undefined) => {
    if (!value || seen.has(value)) return;
    if (!(TRAIT_AXES as readonly string[]).includes(value)) return;
    seen.add(value);
    out.push(value as TraitAxis);
  };
  for (const value of extra) push(value);
  const ranked = Object.entries(touched ?? {}).sort((a, b) => (a[1] < b[1] ? 1 : a[1] > b[1] ? -1 : 0));
  for (const [axis] of ranked) push(axis);
  return out;
}

export { TRAIT_AXES };
