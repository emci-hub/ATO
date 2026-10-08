/**
 * Story v2 thread picker (emci, 2026-10-08; docs/proposals/story-v2-plan.md).
 *
 * The app, not the model, decides what one Story is about: rank the axes by
 * how far they lean, pick the best 1–2 ready categories (A, and B when it is
 * close enough and does not repeat A), and pick at most one joke target, the
 * strongest shareable lean inside them. Pure: no network, no model, no clock
 * beyond `now` for category readiness.
 */
import { AXIS_POLE_NAME } from '@/lib/axis-poles';
import { getCategoryDefs, readAllCategories, type CategoryId, type CategoryReading } from '@/lib/categories';
import { CLEAR_LEAN_MARGIN } from '@/lib/daily-line/pick';
import { isShareableLean } from '@/lib/legends64/identity';
import { trackFor, type TraitTrack } from '@/lib/trait-stability';
import { TRAIT_AXES, type TraitAxis, type TraitLean } from '@/lib/traits';

/** Saved next to the Story body in `me.sage_story` so the next load can take a new angle. */
export interface StoryThreadRecord {
  categories: CategoryId[];
  jokeAxis: TraitAxis | null;
}

export interface RankedAxis {
  axis: TraitAxis;
  value: number;
  /** |value − 0.5|, 0–0.5. */
  strength: number;
  lean: TraitLean;
}

export interface ScoredCategory {
  reading: CategoryReading;
  score: number;
  /** The category's own strongest stable axis, for its pole word and the tension bonus. */
  lead: RankedAxis | null;
}

export interface StoryThread {
  categories: ScoredCategory[];
  joke: RankedAxis | null;
}

/** Share of A's score B must reach to join the story. */
export const STORY_B_MIN_SHARE = 0.6;
/** Score multiplier per axis B shares with A. */
export const STORY_SHARED_AXIS_PENALTY = 0.5;
/** Score multiplier when B's lead leans the opposite way to A's. */
export const STORY_TENSION_BONUS = 1.25;
/** How many combos "Load a new story" rotates through. */
export const STORY_COMBO_POOL = 3;

function axisReading(tracks: readonly TraitTrack[], axis: TraitAxis): RankedAxis | null {
  const row = trackFor(tracks, axis, 'report');
  if (!row || row.answerCount < 1 || !Number.isFinite(row.value)) return null;
  const strength = Math.abs(row.value - 0.5);
  return { axis, value: row.value, strength, lean: row.value >= 0.5 ? 'high' : 'low' };
}

/** Axes that lean clearly (answered, |value − 0.5| ≥ CLEAR_LEAN_MARGIN), strongest first. */
export function rankStoryAxes(tracks: readonly TraitTrack[]): RankedAxis[] {
  const rows: RankedAxis[] = [];
  for (const axis of TRAIT_AXES) {
    const hit = axisReading(tracks, axis);
    if (hit && hit.strength >= CLEAR_LEAN_MARGIN) rows.push(hit);
  }
  // Explicit index tie-break: Hermes' sort is not guaranteed stable.
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => b.row.strength - a.row.strength || a.index - b.index)
    .map(({ row }) => row);
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Score one ready category. Bars: mean axis strength + |bar − 0.5|. Maps: distance from centre + mean axis strength. */
export function scoreCategory(reading: CategoryReading, tracks: readonly TraitTrack[]): ScoredCategory {
  const axes = reading.stableAxes
    .map((axis) => axisReading(tracks, axis))
    .filter((row): row is RankedAxis => row != null);
  const meanStrength = mean(axes.map((row) => row.strength));
  let score = meanStrength;
  if (reading.map) {
    score += Math.hypot(reading.map.x - 0.5, reading.map.y - 0.5);
  } else if (reading.bar != null) {
    score += Math.abs(reading.bar - 0.5);
  }
  let lead: RankedAxis | null = null;
  // Only a clear lean may be the lead: its pole word and the tension bonus need a real side.
  for (const row of axes) {
    if (row.strength >= CLEAR_LEAN_MARGIN && (!lead || row.strength > lead.strength)) lead = row;
  }
  return { reading, score, lead };
}

/** Ready categories, best first. */
export function scoreReadyCategories(tracks: readonly TraitTrack[], now: Date = new Date()): ScoredCategory[] {
  return readAllCategories(tracks, now)
    .filter((reading) => reading.ready)
    .map((reading, index) => ({ scored: scoreCategory(reading, tracks), index }))
    .sort((a, b) => b.scored.score - a.scored.score || a.index - b.index)
    .map(({ scored }) => scored);
}

