/**
 * Almanac off-season arcs (ATO-BUILD PHASE-11b). Pure.
 *
 * Always on, so Home is never empty:
 *  - 4 named seasons (Sparks, Bloom, Tides, Embers); the south is shifted 6 months,
 *    the tropics keep the north names.
 *  - 12 month themes.
 *  - a weekly trait theme: absolute Monday-weeks from the Pick epoch, `% 16` (L1),
 *    so an axis never repeats inside 16 weeks and a year wrap changes nothing.
 *  - micro-events: small one-day moments at intensity 0.4 at most.
 *
 * Arc ids (used by card `arc`): `season_<id>`, `month_<id>`, `week_<axis>`.
 */
import { DAILY_PICK_EPOCH } from '@/lib/daily-pick/bank';
import { addDaysYmd, daysBetweenYmd } from '@/lib/local-date';
import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';

import { FIRST_SNOW, MICRO_IDS, type Hemisphere, type MicroId } from './events';
import { weekdayOfYmd } from './seed';

// ---------------------------------------------------------------- seasons

export type SeasonId = 'sparks' | 'bloom' | 'tides' | 'embers';

export interface SeasonInfo {
  id: SeasonId;
  name: string;
  /** What the season leans on (for card writers; not shown). */
  leans: string;
}

export const SEASONS: readonly SeasonInfo[] = [
  { id: 'sparks', name: 'Season of Sparks', leans: 'fresh starts, growth mindset' },
  { id: 'bloom', name: 'Season of Bloom', leans: 'openness, connection' },
  { id: 'tides', name: 'Season of Tides', leans: 'steadiness, play' },
  { id: 'embers', name: 'Season of Embers', leans: 'warmth, looking back' },
];

/** Month 1..12 → season. North: Jan-Mar Sparks … Oct-Dec Embers. South: shifted 6 months. */
export function seasonFor(month: number, hemisphere: Hemisphere): SeasonInfo {
  const northQuarter = Math.floor((month - 1) / 3);
  const quarter = hemisphere === 'south' ? (northQuarter + 2) % 4 : northQuarter;
  return SEASONS[quarter] as SeasonInfo;
}

// ---------------------------------------------------------------- months

export interface MonthTheme {
  id: string;
  name: string;
}

export const MONTH_THEMES: readonly MonthTheme[] = [
  { id: 'clean_slate', name: 'Clean slate' },
  { id: 'soft_spots', name: 'Soft spots' },
  { id: 'curiosity', name: 'Curiosity' },
  { id: 'small_risks', name: 'Small risks' },
  { id: 'roots', name: 'Roots' },
  { id: 'halfway', name: 'Halfway' },
  { id: 'play', name: 'Play' },
  { id: 'slow_days', name: 'Slow days' },
  { id: 'fresh_pages', name: 'Fresh pages' },
  { id: 'masks', name: 'Masks' },
  { id: 'gratitude_boundaries', name: 'Gratitude & boundaries' },
  { id: 'looking_back', name: 'Looking back' },
];

/** Exam season is part of the month theme, not an event (M8): it folds into Fresh pages (Sep) and Slow days (Aug) copy. */
export function monthTheme(month: number): MonthTheme {
  return MONTH_THEMES[(month - 1 + 12) % 12] as MonthTheme;
}

// ---------------------------------------------------------------- weeks and days

const floorMod = (n: number, m: number) => ((n % m) + m) % m;

/** The Monday on or before the Pick epoch: week 0 starts here. */
export const WEEK_ZERO_MONDAY = addDaysYmd(DAILY_PICK_EPOCH, -floorMod(weekdayOfYmd(DAILY_PICK_EPOCH) + 6, 7));

/** Absolute Monday-week number from the Pick epoch (can be negative before it). */
export function weekIndexFor(ymd: string): number {
  return Math.floor(daysBetweenYmd(WEEK_ZERO_MONDAY, ymd) / 7);
}

/** This week's trait theme. */
export function weekAxisFor(ymd: string): TraitAxis {
  return TRAIT_AXES[floorMod(weekIndexFor(ymd), TRAIT_AXES.length)] as TraitAxis;
}

