/**
 * Timezone-aware calendar helpers. Kept free of React Native so Node tests
 * can pin a clock without a device locale.
 */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Local calendar date as YYYY-MM-DD in `timeZone`. */
export function localYmd(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** 0 = Sunday … 6 = Saturday, in `timeZone`. */
export function weekdayInZone(date: Date, timeZone: string): number {
  const name = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  }).format(date);
  const index = WEEKDAYS.indexOf(name.slice(0, 3) as (typeof WEEKDAYS)[number]);
  return index === -1 ? date.getUTCDay() : index;
}

/** Shift a YYYY-MM-DD by whole calendar days (timezone-free). */
export function addDaysYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

/** Whole calendar days from `startYmd` to `endYmd` (negative if end is earlier). */
export function daysBetweenYmd(startYmd: string, endYmd: string): number {
  const [sy, sm, sd] = startYmd.split('-').map(Number);
  const [ey, em, ed] = endYmd.split('-').map(Number);
  const start = Date.UTC(sy, sm - 1, sd);
  const end = Date.UTC(ey, em - 1, ed);
  return Math.round((end - start) / 86_400_000);
}
