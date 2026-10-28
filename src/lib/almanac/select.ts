/**
 * Almanac selection (PHASE-11a). Pure: the same (bank, context, seen) always
 * gives the same card.
 *
 * 1. Filter: reviewed, kind fits the surface, event/phase/arc/weekday match,
 *    minDataDays met, axis keys match the reader's clear leans, slots fill.
 * 2. Not seen: drop cards shown on this surface within
 *    min(pool − 1, 90) days, so a card never repeats inside min(pool, 90) days
 *    (red team M3). If every card was seen, the least recently seen ones stay.
 * 3. Score: 1 base, +3 strong lean, +2 tension pair (two leans in one card),
 *    +1 axis not shown on this surface in 7 days; × card weight × layer weight.
 * 4. Seeded weighted draw (u^(1/score), highest wins) from the top 8.
 */
import { lineKey } from '@/lib/daily-line/bank';
import { daysApart } from '@/lib/daily-line/pick';

import { personalSeed, unitFor, weekdayOfYmd } from './seed';
import { fillCard, type FilledCard } from './slots';
import {
  SURFACE_KINDS,
  type AlmanacCard,
  type AlmanacContext,
  type AlmanacSurface,
  type SeenEntry,
} from './types';

export const TOP_K = 8;
export const MAX_REPEAT_WINDOW_DAYS = 90;
export const STRONG_LEAN_STRENGTH = 0.2; // value ≥ 0.70 or ≤ 0.30
export const SCORE_BASE = 1;
export const SCORE_STRONG = 3;
export const SCORE_TENSION = 2;
export const SCORE_FRESH_AXIS = 1;
export const FRESH_AXIS_DAYS = 7;

export interface Candidate {
  card: AlmanacCard;
  filled: FilledCard;
}

function axisOf(key: string): string {
  return key.slice(0, key.indexOf(':'));
}

function eventMatches(card: AlmanacCard, ctx: AlmanacContext): boolean {
  const events = ctx.calendar?.events ?? [];
  if (card.event) {
    const live = events.find((e) => e.event === card.event);
    if (!live) return false;
    if (card.phase && live.phase !== card.phase) return false;
  } else if (card.phase) {
    // A phase without an event means "any event in this phase".
    if (!events.some((e) => e.phase === card.phase)) return false;
  }
  if (card.arc && !(ctx.calendar?.arcs ?? []).includes(card.arc)) return false;
  return true;
}

/** Cards this reader may see on this surface today, already filled. */
export function candidatesFor(
  surface: AlmanacSurface,
  ctx: AlmanacContext,
  bank: readonly AlmanacCard[],
): Candidate[] {
  const kinds = SURFACE_KINDS[surface];
  const have = new Set<string>(ctx.leans.map((l) => lineKey(l.axis, l.lean)));
  const weekday = weekdayOfYmd(ctx.ymd);
  const out: Candidate[] = [];
  for (const card of bank) {
    if (!card.reviewed || !kinds.includes(card.kind)) continue;
    if (card.weekday && card.weekday.length > 0 && !card.weekday.includes(weekday)) continue;
    if ((card.minDataDays ?? 0) > ctx.dataDays) continue;
    if (card.axes && card.axes.length > 0 && !card.axes.every((key) => have.has(key))) continue;
    if (!eventMatches(card, ctx)) continue;
    const filled = fillCard(card, ctx);
    if (!filled) continue;
    out.push({ card, filled });
  }
  return out;
}

/** The repeat window for a pool: a card shown on day d is free again on day d + min(pool, 90). */
export function repeatWindowDays(poolSize: number): number {
  return Math.max(0, Math.min(poolSize, MAX_REPEAT_WINDOW_DAYS) - 1);
}

/** Drop recently seen cards. Never returns an empty list for a non-empty pool. */
export function freshCandidates(pool: readonly Candidate[], seen: readonly SeenEntry[], ymd: string): Candidate[] {
  if (pool.length === 0) return [];
  const window = repeatWindowDays(pool.length);
  const lastSeen = new Map<string, number>();
  for (const entry of seen) {
    if (entry.ymd === ymd) continue;
    const gap = daysApart(entry.ymd, ymd);
    const prev = lastSeen.get(entry.id);
    if (prev === undefined || gap < prev) lastSeen.set(entry.id, gap);
  }
  const fresh = pool.filter((c) => {
    const gap = lastSeen.get(c.card.id);
    return gap === undefined || gap > window;
  });
  if (fresh.length > 0) return fresh;
  // Every card was shown inside the window: keep the ones seen longest ago.
  let oldest = -1;
  for (const c of pool) oldest = Math.max(oldest, lastSeen.get(c.card.id) ?? Infinity);
  return pool.filter((c) => (lastSeen.get(c.card.id) ?? Infinity) === oldest);
}

