/**
 * Legend figures — the hall walk (no AI).
 *
 * The person picks a hall. It shows three "???" frames with no clue. Each
 * frame hides a legend from that hall matched to the person's trait sides and
 * best categories; tapping one reveals it, and the frame refills from the
 * hall's next legend. Pure: the same (tracks, user, day, hall, museum) always
 * gives the same order, so a re-open shows the same frames and two people
 * rarely share one.
 *
 *   order    — every legend in the hall not met yet, as a weighted-random
 *              order (Efraimidis–Spirakis: largest u^(1/w) first, seeded by
 *              user + day + hall). w = pole match (top 4 clear leans count
 *              full, the rest half; axes of the best 1–2 categories ×1.25; a
 *              legend tagged with the OPPOSITE side of a clear lean loses
 *              points), floored so every legend can still come up. A legend
 *              born on today's month-day goes first. Hidden legends join only
 *              when every trait side they need is a clear lean.
 *   frames   — the first three of the order, in shuffled positions; a met
 *              one is replaced in place by the next in the order.
 *   chapters — once every open legend in the hall is met, the frames hide
 *              new chapters instead: a met legend with an angle this person
 *              has not been told yet (least-chaptered, best-matched first).
 *
 * Fewer than `LEGEND_MIN_CLEAR_LEANS` clear leans = locked.
 */
import { AXIS_POLE_NAME } from '@/lib/axis-poles';
import { fnv1a } from '@/lib/daily-line/bank';
import { clearLeans } from '@/lib/daily-line/pick';
import { rankStoryAxes, scoreReadyCategories, type RankedAxis } from '@/lib/story-thread';
import type { TraitTrack } from '@/lib/trait-stability';
import type { TraitAxis } from '@/lib/traits';

import { LEGEND_ROSTER } from './roster';
import type { LegendFigure, LegendHall } from './types';

export const LEGEND_MIN_CLEAR_LEANS = 2;
/** Axes counted at full weight (the rest count half). */
export const LEGEND_TOP_AXES = 4;
export const LEGEND_CATEGORY_BONUS = 1.25;
export const LEGEND_OPPOSITE_PENALTY = 0.75;
/** Every legend keeps this much weight, so a weak match can still come up. */
export const LEGEND_WEIGHT_FLOOR = 0.05;
/** "???" frames per hall. */
export const LEGEND_FRAMES = 3;
/** Legends (or chapters) a person reveals per day, before the bonus. */
export const LEGEND_DAILY_REVEALS = 1;
/** One more when a new trait side settles after the day's first reveal. */
export const LEGEND_BONUS_REVEALS = 1;

export function legendLocked(tracks: readonly TraitTrack[]): boolean {
  return rankStoryAxes(tracks).length < LEGEND_MIN_CLEAR_LEANS;
}

/** Every trait side a hidden legend needs is a clear lean right now. */
export function hiddenUnlocked(legend: LegendFigure, ranked: readonly RankedAxis[]): boolean {
  if (!legend.hidden) return true;
  return legend.hidden.needs.every((need) => ranked.some((row) => row.axis === need.axis && row.lean === need.lean));
}

/** A legend's match score against the ranked clear leans. */
export function scoreLegend(
  legend: LegendFigure,
  ranked: readonly RankedAxis[],
  categoryAxes: ReadonlySet<TraitAxis>,
): { score: number; matched: TraitAxis[] } {
  let score = 0;
  const matched: TraitAxis[] = [];
  ranked.forEach((row, rank) => {
    const tag = legend.tags.find((t) => t.axis === row.axis);
    if (!tag) return;
    const weight = (rank < LEGEND_TOP_AXES ? 1 : 0.5) * (categoryAxes.has(row.axis) ? LEGEND_CATEGORY_BONUS : 1);
    if (tag.lean === row.lean) {
      score += row.strength * weight;
      matched.push(row.axis);
    } else {
      score -= row.strength * weight * LEGEND_OPPOSITE_PENALTY;
    }
  });
  return { score, matched };
}

/** Uniform (0,1] from a seed string. */
function unit(seed: string): number {
  return ((fnv1a(seed) % 1_000_000) + 1) / 1_000_001;
}

function monthDay(ymd: string): string {
  return ymd.slice(5, 10);
}

/** Axes of the person's best 1–2 ready categories. */
function topCategoryAxes(tracks: readonly TraitTrack[], now: Date): Set<TraitAxis> {
  return new Set<TraitAxis>(
    scoreReadyCategories(tracks, now)
      .slice(0, 2)
      .flatMap((row) => row.reading.def.axes),
  );
}

/** Weighted-random order, best weight most likely first; ties keep input order. */
function weightedOrder<T>(rows: readonly { item: T; key: string; weight: number }[], seed: string): T[] {
  return rows
    .map((row, index) => ({
      row,
      index,
      sortKey: unit(`${seed}|${row.key}`) ** (1 / Math.max(row.weight, 1e-6)),
    }))
    .sort((a, b) => b.sortKey - a.sortKey || a.index - b.index)
    .map(({ row }) => row.item);
}

