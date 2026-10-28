/**
 * Almanac events and date tables (ATO-BUILD PHASE-11b). Pure data, no logic.
 *
 * Dates for the moving feasts come from published tables (2026-2035), never from
 * lunar maths at runtime. Outside a table a region simply gets no event (M8).
 * Sources checked 2026-10-27:
 *  - Lunar New Year: chinahighlights.com / vclock.com / chinesenewyear.net (all agree).
 *  - Diwali (Lakshmi Puja): Wikipedia, drikpanchang.com, testbook.com. Where sources
 *    split by a day (2031, 2034) the EARLIER date is stored and Diwali has a 2-day peak.
 *  - Eid al-Fitr: Wikipedia, truecalendar.com (Umm al-Qura). Moon sighting moves it
 *    by a day by country, so Eid has a 2-day peak starting on the earliest listed date.
 *  - Equinoxes, solstices, full moons: Meeus, "Astronomical Algorithms" ch. 27 and 49,
 *    UTC to the minute (2026 values match the published times).
 */
import type { RampDays } from './ramp';

export type Hemisphere = 'north' | 'south' | 'tropics';

export const EVENT_IDS = [
  'new_year',
  'lunar_new_year',
  'valentines',
  'easter',
  'mothers_day',
  'fathers_day',
  'summer_solstice',
  'summer',
  'back_to_school',
  'thanksgiving_ca',
  'thanksgiving_us',
  'halloween',
  'diwali',
  'eid_al_fitr',
  'winter_solstice',
  'christmas',
  'year_end',
  'birthday',
  'ato_anniversary',
] as const;
export type EventId = (typeof EVENT_IDS)[number];

export type AstroPoint = 'mar_equinox' | 'jun_solstice' | 'sep_equinox' | 'dec_solstice';

export type DateRule =
  | { kind: 'fixed'; month: number; day: number }
  /** `n` = 1..4, or -1 for the last one. weekday 0 = Sunday. */
  | { kind: 'nthWeekday'; month: number; weekday: number; n: number }
  /** Anonymous Gregorian computus, plus `offset` days. */
  | { kind: 'easter'; offset?: number }
  /** Published dates (YYYY-MM-DD, the day the peak starts). */
  | { kind: 'table'; dates: readonly string[] }
  /** Equinox / solstice: the local day in the reader's time zone. */
  | { kind: 'astro'; point: AstroPoint }
  | { kind: 'personal'; field: 'birthday' | 'joinDate' }
  /** Per region; a region that is not listed has no event. `fallback` = every other known region. */
  | { kind: 'regionTable'; byRegion: Readonly<Record<string, DateRule>>; fallback?: DateRule }
  /** Seasons flip for the south; `tropics` null = no event there. */
  | { kind: 'hemisphere'; north: DateRule; south: DateRule; tropics: DateRule | null };

export interface EventDef {
  id: EventId;
  /** `{eventName}` text. */
  name: string;
  rule: DateRule;
  ramp: RampDays;
  /** Opt-in outside `defaultRegions`. */
  cultural?: boolean;
  defaultRegions?: readonly string[];
  /** The event exists only in these regions, no opt-in (Thanksgiving). */
  onlyRegions?: readonly string[];
  /** Ranks above a global peak when it is a regional or cultural moment. */
  regional?: boolean;
  /** Never above 0.4: a mood, not a moment. */
  ambient?: boolean;
  /** Mother's / Father's Day, Valentine's, Christmas: never assume family, partner, faith or celebration. */
  gentle?: boolean;
  /** Personal events ignore the seasonal master switch. */
  personal?: boolean;
  /** Name override by region (Mothering Sunday). */
  nameByRegion?: Readonly<Record<string, string>>;
}

export const AMBIENT_CAP = 0.4;

const r = (teaser: number, lead: number, build: number, peak: number, fade: number): RampDays => ({
  teaser,
  lead,
  build,
  peak,
  fade,
});

// ---------------------------------------------------------------- date tables

export const LUNAR_NEW_YEAR_DATES = [
  '2026-02-17',
  '2027-02-06',
  '2028-01-26',
  '2029-02-13',
  '2030-02-03',
  '2031-01-23',
  '2032-02-11',
  '2033-01-31',
  '2034-02-19',
  '2035-02-08',
] as const;