/** Days since the Pick epoch (negative before it). */
export function dayIndexFor(ymd: string): number {
  return daysBetweenYmd(DAILY_PICK_EPOCH, ymd);
}

/** The month theme sets the line 1 day in 3. */
export function isLineDay(ymd: string): boolean {
  return floorMod(dayIndexFor(ymd), 3) === 0;
}

export const seasonArc = (id: SeasonId) => `season_${id}`;
export const monthArc = (id: string) => `month_${id}`;
export const weekArc = (axis: TraitAxis) => `week_${axis}`;

// ---------------------------------------------------------------- clock changes

const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(tz: string): Intl.DateTimeFormat {
  let f = offsetFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    offsetFormatters.set(tz, f);
  }
  return f;
}

/** Minutes the zone is ahead of UTC at this instant. */
function offsetMinutesAt(ts: number, tz: string): number {
  const parts = formatterFor(tz).formatToParts(new Date(ts));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const local = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((local - Math.floor(ts / 1000) * 1000) / 60000);
}

/** The zone's UTC offset at local noon of `ymd`. */
function noonOffsetMinutes(ymd: string, tz: string): number {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d, 12);
  const first = offsetMinutesAt(guess, tz);
  return offsetMinutesAt(guess - first * 60000, tz);
}

const clockMemo = new Map<string, boolean>();

/** True on the local day the clocks change (the offset at noon differs from yesterday's). */
export function isClockChangeDay(ymd: string, tz: string): boolean {
  const key = `${tz}|${ymd}`;
  const hit = clockMemo.get(key);
  if (hit !== undefined) return hit;
  let changed = false;
  try {
    changed = noonOffsetMinutes(ymd, tz) !== noonOffsetMinutes(addDaysYmd(ymd, -1), tz);
  } catch {
    changed = false;
  }
  clockMemo.set(key, changed);
  return changed;
}

// ---------------------------------------------------------------- micro-events

/** Facts only the app knows, supplied for TODAY by PHASE-11e. Missing = that moment is skipped. */
export interface MicroFacts {
  /** Picks answered so far (100 → "Your 100th Pick"). */
  pickCount?: number;
  /** `streakWithRest(...).streak` (30 → "30-day glow"). */
  glowStreak?: number;
  /** Did the reader answer a Pick on this date last year? */
  answeredYearAgo?: boolean;
}

export interface MicroEnv {
  tz: string;
  hemisphere: Hemisphere;
  fullMoons: ReadonlySet<string>;
  equinoxes: ReadonlySet<string>;
}

const monthDayOf = (ymd: string) => {
  const [, m, d] = ymd.split('-').map(Number) as [number, number, number];
  return { month: m, day: d };
};

function isLastWeekOfMonth(ymd: string): boolean {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d > last - 7;
}

/**
 * Micro-events that fall on this day, in `MICRO_IDS` order (who wins a shared day).
 * `small_moment` (the quiet-day filler) is added by the resolver, not here.
 */
export function microIdsFor(ymd: string, env: MicroEnv, facts: MicroFacts = {}): MicroId[] {
  const { month, day } = monthDayOf(ymd);
  const weekday = weekdayOfYmd(ymd);
  const snow = env.hemisphere === 'tropics' ? null : FIRST_SNOW[env.hemisphere];
  const hits: Record<MicroId, boolean> = {
    pick_100: facts.pickCount === 100,
    glow_30: facts.glowStreak === 30,
    one_year_ago: facts.answeredYearAgo === true,
    equinox: env.equinoxes.has(ymd),
    full_moon: env.fullMoons.has(ymd),
    friday_13th: weekday === 5 && day === 13,
    clock_change: isClockChangeDay(ymd, env.tz),
    half_year: month === 7 && day === 1,
    first_snow: !!snow && snow.month === month && snow.day === day,
    payday_friday: weekday === 5 && isLastWeekOfMonth(ymd),
    small_moment: false,
  };
  return MICRO_IDS.filter((id) => hits[id]);
}