export interface HallOrderInput {
  tracks: readonly TraitTrack[];
  userId: string;
  ymd: string;
  hall: LegendHall;
  /** Legend ids already in the museum. */
  met: ReadonlySet<string>;
  now?: Date;
  roster?: readonly LegendFigure[];
}

/** Today's order of not-yet-met legends in one hall (null when locked). */
export function hallOrder(input: HallOrderInput): string[] | null {
  const roster = input.roster ?? LEGEND_ROSTER;
  const ranked = rankStoryAxes(input.tracks);
  if (ranked.length < LEGEND_MIN_CLEAR_LEANS) return null;
  const categoryAxes = topCategoryAxes(input.tracks, input.now ?? new Date());
  const open = roster.filter(
    (legend) => legend.hall === input.hall && !input.met.has(legend.id) && hiddenUnlocked(legend, ranked),
  );
  const md = monthDay(input.ymd);
  const born = open.filter((legend) => legend.birthday?.md === md).map((legend) => legend.id);
  const rest = open
    .filter((legend) => !born.includes(legend.id))
    .map((legend) => ({
      item: legend.id,
      key: legend.id,
      weight: Math.max(scoreLegend(legend, ranked, categoryAxes).score, 0) + LEGEND_WEIGHT_FLOOR,
    }));
  return [...born, ...weightedOrder(rest, `${input.userId}|${input.ymd}|${input.hall}`)];
}

/** Every open legend in this hall is met: the frames hold chapters now. */
export function hallComplete(
  hall: LegendHall,
  tracks: readonly TraitTrack[],
  met: ReadonlySet<string>,
  roster: readonly LegendFigure[] = LEGEND_ROSTER,
): boolean {
  const ranked = rankStoryAxes(tracks);
  return roster.every((legend) => legend.hall !== hall || met.has(legend.id) || !hiddenUnlocked(legend, ranked));
}

/** A chapter frame key: `<legendId>#<angleId>`. */
export function chapterKey(legendId: string, angleId: string): string {
  return `${legendId}#${angleId}`;
}

export function parseFrameKey(key: string): { legendId: string; angleId: string | null } {
  const [legendId, angleId] = key.split('#');
  return { legendId: legendId ?? '', angleId: angleId ?? null };
}

export interface ChapterOrderInput {
  tracks: readonly TraitTrack[];
  userId: string;
  ymd: string;
  hall: LegendHall;
  /** legendId → angle ids this person has already been told. */
  told: ReadonlyMap<string, ReadonlySet<string>>;
  now?: Date;
  roster?: readonly LegendFigure[];
}

/**
 * Today's order of new chapters in a finished hall: round by round (each met
 * legend's next untold angle), so no legend gets a second new chapter before
 * every met legend has had one; inside a round, best-matched most likely first.
 */
export function chapterOrder(input: ChapterOrderInput): string[] {
  const roster = input.roster ?? LEGEND_ROSTER;
  const ranked = rankStoryAxes(input.tracks);
  const categoryAxes = topCategoryAxes(input.tracks, input.now ?? new Date());
  const seed = `${input.userId}|${input.ymd}|${input.hall}|chapters`;
  const legends = roster.filter((legend) => legend.hall === input.hall && input.told.has(legend.id));
  const untold = new Map(
    legends.map((legend) => {
      const done = input.told.get(legend.id)!;
      const angles = legend.angles.filter((angle) => !done.has(angle.id));
      const tie = (id: string) => unit(`${seed}|${legend.id}|${id}`);
      return [legend.id, [...angles].sort((a, b) => tie(a.id) - tie(b.id))] as const;
    }),
  );
  const out: string[] = [];
  const maxRounds = Math.max(0, ...legends.map((legend) => legend.angles.length));
  for (let round = 0; round < maxRounds; round += 1) {
    const rows = legends
      .filter((legend) => (untold.get(legend.id)?.length ?? 0) > round)
      .map((legend) => ({
        item: chapterKey(legend.id, untold.get(legend.id)![round]!.id),
        key: `${legend.id}|${round}`,
        weight: Math.max(scoreLegend(legend, ranked, categoryAxes).score, 0) + LEGEND_WEIGHT_FLOOR,
      }));
    out.push(...weightedOrder(rows, `${seed}|${round}`));
  }
  return out;
}

/**
 * The three frames: the order's first three in shuffled positions. Today's
 * reveals (`sequence`, in the order they happened) are replayed so each one
 * refills ITS frame with the next key in the order; anything else already
 * used (met on another phone) is skipped. null = nothing left for that frame.
 */
