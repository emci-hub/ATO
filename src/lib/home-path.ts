/**
 * Home's gamify maths (ATO-BUILD PHASE-08). Pure: no React, no network, no model
 * call, so Node tests can pin it. Every date is a local YYYY-MM-DD built with
 * `localYmd(now, me.timezone)`, the same key `check-window` uses (R21).
 *
 * Nothing here awards or prices anything. "Today's path" only reads the existing
 * daily check-in; the only token amount it ever shows is the one the server paid.
 */
import { AXIS_SHORT_NAME } from '@/lib/axis-poles';
import { addDaysYmd } from '@/lib/local-date';
import type { TraitTrack } from '@/lib/trait-stability';
import type { TraitAxis } from '@/lib/traits';
import { mondayIndex } from '@/lib/week-strip';

// ── Streak with one free rest day a week ─────────────────────────────────────

export interface GlowStreak {
  /** Days opened in a row. A rest day bridges a gap but is never counted. */
  streak: number;
  /** The free rest days this streak used (YYYY-MM-DD, newest first). */
  restDays: string[];
}

const weekKey = (ymd: string) => addDaysYmd(ymd, -mondayIndex(ymd));

/**
 * "N-day glow". Walks back from today (or yesterday if today is still open).
 * One missed day per Monday-Sunday week is a free rest day: it keeps the glow
 * going when the day before it was opened. A second miss in the same week, or a
 * rest day with nothing opened before it, ends the walk. No repair, no penalty.
 */
export function streakWithRest(openedYmds: readonly string[], todayYmd: string): GlowStreak {
  const opened = new Set(openedYmds);
  const restDays: string[] = [];
  const usedWeeks = new Set<string>();
  let cursor = opened.has(todayYmd) ? todayYmd : addDaysYmd(todayYmd, -1);
  let streak = 0;
  // Hard stop: the stored history is capped, so this can never run away.
  for (let guard = 0; guard < 400; guard += 1) {
    if (opened.has(cursor)) {
      streak += 1;
    } else {
      const week = weekKey(cursor);
      const before = addDaysYmd(cursor, -1);
      if (usedWeeks.has(week) || !opened.has(before)) break;
      usedWeeks.add(week);
      restDays.push(cursor);
    }
    cursor = addDaysYmd(cursor, -1);
  }
  return { streak, restDays };
}

export const streakGlowLabel = (streak: number) => `${streak}-day glow`;

// ── "★ X brightened" ─────────────────────────────────────────────────────────

/** A trait must move at least this much (0-1 scale) to count as brightened. */
export const BRIGHTEN_MIN_MOVE = 0.05;

export type AxisValues = Partial<Record<TraitAxis, number>>;

/** The report-track values, keyed by axis: what "last visit" stores. */
export function snapshotValues(tracks: readonly TraitTrack[]): AxisValues {
  const out: AxisValues = {};
  for (const t of tracks) if (t.track === 'report') out[t.axis] = t.value;
  return out;
}

/** Axes that moved since `prev`, biggest move first. No `prev` = no brightening. */
export function axisDiff(prev: AxisValues | null | undefined, tracks: readonly TraitTrack[]): TraitAxis[] {
  if (!prev) return [];
  const moves: { axis: TraitAxis; move: number }[] = [];
  for (const t of tracks) {
    if (t.track !== 'report') continue;
    const was = prev[t.axis];
    if (typeof was !== 'number') continue;
    const move = Math.abs(t.value - was);
    if (move >= BRIGHTEN_MIN_MOVE) moves.push({ axis: t.axis, move });
  }
  return moves.sort((a, b) => b.move - a.move).map((m) => m.axis);
}

export function brightenedLine(axes: readonly TraitAxis[]): string | null {
  if (axes.length === 0) return null;
  const first = AXIS_SHORT_NAME[axes[0]];
  return axes.length === 1 ? `★ ${first} brightened` : `★ ${first} and ${axes.length - 1} more brightened`;
}

// ── Today's path ─────────────────────────────────────────────────────────────

/** "Answer a few questions" step: this many answered since Home first opened today. */
export const PATH_QUESTIONS_TARGET = 3;

export interface PathInput {
  checkedIn: boolean;
  insightSeen: boolean;
  /** Every question answered so far (only ever goes up; see `totalAnswered`). */
  answeredTotal: number;
  /** That total the first time Home opened today (the baseline). */
  answeredBaseline: number;
}

/**
 * Every answer on the report tracks. The round position resets to 0 when a round
 * ends, so it cannot tell "answered 3 today" across a round boundary; this can.
 * A tap is not an answer (it never moves `answerCount`), so only real answers count.
 */
export function totalAnswered(tracks: readonly TraitTrack[]): number {
  return tracks.reduce((sum, t) => (t.track === 'report' ? sum + t.answerCount : sum), 0);
}

/** Answers given today. Never negative. */
export function answeredToday(answeredTotal: number, answeredBaseline: number): number {
  return Math.max(0, answeredTotal - answeredBaseline);
}

export interface PathState {
  done: [boolean, boolean, boolean];
  count: number;
  /** 0-1 for the bar. */
  fraction: number;
  allDone: boolean;
}

export function pathState(input: PathInput): PathState {
  const done: [boolean, boolean, boolean] = [
    input.checkedIn,
    input.insightSeen,
    answeredToday(input.answeredTotal, input.answeredBaseline) >= PATH_QUESTIONS_TARGET,
  ];
  const count = done.filter(Boolean).length;
  return { done, count, fraction: count / 3, allDone: count === 3 };
}

export const PATH_TITLE = 'Today’s path';
export const PATH_STEP_LABELS = [
  'Check in',
  'Read today’s insight',
  `Answer ${PATH_QUESTIONS_TARGET} questions`,
] as const;