export const DIWALI_DATES = [
  '2026-11-08',
  '2027-10-29',
  '2028-10-17',
  '2029-11-05',
  '2030-10-26',
  '2031-11-13',
  '2032-11-02',
  '2033-10-22',
  '2034-11-09',
  '2035-10-30',
] as const;

/** 2033 has two Eids (Jan 2 and Dec 23). */
export const EID_AL_FITR_DATES = [
  '2026-03-20',
  '2027-03-09',
  '2028-02-26',
  '2029-02-14',
  '2030-02-03',
  '2031-01-24',
  '2032-01-14',
  '2033-01-02',
  '2033-12-23',
  '2034-12-12',
  '2035-12-01',
] as const;

/** Equinoxes and solstices, UTC: [March, June, September, December]. */
export const ASTRO_TABLE: Readonly<Record<number, readonly [string, string, string, string]>> = {
  2025: ['2025-03-20T09:02Z', '2025-06-21T02:42Z', '2025-09-22T18:20Z', '2025-12-21T15:03Z'],
  2026: ['2026-03-20T14:46Z', '2026-06-21T08:25Z', '2026-09-23T00:06Z', '2026-12-21T20:50Z'],
  2027: ['2027-03-20T20:25Z', '2027-06-21T14:11Z', '2027-09-23T06:01Z', '2027-12-22T02:42Z'],
  2028: ['2028-03-20T02:17Z', '2028-06-20T20:02Z', '2028-09-22T11:45Z', '2028-12-21T08:20Z'],
  2029: ['2029-03-20T08:02Z', '2029-06-21T01:48Z', '2029-09-22T17:38Z', '2029-12-21T14:14Z'],
  2030: ['2030-03-20T13:52Z', '2030-06-21T07:31Z', '2030-09-22T23:27Z', '2030-12-21T20:10Z'],
  2031: ['2031-03-20T19:41Z', '2031-06-21T13:17Z', '2031-09-23T05:15Z', '2031-12-22T01:56Z'],
  2032: ['2032-03-20T01:22Z', '2032-06-20T19:09Z', '2032-09-22T11:11Z', '2032-12-21T07:56Z'],
  2033: ['2033-03-20T07:23Z', '2033-06-21T01:01Z', '2033-09-22T16:52Z', '2033-12-21T13:46Z'],
  2034: ['2034-03-20T13:18Z', '2034-06-21T06:45Z', '2034-09-22T22:40Z', '2034-12-21T19:34Z'],
  2035: ['2035-03-20T19:04Z', '2035-06-21T12:33Z', '2035-09-23T04:39Z', '2035-12-22T01:31Z'],
  2036: ['2036-03-20T01:03Z', '2036-06-20T18:32Z', '2036-09-22T10:24Z', '2036-12-21T07:13Z'],
};

