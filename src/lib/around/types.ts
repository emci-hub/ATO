export type TicketKind = 'edmtrain' | 'ra' | 'shotgun' | 'dice' | 'other';

export type TicketLink = {
  kind: TicketKind;
  url: string;
};

export type AroundShow = {
  id: string;
  name: string;
  date: string;
  ages: string | null;
  venueName: string | null;
  artists: string[];
  /** Unmodified Edmtrain event link is always first. Ticket platforms if present. */
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

export type AroundLoad =
  | { status: 'ok'; payload: WeekendJson }
  | { status: 'empty'; city: string }
  | { status: 'error'; message: string };