export function hallFrames(
  order: readonly string[],
  used: ReadonlySet<string>,
  seed: string,
  sequence: readonly string[] = [],
): (string | null)[] {
  const first = order.slice(0, LEGEND_FRAMES);
  const positions = first
    .map((key, index) => ({ key, index }))
    .sort((a, b) => unit(`${seed}|${a.key}`) - unit(`${seed}|${b.key}`) || a.index - b.index)
    .map(({ key }) => key);
  const slots: (string | null)[] = Array.from({ length: LEGEND_FRAMES }, (_, i) => positions[i] ?? null);
  const today = new Set(sequence);
  const placed = new Set(positions);
  let next = LEGEND_FRAMES;
  const take = (): string | null => {
    while (next < order.length) {
      const key = order[next]!;
      next += 1;
      if (placed.has(key) || (used.has(key) && !today.has(key))) continue;
      placed.add(key);
      return key;
    }
    return null;
  };
  for (const key of sequence) {
    const at = slots.indexOf(key);
    if (at >= 0) slots[at] = take();
  }
  for (let i = 0; i < slots.length; i += 1) {
    while (slots[i] != null && used.has(slots[i]!)) slots[i] = take();
  }
  return slots;
}

/** Reveals left today: 1, plus 1 once a new trait side settled after the first. */
export function revealsLeft(revealedToday: number, bonusUnlocked: boolean): number {
  return Math.max(0, LEGEND_DAILY_REVEALS + (bonusUnlocked ? LEGEND_BONUS_REVEALS : 0) - revealedToday);
}

/** Settled clear leans as a fingerprint ("axis:lean,…"), for the bonus reveal. */
export function settledFingerprint(tracks: readonly TraitTrack[], now: Date = new Date()): string {
  return clearLeans(tracks, now)
    .filter((row) => row.settled)
    .map((row) => `${row.axis}:${row.lean}`)
    .sort()
    .join(',');
}

/** True when `next` has a settled lean that `prev` did not. */
export function hasNewSettledLean(prev: string, next: string): boolean {
  const before = new Set(prev.split(',').filter(Boolean));
  return next.split(',').some((key) => key && !before.has(key));
}

/**
 * "Matched on: Adventurous · Learning · from your Curiosity category" — the
 * person's same-side poles this legend carries (strongest first, max 3), and
 * the best ready category that shares one of them. Null when nothing matches.
 */
export function matchedOnLine(
  legend: LegendFigure,
  tracks: readonly TraitTrack[],
  now: Date = new Date(),
): string | null {
  const ranked = rankStoryAxes(tracks);
  const poles = ranked
    .filter((row) => legend.tags.some((tag) => tag.axis === row.axis && tag.lean === row.lean))
    .slice(0, 3);
  if (poles.length === 0) return null;
  const axes = new Set(poles.map((row) => row.axis));
  const category = scoreReadyCategories(tracks, now)
    .slice(0, 2)
    .find((row) => row.reading.def.axes.some((axis) => axes.has(axis)));
  const names = poles.map((row) => AXIS_POLE_NAME[row.axis][row.lean]);
  return `Matched on: ${names.join(' · ')}${category ? ` · from your ${category.reading.def.name} category` : ''}`;
}

/** How often each (angle, moment) has been told for one legend, across everyone
 * (anonymous counts from the server; null when unavailable or too few). */
export type AngleCounts = Readonly<Record<string, number>>;

/**
 * The angle and moment this person gets: the least-told angle (by total count
 * over its moments), then its least-told verified moment; ties broken by a
 * per-person seed so two people with no counts still differ. `onlyAngle` pins
 * the angle (a chapter); `skipAngles` leaves out angles already told.
 */
export function chooseAngle(
  legend: LegendFigure,
  userId: string,
  counts: AngleCounts | null,
  opts: { onlyAngle?: string | null; skipAngles?: ReadonlySet<string> } = {},
): { angleId: string; momentId: string } {
  const moments = legend.moments.filter((m) => m.source.verified);
  const momentPool = moments.length > 0 ? moments : legend.moments;
  const count = (angleId: string, momentId: string) => counts?.[`${angleId}|${momentId}`] ?? 0;
  const tie = (key: string) => unit(`${userId}|${legend.id}|${key}`);
  const pinned = opts.onlyAngle ? legend.angles.filter((a) => a.id === opts.onlyAngle) : [];
  const fresh = legend.angles.filter((a) => !opts.skipAngles?.has(a.id));
  const pool = pinned.length > 0 ? pinned : fresh.length > 0 ? fresh : legend.angles;
  const angle = [...pool].sort((a, b) => {
    const ca = momentPool.reduce((sum, m) => sum + count(a.id, m.id), 0);
    const cb = momentPool.reduce((sum, m) => sum + count(b.id, m.id), 0);
    return ca - cb || tie(a.id) - tie(b.id);
  })[0]!;
  const moment = [...momentPool].sort(
    (a, b) => count(angle.id, a.id) - count(angle.id, b.id) || tie(`${angle.id}|${a.id}`) - tie(`${angle.id}|${b.id}`),
  )[0]!;
  return { angleId: angle.id, momentId: moment.id };
}