/** Full moons, UTC (Dec 2025 to Jan 2036, so every local day in 2026-2035 is covered). */
export const FULL_MOONS_UTC: readonly string[] = [
  '2025-12-04T23:14Z',
  '2026-01-03T10:03Z', '2026-02-01T22:10Z', '2026-03-03T11:39Z', '2026-04-02T02:13Z',
  '2026-05-01T17:24Z', '2026-05-31T08:46Z', '2026-06-29T23:57Z', '2026-07-29T14:36Z',
  '2026-08-28T04:19Z', '2026-09-26T16:49Z', '2026-10-26T04:12Z', '2026-11-24T14:54Z',
  '2026-12-24T01:29Z',
  '2027-01-22T12:18Z', '2027-02-20T23:24Z', '2027-03-22T10:44Z', '2027-04-20T22:28Z',
  '2027-05-20T10:59Z', '2027-06-19T00:45Z', '2027-07-18T15:46Z', '2027-08-17T07:29Z',
  '2027-09-15T23:04Z', '2027-10-15T13:48Z', '2027-11-14T03:26Z', '2027-12-13T16:09Z',
  '2028-01-12T04:04Z', '2028-02-10T15:04Z', '2028-03-11T01:07Z', '2028-04-09T10:27Z',
  '2028-05-08T19:50Z', '2028-06-07T06:10Z', '2028-07-06T18:12Z', '2028-08-05T08:11Z',
  '2028-09-03T23:48Z', '2028-10-03T16:26Z', '2028-11-02T09:17Z', '2028-12-02T01:40Z',
  '2028-12-31T16:48Z',
  '2029-01-30T06:04Z', '2029-02-28T17:11Z', '2029-03-30T02:27Z', '2029-04-28T10:38Z',
  '2029-05-27T18:39Z', '2029-06-26T03:23Z', '2029-07-25T13:37Z', '2029-08-24T01:52Z',
  '2029-09-22T16:30Z', '2029-10-22T09:28Z', '2029-11-21T04:03Z', '2029-12-20T22:47Z',
  '2030-01-19T15:55Z', '2030-02-18T06:20Z', '2030-03-19T17:57Z', '2030-04-18T03:20Z',
  '2030-05-17T11:20Z', '2030-06-15T18:41Z', '2030-07-15T02:12Z', '2030-08-13T10:45Z',
  '2030-09-11T21:18Z', '2030-10-11T10:47Z', '2030-11-10T03:31Z', '2030-12-09T22:41Z',
  '2031-01-08T18:26Z', '2031-02-07T12:47Z', '2031-03-09T04:30Z', '2031-04-07T17:22Z',
  '2031-05-07T03:40Z', '2031-06-05T11:59Z', '2031-07-04T19:02Z', '2031-08-03T01:46Z',
  '2031-09-01T09:21Z', '2031-09-30T18:59Z', '2031-10-30T07:34Z', '2031-11-28T23:19Z',
  '2031-12-28T17:33Z',
  '2032-01-27T12:53Z', '2032-02-26T07:43Z', '2032-03-27T00:46Z', '2032-04-25T15:10Z',
  '2032-05-25T02:38Z', '2032-06-23T11:33Z', '2032-07-22T18:52Z', '2032-08-21T01:48Z',
  '2032-09-19T09:31Z', '2032-10-18T18:59Z', '2032-11-17T06:43Z', '2032-12-16T20:50Z',
  '2033-01-15T13:08Z', '2033-02-14T07:05Z', '2033-03-16T01:38Z', '2033-04-14T19:18Z',
  '2033-05-14T10:43Z', '2033-06-12T23:20Z', '2033-07-12T09:29Z', '2033-08-10T18:08Z',
  '2033-09-09T02:21Z', '2033-10-08T10:58Z', '2033-11-06T20:33Z', '2033-12-06T07:23Z',
  '2034-01-04T19:48Z', '2034-02-03T10:06Z', '2034-03-05T02:11Z', '2034-04-03T19:19Z',
  '2034-05-03T12:16Z', '2034-06-02T03:54Z', '2034-07-01T17:45Z', '2034-07-31T05:55Z',
  '2034-08-29T16:50Z', '2034-09-28T02:57Z', '2034-10-27T12:43Z', '2034-11-25T22:33Z',
  '2034-12-25T08:55Z',
  '2035-01-23T20:17Z', '2035-02-22T08:54Z', '2035-03-23T22:42Z', '2035-04-22T13:21Z',
  '2035-05-22T04:26Z', '2035-06-20T19:37Z', '2035-07-20T10:37Z', '2035-08-19T01:01Z',
  '2035-09-17T14:24Z', '2035-10-17T02:36Z', '2035-11-15T13:50Z', '2035-12-15T00:34Z',
  '2036-01-13T11:17Z',
];

/** First and last year every table covers (UTC). */
export const TABLE_FIRST_YEAR = 2026;
export const TABLE_LAST_YEAR = 2035;

// ---------------------------------------------------------------- event list

const CHRISTIAN_REGIONS = [
  'US', 'CA', 'GB', 'IE', 'AU', 'NZ', 'DE', 'FR', 'IT', 'ES', 'PT', 'NL', 'BE', 'AT', 'CH', 'PL', 'BR', 'MX',
] as const;

