import type { TicketKind, TicketLink } from '@/lib/around/types';

const HOSTS: { kind: Exclude<TicketKind, 'other' | 'edmtrain'>; host: string }[] = [
  { kind: 'ra', host: 'ra.co' },
  { kind: 'shotgun', host: 'shotgun.live' },
  { kind: 'dice', host: 'dice.fm' },
];

export function ticketKindForUrl(url: string): TicketKind {
  let host = '';
  try {
    host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return 'other';
  }
  if (host === 'edmtrain.com' || host.endsWith('.edmtrain.com')) return 'edmtrain';
  for (const row of HOSTS) {
    if (host === row.host || host.endsWith(`.${row.host}`)) return row.kind;
  }
  return 'other';
}

export function ticketLabel(kind: TicketKind): string {
  switch (kind) {
    case 'edmtrain':
      return 'Edmtrain';
    case 'ra':
      return 'Resident Advisor';
    case 'shotgun':
      return 'Shotgun';
    case 'dice':
      return 'DICE';
    default:
      return 'Tickets';
  }
}

/** Edmtrain event link first (ToS), then RA / Shotgun / DICE if those URLs appeared. */
export function collectTicketLinks(eventLink: string, extraUrls: string[] = []): TicketLink[] {
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
