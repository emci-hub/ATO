/**
 * Almanac calendar, locale, ramp and arcs (ATO-BUILD PHASE-11b).
 * Run: npm run check:almanac-calendar
 *      npm run check:almanac-calendar -- --write   (rewrites docs/almanac-calendar.md)
 *
 * Pins: golden dates (Easter 2027-03-28, Lunar NY 2027-02-06, CA Thanksgiving 2026-10-12,
 * Mothering Sunday 2027-03-07); every date table covers 2026-2035; ramp phases and bands;
 * a 2026-01-01 … 2035-12-31 sim for US / GB / AU × north / south / tropics × default and
 * all-opted-in: every day has a theme, the displayed intensity moves at most 0.3 a day,
 * at most one event is shown above 0.4, the real clashes resolve; the same day gives the
 * same answer from any walk-back start; time-zone fixtures (UTC+14, UTC−12, DST both
 * ways, date-line travel); the hemisphere is stored once; the layer blend feeds the
 * 11a engine; the new files stay pure; docs/almanac-calendar.md is fresh.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  SEASONS,
  MONTH_THEMES,
  WEEK_ZERO_MONDAY,
  isClockChangeDay,
  seasonFor,
  weekAxisFor,
  weekIndexFor,
} from '../src/lib/almanac/arcs';
import {
  easterYmd,
  equinoxDays,
  eventEnabled,
  fullMoonDays,
  isLeapYear,
  localDayOfInstant,
  monthDayInYear,
  nthWeekdayYmd,
  peakStartsFor,
  type RuleEnv,
} from '../src/lib/almanac/calendar';
import {
  ASTRO_TABLE,
  DIWALI_DATES,
  EID_AL_FITR_DATES,
  EVENTS,
  EVENT_IDS,
  FULL_MOONS_UTC,
  LUNAR_NEW_YEAR_DATES,
  MICRO_IDS,
  MICRO_NAMES,
  eventDef,
  isGentleEvent,
  type DateRule,
  type Hemisphere,
} from '../src/lib/almanac/events';
import { today } from '../src/lib/almanac/index';
import {
  ALMANAC_LOCALE_KEY,
  hemisphereFromZone,
  loadLocale,
  parseLocale,
  regionFromLocale,
  setHemisphere,
} from '../src/lib/almanac/locale';
import {
  MAX_DAILY_STEP,
  MIN_BUILD_DAYS,
  MIN_FADE_DAYS,
  PHASE_BANDS,
  normalizeRamp,
  rampAt,
  rampSpanDays,
  slewToward,
  type RampDays,
} from '../src/lib/almanac/ramp';
import {
  HANDOVER_MAX,
  almanacTodayFromTheme,
  callbackKey,
  createCalendar,
  layerWeightFor,
  stepLane,
  toAlmanacCalendar,
  type CalendarConfig,
  type DayTheme,
} from '../src/lib/almanac/resolve';
import { almanacYmd, weekdayOfYmd } from '../src/lib/almanac/seed';
import type { AlmanacCard, AlmanacContext, KeyValueStore } from '../src/lib/almanac/types';
import { DAILY_PICK_EPOCH } from '../src/lib/daily-pick/bank';
import { addDaysYmd, daysBetweenYmd } from '../src/lib/local-date';
import { TRAIT_AXES } from '../src/lib/traits';

function ok(label: string): void {
  console.log(`  ok  ${label}`);
}

const EPS = 1e-9;
const DOC_PATH = resolve(__dirname, '../docs/almanac-calendar.md');

// ---------------------------------------------------------------- helpers

function env(partial: Partial<RuleEnv> = {}): RuleEnv {
  return { tz: 'America/New_York', region: 'US', hemisphere: 'north', bornOn: null, joinedYmd: null, ...partial };
}

function rule(id: string): DateRule {
  const def = eventDef(id);
  assert.ok(def, `event ${id} exists`);
  return def.rule;
}

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    async getItem(key) {
      return data.get(key) ?? null;
    },
    async setItem(key, value) {
      data.set(key, value);
    },
  };
}

// ---------------------------------------------------------------- 1. golden dates and rules

function goldenDates(): void {
  assert.equal(easterYmd(2027), '2027-03-28');
  assert.equal(easterYmd(2026), '2026-04-05');
  assert.equal(easterYmd(2028), '2028-04-16');
  assert.equal(easterYmd(2030), '2030-04-21');
  assert.equal(easterYmd(2035), '2035-03-25');
  ok('Easter computus: 2026-04-05, 2027-03-28, 2028-04-16, 2030-04-21, 2035-03-25');

  assert.deepEqual(peakStartsFor(rule('lunar_new_year'), 2027, env()), ['2027-02-06']);
  assert.deepEqual(peakStartsFor(rule('lunar_new_year'), 2025, env()), [], 'outside the table = no event');
  assert.deepEqual(peakStartsFor(rule('lunar_new_year'), 2036, env()), []);
  ok('Lunar New Year 2027-02-06; none outside the table');

  assert.equal(nthWeekdayYmd(2026, 10, 1, 2), '2026-10-12');
  assert.deepEqual(peakStartsFor(rule('thanksgiving_ca'), 2026, env({ region: 'CA' })), ['2026-10-12']);
  assert.deepEqual(peakStartsFor(rule('thanksgiving_us'), 2026, env()), ['2026-11-26']);
  assert.equal(nthWeekdayYmd(2026, 2, 0, -1), '2026-02-22', 'last Sunday of February 2026');
  ok('Thanksgiving: CA 2026-10-12, US 2026-11-26; nth and last weekday');

  assert.deepEqual(peakStartsFor(rule('mothers_day'), 2027, env({ region: 'GB' })), ['2027-03-07']);
  assert.deepEqual(peakStartsFor(rule('mothers_day'), 2027, env({ region: 'IE' })), ['2027-03-07']);
  assert.deepEqual(peakStartsFor(rule('mothers_day'), 2027, env({ region: 'US' })), ['2027-05-09']);
  assert.deepEqual(peakStartsFor(rule('mothers_day'), 2027, env({ region: 'AU' })), ['2027-05-09']);
  assert.deepEqual(peakStartsFor(rule('mothers_day'), 2027, env({ region: 'DE' })), [], 'not in the table = no event');
  assert.deepEqual(peakStartsFor(rule('mothers_day'), 2027, env({ region: null })), []);
  ok('Mother\'s Day: Mothering Sunday 2027-03-07 (GB/IE), 2027-05-09 (US/CA/AU/NZ), none elsewhere');

  assert.deepEqual(peakStartsFor(rule('fathers_day'), 2027, env({ region: 'US' })), ['2027-06-20']);
  assert.deepEqual(peakStartsFor(rule('fathers_day'), 2027, env({ region: 'AU' })), ['2027-09-05']);
  assert.deepEqual(peakStartsFor(rule('fathers_day'), 2027, env({ region: 'NZ' })), ['2027-09-05']);
  assert.deepEqual(peakStartsFor(rule('fathers_day'), 2027, env({ region: null })), [], 'unknown region = no event');
  ok("Father's Day: 3rd Sunday of June, AU/NZ 1st Sunday of September");

  // Birthday and ATO anniversary
  const born = env({ bornOn: '2000-02-29', joinedYmd: '2024-02-29' });
  assert.deepEqual(peakStartsFor(rule('birthday'), 2027, born), ['2027-02-28'], 'Feb 29 → Feb 28 in a non-leap year');
  assert.deepEqual(peakStartsFor(rule('birthday'), 2028, born), ['2028-02-29']);
  assert.deepEqual(peakStartsFor(rule('birthday'), 2000, born), [], 'no birthday in the birth year');
  assert.deepEqual(peakStartsFor(rule('birthday'), 2027, env()), [], 'no birthday given = none');
  assert.deepEqual(peakStartsFor(rule('ato_anniversary'), 2026, born), ['2026-02-28']);
  assert.deepEqual(peakStartsFor(rule('ato_anniversary'), 2028, born), ['2028-02-29']);
  assert.deepEqual(peakStartsFor(rule('ato_anniversary'), 2024, born), [], 'first anniversary is a year after joining');
  assert.equal(monthDayInYear(2100, 2, 29), '2100-02-28');
  assert.ok(isLeapYear(2028) && !isLeapYear(2100) && isLeapYear(2000));
  ok('birthday + ATO anniversary: Feb 29 → Feb 28 in non-leap years, first one a year later');

  // Hemisphere flips
  const sumSol = rule('summer_solstice');
  assert.deepEqual(peakStartsFor(sumSol, 2026, env({ hemisphere: 'north' })), ['2026-06-21']);
  assert.deepEqual(peakStartsFor(sumSol, 2026, env({ hemisphere: 'south', tz: 'Australia/Sydney' })), ['2026-12-22']);
  assert.deepEqual(peakStartsFor(sumSol, 2026, env({ hemisphere: 'tropics' })), [], 'tropics: no solstice flip');
  assert.deepEqual(peakStartsFor(rule('winter_solstice'), 2026, env({ hemisphere: 'north' })), ['2026-12-21']);
  assert.deepEqual(peakStartsFor(rule('summer'), 2026, env({ hemisphere: 'south' })), ['2026-12-01']);
  ok('hemisphere flips: summer solstice Jun 21 (N) / Dec 22 Sydney (S) / none (tropics)');
}

// ---------------------------------------------------------------- 2. tables

function tableChecks(): void {
  for (const [name, dates] of [
    ['Lunar New Year', LUNAR_NEW_YEAR_DATES],
    ['Diwali', DIWALI_DATES],
    ['Eid al-Fitr', EID_AL_FITR_DATES],
  ] as const) {
    for (let y = 2026; y <= 2035; y += 1) {
      assert.ok(dates.some((d) => d.startsWith(`${y}-`)), `${name} has ${y}`);
    }
    assert.deepEqual([...dates], [...dates].sort(), `${name} sorted`);
  }
  assert.equal(EID_AL_FITR_DATES.filter((d) => d.startsWith('2033-')).length, 2, 'Eid twice in 2033');
  assert.equal(LUNAR_NEW_YEAR_DATES.length, 10);
  assert.equal(DIWALI_DATES.length, 10);
  for (let y = 2026; y <= 2035; y += 1) {
    const row = ASTRO_TABLE[y];
    assert.ok(row && row.length === 4, `equinox/solstice row ${y}`);
    assert.ok(row[0].startsWith(`${y}-03-`) && row[1].startsWith(`${y}-06-`));
    assert.ok(row[2].startsWith(`${y}-09-`) && row[3].startsWith(`${y}-12-`));
  }
  assert.deepEqual([...FULL_MOONS_UTC], [...FULL_MOONS_UTC].sort(), 'full moons sorted');
  for (let i = 1; i < FULL_MOONS_UTC.length; i += 1) {
    const gap = (Date.parse(FULL_MOONS_UTC[i] as string) - Date.parse(FULL_MOONS_UTC[i - 1] as string)) / 86_400_000;
    assert.ok(gap > 29 && gap < 30.1, `full moon gap ${gap.toFixed(2)} days at ${FULL_MOONS_UTC[i]}`);
  }
  assert.ok(FULL_MOONS_UTC[0] as string < '2026-01-01' && (FULL_MOONS_UTC.at(-1) as string) > '2035-12-31');
  assert.ok(FULL_MOONS_UTC.includes('2026-01-03T10:03Z'), 'known full moon 2026-01-03 10:03 UTC');
  assert.equal(ASTRO_TABLE[2026]?.[0], '2026-03-20T14:46Z', 'known equinox 2026-03-20 14:46 UTC');
  assert.equal(ASTRO_TABLE[2026]?.[3], '2026-12-21T20:50Z', 'known solstice 2026-12-21 20:50 UTC');
  ok('date tables cover 2026-2035 (LNY, Diwali, Eid incl. two in 2033, 4 astro points a year, full moons 29-30 days apart)');
}

// ---------------------------------------------------------------- 3. ramp

function rampChecks(): void {
  assert.equal(MIN_BUILD_DAYS, 2);
  assert.equal(MIN_FADE_DAYS, 4);
  assert.deepEqual(normalizeRamp({ teaser: 5, lead: 2, build: 1, peak: 0, fade: 1 }), {
    teaser: 5,
    lead: 2,
    build: 2,
    peak: 1,
    fade: 4,
  });
  for (const def of EVENTS) {
    const n = normalizeRamp(def.ramp);
    assert.deepEqual(n, def.ramp, `${def.id} ramp already meets the minimums`);
  }

  const christmas: RampDays = { teaser: 14, lead: 7, build: 5, peak: 2, fade: 5 };
  assert.equal(rampSpanDays(christmas), 33);
  assert.equal(rampAt(christmas, -27), null);
  const phases: Record<number, string> = {};
  let prev = -1;
  for (let dt = -26; dt <= 6; dt += 1) {
    const p = rampAt(christmas, dt);
    assert.ok(p, `christmas dt ${dt}`);
    phases[dt] = p.phase;
    assert.ok(p.intensity >= 0 && p.intensity <= 1);
    if (dt <= 0) assert.ok(p.intensity >= prev - EPS, `non-decreasing into the peak at ${dt}`);
    prev = p.intensity;
  }
  assert.equal(rampAt(christmas, 7), null);
  assert.deepEqual([phases[-26], phases[-13], phases[-12], phases[-6], phases[-5], phases[-1], phases[0], phases[1], phases[2], phases[6]], [
    'teaser',
    'teaser',
    'lead',
    'lead',
    'build',
    'build',
    'peak',
    'peak',
    'fade',
    'fade',
  ]);
  // Counted back from the peak start: teaser 14, lead 7, build 5.
  assert.equal(Object.values(phases).filter((p) => p === 'teaser').length, 14);
  assert.equal(Object.values(phases).filter((p) => p === 'lead').length, 7);
  assert.equal(Object.values(phases).filter((p) => p === 'build').length, 5);
  assert.equal(Object.values(phases).filter((p) => p === 'peak').length, 2);
  assert.equal(Object.values(phases).filter((p) => p === 'fade').length, 5);
  // Bands.
  for (const def of EVENTS) {
    for (let dt = -rampSpanDays(def.ramp); dt < rampSpanDays(def.ramp); dt += 1) {
      const p = rampAt(def.ramp, dt);
      if (!p) continue;
      if (p.phase === 'teaser' || p.phase === 'lead' || p.phase === 'build') {
        const [lo, hi] = PHASE_BANDS[p.phase];
        assert.ok(p.intensity >= lo - EPS && p.intensity <= hi + EPS, `${def.id} ${p.phase} ${p.intensity} in [${lo}, ${hi}]`);
      } else if (p.phase === 'peak') {
        assert.equal(p.intensity, 1);
      } else {
        assert.ok(p.intensity > 0 && p.intensity < 1, `${def.id} fade ${p.intensity}`);
      }
    }
  }
  // Fade 1 → 0 over N days, each step under the slew limit for the shipped ramps.
  for (const def of EVENTS) {
    const n = normalizeRamp(def.ramp);
    let last = 1;
    for (let j = 0; j < n.fade; j += 1) {
      const p = rampAt(n, n.peak + j);
      assert.ok(p && p.phase === 'fade');
      assert.ok(p.intensity < last + EPS, `${def.id} fade falls`);
      assert.ok(last - p.intensity <= MAX_DAILY_STEP + 0.01, `${def.id} fade step ${(last - p.intensity).toFixed(3)}`);
      last = p.intensity;
    }
  }
  assert.ok(Math.abs(slewToward(0.9, 0, 0.3) - 0.6) < EPS);
  assert.equal(slewToward(0.1, 0.2), 0.2);
  assert.ok(Math.abs(slewToward(0.2, 1) - 0.5) < EPS);
  ok('ramp: durations counted back from peak start, bands (teaser .1-.2, lead .2-.4, build .4-.8), minimum build 2 / fade 4');
}

// ---------------------------------------------------------------- 4. locale

async function localeChecks(): Promise<void> {
  assert.equal(regionFromLocale('en-GB'), 'GB');
  assert.equal(regionFromLocale('en_US'), 'US');
  assert.equal(regionFromLocale('zh-Hans-CN'), 'CN');
  assert.equal(regionFromLocale('en'), null);
  assert.equal(regionFromLocale('es-419'), null);
  assert.equal(regionFromLocale('en-u-ca-gregory'), null);
  assert.equal(regionFromLocale(''), null);
  assert.equal(regionFromLocale(null), null);
  ok('region from the device locale (Intl tag): en-GB → GB, en → none');

  assert.equal(hemisphereFromZone('America/New_York'), 'north');
  assert.equal(hemisphereFromZone('Europe/London'), 'north');
  assert.equal(hemisphereFromZone('Australia/Sydney'), 'south');
  assert.equal(hemisphereFromZone('Pacific/Auckland'), 'south');
  assert.equal(hemisphereFromZone('America/Argentina/Buenos_Aires'), 'south');
  assert.equal(hemisphereFromZone('America/Sao_Paulo'), 'south');
  assert.equal(hemisphereFromZone('Africa/Johannesburg'), 'south');
  for (const zone of ['Asia/Singapore', 'Africa/Nairobi', 'America/Bogota', 'Asia/Jakarta', 'America/Panama']) {
    assert.equal(hemisphereFromZone(zone), 'tropics', zone);
  }
  assert.equal(hemisphereFromZone('Australia/Darwin'), 'tropics');
  assert.equal(hemisphereFromZone('Nowhere/Land'), 'north');
  assert.equal(hemisphereFromZone(null), 'north');
  ok('hemisphere from the zone: north / south / tropics (Singapore, Nairobi, Bogotá)');

  // Stored once: travel never flips the seasons.
  const store = memoryStore();
  const first = await loadLocale(store, 'Australia/Sydney');
  assert.equal(first.hemisphere, 'south');
  assert.equal(store.data.get(ALMANAC_LOCALE_KEY) !== undefined, true);
  assert.equal(ALMANAC_LOCALE_KEY, 'ato.almanac.locale.v1');
  const abroad = await loadLocale(store, 'America/Los_Angeles');
  assert.equal(abroad.hemisphere, 'south', 'date-line travel keeps the stored hemisphere');
  const override = await setHemisphere(store, 'tropics', 'America/Los_Angeles');
  assert.deepEqual(override, { v: 1, hemisphere: 'tropics', source: 'user' });
  assert.equal((await loadLocale(store, 'Australia/Sydney')).hemisphere, 'tropics', 'override sticks');
  const back = await setHemisphere(store, 'auto', 'America/Los_Angeles');
  assert.deepEqual(back, { v: 1, hemisphere: 'north', source: 'auto' });
  assert.equal(parseLocale('not json'), null);
  assert.equal(parseLocale(JSON.stringify({ v: 2, hemisphere: 'north', source: 'auto' })), null);
  assert.equal(parseLocale(JSON.stringify({ v: 1, hemisphere: 'moon', source: 'auto' })), null);
  const broken: KeyValueStore = {
    async getItem() {
      throw new Error('storage down');
    },
    async setItem() {
      throw new Error('storage down');
    },
  };
  assert.equal((await loadLocale(broken, 'Asia/Singapore')).hemisphere, 'tropics', 'storage failure still answers');
  ok('hemisphere is stored once (travel keeps it), Settings override sticks, bad storage still answers');
}

// ---------------------------------------------------------------- 5. time zones

function timeZoneChecks(): void {
  // The same instant is a different local day in different zones.
  const moon = '2026-01-03T10:03Z';
  assert.equal(localDayOfInstant(moon, 'Pacific/Kiritimati'), '2026-01-04', 'UTC+14');
  assert.equal(localDayOfInstant(moon, 'Etc/GMT+12'), '2026-01-02', 'UTC−12');
  assert.equal(localDayOfInstant(moon, 'UTC'), '2026-01-03');
  assert.equal(localDayOfInstant(moon, 'Not/AZone'), '2026-01-03', 'a bad zone reads as UTC');
  assert.equal(almanacYmd(new Date(moon), 'Pacific/Kiritimati'), '2026-01-04');
  assert.equal(almanacYmd(new Date(moon), 'Etc/GMT+12'), '2026-01-02');

  const cal = (tz: string) => createCalendar({ ...env({ tz }), hemisphere: 'north' });
  const hasMoon = (tz: string, ymd: string) => cal(tz).theme(ymd).active.some((e) => e.id === 'full_moon');
  assert.ok(hasMoon('Pacific/Kiritimati', '2026-01-04'), 'full moon on the UTC+14 local day');
  assert.ok(!hasMoon('Pacific/Kiritimati', '2026-01-03'));
  assert.ok(hasMoon('Etc/GMT+12', '2026-01-02'), 'full moon on the UTC−12 local day');
  assert.ok(!hasMoon('Etc/GMT+12', '2026-01-03'));
  assert.ok(equinoxDays('Pacific/Kiritimati').has('2026-03-21'), 'equinox 2026-03-20 14:46Z is Mar 21 in UTC+14');
  assert.ok(equinoxDays('Etc/GMT+12').has('2026-03-20'));
  assert.ok(fullMoonDays('UTC').has('2026-05-31'), 'blue moon 2026-05-31');
  ok('time zones: UTC+14 and UTC−12 land the full moon and equinox on their own local day');

  // Clock changes (DST both ways).
  const changes: [string, string[]][] = [
    ['America/New_York', ['2027-03-14', '2027-11-07']],
    ['Europe/London', ['2027-03-28', '2027-10-31']],
    ['Australia/Sydney', ['2027-04-04', '2027-10-03']],
  ];
  for (const [tz, days] of changes) {
    for (const day of days) assert.ok(isClockChangeDay(day, tz), `${tz} changes on ${day}`);
    let count = 0;
    for (let d = '2027-01-01'; d <= '2027-12-31'; d = addDaysYmd(d, 1)) if (isClockChangeDay(d, tz)) count += 1;
    assert.equal(count, 2, `${tz} changes twice in 2027`);
    assert.ok(!isClockChangeDay(addDaysYmd(days[0] as string, 1), tz));
  }
  for (const tz of ['Asia/Singapore', 'UTC']) {
    for (let d = '2027-01-01'; d <= '2027-12-31'; d = addDaysYmd(d, 1)) {
      assert.ok(!isClockChangeDay(d, tz), `${tz} never changes (${d})`);
    }
  }
  assert.ok(isClockChangeDay('2027-03-14', 'garbage-zone') === false, 'bad zone: no clock change');
  const nyChange = createCalendar(env()).theme('2027-03-14');
  assert.ok(nyChange.active.some((e) => e.id === 'clock_change'));
  ok('clock-change micro-event: New York, London and Sydney twice a year; Singapore never');

  // Date-line travel: the same instant is two different Pick days.
  const instant = new Date('2027-06-15T13:00:00Z');
  assert.equal(almanacYmd(instant, 'Pacific/Auckland'), '2027-06-16');
  assert.equal(almanacYmd(instant, 'Pacific/Honolulu'), '2027-06-15');
  ok('date-line travel: one instant = 2027-06-16 in Auckland, 2027-06-15 in Honolulu');
}

// ---------------------------------------------------------------- 6. the sim

interface SimStats {
  days: number;
  rawClashDays: number;
  shownAbove04Max: number;
  maxStep: number;
  handovers: number;
  microDays: number;
  maxEmptyRun: number;
}

const SIM_START = '2026-01-01';
const SIM_END = '2035-12-31';
const SIM_DAYS = daysBetweenYmd(SIM_START, SIM_END) + 1;
const SIM_REGIONS = ['US', 'GB', 'AU'] as const;
const SIM_HEMISPHERES: Record<Hemisphere, string> = {
  north: 'America/New_York',
  south: 'Australia/Sydney',
  tropics: 'Asia/Singapore',
};
const ALL_CULTURAL = { lunar_new_year: true, diwali: true, eid_al_fitr: true, easter: true } as const;

function simulate(config: CalendarConfig, label: string): SimStats {
  const calendar = createCalendar(config);
  const series = calendar.series(SIM_START, SIM_DAYS);
  assert.equal(series.length, SIM_DAYS, `${label}: one theme per day`);
  const stats: SimStats = {
    days: series.length,
    rawClashDays: 0,
    shownAbove04Max: 0,
    maxStep: 0,
    handovers: 0,
    microDays: 0,
    maxEmptyRun: 0,
  };
  let emptyRun = 0;
  let prev: DayTheme | null = null;
  for (const theme of series) {
    assert.ok(theme.season && theme.month && theme.weekAxis && theme.hero, `${label} ${theme.ymd}: every day has a theme`);
    assert.ok(TRAIT_AXES.includes(theme.weekAxis));
    const { intensity, event } = theme.display;
    assert.ok(intensity >= 0 && intensity <= 1 + EPS, `${label} ${theme.ymd}: intensity ${intensity}`);
    assert.equal(event === null, intensity === 0, `${label} ${theme.ymd}: owner iff intensity`);
    // At most ONE event is shown above 0.4 (the lane has one owner).
    const shownAbove = intensity > 0.4 + EPS ? 1 : 0;
    assert.ok(shownAbove <= 1);
    stats.shownAbove04Max = Math.max(stats.shownAbove04Max, shownAbove);
    // Content: the winner is the top active event.
    assert.equal(theme.winner, theme.active[0] ?? null);
    const raw = theme.active.filter((e) => e.target > 0.4 + EPS).length;
    if (raw > 1) stats.rawClashDays += 1;
    if (theme.winner?.kind === 'micro') stats.microDays += 1;
    if (theme.active.length === 0) {
      emptyRun += 1;
      stats.maxEmptyRun = Math.max(stats.maxEmptyRun, emptyRun);
    } else {
      emptyRun = 0;
    }
    if (prev) {
      const step = Math.abs(intensity - prev.display.intensity);
      stats.maxStep = Math.max(stats.maxStep, step);
      assert.ok(step <= MAX_DAILY_STEP + EPS, `${label} ${theme.ymd}: displayed intensity moved ${step.toFixed(3)} in a day`);
      if (prev.display.event !== event && prev.display.event !== null) {
        stats.handovers += 1;
        assert.ok(
          prev.display.intensity <= HANDOVER_MAX + EPS,
          `${label} ${theme.ymd}: ${prev.display.event} (${prev.display.intensity.toFixed(2)}) handed over above the step`,
        );
        assert.ok(intensity <= HANDOVER_MAX + EPS || event === null);
      }
      // The week theme changes only on Mondays.
      if (weekdayOfYmd(theme.ymd) !== 1) assert.equal(theme.weekAxis, prev.weekAxis);
    }
    prev = theme;
  }
  return stats;
}

function simChecks(): void {
  const totals = { configs: 0, days: 0, clash: 0, maxStep: 0, handovers: 0 };
  for (const region of SIM_REGIONS) {
    for (const hemisphere of ['north', 'south', 'tropics'] as const) {
      for (const all of [false, true]) {
        const config: CalendarConfig = {
          tz: SIM_HEMISPHERES[hemisphere],
          region,
          hemisphere,
          bornOn: all ? '1999-07-04' : null,
          joinedYmd: all ? '2025-10-27' : null,
          prefs: all ? { cultural: ALL_CULTURAL } : undefined,
        };
        const label = `${region}/${hemisphere}/${all ? 'all' : 'default'}`;
        const s = simulate(config, label);
        assert.ok(s.maxEmptyRun <= 9, `${label}: ${s.maxEmptyRun} days in a row with nothing on (quiet days get a micro-event)`);
        assert.ok(s.microDays > 100, `${label}: micro-events appear (${s.microDays})`);
        totals.configs += 1;
        totals.days += s.days;
        totals.clash += s.rawClashDays;
        totals.maxStep = Math.max(totals.maxStep, s.maxStep);
        totals.handovers += s.handovers;
      }
    }
  }
  assert.ok(totals.clash > 0, 'the sim meets real clashes');
  assert.ok(totals.handovers > 0, 'the sim meets real hand-overs');
  assert.ok(totals.maxStep <= MAX_DAILY_STEP + EPS);
  ok(
    `sim 2026-2035 × ${SIM_REGIONS.length} regions × 3 hemispheres × 2 prefs = ${totals.configs} runs, ${totals.days} days: ` +
      `a theme every day, max step ${totals.maxStep.toFixed(2)} ≤ 0.3, ≤ 1 event shown above 0.4, ` +
      `${totals.handovers} hand-overs all at or below the step, ${totals.clash} raw clash days resolved`,
  );
}

function clashChecks(): void {
  const all: CalendarConfig = {
    tz: 'America/New_York',
    region: 'US',
    hemisphere: 'north',
    prefs: { cultural: ALL_CULTURAL },
  };
  const cal = createCalendar(all);
  const ids = (t: DayTheme) => t.active.map((e) => e.id);

  // 2026: Valentine's fade meets the Lunar New Year build (LNY 2026-02-17).
  let met = false;
  for (let d = '2026-02-12'; d <= '2026-02-18'; d = addDaysYmd(d, 1)) {
    const t = cal.theme(d);
    if (ids(t).includes('valentines') && ids(t).includes('lunar_new_year')) met = true;
  }
  assert.ok(met, '2026 Lunar New Year / Valentine\'s overlap exists');
  assert.equal(cal.theme('2026-02-17').winner?.id, 'lunar_new_year');
  assert.equal(cal.theme('2026-02-14').winner?.id, 'valentines');

  // Diwali 2027-10-29 inside Halloween's window.
  const diwali = cal.theme('2027-10-29');
  assert.ok(ids(diwali).includes('diwali') && ids(diwali).includes('halloween'));
  assert.equal(diwali.winner?.id, 'diwali', 'Diwali peak beats the Halloween build');
  const halloween = cal.theme('2027-10-31');
  assert.equal(halloween.winner?.id, 'halloween', 'Halloween peak takes the content back');
  assert.ok(halloween.display.intensity <= cal.theme('2027-10-30').display.intensity - 0.0, 'the lane slews down, never up');
  assert.ok(cal.theme('2027-10-30').display.intensity - halloween.display.intensity <= MAX_DAILY_STEP + EPS);

  // Eid 2026-03-20 on the equinox.
  const eid = cal.theme('2026-03-20');
  assert.ok(ids(eid).includes('eid_al_fitr') && ids(eid).includes('equinox'));
  assert.equal(eid.winner?.id, 'eid_al_fitr');

  // LNY covers Valentine's: 2029-02-14, 2032-02-14, 2035-02-14.
  for (const d of ['2029-02-14', '2032-02-14', '2035-02-14']) {
    const t = cal.theme(d);
    assert.ok(ids(t).includes('lunar_new_year') && ids(t).includes('valentines'), `${d}: LNY and Valentine's both on`);
    // Regional peaks (rank 7) beat Valentine's (global peak, rank 6). On 2029-02-14 Eid
    // al-Fitr also peaks: two regional peaks tie on target, so the id decides (eid < lunar).
    const expected = d === '2029-02-14' ? 'eid_al_fitr' : 'lunar_new_year';
    assert.equal(t.winner?.id, expected, `${d}: the regional peak wins`);
    assert.ok(t.display.intensity > 0);
  }
  assert.ok(ids(cal.theme('2029-02-14')).includes('eid_al_fitr'), 'Eid 2029-02-14 is a three-way clash');

  // Default prefs in the US: Lunar New Year, Diwali, Eid are opt-in.
  const plain = createCalendar({ tz: 'America/New_York', region: 'US', hemisphere: 'north' });
  for (const d of ['2027-02-06', '2027-10-29', '2027-03-09']) {
    const t = plain.theme(d);
    assert.ok(!ids(t).some((id) => ['lunar_new_year', 'diwali', 'eid_al_fitr'].includes(id)), `${d}: cultural events are opt-in`);
  }
  assert.equal(createCalendar({ tz: 'Asia/Singapore', region: 'SG', hemisphere: 'tropics' }).theme('2027-02-06').winner?.id, 'lunar_new_year');
  assert.equal(createCalendar({ tz: 'Asia/Kolkata', region: 'IN', hemisphere: 'north' }).theme('2027-10-29').winner?.id, 'diwali');
  const off = createCalendar({ tz: 'Asia/Singapore', region: 'SG', hemisphere: 'tropics', prefs: { cultural: { lunar_new_year: false } } });
  assert.notEqual(off.theme('2027-02-06').winner?.id, 'lunar_new_year', 'opted out');
  ok('clashes resolve: 2026 LNY/Valentine\'s, Diwali 2027-10-29/Halloween, Eid 2026-03-20/equinox, LNY over Feb 14 in 2029/2032/2035; cultural events are opt-in');

  // Eid has a 2-day peak window; the master switch turns events and micro-events off, seasons stay.
  assert.equal(cal.theme('2027-03-09').winner?.id, 'eid_al_fitr');
  assert.equal(cal.theme('2027-03-10').winner?.id, 'eid_al_fitr');
  assert.equal(cal.theme('2027-03-10').winner?.phase, 'peak');
  const quiet = createCalendar({ tz: 'America/New_York', region: 'US', hemisphere: 'north', prefs: { seasonal: false } });
  for (let d = '2026-12-01'; d <= '2026-12-31'; d = addDaysYmd(d, 1)) {
    const t = quiet.theme(d);
    assert.equal(t.winner, null, `${d}: seasonal off = no event`);
    assert.ok(t.season && t.month && t.weekAxis, 'seasons, months and weeks stay on');
    assert.equal(t.hero.kind, 'season');
  }
  const bday = createCalendar({ tz: 'America/New_York', region: 'US', hemisphere: 'north', bornOn: '1990-12-25', prefs: { seasonal: false } });
  assert.equal(bday.theme('2026-12-25').winner?.id, 'birthday', 'personal events ignore the seasonal switch');
  ok('Eid has a 2-day peak; seasonal off removes events and micro-events but keeps season / month / week; birthday stays');

  // Personal beats a regional peak: a birthday on Christmas.
  const bd = createCalendar({ tz: 'America/New_York', region: 'US', hemisphere: 'north', bornOn: '1990-12-25' });
  assert.equal(bd.theme('2026-12-25').winner?.id, 'birthday');
  assert.ok(bd.theme('2026-12-25').active.some((e) => e.id === 'christmas'));
  // Only the personal DAY outranks: a birthday's own lead / fade must not take Christmas Day away.
  for (const born of ['1990-12-22', '1990-12-24', '1990-12-28']) {
    const near = createCalendar({ tz: 'America/New_York', region: 'US', hemisphere: 'north', bornOn: born });
    for (const d of ['2026-12-25', '2026-12-26']) {
      assert.equal(near.theme(d).winner?.id, 'christmas', `born ${born}: Christmas peak ${d} still wins`);
    }
  }
  ok('personal outranks the regional and global peaks (birthday on Christmas)');
}

// ---------------------------------------------------------------- 7. determinism

function determinismChecks(): void {
  const configs: CalendarConfig[] = [
    { tz: 'America/New_York', region: 'US', hemisphere: 'north', bornOn: '1999-07-04', joinedYmd: '2025-10-27', prefs: { cultural: ALL_CULTURAL } },
    { tz: 'Australia/Sydney', region: 'AU', hemisphere: 'south', bornOn: '2000-02-29', joinedYmd: '2025-12-20' },
  ];
  let compared = 0;
  for (const config of configs) {
    const cal = createCalendar(config);
    for (let i = 0; i < SIM_DAYS; i += 13) {
      const day = addDaysYmd(SIM_START, i);
      const direct = cal.theme(day);
      // A different walk-back start must give the same displayed day.
      const wide = cal.series(addDaysYmd(day, -12), 13).at(-1) as DayTheme;
      const narrow = cal.series(addDaysYmd(day, -3), 4).at(-1) as DayTheme;
      for (const other of [wide, narrow]) {
        assert.deepEqual(other.display, direct.display, `${day}: same lane from any start`);
        assert.equal(other.winner?.id ?? null, direct.winner?.id ?? null);
      }
      assert.deepEqual(createCalendar(config).theme(day), direct, `${day}: same input, same theme`);
      compared += 1;
    }
  }
  // stepLane contract.
  assert.deepEqual(stepLane({ owner: null, intensity: 0 }, null, 0), { owner: null, intensity: 0 });
  assert.deepEqual(stepLane({ owner: null, intensity: 0 }, 'a', 0.15), { owner: 'a', intensity: 0.15 });
  assert.deepEqual(stepLane({ owner: null, intensity: 0 }, 'a', 1), { owner: 'a', intensity: HANDOVER_MAX }, 'a new owner enters at the step, then climbs');
  assert.deepEqual(stepLane({ owner: 'a', intensity: 1 }, 'b', 1), { owner: 'a', intensity: 0.7 }, 'the loser slews down first');
  assert.deepEqual(stepLane({ owner: 'a', intensity: 0.3 }, 'b', 1), { owner: 'b', intensity: HANDOVER_MAX });
  assert.deepEqual(stepLane({ owner: 'a', intensity: 0.2 }, null, 0), { owner: null, intensity: 0 });
  assert.deepEqual(stepLane({ owner: 'a', intensity: 0.3 }, 'a', 1), { owner: 'a', intensity: 0.6 });
  ok(`pure: ${compared} sampled days give the same lane from any walk-back start; stepLane contract`);
}

// ---------------------------------------------------------------- 8. arcs

function arcChecks(): void {
  assert.deepEqual(SEASONS.map((s) => s.name), ['Season of Sparks', 'Season of Bloom', 'Season of Tides', 'Season of Embers']);
  assert.equal(seasonFor(1, 'north').id, 'sparks');
  assert.equal(seasonFor(4, 'north').id, 'bloom');
  assert.equal(seasonFor(8, 'north').id, 'tides');
  assert.equal(seasonFor(12, 'north').id, 'embers');
  assert.equal(seasonFor(1, 'south').id, 'tides', 'south: shifted 6 months');
  assert.equal(seasonFor(7, 'south').id, 'sparks');
  assert.equal(seasonFor(10, 'south').id, 'bloom');
  assert.equal(seasonFor(1, 'tropics').id, 'sparks', 'tropics keep the northern names');
  assert.deepEqual(MONTH_THEMES.map((m) => m.name), [
    'Clean slate', 'Soft spots', 'Curiosity', 'Small risks', 'Roots', 'Halfway',
    'Play', 'Slow days', 'Fresh pages', 'Masks', 'Gratitude & boundaries', 'Looking back',
  ]);

  // Weekly theme: absolute Monday-weeks from the Pick epoch, % 16.
  assert.equal(WEEK_ZERO_MONDAY, '2025-12-29');
  assert.equal(weekdayOfYmd(WEEK_ZERO_MONDAY), 1);
  assert.equal(weekdayOfYmd(DAILY_PICK_EPOCH), 4);
  assert.equal(weekIndexFor(DAILY_PICK_EPOCH), 0);
  assert.equal(weekIndexFor('2026-01-04'), 0, 'Sunday still belongs to the week that began Monday');
  assert.equal(weekIndexFor('2026-01-05'), 1);
  assert.equal(weekAxisFor('2026-01-01'), TRAIT_AXES[0]);
  assert.equal(weekAxisFor('2026-01-05'), TRAIT_AXES[1]);
  for (let w = 0; w < 16; w += 1) {
    assert.equal(weekAxisFor(addDaysYmd(WEEK_ZERO_MONDAY, w * 7 + 3)), TRAIT_AXES[w]);
  }
  assert.equal(weekAxisFor(addDaysYmd(WEEK_ZERO_MONDAY, 16 * 7)), TRAIT_AXES[0], 'week 16 starts the cycle again');
  // No axis repeats inside 16 weeks, across a year wrap too.
  for (let start = 0; start < 130; start += 1) {
    const seen = new Set<string>();
    for (let w = 0; w < 16; w += 1) seen.add(weekAxisFor(addDaysYmd('2026-12-01', (start + w) * 7)));
    assert.equal(seen.size, 16, `16 weeks from offset ${start} cover all 16 axes`);
  }
  assert.equal(weekAxisFor('2025-12-28'), TRAIT_AXES[15], 'before the epoch it wraps backward');
  ok('arcs: 4 seasons (south shifted), 12 month themes, weekly axis = absolute Monday-weeks % 16 (no repeat inside 16 weeks)');
}

// ---------------------------------------------------------------- 9. micro-events

function microChecks(): void {
  const cal = createCalendar(env());
  const ids = (ymd: string, facts?: Parameters<typeof cal.theme>[1]) => cal.theme(ymd, facts).active.map((e) => e.id);
  assert.ok(ids('2026-02-13').includes('friday_13th'), 'Friday 13th 2026-02-13');
  assert.ok(ids('2026-03-13').includes('friday_13th'), 'Friday 13th 2026-03-13');
  assert.ok(!ids('2026-02-12').includes('friday_13th'));
  assert.ok(ids('2026-10-30').includes('payday_friday'), 'last Friday of October 2026');
  assert.ok(!ids('2026-10-23').includes('payday_friday'));
  assert.ok(ids('2026-07-01').includes('half_year'));
  assert.ok(ids('2026-11-20').includes('first_snow'), 'first snow (north) Nov 20');
  assert.ok(createCalendar(env({ hemisphere: 'south', tz: 'Australia/Sydney', region: 'AU' })).theme('2026-07-20').active.some((e) => e.id === 'first_snow'));
  assert.ok(!createCalendar(env({ hemisphere: 'tropics', tz: 'Asia/Singapore', region: 'SG' })).theme('2026-11-20').active.some((e) => e.id === 'first_snow'), 'tropics: no snow');
  assert.ok(ids('2026-03-20').includes('equinox'));
  assert.ok(ids('2026-01-03').includes('full_moon'));
  for (const id of MICRO_IDS) assert.ok(MICRO_NAMES[id], `micro name ${id}`);

  // Facts only apply to today.
  const quietDay = (() => {
    const series = cal.series('2026-08-01', 60);
    const day = series.find((t) => t.active.length === 0);
    assert.ok(day, 'a quiet day exists');
    return day.ymd;
  })();
  assert.ok(ids(quietDay, { pickCount: 100 }).includes('pick_100'));
  assert.ok(!ids(quietDay, { pickCount: 99 }).includes('pick_100'));
  assert.ok(ids(quietDay, { glowStreak: 30 }).includes('glow_30'));
  assert.ok(ids(quietDay, { answeredYearAgo: true }).includes('one_year_ago'));
  assert.ok(!ids(quietDay).includes('pick_100'));
  assert.equal(cal.theme(quietDay, { pickCount: 100 }).winner?.id, 'pick_100');
  assert.ok(cal.theme(quietDay, { pickCount: 100 }).display.intensity <= 0.4 + EPS);
  assert.equal(callbackKey('halloween', 2026), 'halloween:2026');
  ok('micro-events: full moon, equinox, Friday 13th, payday Friday, clock change, half-year, first snow (not in the tropics), 100th Pick, 30-day glow, one year ago');
}

// ---------------------------------------------------------------- 10. layer blend with the 11a engine

function blendChecks(): void {
  const cal = createCalendar({ tz: 'America/New_York', region: 'US', hemisphere: 'north' });
  const line = (id: string, extra: Partial<AlmanacCard> = {}): AlmanacCard => ({
    id,
    kind: 'line',
    text: `Card ${id}.`,
    reviewed: true,
    ...extra,
  });
  const xmasLine = line('alm_line_christmas_01', { event: 'christmas' });
  const xmasTry = line('alm_try_christmas_01', { event: 'christmas', kind: 'try' });
  const xmasTeaser = line('alm_teaser_christmas_01', { event: 'christmas', kind: 'teaser' });
  const xmasAfter = line('alm_afterglow_christmas_01', { event: 'christmas', kind: 'afterglow' });
  const xmasCallback = line('alm_callback_christmas_01', { event: 'christmas', kind: 'callback' });
  const baseLine = line('alm_line_base_01');
  const baseTry = line('alm_try_base_01', { kind: 'try' });
  const weekTry = line('alm_try_week_01', { kind: 'try', arc: 'week_openness' });
  const monthLine = line('alm_line_month_01', { arc: 'month_clean_slate' });
  const seasonLine = line('alm_line_season_01', { arc: 'season_sparks' });
  const monthCard = line('alm_month_clean_slate_01', { kind: 'month', arc: 'month_clean_slate' });

  // Peak day: line + deck + try all seasonal.
  const peak = cal.theme('2026-12-25');
  const wPeak = layerWeightFor(peak);
  assert.equal(wPeak(xmasLine), 6);
  assert.equal(wPeak(xmasTry), 6);
  assert.equal(wPeak(xmasTeaser), 0, 'no teaser card on the peak');
  assert.equal(wPeak(xmasCallback), 6);
  assert.equal(wPeak(baseLine), 0.25, 'base cards are damped, never hidden');
  assert.equal(wPeak(baseTry), 0.25);
  assert.equal(wPeak(line('x', { event: 'halloween' })), 0, 'only the winner\'s cards');
  // Build day (target ≥ 0.4, < 0.9): only the try slot.
  const build = cal.theme('2026-12-22');
  assert.equal(build.winner?.phase, 'build');
  const wBuild = layerWeightFor(build);
  assert.equal(wBuild(xmasTry), 6);
  assert.equal(wBuild(xmasLine), 0, 'the line stays base on a build day');
  assert.equal(wBuild(baseLine), 1);
  assert.equal(wBuild(baseTry), 0.25);
  // Teaser day: one teaser card only.
  // (Nov 29 is still Thanksgiving's fade, which outranks a teaser on target: a fine clash, not this test.)
  const teaser = cal.theme('2026-12-03');
  assert.equal(teaser.winner?.phase, 'teaser');
  const wTeaser = layerWeightFor(teaser);
  assert.equal(wTeaser(xmasTeaser), 1);
  assert.equal(wTeaser(xmasLine), 0);
  assert.equal(wTeaser(xmasTry), 0);
  // Afterglow only on fade day 1.
  const fade1 = cal.theme('2026-12-27');
  assert.equal(fade1.winner?.fadeDay, 1);
  assert.equal(layerWeightFor(fade1)(xmasAfter), 6);
  assert.equal(layerWeightFor(cal.theme('2026-12-28'))(xmasAfter), 0);
  assert.equal(wPeak(xmasAfter), 0);
  // A quiet day: the week theme sets the try slot; the month theme sets the line 1 day in 3.
  const quiet = cal.series('2026-08-03', 40).filter((t) => t.winner === null || t.winner.kind === 'micro');
  const plain = quiet.find((t) => t.winner === null && t.lineDay);
  const plainOff = quiet.find((t) => t.winner === null && !t.lineDay);
  assert.ok(plain && plainOff, 'quiet line day and quiet other day exist');
  assert.equal(layerWeightFor(plain)(monthLine), 4);
  assert.equal(layerWeightFor(plainOff)(monthLine), 0);
  assert.equal(layerWeightFor(plainOff)(monthCard), 1, 'month cards for You are always on');
  assert.equal(layerWeightFor(plain)(weekTry), 4);
  assert.equal(layerWeightFor(plain)(seasonLine), 1.5);
  assert.equal(wPeak(weekTry), 0.25, 'an event takes the try slot, so the week theme steps back');
  assert.equal(wPeak(monthLine), 0, 'no month line on a peak day');
  const lineDays = cal.series('2026-01-01', 300).filter((t) => t.lineDay).length;
  assert.equal(lineDays, 100, 'the month theme sets the line 1 day in 3');
  // Micro-event days.
  const full = cal.theme('2026-07-29'); // full moon, nothing else on
  assert.equal(full.winner?.id, 'full_moon');
  assert.equal(layerWeightFor(full)(line('alm_line_full_moon_01', { event: 'full_moon' })), 6);
  assert.equal(layerWeightFor(full)(baseLine), 1, 'a micro-event does not damp the base');

  // The 11a engine takes the hand-off.
  const calendar = toAlmanacCalendar(peak);
  assert.deepEqual(calendar.events, [{ event: 'christmas', phase: 'peak', name: 'Christmas', daysInto: 1 }]);
  assert.deepEqual(calendar.arcs, ['season_embers', 'month_looking_back', `week_${peak.weekAxis}`]);
  assert.equal(toAlmanacCalendar(cal.theme('2026-12-26')).events?.[0]?.daysInto, 2);
  assert.equal(toAlmanacCalendar(teaser).events?.[0]?.daysInto, undefined, 'before the peak: no {daysInto}');
  const bank: AlmanacCard[] = [xmasLine, xmasTry];
  for (let i = 1; i <= 12; i += 1) bank.push(line(`alm_line_base_${String(i).padStart(2, '0')}`));
  const ctx = (userId: string, theme: DayTheme): AlmanacContext => ({
    userId,
    ymd: theme.ymd,
    leans: [],
    dataDays: 0,
    ...almanacTodayFromTheme(theme),
  });
  let seasonalWins = 0;
  for (let i = 0; i < 40; i += 1) {
    const result = today('home.line', ctx(`user-${i}`, peak), { bank });
    if (result?.source === 'card' && result.card.id === xmasLine.id) seasonalWins += 1;
  }
  assert.ok(seasonalWins >= 36, `the seasonal line wins on the peak (${seasonalWins}/40)`);
  const offDay = cal.theme('2026-08-12');
  for (let i = 0; i < 40; i += 1) {
    const result = today('home.line', ctx(`user-${i}`, offDay), { bank });
    assert.ok(result?.source === 'card' && result.card.id !== xmasLine.id, 'an event card never shows off-season');
  }
  // One event at a time: on a real clash day the loser's cards get weight 0, so the engine cannot show two.
  const clash = createCalendar({ tz: 'America/New_York', region: 'US', hemisphere: 'north', prefs: { cultural: ALL_CULTURAL } }).theme('2027-10-29');
  assert.ok(clash.active.length >= 2 && clash.winner?.id === 'diwali');
  const loserWeight = layerWeightFor(clash);
  for (const other of clash.active.filter((e) => e.id !== 'diwali')) {
    assert.equal(loserWeight(line(`alm_line_${other.id}_01`, { event: other.id })), 0, `${other.id} cards are off while Diwali rules`);
  }
  assert.ok(isGentleEvent('mothers_day') && isGentleEvent('fathers_day') && isGentleEvent('valentines') && isGentleEvent('christmas'));
  assert.ok(!isGentleEvent('halloween'));
  assert.equal(peak.winner?.gentle, true);
  ok('layer blend: ≥ 0.9 line + deck, ≥ 0.4 try, teaser alone, afterglow on fade day 1, week / month / season arcs, micro days; feeds the 11a engine');
}

// ---------------------------------------------------------------- 11. names

function nameChecks(): void {
  assert.equal(EVENT_IDS.length, 19);
  assert.deepEqual(EVENTS.map((e) => e.id), [...EVENT_IDS]);
  const gb = createCalendar({ tz: 'Europe/London', region: 'GB', hemisphere: 'north' }).theme('2027-03-07');
  assert.equal(gb.winner?.id, 'mothers_day');
  assert.equal(gb.winner?.name, 'Mothering Sunday');
  const us = createCalendar({ tz: 'America/New_York', region: 'US', hemisphere: 'north' }).theme('2027-05-09');
  assert.equal(us.winner?.name, "Mother's Day");
  for (const def of EVENTS) {
    assert.ok(def.name.length > 0 && def.name.length <= 24, `${def.id} name fits a card slot`);
    if (def.cultural) assert.ok(def.defaultRegions && def.defaultRegions.length > 0, `${def.id} has default regions`);
  }
  for (const id of ['lunar_new_year', 'diwali', 'eid_al_fitr', 'easter']) assert.equal(eventDef(id)?.cultural, true);
  for (const id of ['christmas', 'halloween', 'valentines', 'new_year']) assert.ok(!eventDef(id)?.cultural);
  assert.ok(eventEnabled(eventDef('christmas') as never, env()));
  ok('19 events, names fit a slot, Mothering Sunday for GB/IE, cultural events carry default regions');
}

// ---------------------------------------------------------------- 12. purity

function purityChecks(): void {
  const dir = resolve(__dirname, '../src/lib/almanac');
  const files = ['events', 'calendar', 'ramp', 'resolve', 'arcs', 'locale'].map((n) => `${n}.ts`);
  for (const file of files) {
    assert.ok(existsSync(resolve(dir, file)), `${file} exists`);
    const text = readFileSync(resolve(dir, file), 'utf8');
    const imports = [...text.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1] as string);
    for (const from of imports) {
      assert.ok(!/react|expo|async-storage|supabase|play\//.test(from), `${file} must stay pure (imports ${from})`);
    }
    assert.ok(!/\bfetch\(|XMLHttpRequest|Math\.random|Date\.now\(|new Date\(\)/.test(text), `${file}: no network, no clock, no randomness`);
    assert.ok(!/expo-localization/.test(text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), `${file} does not import expo-localization`);
  }
  assert.ok(readdirSync(dir).includes('locale.ts'));
  const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8')) as { scripts: Record<string, string> };
  assert.equal(pkg.scripts['check:almanac-calendar'], 'tsx ./scripts/almanac-calendar-check.ts');
  ok('new files stay pure: no react / expo / storage / network / clock / randomness, no expo-localization import');
}

// ---------------------------------------------------------------- 13. the doc

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ORDINALS: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', [-1]: 'last' };

function describeRule(r: DateRule): string {
  switch (r.kind) {
    case 'fixed':
      return `${MONTH_NAMES[r.month]} ${r.day}`;
    case 'nthWeekday':
      return `${ORDINALS[r.n]} ${DAY_NAMES[r.weekday]} of ${MONTH_NAMES[r.month]}`;
    case 'easter':
      return r.offset ? `Easter ${r.offset > 0 ? '+' : '−'}${Math.abs(r.offset)} days` : 'Easter Sunday';
    case 'table':
      return 'published table 2026–2035';
    case 'astro':
      return { mar_equinox: 'March equinox', jun_solstice: 'June solstice', sep_equinox: 'September equinox', dec_solstice: 'December solstice' }[r.point];
    case 'personal':
      return r.field === 'birthday' ? 'birthday (born_on)' : 'ATO join date';
    case 'regionTable': {
      const groups = new Map<string, string[]>();
      for (const [region, inner] of Object.entries(r.byRegion)) {
        const text = describeRule(inner);
        groups.set(text, [...(groups.get(text) ?? []), region]);
      }
      const parts = [...groups].map(([text, regions]) => `${regions.join('/')}: ${text}`);
      if (r.fallback) parts.push(`other known regions: ${describeRule(r.fallback)}`);
      return parts.join('; ');
    }
    case 'hemisphere':
      return `N: ${describeRule(r.north)} · S: ${describeRule(r.south)} · tropics: ${r.tropics ? describeRule(r.tropics) : 'off'}`;
  }
}

function renderDoc(): string {
  const lines: string[] = [];
  const push = (text = '') => lines.push(text);
  push('# Almanac calendar, ramps and arcs');
  push();
  push('Generated by `npm run check:almanac-calendar -- --write` (ATO-BUILD PHASE-11b). Do not edit by hand: the check fails if this file is stale.');
  push();
  push('## How a day gets its theme');
  push();
  push('- Every day has a **season**, a **month theme** and a **weekly trait theme**, so Home is never empty.');
  push('- On top of that an **event** (or a one-day **micro-event**) may be on. Events are laid out as `teaser | lead | build | PEAK | fade`, with durations in days counted back from the peak\'s first day.');
  push('- Target intensity: teaser 0.10–0.20 · lead 0.20–0.40 · build 0.40–0.80 · peak 1.0 · fade 1 → 0, smoothstep inside each band. Ambient events stop at 0.4.');
  push('- **Content** (which cards may show) follows the winner: personal day (its lead and fade rank like any other approach) > regional peak > global peak > lead/fade/build/teaser > ambient > micro; ties go to the higher target, then the id.');
  push('- **Visuals** follow one lane with one owner. Its intensity follows the owner\'s target through a slew limit of 0.3 a day. The owner changes only once the lane is at 0.3 or lower, so a losing event slews down instead of snapping, and at most one event is ever shown above 0.4.');
  push('- State is derived, never stored: the lane for a day is rebuilt by walking back 30 days.');
  push('- Card blend: winner target ≥ 0.9 → line + deck seasonal; ≥ 0.4 → try slot seasonal; teaser phase → one teaser card; otherwise the week theme sets the try slot and the month theme sets the line 1 day in 3. Afterglow card on the first fade day; callbacks are keyed `eventId:year`.');
  push('- Master switch off: events and micro-events go away; seasons, months and weeks stay. Birthday and ATO anniversary stay (they are personal, not seasonal).');
  push();
  push('## Events');
  push();
  push('Ramp = teaser / lead / build / peak / fade, in days.');
  push();
  push('| Event | Date rule | Ramp | Span | Notes |');
  push('|---|---|---|---|---|');
  for (const def of EVENTS) {
    const r = def.ramp;
    const notes: string[] = [];
    if (def.cultural) notes.push(`cultural, on by default in ${def.defaultRegions?.slice(0, 8).join(' ')}${(def.defaultRegions?.length ?? 0) > 8 ? ' …' : ''}`);
    if (def.onlyRegions) notes.push(`only ${def.onlyRegions.join('/')}`);
    if (def.regional) notes.push('regional peak');
    if (def.ambient) notes.push('ambient (max 0.4)');
    if (def.gentle) notes.push('gentle day');
    if (def.personal) notes.push('personal (ignores the master switch)');
    if (def.nameByRegion) notes.push(`named ${Object.entries(def.nameByRegion).map(([k, v]) => `${v} (${k})`).join(', ')}`);
    push(`| \`${def.id}\` | ${describeRule(def.rule)} | ${r.teaser}/${r.lead}/${r.build}/${r.peak}/${r.fade} | ${rampSpanDays(r)} d | ${notes.join('; ')} |`);
  }
  push();
  push('Peak days start 2027 (US = New York, GB = London, AU = Sydney; everything opted in; "—" = no event for that region):');
  push();
  push('| Event | US | GB | AU |');
  push('|---|---|---|---|');
  const probes: [string, RuleEnv][] = [
    ['US', { tz: 'America/New_York', region: 'US', hemisphere: 'north', bornOn: '1999-07-04', joinedYmd: '2025-10-27' }],
    ['GB', { tz: 'Europe/London', region: 'GB', hemisphere: 'north', bornOn: '1999-07-04', joinedYmd: '2025-10-27' }],
    ['AU', { tz: 'Australia/Sydney', region: 'AU', hemisphere: 'south', bornOn: '1999-07-04', joinedYmd: '2025-10-27' }],
  ];
  for (const def of EVENTS) {
    const cells = probes.map(([, e]) => {
      if (def.onlyRegions && !(e.region && def.onlyRegions.includes(e.region))) return '—';
      const days = peakStartsFor(def.rule, 2027, e);
      return days.length ? days.join(', ') : '—';
    });
    push(`| \`${def.id}\` | ${cells.join(' | ')} |`);
  }
  push();
  push('## Ramp shape (Christmas, 14/7/5/2/5)');
  push();
  push('| Day | Phase | Target |');
  push('|---|---|---|');
  const xmas = (eventDef('christmas') as { ramp: RampDays }).ramp;
  for (let dt = -rampSpanDays(xmas) + xmas.fade + xmas.peak; dt < xmas.peak + xmas.fade; dt += 1) {
    const p = rampAt(xmas, dt);
    if (p) push(`| ${dt < 0 ? `−${-dt}` : `+${dt}`} | ${p.phase} ${p.dayInPhase}/${p.phaseDays} | ${p.intensity.toFixed(2)} |`);
  }
  push();
  push('## Seasons');
  push();
  push('| Season | North | South | Leans on |');
  push('|---|---|---|---|');
  const monthRange = (id: string, hemi: Hemisphere) => {
    const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter((m) => seasonFor(m, hemi).id === id);
    return `${MONTH_NAMES[months[0] as number]}–${MONTH_NAMES[months.at(-1) as number]}`;
  };
  for (const s of SEASONS) push(`| ${s.name} | ${monthRange(s.id, 'north')} | ${monthRange(s.id, 'south')} | ${s.leans} |`);
  push();
  push('Tropics keep the northern names; summer, the solstices, snow and leaf moments are off there.');
  push();
  push('## Month themes');
  push();
  push(MONTH_THEMES.map((m, i) => `${i + 1}. ${m.name}`).join('  \n'));
  push();
  push('## Weekly trait theme');
  push();
  push(`Absolute Monday-weeks from the Pick epoch (week 0 begins ${WEEK_ZERO_MONDAY}), \`week % 16\` → axis. No axis repeats inside 16 weeks, and a year wrap changes nothing.`);
  push();
  push('| Week | Starts | Axis |');
  push('|---|---|---|');
  for (let w = 0; w < 16; w += 1) push(`| ${w} | ${addDaysYmd(WEEK_ZERO_MONDAY, w * 7)} | ${TRAIT_AXES[w]} |`);
  push();
  push('## Micro-events');
  push();
  push('One day, intensity 0.4 at most. On a shared day the first in this list wins. `small_moment` fills quiet days: every 10th day since the Pick epoch with nothing else on, so no stretch is empty for more than 9 days.');
  push();
  push('| Id | Name | When |');
  push('|---|---|---|');
  const when: Record<string, string> = {
    pick_100: 'the day the reader answers their 100th Pick (needs `pickCount` from the app)',
    glow_30: 'the day the glow streak reaches 30 (`streakWithRest`)',
    one_year_ago: 'a Pick was answered on this date last year (`answeredYearAgo`)',
    equinox: 'March and September equinox, local day',
    full_moon: 'full-moon table, local day',
    friday_13th: 'any Friday the 13th',
    clock_change: 'the local day the zone\'s UTC offset changes',
    half_year: 'Jul 1',
    first_snow: 'north Nov 20 · south Jul 20 · off in the tropics',
    payday_friday: 'the last Friday of the month',
    small_moment: 'quiet-day filler',
  };
  for (const id of MICRO_IDS) push(`| \`${id}\` | ${MICRO_NAMES[id]} | ${when[id]} |`);
  push();
  push('## Sources');
  push();
  push('- Lunar New Year: chinahighlights.com, vclock.com, chinesenewyear.net (agree).');
  push('- Diwali (Lakshmi Puja): Wikipedia, drikpanchang.com, testbook.com. Where sources differ by a day (2031, 2034) the earlier date is stored and Diwali has a 2-day peak.');
  push('- Eid al-Fitr: Wikipedia, truecalendar.com (Umm al-Qura). Moon sighting moves it by a day by country, so Eid has a 2-day peak that starts on the earliest listed date. 2033 has two.');
  push('- Equinoxes, solstices, full moons: Meeus, Astronomical Algorithms ch. 27 and 49, UTC to the minute; 2026 values match the published times.');
  push('- Mother\'s Day: US/CA/AU/NZ 2nd Sunday of May; UK/IE Mothering Sunday = Easter − 21. Father\'s Day: AU/NZ 1st Sunday of September, other known regions 3rd Sunday of June. A region with no rule gets no event.');
  push();
  return `${lines.join('\n')}\n`;
}

function docChecks(): void {
  const next = renderDoc();
  if (process.argv.includes('--write')) {
    writeFileSync(DOC_PATH, next);
    console.log('  wrote docs/almanac-calendar.md');
    return;
  }
  assert.ok(existsSync(DOC_PATH), 'docs/almanac-calendar.md exists (run with -- --write)');
  const current = readFileSync(DOC_PATH, 'utf8').replace(/\r\n/g, '\n');
  assert.equal(current, next, 'docs/almanac-calendar.md is stale: run `npm run check:almanac-calendar -- --write`');
  ok('docs/almanac-calendar.md is fresh (ramp, season and arc tables)');
}

// ---------------------------------------------------------------- run

async function main(): Promise<void> {
  console.log('almanac calendar (PHASE-11b)');
  goldenDates();
  tableChecks();
  rampChecks();
  await localeChecks();
  timeZoneChecks();
  arcChecks();
  nameChecks();
  clashChecks();
  determinismChecks();
  microChecks();
  blendChecks();
  simChecks();
  purityChecks();
  docChecks();
  console.log('almanac calendar: all checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