const SECOND_SUNDAY_MAY = { kind: 'nthWeekday', month: 5, weekday: 0, n: 2 } as const satisfies DateRule;
const EASTER_MINUS_21 = { kind: 'easter', offset: -21 } as const satisfies DateRule;

export const EVENTS: readonly EventDef[] = [
  { id: 'new_year', name: 'New Year', rule: { kind: 'fixed', month: 1, day: 1 }, ramp: r(5, 2, 2, 1, 7) },
  {
    id: 'lunar_new_year',
    name: 'Lunar New Year',
    rule: { kind: 'table', dates: LUNAR_NEW_YEAR_DATES },
    ramp: r(7, 3, 2, 7, 4),
    cultural: true,
    regional: true,
    defaultRegions: ['CN', 'TW', 'HK', 'MO', 'SG', 'MY', 'VN', 'KR'],
  },
  {
    id: 'valentines',
    name: "Valentine's Day",
    rule: { kind: 'fixed', month: 2, day: 14 },
    ramp: r(5, 2, 2, 1, 4),
    gentle: true,
  },
  {
    id: 'easter',
    name: 'Easter',
    rule: { kind: 'easter' },
    ramp: r(6, 3, 2, 1, 4),
    cultural: true,
    defaultRegions: CHRISTIAN_REGIONS,
  },
  {
    id: 'mothers_day',
    name: "Mother's Day",
    nameByRegion: { GB: 'Mothering Sunday', IE: 'Mothering Sunday' },
    rule: {
      kind: 'regionTable',
      byRegion: { US: SECOND_SUNDAY_MAY, CA: SECOND_SUNDAY_MAY, AU: SECOND_SUNDAY_MAY, NZ: SECOND_SUNDAY_MAY, GB: EASTER_MINUS_21, IE: EASTER_MINUS_21 },
    },
    ramp: r(5, 2, 2, 1, 4),
    regional: true,
    gentle: true,
  },
  {
    id: 'fathers_day',
    name: "Father's Day",
    rule: {
      kind: 'regionTable',
      byRegion: {
        AU: { kind: 'nthWeekday', month: 9, weekday: 0, n: 1 },
        NZ: { kind: 'nthWeekday', month: 9, weekday: 0, n: 1 },
      },
      fallback: { kind: 'nthWeekday', month: 6, weekday: 0, n: 3 },
    },
    ramp: r(5, 2, 2, 1, 4),
    regional: true,
    gentle: true,
  },
  {
    id: 'summer_solstice',
    name: 'Summer solstice',
    rule: {
      kind: 'hemisphere',
      north: { kind: 'astro', point: 'jun_solstice' },
      south: { kind: 'astro', point: 'dec_solstice' },
      tropics: null,
    },
    ramp: r(5, 2, 2, 1, 4),
    ambient: true,
  },
  {
    id: 'summer',
    name: 'Summer',
    rule: {
      kind: 'hemisphere',
      north: { kind: 'fixed', month: 6, day: 1 },
      south: { kind: 'fixed', month: 12, day: 1 },
      tropics: null,
    },
    ramp: r(7, 3, 2, 1, 4),
    ambient: true,
  },
  {
    id: 'back_to_school',
    name: 'Back to school',
    rule: {
      kind: 'hemisphere',
      north: { kind: 'fixed', month: 9, day: 1 },
      south: { kind: 'fixed', month: 2, day: 1 },
      tropics: { kind: 'fixed', month: 9, day: 1 },
    },
    ramp: r(7, 3, 2, 1, 4),
    ambient: true,
  },
  {
    id: 'thanksgiving_ca',
    name: 'Thanksgiving',
    rule: { kind: 'nthWeekday', month: 10, weekday: 1, n: 2 },
    ramp: r(5, 2, 2, 1, 4),
    regional: true,
    onlyRegions: ['CA'],
  },
  {
    id: 'thanksgiving_us',
    name: 'Thanksgiving',
    rule: { kind: 'nthWeekday', month: 11, weekday: 4, n: 4 },
    ramp: r(5, 2, 2, 1, 4),
    regional: true,
    onlyRegions: ['US'],
  },
  { id: 'halloween', name: 'Halloween', rule: { kind: 'fixed', month: 10, day: 31 }, ramp: r(10, 5, 3, 1, 4) },
  {
    id: 'diwali',
    name: 'Diwali',
    rule: { kind: 'table', dates: DIWALI_DATES },
    ramp: r(7, 3, 2, 2, 4),
    cultural: true,
    regional: true,
    defaultRegions: ['IN', 'NP', 'LK', 'SG', 'MY', 'FJ', 'MU'],
  },
  {
    id: 'eid_al_fitr',
    name: 'Eid al-Fitr',
    rule: { kind: 'table', dates: EID_AL_FITR_DATES },
    ramp: r(7, 3, 2, 2, 4),
    cultural: true,
    regional: true,
    defaultRegions: ['SA', 'AE', 'EG', 'TR', 'ID', 'MY', 'PK', 'BD', 'MA', 'DZ', 'NG', 'QA', 'KW', 'JO', 'IQ', 'SG', 'BN'],
  },
  {
    id: 'winter_solstice',
    name: 'Winter solstice',
    rule: {
      kind: 'hemisphere',
      north: { kind: 'astro', point: 'dec_solstice' },
      south: { kind: 'astro', point: 'jun_solstice' },
      tropics: null,
    },
    ramp: r(5, 2, 2, 1, 4),
    ambient: true,
  },
  {
    id: 'christmas',
    name: 'Christmas',
    rule: { kind: 'fixed', month: 12, day: 25 },
    ramp: r(14, 7, 5, 2, 5),
    gentle: true,
  },
  {
    id: 'year_end',
    name: 'Year end',
    rule: { kind: 'fixed', month: 12, day: 29 },
    ramp: r(3, 2, 2, 1, 4),
    ambient: true,
  },
  {
    id: 'birthday',
    name: 'Your birthday',
    rule: { kind: 'personal', field: 'birthday' },
    ramp: r(3, 1, 2, 1, 4),
    personal: true,
  },
  {
    id: 'ato_anniversary',
    name: 'Your ATO anniversary',
    rule: { kind: 'personal', field: 'joinDate' },
    ramp: r(3, 1, 2, 1, 4),
    personal: true,
  },
];

