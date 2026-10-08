/**
 * Legend figures — today's three labels (no AI).
 *
 * Pure: the same (tracks, user, day, set number, museum, roster) always gives
 * the same three, so a re-open shows the same set and two users rarely match.
 *
 *   close       — strongest pole match (top 4 clear leans count full, the rest
 *                 half; axes of the best 1–2 categories ×1.25; a legend tagged
 *                 with the OPPOSITE side of a clear lean loses points).
 *   surprise    — a different hall, preferring halls not visited yet; an
 *                 unlocked hidden legend always takes this slot.
 *   other_side  — matched without the user's single strongest axis.
 *   on_this_day — a legend born on today's month-day replaces other_side.
 *
 * Each slot draws weighted-random from its top `LEGEND_POOL_TOP`, seeded by
 * (user, day, set, legend) — the insight bank's `u^(1/w)` draw. Legends
 * already in the museum are skipped; only if fewer than three are left does a
 * met legend come back (repeat rather than an empty set). Hidden legends are
 * offered only when every trait side they need is a clear lean. Fewer than
 * `LEGEND_MIN_CLEAR_LEANS` clear leans = locked.
 */
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
/** Each slot draws from this many best candidates. */
export const LEGEND_POOL_TOP = 5;
export const LEGEND_CATEGORY_BONUS = 1.25;
export const LEGEND_OPPOSITE_PENALTY = 0.75;
/** A hall the person has not met anyone in yet is this much likelier as the surprise. */
export const LEGEND_NEW_HALL_WEIGHT = 1.5;

export type LegendSlot = 'close' | 'surprise' | 'other_side' | 'on_this_day';

export interface LegendOffer {
  legendId: string;
  slot: LegendSlot;
  hidden: boolean;
  /** The user's axes this legend matched (same side), strongest first. */
  matched: TraitAxis[];
}

export interface LegendSet {
  ymd: string;
  setNo: number;
  offers: LegendOffer[];
}

export interface LegendPickInput {
  tracks: readonly TraitTrack[];
  userId: string;
  ymd: string;
  /** 0 = the day's set; 1 = the bonus set after a new trait settles. */
  setNo: number;
  /** Legend ids already in the museum. */
  met: ReadonlySet<string>;
  /** Halls with at least one met legend (surprise prefers the others). */
  visitedHalls?: ReadonlySet<LegendHall>;
  now?: Date;
  roster?: readonly LegendFigure[];
}

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

/** Weighted draw from the top `LEGEND_POOL_TOP`: the largest u^(1/w) wins. Ties
 * (equal score) keep roster order, so the result never depends on sort luck. */
function draw<T extends { legend: LegendFigure; weight: number }>(rows: readonly T[], seed: string): T | null {
  const top = rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => b.row.weight - a.row.weight || a.index - b.index)
    .slice(0, LEGEND_POOL_TOP)
    .map(({ row }) => row);
  let best: T | null = null;
  let bestKey = -1;
  for (const row of top) {
    const w = Math.max(row.weight, 1e-6);
    const key = unit(`${seed}|${row.legend.id}`) ** (1 / w);
    if (key > bestKey) {
      bestKey = key;
      best = row;
    }
  }
  return best;
}

function monthDay(ymd: string): string {
  return ymd.slice(5, 10);
}

