/**
 * Edmtrain pull for Around.
 *
 * Auth: `client` query param (EDMTRAIN_CLIENT_KEY). Apply at
 * https://edmtrain.com/developer-api — must be signed in.
 * Base: https://edmtrain.com/api/{events|locations}
 * Cache: ToS requires displayed cache < 24h; this job runs twice daily.
 * Calgary is a real location (edmtrain.com/calgary-ab). Province = Alberta.
 * No images. Event `link` must be passed through unmodified.
 */
const EDMTRAIN_API = 'https://edmtrain.com/api';

export type AroundCity = {
  slug: string;
  label: string;
  edmtrainCity: string;
  edmtrainState: string;
  timeZone: string;
};

export const AROUND_CITIES: AroundCity[] = [
  {
    slug: 'calgary',
    label: 'Calgary',
    edmtrainCity: 'Calgary',
    edmtrainState: 'Alberta',
    timeZone: 'America/Edmonton',
  },
];

export type TicketLink = { kind: string; url: string };
export type AroundShow = {
  id: string;
  name: string;
  date: string;
  ages: string | null;
  venueName: string | null;
  artists: string[];
  links: TicketLink[];
};
export type WeekendJson = {
  city: string;
  weekendStart: string;
  weekendEnd: string;
  fetchedAt: string;
  source: 'edmtrain';
  shows: AroundShow[];
};

export function weekendWindow(timeZone: string, now = new Date()): { start: string; end: string } {
  const local = localYmd(timeZone, now);
  const weekday = localWeekday(timeZone, now);
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

function ticketKindForUrl(url: string): string {
  let host = '';
  try {
    host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return 'other';
  }
  if (host === 'edmtrain.com' || host.endsWith('.edmtrain.com')) return 'edmtrain';
  if (host === 'ra.co' || host.endsWith('.ra.co')) return 'ra';
  if (host === 'shotgun.live' || host.endsWith('.shotgun.live')) return 'shotgun';
  if (host === 'dice.fm' || host.endsWith('.dice.fm')) return 'dice';
  return 'other';
}

function collectTicketLinks(eventLink: string, extraUrls: string[] = []): TicketLink[] {
  const seen = new Set<string>();
  const links: TicketLink[] = [];
  for (const url of [eventLink, ...extraUrls]) {
    const trimmed = url.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    links.push({ kind: ticketKindForUrl(trimmed), url: trimmed });
  }
  return links;
}

type RawEvent = {
  id?: unknown;
  name?: unknown;
  date?: unknown;
  ages?: unknown;
  link?: unknown;
  ticketLink?: unknown;
  liveStreamInd?: unknown;
  artistList?: unknown;
  venue?: unknown;
};

export function mapEdmtrainEvents(
  city: string,
  weekendStart: string,
  weekendEnd: string,
  events: RawEvent[],
  fetchedAt = new Date().toISOString(),
): WeekendJson {
  const shows: AroundShow[] = [];
  for (const event of events) {
    if (event.liveStreamInd === true) continue;
    const date = typeof event.date === 'string' ? event.date.slice(0, 10) : '';
    if (!date || date < weekendStart || date > weekendEnd) continue;
    const link = typeof event.link === 'string' ? event.link.trim() : '';
    if (!link) continue;
    const extra = typeof event.ticketLink === 'string' ? [event.ticketLink] : [];
    const artists = Array.isArray(event.artistList)
      ? event.artistList
          .map((row) =>
            typeof row === 'object' && row && typeof (row as { name?: unknown }).name === 'string'
              ? String((row as { name: string }).name).trim()
              : '',
          )
          .filter(Boolean)
      : [];
    const venueObj = event.venue && typeof event.venue === 'object' ? (event.venue as { name?: unknown }) : null;
    const venueName = typeof venueObj?.name === 'string' ? venueObj.name.trim() : null;
    const nameFromEvent = typeof event.name === 'string' ? event.name.trim() : '';
    const name = nameFromEvent || artists.join(', ') || venueName || 'Show';
    const ages = typeof event.ages === 'string' && event.ages.trim() ? event.ages.trim() : null;
    const id = event.id != null ? `edmtrain:${String(event.id)}` : `edmtrain:${link}`;
    shows.push({
      id,
      name,
      date,
      ages,
      venueName,
      artists,
      links: collectTicketLinks(link, extra),
    });
  }
  shows.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  return { city, weekendStart, weekendEnd, fetchedAt, source: 'edmtrain', shows };
}

type EdmtrainEnvelope = { success?: boolean; message?: string; data?: unknown };

export async function edmtrainGet(path: string, params: Record<string, string>, clientKey: string): Promise<unknown> {
  const url = new URL(`${EDMTRAIN_API}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set('client', clientKey);
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  const text = await response.text();
  let body: EdmtrainEnvelope;
  try {
    body = JSON.parse(text) as EdmtrainEnvelope;
  } catch {
    throw new Error(`edmtrain_http_${response.status}`);
  }
  if (!body.success) throw new Error(body.message || `edmtrain_http_${response.status}`);
  return body.data;
}

export async function locationIdFor(
  city: AroundCity,
  clientKey: string,
): Promise<number> {
  const data = await edmtrainGet(
    'locations',
    { city: city.edmtrainCity, state: city.edmtrainState },
    clientKey,
  );
  const rows = Array.isArray(data) ? data : [];
  const match = rows.find((row) => {
    if (!row || typeof row !== 'object') return false;
    const rec = row as { id?: unknown; city?: unknown; state?: unknown };
    return (
      typeof rec.city === 'string' &&
      rec.city.toLowerCase() === city.edmtrainCity.toLowerCase() &&
      typeof rec.id === 'number'
    );
  });
  const id = match && typeof (match as { id: number }).id === 'number' ? (match as { id: number }).id : null;
  if (id == null) throw new Error(`edmtrain_location_missing:${city.slug}`);
  return id;
}

export async function eventsForLocation(
  locationId: number,
  start: string,
  end: string,
  clientKey: string,
): Promise<RawEvent[]> {
  const data = await edmtrainGet(
    'events',
    {
      locationIds: String(locationId),
      startDate: start,
      endDate: end,
      livestreamInd: 'false',
    },
    clientKey,
  );
  return Array.isArray(data) ? (data as RawEvent[]) : [];
}
