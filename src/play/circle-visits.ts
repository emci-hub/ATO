/**
 * Circle visits (hideout roadmap step 6, plan approved by emci 2026-10-15) — pure rules, no React, no I/O.
 *
 * A Circle friend's pet can visit your Hideout and leave a gift; you can visit theirs. Opt-in per
 * friend, OFF by default, and it needs BOTH switches on (the server decides: wave97
 * `circle_visit_allowed`). What crosses between two accounts is ONLY the pet's look (line, hero,
 * stage, shiny) and the 3 decor slots, cut out of the friend's save on the server
 * (`_circle_visit_look`) and checked again here. Never traits, never the pet's name, never anything
 * typed. The handle shown is the one your own Circle already shows you.
 *
 * Gift = the visiting pet's hero sticker in your sticker book ("From a Circle friend"), or a Circle
 * stamp when that hero has no sticker. One per friend per day (server unique index). Nothing here
 * touches tokens, shells, stones or pet tokens (`check:circle-visits` compares the whole doc).
 */
import { DECOR_ITEM_IDS, DECOR_SLOT_IDS, type DecorState } from '@/play/decor-slots';
import { VISITOR_STICKER_HEROES } from '@/play/daily-visitors-roster';
import { heroById } from '@/play/heroes-data';
import { petLookFor, type PetStage } from '@/play/pet';

/** Copy ships unreviewed until emci reads `docs/divecore/circle-visits/review.md`. */
export const CIRCLE_VISITS_COPY_REVIEWED = true;

/** Opened gift ids kept on the phone (so a gift whose "opened" call failed is never counted twice). */
export const CIRCLE_OPENED_CAP = 60;
/** At most this many friends in the list (the server's Circle is small; the box scrolls). */
export const CIRCLE_FRIENDS_CAP = 200;

export type CircleFriend = {
  peer: string;
  handle: string;
  /** My switch for this friend. */
  mine: boolean;
  /** Both switches on (and not blocked): a visit / gift may happen. */
  allowed: boolean;
  /** I already left this friend a gift today (their server-side day rule). */
  giftedToday: boolean;
};

/** The only part of a friend's save the phone ever gets. */
export type CircleLook = { heroId: string; stage: PetStage | null; shiny: boolean; decor: DecorState };

export type CircleGift = { id: string; handle: string; look: CircleLook };

export type CircleBook = {
  /** Gifts per hero (stickers count once ≥ 1). */
  gifts: Record<string, number>;
  /** Every gift ever opened (stickers + stamps). */
  stamps: number;
  /** Recently opened gift ids (newest last, capped). */
  opened: string[];
};

