/**
 * Which line an account gets on a given day. Pure — no storage, no network, no
 * model call — so the check script can run the real picker.
 *
 * The same (user, day, history) always gives the same line, which is what lets
 * the morning push be planned a week ahead and still match what Home shows.
 *
 * Two friends do not get the same text: the pick is seeded by the user id, and
 * it only draws from lines that match that person's own leans.
 */
import { isShareableLean } from '@/lib/legends64/identity';
import { isAxisSettled, trackFor, type TraitTrack } from '@/lib/trait-stability';
import { TRAIT_AXES, type TraitAxis, type TraitLean } from '@/lib/traits';

import { allLines, axisOfKey, dailyLineById, fnv1a, lineKey, type DailyLine, type LineKey } from './bank';

/** How far from the middle a trait has to sit before a line may speak about it. */
export const CLEAR_LEAN_MARGIN = 0.1;
/** A line is not shown again to the same account inside this many days. */
export const NO_REPEAT_DAYS = 60;
/** Pair lines are the specific ones, so they are drawn more often. */
export const PAIR_WEIGHT = 2.5;
export const SETTLED_WEIGHT = 1.3;
/** Yesterday's trait is turned down so two days in a row do not feel alike. */
export const YESTERDAY_AXIS_WEIGHT = 0.4;
export const REACTION_STEP = 0.4;
export const REACTION_MIN = 0.3;
export const REACTION_MAX = 2.5;

export type LineReaction = 'me' | 'not_me';

export interface LineDay {
  ymd: string;
  id: string;
  reaction?: LineReaction;
}

export interface ClearLean {
  axis: TraitAxis;
  lean: TraitLean;
  settled: boolean;
  /** Distance from the middle, 0–0.5. */
  strength: number;
}

/**
 * Report-track axes that have at least one answer and sit clearly to one side.
 * Deliberately not "settled only": right after the 50, ten axes have two
 * answers and cannot be settled yet, and someone part-way through the intake
 * still deserves a line about what they have told us so far.
 */
export function clearLeans(tracks: readonly TraitTrack[], now: Date = new Date()): ClearLean[] {
  const out: ClearLean[] = [];
  for (const axis of TRAIT_AXES) {
    const row = trackFor(tracks, axis, 'report');
    if (!row || row.answerCount < 1 || !Number.isFinite(row.value)) continue;
    const strength = Math.abs(row.value - 0.5);
    if (strength < CLEAR_LEAN_MARGIN) continue;
    out.push({
      axis,
      lean: row.value >= 0.5 ? 'high' : 'low',
      settled: isAxisSettled(row, now),
      strength,
    });
  }
  return out;
}

function ymdToDayNumber(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return Math.floor(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / 86_400_000);
}

export function daysApart(aYmd: string, bYmd: string): number {
  return Math.abs(ymdToDayNumber(aYmd) - ymdToDayNumber(bYmd));
}

/** Lines whose every key matches one of the account's clear leans. */
export function eligibleLines(leans: readonly ClearLean[]): DailyLine[] {
  const have = new Set<LineKey>(leans.map((l) => lineKey(l.axis, l.lean)));
  return allLines().filter((line) => line.keys.length > 0 && line.keys.every((key) => have.has(key)));
}

export function starterLines(): DailyLine[] {
  return allLines().filter((line) => line.keys.length === 0);
}

/**
 * "That's me" turns a trait up, "Not me" turns it down, for the lines that
 * come next. It changes which lines are drawn and nothing else — a reaction
 * never writes a trait score.
 */
export function axisReactionWeights(history: readonly LineDay[], todayYmd: string): Map<TraitAxis, number> {
  const tally = new Map<TraitAxis, number>();
  for (const day of history) {
    if (!day.reaction || daysApart(day.ymd, todayYmd) > NO_REPEAT_DAYS) continue;
    const line = dailyLineById(day.id);
    if (!line) continue;
    for (const key of line.keys) {
      const axis = axisOfKey(key);
      tally.set(axis, (tally.get(axis) ?? 0) + (day.reaction === 'me' ? 1 : -1));
    }
  }
  const out = new Map<TraitAxis, number>();
  for (const [axis, net] of tally) {
    out.set(axis, Math.min(REACTION_MAX, Math.max(REACTION_MIN, 1 + REACTION_STEP * net)));
  }
  return out;
}

