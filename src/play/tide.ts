/**
 * Tide Pass (v28, Part E) — five days you play, Legendary progress ×2, one
 * Prism Stone when a pass starts. No money: a pass is granted by the dev kit
 * or by day 7 of the login streak.
 *
 * A pass day is used the first time Divecore opens on a new local day
 * (`petDayHolds`). Days you skip are not used. A clock set back (the stored
 * day up to two ahead) cannot add a day. A stored day more than two ahead
 * does not count as today, so the next open spends one day instead of
 * giving any back.
 *
 * `days_left` is play-days still held AFTER the day already opened. Today
 * counts as held while `day_ymd` still holds.
 */
import { petDayHolds } from '@/play/pet';

/** Days you play that one grant lasts. */
export const TIDE_PASS_DAYS = 5;
/** Play-days you can hold at once (stacking). */
export const TIDE_PASS_MAX_DAYS = 30;
/** How many pity steps an egg counts while the pass is on. */
export const TIDE_PITY_STEP = 2;
/** Prism Stones given when a pass starts (not when days are stacked on). */
export const TIDE_PRISM_GIFT = 1;

export type TideSource = 'dev' | 'streak';

export type TideState = {
  /** Play-days still held after the day already opened. */
  days_left: number;
  /** The local day a pass day was last used. Null = not on today. */
  day_ymd: string | null;
  /** Passes that have started (the Tide Friend ribbon, and the shelf's limit key). */
  passes_started: number;
  source_last: TideSource | null;
};

export function emptyTide(): TideState {
  return { days_left: 0, day_ymd: null, passes_started: 0, source_last: null };
}

/** The pass is on for this local day. */
export function tideActive(tide: TideState, today: string): boolean {
  return tide.day_ymd != null && petDayHolds(today, tide.day_ymd);
}

/** Play-days still held, counting today when the pass is on. */
export function tideDaysHeld(tide: TideState, today: string): number {
  return tide.days_left + (tideActive(tide, today) ? 1 : 0);
}

/** Pity step for an egg picked or woken now: 2 while the pass is on, else 1. */
export function tidePityStep(tide: TideState, today: string): number {
  return tideActive(tide, today) ? TIDE_PITY_STEP : 1;
}

/**
 * Use one pass day the first time this local day opens Divecore.
 * Returns the same object when nothing changes.
 */
export function openTideDay(tide: TideState, today: string): TideState {
  if (petDayHolds(today, tide.day_ymd)) return tide;
  if (tide.days_left <= 0) return tide.day_ymd == null ? tide : { ...tide, day_ymd: null };
  return { ...tide, days_left: tide.days_left - 1, day_ymd: today };
}

export type TideGrant = {
  tide: TideState;
  /** Prism Stones because a pass started (0 when stacking onto days already held). */
  prismGift: number;
  /** Days actually added (0 at the cap). */
  added: number;
  started: boolean;
};

/**
 * Add play-days, capped at `TIDE_PASS_MAX_DAYS` held. A pass starts — and
 * gifts a Prism Stone — only when none is held. Today is not consumed here;
 * `openTideDay` does that on open.
 */
export function grantTide(tide: TideState, today: string, days: number, source: TideSource): TideGrant {
  const add = Math.max(0, Math.floor(days));
  const held = tideDaysHeld(tide, today);
  const room = Math.max(0, TIDE_PASS_MAX_DAYS - held);
  const added = Math.min(add, room);
  if (added <= 0) return { tide, prismGift: 0, added: 0, started: false };
  const started = held === 0;
  return {
    tide: {
      ...tide,
      days_left: tide.days_left + added,
      passes_started: tide.passes_started + (started ? 1 : 0),
      source_last: source,
    },
    prismGift: started ? TIDE_PRISM_GIFT : 0,
    added,
    started,
  };
}

/** Drop every held day, including one already opened today. The ribbon stays. */
export function endTide(tide: TideState): TideState {
  if (tide.days_left === 0 && tide.day_ymd == null) return tide;
  return { ...tide, days_left: 0, day_ymd: null };
}

export function parseTide(raw: unknown): TideState {
  const base = emptyTide();
  if (typeof raw !== 'object' || raw == null) return base;
  const r = raw as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
  const source = r.source_last === 'dev' || r.source_last === 'streak' ? r.source_last : null;
  return {
    days_left: Math.min(TIDE_PASS_MAX_DAYS, n(r.days_left)),
    day_ymd: typeof r.day_ymd === 'string' ? r.day_ymd : null,
    passes_started: n(r.passes_started),
    source_last: source,
  };
}
