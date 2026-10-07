/**
 * Which Focus · try · watch idea an account gets on a given day. Pure: no
 * storage, no network, no model call, so the check script runs the real
 * picker. Same (user, day, history) always gives the same idea and wording.
 *
 * Reuses the daily line's lean reading and weights (lib/daily-line/pick.ts)
 * rather than a second copy: a clear lean is the same thing for both.
 */
import { axisOfKey, fnv1a, lineKey, type LineKey } from '@/lib/daily-line/bank';
import {
  daysApart,
  NO_REPEAT_DAYS,
  PAIR_WEIGHT,
  SETTLED_WEIGHT,
  YESTERDAY_AXIS_WEIGHT,
  type ClearLean,
} from '@/lib/daily-line/pick';
import type { TraitAxis } from '@/lib/traits';

import type { DailyInsightDraft } from '@/lib/insight/generate-insight';

import { ideaById, ideaTheme, STARTER_IDEAS, TRAIT_IDEAS, type InsightIdea } from './index';

/** One day already shown: which idea, from the reverse title map. */
export interface IdeaDay {
  ymd: string;
  ideaId: string;
}

/** Ideas whose every key matches one of the account's clear leans. */
export function eligibleIdeas(leans: readonly ClearLean[]): InsightIdea[] {
  const have = new Set<LineKey>(leans.map((l) => lineKey(l.axis, l.lean)));
  return TRAIT_IDEAS.filter((entry) => entry.keys.length > 0 && entry.keys.every((key) => have.has(key)));
}

/**
 * How long an idea stays out after it was shown. A small pool cannot hold 60
 * days apart, so the window shrinks with it and the picker still has 20% of
 * the pool to choose from.
 */
export function repeatWindowDays(poolSize: number): number {
  return Math.min(NO_REPEAT_DAYS, Math.floor(poolSize * 0.8));
}

function dayNumber(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return Math.floor(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / 86_400_000);
}

function unit(seed: string): number {
  // Never exactly 0, so the weighted draw below cannot return -Infinity.
  return (fnv1a(seed) + 1) / 4_294_967_297;
}

export interface IdeaPickInput {
  userId: string;
  ymd: string;
  leans: readonly ClearLean[];
  /** Days already shown (unknown titles already dropped), in any order. */
  history: readonly IdeaDay[];
}

export interface IdeaPick {
  idea: InsightIdea;
  focusIndex: number;
  tryIndex: number;
  watchIndex: number;
}

export function pickIdea(input: IdeaPickInput): IdeaPick {
  const { userId, ymd, leans, history } = input;
  const matched = eligibleIdeas(leans);
  const pool = matched.length > 0 ? matched : [...STARTER_IDEAS];
  const today = dayNumber(ymd);
  const past = history.filter((day) => dayNumber(day.ymd) < today);

  const window = repeatWindowDays(pool.length);
  const recent = new Set(past.filter((day) => daysApart(day.ymd, ymd) <= window).map((day) => day.ideaId));
  const fresh = pool.filter((entry) => !recent.has(entry.id));
  // A pool that has run dry inside the window repeats rather than shows nothing.
  const candidates = fresh.length > 0 ? fresh : pool;

  const settled = new Set(leans.filter((l) => l.settled).map((l) => l.axis));
  const previous = [...past].sort((a, b) => dayNumber(b.ymd) - dayNumber(a.ymd))[0];
  const previousAxes = new Set<TraitAxis>(
    previous ? (ideaById(previous.ideaId)?.keys ?? []).map((key) => axisOfKey(key)) : [],
  );

  let best: InsightIdea = candidates[0]!;
  let bestScore = -Infinity;
  for (const entry of candidates) {
    let weight = entry.keys.length >= 2 ? PAIR_WEIGHT : 1;
    for (const key of entry.keys) {
      const axis = axisOfKey(key);
      if (settled.has(axis)) weight *= SETTLED_WEIGHT;
      if (previousAxes.has(axis)) weight *= YESTERDAY_AXIS_WEIGHT;
    }
    // Weighted draw without a random source: u^(1/w), highest wins.
    const score = Math.pow(unit(`${userId}|${ymd}|${entry.id}`), 1 / weight);
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  // Each time an idea comes back it moves to the next focus wording.
  const timesShown = past.filter((day) => day.ideaId === best.id).length;
  return {
    idea: best,
    focusIndex: (fnv1a(`${userId}|${best.id}`) + timesShown) % 3,
    tryIndex: fnv1a(`${userId}|${ymd}|try`) % 2,
    watchIndex: fnv1a(`${userId}|${ymd}|watch`) % 2,
  };
}

/** The row Home saves through insert_daily_insight. */
export function draftFromPick(pick: IdeaPick): DailyInsightDraft {
  const { idea, focusIndex, tryIndex, watchIndex } = pick;
  return {
    theme: ideaTheme(idea),
    title: idea.focus[focusIndex]!,
    reflection: idea.why,
    tryToday: idea.try[tryIndex]!,
    watchFor: idea.watch[watchIndex]!,
  };
}