function unit(seed: string): number {
  // Never exactly 0, so the weighted draw below cannot return -Infinity.
  return (fnv1a(seed) + 1) / 4_294_967_297;
}

export interface PickInput {
  userId: string;
  ymd: string;
  leans: readonly ClearLean[];
  /** Days already shown or already planned, in any order. */
  history: readonly LineDay[];
}

export function pickDailyLine(input: PickInput): DailyLine {
  const { userId, ymd, leans, history } = input;
  const matched = eligibleLines(leans);
  const pool = matched.length > 0 ? matched : starterLines();

  const recent = new Set(
    history.filter((day) => day.ymd !== ymd && daysApart(day.ymd, ymd) <= NO_REPEAT_DAYS).map((day) => day.id),
  );
  const fresh = pool.filter((line) => !recent.has(line.id));
  // A small pool can run dry inside the window. Repeating is better than
  // nothing, so fall back to the whole pool rather than an empty card.
  const candidates = fresh.length > 0 ? fresh : pool;

  const settled = new Set(leans.filter((l) => l.settled).map((l) => l.axis));
  const reactions = axisReactionWeights(history, ymd);
  const previous = history
    .filter((day) => ymdToDayNumber(day.ymd) < ymdToDayNumber(ymd))
    .sort((a, b) => ymdToDayNumber(b.ymd) - ymdToDayNumber(a.ymd))[0];
  const previousAxes = new Set(
    previous ? (dailyLineById(previous.id)?.keys ?? []).map((key) => axisOfKey(key)) : [],
  );

  let best: DailyLine = candidates[0]!;
  let bestScore = -Infinity;
  for (const line of candidates) {
    let weight = line.keys.length >= 2 ? PAIR_WEIGHT : 1;
    for (const key of line.keys) {
      const axis = axisOfKey(key);
      if (settled.has(axis)) weight *= SETTLED_WEIGHT;
      if (previousAxes.has(axis)) weight *= YESTERDAY_AXIS_WEIGHT;
      weight *= reactions.get(axis) ?? 1;
    }
    // Weighted draw without a random source: u^(1/w), highest wins.
    const score = Math.pow(unit(`${userId}|${ymd}|${line.id}`), 1 / weight);
    if (score > bestScore) {
      bestScore = score;
      best = line;
    }
  }
  return best;
}

/** Days in a row, ending today or yesterday, on which a line was opened. */
export function lineStreak(history: readonly LineDay[], todayYmd: string): number {
  const days = new Set(history.map((day) => ymdToDayNumber(day.ymd)));
  const today = ymdToDayNumber(todayYmd);
  let cursor = days.has(today) ? today : today - 1;
  let count = 0;
  while (days.has(cursor)) {
    count += 1;
    cursor -= 1;
  }
  return count;
}

/** What the push and the widget say instead of a line that is not for other eyes. */
export const LOCK_SCREEN_PRIVATE_COPY = 'Today’s line is ready.';

/**
 * A push and a widget are read by whoever is near the phone. Lines about
 * closeness and worry, or about the struggle side of a trait, stay inside the
 * app: the lock screen gets a plain "ready" instead. Same list the share image
 * uses (`isShareableLean`). So does every AI-written line.
 */
export function lockScreenText(line: DailyLine): string {
  // An AI-written line has been read by nobody but its owner. It stays in the app.
  if (line.source === 'ai') return LOCK_SCREEN_PRIVATE_COPY;
  const safe = line.keys.every((key) => {
    const axis = axisOfKey(key);
    return isShareableLean(axis, key.slice(key.indexOf(':') + 1) as TraitLean);
  });
  return safe ? line.text : LOCK_SCREEN_PRIVATE_COPY;
}

/** True when the line was picked for nobody in particular. */
export function isStarterLine(line: DailyLine): boolean {
  return line.keys.length === 0;
}