function sharedAxes(a: CategoryReading, b: CategoryReading): number {
  return b.def.axes.filter((axis) => a.def.axes.includes(axis)).length;
}

/** B's score once overlap and tension are counted, or null when B may not join A. */
export function partnerScore(a: ScoredCategory, b: ScoredCategory): number | null {
  const shared = sharedAxes(a.reading, b.reading);
  if (shared > 1) return null;
  let score = b.score * STORY_SHARED_AXIS_PENALTY ** shared;
  if (a.lead && b.lead && a.lead.axis !== b.lead.axis && a.lead.lean !== b.lead.lean) {
    score *= STORY_TENSION_BONUS;
  }
  return score >= a.score * STORY_B_MIN_SHARE ? score : null;
}

function bestPartner(a: ScoredCategory, pool: readonly ScoredCategory[]): ScoredCategory | null {
  let best: { row: ScoredCategory; score: number } | null = null;
  for (const row of pool) {
    if (row.reading.def.id === a.reading.def.id) continue;
    const score = partnerScore(a, row);
    if (score != null && (!best || score > best.score)) best = { row, score };
  }
  return best?.row ?? null;
}

function comboKey(ids: readonly CategoryId[]): string {
  return [...ids].sort().join('+');
}

/** Up to STORY_COMBO_POOL distinct combos, best first: each ready category as A with its best B. */
export function rankStoryCombos(scored: readonly ScoredCategory[]): ScoredCategory[][] {
  const out: ScoredCategory[][] = [];
  const seen = new Set<string>();
  for (const a of scored) {
    const b = bestPartner(a, scored);
    const combo = b ? [a, b] : [a];
    const key = comboKey(combo.map((row) => row.reading.def.id));
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(combo);
    if (out.length >= STORY_COMBO_POOL) break;
  }
  return out;
}

/** The strongest clear, shareable lean inside the chosen categories. Never one when crisis is on. */
export function pickJokeTarget(
  tracks: readonly TraitTrack[],
  categories: readonly ScoredCategory[],
  crisisToday: boolean,
): RankedAxis | null {
  if (crisisToday) return null;
  const inThread = new Set<TraitAxis>(categories.flatMap((row) => row.reading.stableAxes));
  for (const row of rankStoryAxes(tracks)) {
    if (inThread.has(row.axis) && isShareableLean(row.axis, row.lean)) return row;
  }
  return null;
}

/**
 * The thread for one Story. Null when no category is ready (the Story stays
 * locked, same as `storyReady`). Takes the best combo that is not `last`;
 * with only one combo, reuses it.
 */
export function pickStoryThread(input: {
  tracks: readonly TraitTrack[];
  last: StoryThreadRecord | null;
  crisisToday: boolean;
  now?: Date;
}): StoryThread | null {
  const combos = rankStoryCombos(scoreReadyCategories(input.tracks, input.now));
  if (combos.length === 0) return null;
  const lastKey = input.last ? comboKey(input.last.categories) : null;
  const combo = combos.find((row) => comboKey(row.map((c) => c.reading.def.id)) !== lastKey) ?? combos[0]!;
  return { categories: combo, joke: pickJokeTarget(input.tracks, combo, input.crisisToday) };
}

export function threadRecord(thread: StoryThread): StoryThreadRecord {
  return {
    categories: thread.categories.map((row) => row.reading.def.id),
    jokeAxis: thread.joke?.axis ?? null,
  };
}

/** Every axis the thread covers, for the tension-line gate. */
export function threadAxes(thread: StoryThread): TraitAxis[] {
  return [...new Set(thread.categories.flatMap((row) => row.reading.def.axes))];
}

/** The pole word for an axis lean, e.g. "Watchful". */
export function poleWord(row: RankedAxis): string {
  return AXIS_POLE_NAME[row.axis][row.lean];
}

/** Safe read of a saved thread. Anything unexpected becomes null. */
export function parseStoryThreadRecord(raw: unknown): StoryThreadRecord | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  if (!Array.isArray(row.categories)) return null;
  const known = new Set<string>(getCategoryDefs().map((def) => def.id));
  const categories = row.categories.filter(
    (id): id is CategoryId => typeof id === 'string' && known.has(id),
  );
  if (categories.length === 0 || categories.length > 2) return null;
  const jokeAxis =
    typeof row.jokeAxis === 'string' && (TRAIT_AXES as readonly string[]).includes(row.jokeAxis)
      ? (row.jokeAxis as TraitAxis)
      : null;
  return { categories, jokeAxis };
}
