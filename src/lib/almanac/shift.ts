/**
 * "What shifted" (PHASE-11e): the biggest trait moves over the last month, from
 * the answer history. Pure. A move is where a trait ended minus where it stood at
 * the start of the window (the last value before it, else the first inside it).
 */
import { AXIS_POLE_NAME } from '@/lib/axis-poles';
import type { TraitAxis } from '@/lib/traits';

/** The fields of a `TraitHistoryRow` this needs (kept structural so the engine folder stays pure). */
export interface ShiftRow {
  axis: TraitAxis;
  value: number;
  createdAt: string;
  /** Optional so plain rows still work; `self_game` rows are scenario-pick nudges, not answers. */
  source?: string;
}

export const SHIFT_WINDOW_DAYS = 31;
/** Smaller moves are noise, not a shift. */
export const SHIFT_MIN_DELTA = 0.05;
export const SHIFT_MAX_ROWS = 3;

export interface TraitShift {
  axis: TraitAxis;
  /** Signed move, -1..1. Positive = toward the high pole. */
  delta: number;
  /** The pole it moved toward ("Adventurous"). */
  toward: string;
}

export function monthlyShifts(
  rows: readonly ShiftRow[],
  now: Date,
  windowDays: number = SHIFT_WINDOW_DAYS,
): TraitShift[] {
  const since = now.getTime() - windowDays * 86_400_000;
  const byAxis = new Map<TraitAxis, ShiftRow[]>();
  for (const row of rows) {
    if (row.source === 'self_game') continue;
    const list = byAxis.get(row.axis) ?? [];
    list.push(row);
    byAxis.set(row.axis, list);
  }
  const out: TraitShift[] = [];
  for (const [axis, list] of byAxis) {
    const ordered = [...list].sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
    const inside = ordered.filter((r) => new Date(r.createdAt).getTime() >= since);
    if (inside.length === 0) continue;
    const before = ordered.filter((r) => new Date(r.createdAt).getTime() < since);
    const start = before.length > 0 ? before[before.length - 1]! : inside[0]!;
    const end = inside[inside.length - 1]!;
    const delta = end.value - start.value;
    if (Math.abs(delta) < SHIFT_MIN_DELTA) continue;
    out.push({ axis, delta, toward: delta > 0 ? AXIS_POLE_NAME[axis].high : AXIS_POLE_NAME[axis].low });
  }
  return out
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || (a.axis < b.axis ? -1 : 1))
    .slice(0, SHIFT_MAX_ROWS);
}
