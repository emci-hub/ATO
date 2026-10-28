/**
 * Almanac date rules (ATO-BUILD PHASE-11b). Pure: no storage, no network.
 *
 * A rule answers one question: "on which local day does this event's PEAK start
 * in year Y?" (`peakStartsFor`). The ramp (ramp.ts) lays the other phases around it.
 * Rule kinds: fixed, nthWeekday, easter (Anonymous Gregorian computus), table,
 * astro (equinox / solstice from the table, mapped to the reader's local day),
 * personal (birthday, ATO join date), regionTable, hemisphere.
 *
 * Outside its table a region gets no event: a date is never guessed (M8).
 */
import { localYmd } from '@/lib/local-date';

import {
  ASTRO_TABLE,
  FULL_MOONS_UTC,
  eventName,
  type AstroPoint,
  type DateRule,
  type EventDef,
  type Hemisphere,
} from './events';
import { weekdayOfYmd } from './seed';

export interface RuleEnv {
  /** IANA zone (`me.timezone`, else the device zone). */
  tz: string;
  /** ISO country code from the device locale, or null. */
  region: string | null;
  hemisphere: Hemisphere;
  /** `me.born_on`, YYYY-MM-DD. */
  bornOn?: string | null;
  /** The local day the account was created, YYYY-MM-DD. */
  joinedYmd?: string | null;
}

/** Settings choices the calendar needs (PHASE-11f owns the screen). */
export interface EventPrefs {
  /** Master switch for events and micro-events. Default on. Seasons, months and weeks stay on. */
  seasonal?: boolean;
  /** Per-event choice for `cultural` events. Missing = on only in the default regions. */
  cultural?: Readonly<Partial<Record<string, boolean>>>;
  /** "Use my birthday". Missing = on. The master switch still wins. */
  birthday?: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const ymdOf = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** A month/day in a year; Feb 29 becomes Feb 28 in a non-leap year. */
export function monthDayInYear(year: number, month: number, day: number): string {
  const safeDay = month === 2 && day === 29 && !isLeapYear(year) ? 28 : day;
  return ymdOf(year, month, safeDay);
}

/** Easter Sunday (Anonymous Gregorian algorithm). */
export function easterYmd(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return ymdOf(year, month, day);
}

/** The n-th weekday of a month (n = 1..4), or the last one (n = -1). weekday 0 = Sunday. */
export function nthWeekdayYmd(year: number, month: number, weekday: number, n: number): string {
  if (n === -1) {
    const last = daysInMonth(year, month);
    const back = (weekdayOfYmd(ymdOf(year, month, last)) - weekday + 7) % 7;
    return ymdOf(year, month, last - back);
  }
  const first = weekdayOfYmd(ymdOf(year, month, 1));
  return ymdOf(year, month, 1 + ((weekday - first + 7) % 7) + 7 * (n - 1));
}

/** Local day of a UTC instant (`2026-03-20T14:46Z`) in `tz`. A bad zone reads as UTC. */
export function localDayOfInstant(iso: string, tz: string): string {
  const at = new Date(iso);
  try {
    return localYmd(at, tz);
  } catch {
    return at.toISOString().slice(0, 10);
  }
}

const ASTRO_INDEX: Readonly<Record<AstroPoint, 0 | 1 | 2 | 3>> = {
  mar_equinox: 0,
  jun_solstice: 1,
  sep_equinox: 2,
  dec_solstice: 3,
};

export function astroYmd(year: number, point: AstroPoint, tz: string): string | null {
  const row = ASTRO_TABLE[year];
  return row ? localDayOfInstant(row[ASTRO_INDEX[point]], tz) : null;
}

const moonMemo = new Map<string, Set<string>>();
const equinoxMemo = new Map<string, Set<string>>();

/** Local days (in `tz`) that hold a full moon. Memoised per zone (about 125 Intl calls). */
export function fullMoonDays(tz: string): Set<string> {
  let hit = moonMemo.get(tz);
  if (!hit) {
    hit = new Set(FULL_MOONS_UTC.map((iso) => localDayOfInstant(iso, tz)));
    moonMemo.set(tz, hit);
  }
  return hit;
}

/** Local days of the March and September equinox. Memoised per zone. */
export function equinoxDays(tz: string): Set<string> {
  let hit = equinoxMemo.get(tz);
  if (!hit) {
    hit = new Set<string>();
    for (const row of Object.values(ASTRO_TABLE)) {
      hit.add(localDayOfInstant(row[0], tz));
      hit.add(localDayOfInstant(row[2], tz));
    }
    equinoxMemo.set(tz, hit);
  }
  return hit;
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function personalYmd(field: 'birthday' | 'joinDate', year: number, env: RuleEnv): string | null {
  const source = field === 'birthday' ? env.bornOn : env.joinedYmd;
  if (!source || !YMD.test(source)) return null;
  const [y, m, d] = source.split('-').map(Number) as [number, number, number];
  if (year <= y) return null; // the first one is a year after the start
  return monthDayInYear(year, m, d);
}

/** Local days (YYYY-MM-DD) on which the event's peak starts in `year`. Usually zero or one. */
export function peakStartsFor(rule: DateRule, year: number, env: RuleEnv): string[] {
  switch (rule.kind) {
    case 'fixed':
      return [monthDayInYear(year, rule.month, rule.day)];
    case 'nthWeekday':
      return [nthWeekdayYmd(year, rule.month, rule.weekday, rule.n)];
    case 'easter': {
      const easter = easterYmd(year);
      if (!rule.offset) return [easter];
      const [y, m, d] = easter.split('-').map(Number) as [number, number, number];
      return [new Date(Date.UTC(y, m - 1, d + rule.offset)).toISOString().slice(0, 10)];
    }
    case 'table':
      return rule.dates.filter((date) => date.startsWith(`${year}-`));
    case 'astro': {
      const day = astroYmd(year, rule.point, env.tz);
      return day ? [day] : [];
    }
    case 'personal': {
      const day = personalYmd(rule.field, year, env);
      return day ? [day] : [];
    }
    case 'regionTable': {
      if (!env.region) return [];
      const inner = rule.byRegion[env.region] ?? rule.fallback;
      return inner ? peakStartsFor(inner, year, env) : [];
    }
    case 'hemisphere': {
      const inner = env.hemisphere === 'south' ? rule.south : env.hemisphere === 'tropics' ? rule.tropics : rule.north;
      return inner ? peakStartsFor(inner, year, env) : [];
    }
  }
}

/** Is this event on for this reader? */
export function eventEnabled(def: EventDef, env: RuleEnv, prefs: EventPrefs = {}): boolean {
  // Master off turns every event off, personal ones too (emci 2026-10-28).
  if (prefs.seasonal === false) return false;
  if (def.personal) return def.id !== 'birthday' || prefs.birthday !== false;
  if (def.onlyRegions && !(env.region && def.onlyRegions.includes(env.region))) return false;
  if (def.cultural) {
    const chosen = prefs.cultural?.[def.id];
    if (chosen !== undefined) return chosen;
    return !!(env.region && def.defaultRegions?.includes(env.region));
  }
  return true;
}

/** The name shown in `{eventName}` (Mothering Sunday for GB / IE). */
export function nameFor(def: EventDef, env: RuleEnv): string {
  return eventName(def, env.region);
}