export const EMPTY_CIRCLE_BOOK: CircleBook = { gifts: {}, stamps: 0, opened: [] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HERO_ID = /^[a-z0-9-]{1,48}$/;
const LINE_ID = /^[a-z0-9_-]{1,48}$/;
const STAGES: readonly PetStage[] = ['egg', 'baby', 'child', 'teen', 'adult', 'god'];

const obj = (v: unknown): Record<string, unknown> | null => (typeof v === 'object' && v != null && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

/** A handle as the Circle shows it (no "@", letters / digits / _ . only, ≤ 30). Anything else = null. */
export function cleanHandle(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const h = v.trim().replace(/^@/, '');
  return /^[A-Za-z0-9_.]{1,30}$/.test(h) ? h : null;
}

/** The hero a friend's pet shows as: its locked hero, else its line's grown hero. Unknown = null. */
export function lookHeroId(hero: unknown, line: unknown): string | null {
  if (typeof hero === 'string' && HERO_ID.test(hero) && heroById(hero)) return hero;
  if (typeof line === 'string' && LINE_ID.test(line)) {
    const look = petLookFor(line, 'adult');
    if (look?.kind === 'hero' && heroById(look.heroId)) return look.heroId;
  }
  return null;
}

/** Only known slots holding known items (the server already filters; the phone checks again). */
export function cleanDecor(raw: unknown): DecorState {
  const r = obj(raw);
  const out: DecorState = {};
  if (!r) return out;
  for (const slot of DECOR_SLOT_IDS) {
    const v = r[slot];
    if (typeof v === 'string' && (DECOR_ITEM_IDS as readonly string[]).includes(v)) out[slot] = v as DecorState[typeof slot];
  }
  return out;
}

/** `{ pet: { line, hero, stage, shiny }, decor }` → a look, or null. Every other field is dropped. */
export function parseCircleLook(raw: unknown): CircleLook | null {
  const r = obj(raw);
  const pet = obj(r?.pet);
  if (!r || !pet) return null;
  const heroId = lookHeroId(pet.hero, pet.line);
  if (!heroId) return null;
  const stage = STAGES.includes(pet.stage as PetStage) ? (pet.stage as PetStage) : null;
  return { heroId, stage, shiny: pet.shiny === true, decor: cleanDecor(r.decor) };
}

export function parseCircleFriends(raw: unknown): CircleFriend[] {
  if (!Array.isArray(raw)) return [];
  const out: CircleFriend[] = [];
  for (const row of raw.slice(0, CIRCLE_FRIENDS_CAP)) {
    const r = obj(row);
    const handle = cleanHandle(r?.handle);
    if (!r || typeof r.peer !== 'string' || !UUID.test(r.peer) || !handle) continue;
    out.push({ peer: r.peer, handle, mine: r.mine === true, allowed: r.allowed === true, giftedToday: r.gifted_today === true });
  }
  return out;
}

export function parseCircleInbox(raw: unknown): CircleGift[] {
  if (!Array.isArray(raw)) return [];
  const out: CircleGift[] = [];
  for (const row of raw.slice(0, 20)) {
    const r = obj(row);
    const handle = cleanHandle(r?.handle);
    const look = parseCircleLook(r?.look);
    if (!r || typeof r.id !== 'string' || !UUID.test(r.id) || !handle || !look) continue;
    out.push({ id: r.id, handle, look });
  }
  return out;
}

/** The next gift to show: the oldest one this phone has not opened yet. */
export function nextCircleGift(inbox: readonly CircleGift[], book: CircleBook): CircleGift | null {
  return inbox.find((g) => !book.opened.includes(g.id)) ?? null;
}

/** Whether a hero has a sticker to give (the 14 room-ready visitors); otherwise the gift is a stamp. */
export function circleGiftIsSticker(heroId: string): boolean {
  return VISITOR_STICKER_HEROES.includes(heroId);
}

/** Open one gift. Null = already opened on this phone (never counted twice). */
export function openCircleGiftBook(book: CircleBook, gift: CircleGift): CircleBook | null {
  if (book.opened.includes(gift.id)) return null;
  const hero = gift.look.heroId;
  const gifts = circleGiftIsSticker(hero) ? { ...book.gifts, [hero]: (book.gifts[hero] ?? 0) + 1 } : book.gifts;
  const opened = [...book.opened, gift.id];
  return {
    gifts,
    stamps: book.stamps + 1,
    opened: opened.length > CIRCLE_OPENED_CAP ? opened.slice(opened.length - CIRCLE_OPENED_CAP) : opened,
  };
}

/** Tolerant read of the saved book: unknown heroes, bad counts and bad ids are dropped, never a crash. */
export function parseCircleBook(raw: unknown): CircleBook {
  const r = obj(raw);
  if (!r) return { gifts: {}, stamps: 0, opened: [] };
  const bag = obj(r.gifts) ?? {};
  const gifts: Record<string, number> = {};
  for (const id of VISITOR_STICKER_HEROES) {
    const v = bag[id];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 1) gifts[id] = Math.min(9999, Math.floor(v));
  }
  const stamps = typeof r.stamps === 'number' && Number.isFinite(r.stamps) && r.stamps > 0 ? Math.min(99999, Math.floor(r.stamps)) : 0;
  const opened = Array.isArray(r.opened) ? r.opened.filter((v): v is string => typeof v === 'string' && UUID.test(v)).slice(-CIRCLE_OPENED_CAP) : [];
  return { gifts, stamps, opened };
}

/** A friend row's status line. */
export function friendStatus(f: CircleFriend): 'sharing' | 'waiting' | 'off' {
  if (f.allowed) return 'sharing';
  return f.mine ? 'waiting' : 'off';
}

/* ---------------------------------------------------- safety (wave104) --- */

/** Where a person writes about someone in their Circle (Apple 1.2). One string, used everywhere. */
export const CIRCLE_SUPPORT_EMAIL = 'support@asstrollogs.com';

/** A pending request, either direction: `id` answers it, `peer` is who, `handle` is what we show. */
export type CircleRequest = { id: string; peer: string; handle: string };
export type CircleRequests = { incoming: CircleRequest[]; outgoing: CircleRequest[] };
export type CircleBlocked = { peer: string; handle: string };

export const CIRCLE_REPORT_REASON_IDS = ['harassment', 'hate', 'sexual', 'spam', 'impersonation', 'other'] as const;
export type CircleReportReason = (typeof CIRCLE_REPORT_REASON_IDS)[number];

export type CircleRequestNo = 'not_found' | 'self' | 'already' | 'pending' | 'cap' | 'rate_limited' | 'name';
export const CIRCLE_REQUEST_NO: readonly CircleRequestNo[] = ['not_found', 'self', 'already', 'pending', 'cap', 'rate_limited', 'name'];
export type CircleReportNo = 'rate_limited' | 'bad_reason' | 'not_found';
export const CIRCLE_REPORT_NO: readonly CircleReportNo[] = ['rate_limited', 'bad_reason', 'not_found'];
export type CircleRespondNo = 'not_found' | 'cap';

const parseRequestList = (raw: unknown): CircleRequest[] => {
  if (!Array.isArray(raw)) return [];
  const out: CircleRequest[] = [];
  for (const row of raw.slice(0, CIRCLE_FRIENDS_CAP)) {
    const r = obj(row);
    const handle = cleanHandle(r?.handle);
    if (!r || typeof r.id !== 'string' || !UUID.test(r.id) || typeof r.peer !== 'string' || !UUID.test(r.peer) || !handle) continue;
    out.push({ id: r.id, peer: r.peer, handle });
  }
  return out;
};

export function parseCircleRequests(raw: unknown): CircleRequests | null {
  const r = obj(raw);
  if (!r) return null;
  return { incoming: parseRequestList(r.incoming), outgoing: parseRequestList(r.outgoing) };
}

export function parseCircleBlocked(raw: unknown): CircleBlocked[] {
  if (!Array.isArray(raw)) return [];
  const out: CircleBlocked[] = [];
  for (const row of raw.slice(0, CIRCLE_FRIENDS_CAP)) {
    const r = obj(row);
    const handle = cleanHandle(r?.handle);
    if (!r || typeof r.peer !== 'string' || !UUID.test(r.peer) || !handle) continue;
    out.push({ peer: r.peer, handle });
  }
  return out;
}

/* ------------------------------------------------------------------ copy --- */

export const CIRCLE_UI = {
  railLabel: 'Circle',
  sheetTitle: 'Circle visits',
  sheetNote: 'Pets visit when you both switch sharing on. Only your pet and room go.',
  sheetTools: 'Add friends, Message, Report and Block are in the Circle tab.',
  status: {
    sharing: 'Sharing',
    waiting: 'Waiting on them',
    off: 'Not sharing',
  },
  visit: 'Visit',
  share: (handle: string, on: boolean) => `Share your Hideout with @${handle}, ${on ? 'on' : 'off'}`,
  loading: 'Checking your Circle…',
  empty: 'No one in your Circle yet. Scan a friend in from the Circle tab.',
  signedOut: 'Sign in to visit your Circle.',
  off: 'Circle visits aren’t switched on yet.',
  error: 'Can’t reach your Circle right now.',
  done: 'Done',
  visiting: (handle: string) => `@${handle}’s Hideout`,
  visitingNote: 'Look around. Their pet stays put.',
  gift: 'Leave a gift',
  giftSent: 'Gift left',
  giftNotAllowed: 'They switched sharing off.',
  home: 'Back home',
  noSave: 'Their Hideout hasn’t synced yet.',
  notAllowed: 'Sharing is off on one side.',
  giftTitle: (handle: string) => `From @${handle}`,
  giftLine: 'Their pet left this by the door and didn’t even text first.',
  giftSticker: (name: string) => `New sticker · ${name}`,
  giftStamp: 'Circle stamp',
  giftHint: 'It’s in your sticker book: Info → Style.',
  keep: 'Keep it',
  bookNote: (stamps: number) => (stamps > 0 ? `Circle gifts: ${stamps}.` : ''),
  stickerSource: 'From a Circle friend',
  /* Circle safety (wave104). */
  more: (handle: string) => `More options for @${handle}`,
  moreGlyph: '⋯',
  menuTitle: (handle: string) => `@${handle}`,
  message: 'Message',
  report: 'Report',
  block: 'Block',
  blockArmed: (handle: string) => `Tap again to block @${handle}`,
  blockQuiet: 'They won’t be told.',
  blocked: 'Blocked. They won’t be told.',
  remove: 'Remove from Circle',
  removeArmed: (handle: string) => `Tap again to remove @${handle}`,
  removed: 'Removed from your Circle.',
  close: 'Close',
  back: 'Back',
  reportTitle: 'What happened?',
  reportReasons: {
    harassment: 'Harassing me',
    hate: 'Hate or slurs',
    sexual: 'Sexual stuff I didn’t want',
    spam: 'Spam or scam',
    impersonation: 'Pretending to be someone',
    other: 'Something else',
  },
  reported: 'Thanks. We read every report.',
  blockThemToo: 'Block them too',
  reportNo: {
    rate_limited: 'That’s a lot of reports today. Try again later.',
    bad_reason: 'Pick one of the reasons.',
    not_found: 'Can’t find them any more.',
  },
  addPlaceholder: 'Add by handle',
  addLabel: 'Handle to add to your Circle',
  send: 'Send',
  addBadHandle: 'Handles use letters, numbers, _ and .',
  addSent: 'Request sent.',
  addAccepted: 'Added to your Circle.',
  addNo: {
    not_found: 'No one with that handle.',
    self: 'That’s your own handle.',
    already: 'Already in your Circle.',
    pending: 'A request is already waiting.',
    cap: 'Circle is full.',
    rate_limited: 'Too many tries. Try again later.',
    name: 'Can’t send that one.',
  },
  requests: 'Requests',
  incomingStatus: 'Wants to join your Circle',
  outgoingStatus: 'Request sent',
  accept: 'Accept',
  decline: 'Decline',
  cancel: 'Cancel',
  accepted: 'Added to your Circle.',
  declined: 'Declined.',
  canceled: 'Request canceled.',
  respondNo: { not_found: 'That request is gone.', cap: 'Circle is full.' },
  blockedRow: (n: number) => `Blocked (${n})`,
  blockedTitle: 'Blocked',
  unblock: 'Unblock',
  unblockArmed: 'Tap again',
  unblocked: (handle: string) => `@${handle} unblocked.`,
  supportLead: 'Problem with someone?',
  supportLabel: `Email ${CIRCLE_SUPPORT_EMAIL}`,
} as const;