const BY_ID = new Map<string, EventDef>(EVENTS.map((e) => [e.id, e]));

export function eventDef(id: string): EventDef | undefined {
  return BY_ID.get(id);
}

/** Gentle days: card writers may never assume family, partner, faith or celebration. */
export function isGentleEvent(id: string): boolean {
  return BY_ID.get(id)?.gentle === true;
}

export function eventName(def: EventDef, region: string | null): string {
  return (region && def.nameByRegion?.[region]) || def.name;
}

// ---------------------------------------------------------------- micro-events

/** Small one-day moments (intensity 0.4 at most). Order = who wins on a shared day. */
export const MICRO_IDS = [
  'pick_100',
  'glow_30',
  'one_year_ago',
  'equinox',
  'full_moon',
  'friday_13th',
  'clock_change',
  'half_year',
  'first_snow',
  'payday_friday',
  'small_moment',
] as const;
export type MicroId = (typeof MICRO_IDS)[number];

export const MICRO_NAMES: Readonly<Record<MicroId, string>> = {
  pick_100: 'Your 100th Pick',
  glow_30: '30-day glow',
  one_year_ago: 'One year ago today',
  equinox: 'Equinox',
  full_moon: 'Full moon',
  friday_13th: 'Friday the 13th',
  clock_change: 'Clock change',
  half_year: 'Half-year',
  first_snow: 'First snow',
  payday_friday: 'Payday Friday',
  small_moment: 'A small moment',
};

/** Target intensity of a micro-event. */
export const MICRO_INTENSITY = 0.4;
/** Quiet days: a `small_moment` lands on every 10th day since the Pick epoch when nothing else is on. */
export const SMALL_MOMENT_EVERY = 10;
/** First snow, by hemisphere (tropics: no snow, no leaf-fall). */
export const FIRST_SNOW: Readonly<Record<'north' | 'south', { month: number; day: number }>> = {
  north: { month: 11, day: 20 },
  south: { month: 7, day: 20 },
};