export function pickLegendSet(input: LegendPickInput): LegendSet | null {
  const roster = input.roster ?? LEGEND_ROSTER;
  const now = input.now ?? new Date();
  const ranked = rankStoryAxes(input.tracks);
  if (ranked.length < LEGEND_MIN_CLEAR_LEANS) return null;

  const categoryAxes = new Set<TraitAxis>(
    scoreReadyCategories(input.tracks, now)
      .slice(0, 2)
      .flatMap((row) => row.reading.def.axes),
  );
  const visited = input.visitedHalls ?? new Set<LegendHall>();
  const seed = `${input.userId}|${input.ymd}|${input.setNo}`;

  const open = roster.filter((legend) => hiddenUnlocked(legend, ranked));
  const fresh = open.filter((legend) => !input.met.has(legend.id));
  // Repeat rather than show an empty museum wall.
  const pool = fresh.length >= 3 ? fresh : open;

  const scored = pool.map((legend) => ({ legend, ...scoreLegend(legend, ranked, categoryAxes) }));
  const chosen = new Set<string>();
  const offers: LegendOffer[] = [];
  const offer = (row: (typeof scored)[number] | null, slot: LegendSlot) => {
    if (!row) return;
    chosen.add(row.legend.id);
    offers.push({ legendId: row.legend.id, slot, hidden: row.legend.hidden != null, matched: row.matched });
  };
  const notChosen = (row: { legend: LegendFigure }) => !chosen.has(row.legend.id);
  const positive = (rows: typeof scored) => {
    const good = rows.filter((row) => row.score > 0);
    return good.length > 0 ? good : rows;
  };

  // 1. Close match.
  offer(
    draw(
      positive(scored.filter((row) => !row.legend.hidden)).map((row) => ({ ...row, weight: row.score })),
      `${seed}|close`,
    ),
    'close',
  );
  const closeHall = offers[0] ? roster.find((l) => l.id === offers[0].legendId)?.hall : undefined;

  // 2. Surprise: an unlocked hidden legend first, else another hall.
  const hiddenReady = scored.filter((row) => row.legend.hidden && notChosen(row));
  if (hiddenReady.length > 0) {
    offer(draw(hiddenReady.map((row) => ({ ...row, weight: Math.max(row.score, 0.05) })), `${seed}|hidden`), 'surprise');
  } else {
    const otherHalls = scored.filter((row) => notChosen(row) && row.legend.hall !== closeHall && !row.legend.hidden);
    offer(
      draw(
        positive(otherHalls.length > 0 ? otherHalls : scored.filter(notChosen)).map((row) => ({
          ...row,
          weight: Math.max(row.score, 0.01) * (visited.has(row.legend.hall) ? 1 : LEGEND_NEW_HALL_WEIGHT),
        })),
        `${seed}|surprise`,
      ),
      'surprise',
    );
  }

  // 3. On this day, else the other side of you (without the strongest axis).
  const md = monthDay(input.ymd);
  const birthday = scored.find((row) => notChosen(row) && row.legend.birthday?.md === md && !row.legend.hidden);
  if (birthday) {
    offer(birthday, 'on_this_day');
  } else {
    const rest = ranked.slice(1);
    const second = pool
      .filter((legend) => !chosen.has(legend.id) && !legend.hidden)
      .map((legend) => ({ legend, ...scoreLegend(legend, rest, categoryAxes) }));
    const usedHalls = new Set(offers.map((o) => roster.find((l) => l.id === o.legendId)?.hall));
    offer(
      draw(
        positive(second).map((row) => ({ ...row, weight: Math.max(row.score, 0.01) * (usedHalls.has(row.legend.hall) ? 1 : 1.2) })),
        `${seed}|other`,
      ),
      'other_side',
    );
  }

  // Never fewer than three while the open roster has three: fill from what is left.
  for (const row of scored) {
    if (offers.length >= 3) break;
    if (notChosen(row)) offer(row, 'other_side');
  }
  for (const legend of open) {
    if (offers.length >= 3) break;
    if (!chosen.has(legend.id)) {
      offer({ legend, ...scoreLegend(legend, ranked, categoryAxes) }, 'other_side');
    }
  }

  return { ymd: input.ymd, setNo: input.setNo, offers };
}

/** Settled clear leans as a fingerprint ("axis:lean,…"), for the bonus set. */
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

/** How often each (angle, moment) has been told for one legend, across everyone
 * (anonymous counts from the server; null when unavailable or too few). */
export type AngleCounts = Readonly<Record<string, number>>;

/**
 * The angle and moment this person gets: the least-told angle (by total count
 * over its moments), then its least-told verified moment; ties broken by a
 * per-person seed so two people with no counts still differ.
 */
export function chooseAngle(
  legend: LegendFigure,
  userId: string,
  counts: AngleCounts | null,
): { angleId: string; momentId: string } {
  const moments = legend.moments.filter((m) => m.source.verified);
  const momentPool = moments.length > 0 ? moments : legend.moments;
  const count = (angleId: string, momentId: string) => counts?.[`${angleId}|${momentId}`] ?? 0;
  const tie = (key: string) => unit(`${userId}|${legend.id}|${key}`);
  const angle = [...legend.angles].sort((a, b) => {
    const ca = momentPool.reduce((sum, m) => sum + count(a.id, m.id), 0);
    const cb = momentPool.reduce((sum, m) => sum + count(b.id, m.id), 0);
    return ca - cb || tie(a.id) - tie(b.id);
  })[0]!;
  const moment = [...momentPool].sort(
    (a, b) => count(angle.id, a.id) - count(angle.id, b.id) || tie(`${angle.id}|${a.id}`) - tie(`${angle.id}|${b.id}`),
  )[0]!;
  return { angleId: angle.id, momentId: moment.id };
}
