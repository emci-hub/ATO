/** Upcoming (or current) Fri–Sun as YYYY-MM-DD in the city's timezone. */
export function weekendWindow(timeZone: string, now = new Date()): { start: string; end: string } {
  const local = localYmd(timeZone, now);
  const weekday = localWeekday(timeZone, now); // 0 Sun … 6 Sat
  let start: string;
  if (weekday === 0) start = addDays(local, -2);
  else if (weekday === 5) start = local;
  else if (weekday === 6) start = addDays(local, -1);
  else start = addDays(local, 5 - weekday);
  return { start, end: addDays(start, 2) };
}

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map((part) => Number(part));
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return utc.toISOString().slice(0, 10);
}

function localYmd(timeZone: string, now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  if (!year || !month || !day) throw new Error('weekend_tz');
  return `${year}-${month}-${day}`;
}

function localWeekday(timeZone: string, now: Date): number {
  const label = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(now);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const day = map[label];
  if (day == null) throw new Error('weekend_weekday');
  return day;
}