export function scoreCandidate(
  candidate: Candidate,
  ctx: AlmanacContext,
  recentAxes: ReadonlySet<string>,
): number {
  const { card } = candidate;
  const keys = card.axes ?? [];
  let score = SCORE_BASE;
  const strong = new Set(
    ctx.leans.filter((l) => l.strength >= STRONG_LEAN_STRENGTH).map((l) => lineKey(l.axis, l.lean)),
  );
  if (keys.some((key) => strong.has(key))) score += SCORE_STRONG;
  if (keys.length >= 2) score += SCORE_TENSION;
  if (keys.length > 0 && keys.every((key) => !recentAxes.has(axisOf(key)))) score += SCORE_FRESH_AXIS;
  const weight = Number.isFinite(card.weight) && (card.weight ?? 0) > 0 ? card.weight! : 1;
  const layer = ctx.layerWeight ? ctx.layerWeight(card) : 1;
  const safeLayer = Number.isFinite(layer) && layer > 0 ? layer : 0;
  return score * weight * safeLayer;
}

/** Axes shown on this surface within the last 7 days (today excluded). */
export function recentAxesFor(
  seen: readonly SeenEntry[],
  ymd: string,
  bank: readonly AlmanacCard[],
): Set<string> {
  const byId = new Map(bank.map((c) => [c.id, c]));
  const out = new Set<string>();
  for (const entry of seen) {
    if (entry.ymd === ymd || daysApart(entry.ymd, ymd) > FRESH_AXIS_DAYS) continue;
    for (const key of byId.get(entry.id)?.axes ?? []) out.add(axisOf(key));
  }
  return out;
}

/**
 * Fresh candidates, highest score first, with their scores. Zero-score cards
 * (e.g. a layer weight of 0) are removed BEFORE the repeat window is sized, so
 * the window counts only cards that can be drawn. Equal scores are ordered by
 * the personal seed, not by id, so readers do not walk the bank alphabetically.
 */
export function rankCandidates(
  surface: AlmanacSurface,
  ctx: AlmanacContext,
  bank: readonly AlmanacCard[],
  seen: readonly SeenEntry[],
  seed: number = personalSeed(ctx.userId, ctx.ymd, surface),
): { candidate: Candidate; score: number }[] {
  const recentAxes = recentAxesFor(seen, ctx.ymd, bank);
  const scored = new Map<Candidate, number>();
  for (const candidate of candidatesFor(surface, ctx, bank)) {
    const score = scoreCandidate(candidate, ctx, recentAxes);
    if (score > 0) scored.set(candidate, score);
  }
  const fresh = freshCandidates([...scored.keys()], seen, ctx.ymd);
  return fresh
    .map((candidate) => ({ candidate, score: scored.get(candidate)!, tie: unitFor(seed, candidate.card.id) }))
    .sort(
      (a, b) =>
        b.score - a.score || b.tie - a.tie || (a.candidate.card.id < b.candidate.card.id ? -1 : 1),
    )
    .map(({ candidate, score }) => ({ candidate, score }));
}

/** Seeded weighted draw from the top 8. Null when nothing fits. */
export function drawFromTop(
  ranked: readonly { candidate: Candidate; score: number }[],
  seed: number,
): Candidate | null {
  let best: Candidate | null = null;
  let bestKey = -Infinity;
  for (const { candidate, score } of ranked.slice(0, TOP_K)) {
    const key = Math.pow(unitFor(seed, candidate.card.id), 1 / score);
    if (key > bestKey) {
      bestKey = key;
      best = candidate;
    }
  }
  return best;
}

export function selectCard(
  surface: AlmanacSurface,
  ctx: AlmanacContext,
  bank: readonly AlmanacCard[],
  seen: readonly SeenEntry[],
): Candidate | null {
  const seed = personalSeed(ctx.userId, ctx.ymd, surface);
  return drawFromTop(rankCandidates(surface, ctx, bank, seen, seed), seed);
}
