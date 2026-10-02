/**
 * "How you've changed" — the biggest real movements in a person's own answers
 * over a recent window, read from the existing `trait_history` log. Pure.
 *
 * This is the one piece of content no star-sign app can make: it is about what
 * actually moved, not about a date. It never invents movement — if nothing
 * moved enough, it says so.
 */
import { TRAIT_BAND_PHRASES } from '@/lib/trait-bands';
import { historyForAxis, type TraitHistoryRow } from '@/lib/trait-history';
import { trackKindForSource } from '@/lib/trait-stability';
import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';

export const CHANGE_WINDOW_DAYS = 30;
/** Smaller than this is noise, not a change. */
export const CHANGE_MIN_DELTA = 0.05;
export const CHANGE_MAX_ROWS = 3;
/**
 * With no reading from before the window, the two readings compared must be at
 * least this far apart. Otherwise a new account's first week of answers — the
 * estimate finding its level — would be reported as the person changing.
 */
export const CHANGE_MIN_SPAN_DAYS = 7;

export const CHANGE_LABEL = 'How you’ve changed';
export const CHANGE_LEDE = `The biggest shifts in your own answers over the last ${CHANGE_WINDOW_DAYS} days.`;
export const CHANGE_EMPTY =
  'Nothing has moved enough to call it a change yet. Finish another round of questions and this fills in.';

export interface TraitChange {
  axis: TraitAxis;
  delta: number;
  /** "More toward: sees a plan through" */
  line: string;
}

export function traitChanges(
  history: readonly TraitHistoryRow[],
  now: Date = new Date(),
  windowDays: number = CHANGE_WINDOW_DAYS,
): TraitChange[] {
  const windowStart = now.getTime() - windowDays * 86_400_000;
  const out: TraitChange[] = [];
  for (const axis of TRAIT_AXES) {
    // Report track only — a gut-call game is a different instrument.
    const rows = historyForAxis(history, axis)
      .filter((row) => trackKindForSource(row.source) === 'report')
      .map((row) => ({ value: row.value, at: new Date(row.createdAt).getTime() }))
      .filter((row) => Number.isFinite(row.at) && row.at <= now.getTime())
      .sort((a, b) => a.at - b.at);
    if (rows.length < 2) continue;
    const latest = rows[rows.length - 1]!;
    if (latest.at < windowStart) continue; // nothing happened inside the window
    // Where the axis stood going into the window; if it did not exist yet,
    // its first reading inside the window.
    const before = [...rows].reverse().find((row) => row.at < windowStart);
    const baseline = before ?? rows[0]!;
    if (!before && latest.at - baseline.at < CHANGE_MIN_SPAN_DAYS * 86_400_000) continue;
    const delta = latest.value - baseline.value;
    if (Math.abs(delta) < CHANGE_MIN_DELTA) continue;
    const phrases = TRAIT_BAND_PHRASES[axis];
    out.push({ axis, delta, line: `More toward: ${delta > 0 ? phrases.high : phrases.low}` });
  }
  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, CHANGE_MAX_ROWS);
}
