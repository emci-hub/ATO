import { collectTicketLinks } from '@/lib/around/tickets';
import type { AroundShow, WeekendJson } from '@/lib/around/types';

/** Raw Event Search API row. Images are not provided. */
export type EdmtrainEvent = {
  id?: unknown;
  name?: unknown;
  date?: unknown;
  ages?: unknown;
  link?: unknown;
  ticketLink?: unknown;
  festivalInd?: unknown;
  liveStreamInd?: unknown;
  artistList?: unknown;
  venue?: unknown;
};

type EdmtrainArtist = { name?: unknown };
type EdmtrainVenue = { name?: unknown; location?: unknown; address?: unknown };

export function mapEdmtrainEvents(
  city: string,
  weekendStart: string,
  weekendEnd: string,
  events: EdmtrainEvent[],
  fetchedAt = new Date().toISOString(),
): WeekendJson {
  const shows: AroundShow[] = [];
  for (const event of events) {
    const show = mapOne(event, weekendStart, weekendEnd);
    if (show) shows.push(show);
  }
  shows.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  return {
    city,
    weekendStart,
    weekendEnd,
    fetchedAt,
    source: 'edmtrain',
    shows,
  };
}

function mapOne(event: EdmtrainEvent, start: string, end: string): AroundShow | null {
  if (event.liveStreamInd === true) return null;
  const date = typeof event.date === 'string' ? event.date.slice(0, 10) : '';
  if (!date || date < start || date > end) return null;
  const link = typeof event.link === 'string' ? event.link.trim() : '';
  if (!link) return null;

  const extra: string[] = [];
  if (typeof event.ticketLink === 'string') extra.push(event.ticketLink);

  const artists = Array.isArray(event.artistList)
    ? event.artistList
        .map((row) => (isArtist(row) && typeof row.name === 'string' ? row.name.trim() : ''))
        .filter(Boolean)
    : [];

  const venue = isVenue(event.venue) && typeof event.venue.name === 'string' ? event.venue.name.trim() : null;
  const nameFromEvent = typeof event.name === 'string' ? event.name.trim() : '';
  const name = nameFromEvent || artists.join(', ') || venue || 'Show';
  const ages = typeof event.ages === 'string' && event.ages.trim() ? event.ages.trim() : null;
  const id = event.id != null ? `edmtrain:${String(event.id)}` : `edmtrain:${link}`;

  return {
    id,
    name,
    date,
    ages,
    venueName: venue,
    artists,
    links: collectTicketLinks(link, extra),
  };
}

function isArtist(value: unknown): value is EdmtrainArtist {
  return typeof value === 'object' && value !== null;
}

function isVenue(value: unknown): value is EdmtrainVenue {
  return typeof value === 'object' && value !== null;
}
