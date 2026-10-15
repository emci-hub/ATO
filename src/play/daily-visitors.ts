/**
 * Daily visitors (roadmap step 4, plan approved by emci 2026-10-15) — pure rules, no React.
 *
 * Who drops by is worked out on the phone from the LOCAL date alone, so it works offline and two
 * phones on one save agree. Day N shows `VISITOR_ROTATION[N mod 12]`; a week is 7 visitors in a row
 * and the next week carries on where it stopped, so every week's line-up differs and all 12 come
 * round every 12 days. A visitor stays all day and leaves at midnight; a missed day is gone.
 *
 * Greeting = one tap on the visitor, at most once a day. Rewards are the visitor's own (never a hero
 * copy, never currency): greeting 1 → its sticker, 2 → a line, 3 → its rare look (a tint you can't
 * buy), 4+ → just the visit. Nothing here touches tokens, shells or stones.
 */
import {
  VISITOR_ROTATION,
  VISITOR_STAND_INS,
  VISITOR_STICKER_HEROES,
  visitorTintId,
} from '@/play/daily-visitors-roster';

/** A Monday: day 0 of the rotation (any fixed local day works; this one keeps week 1 tidy). */
export const VISITOR_DAY0 = '2026-10-12';
/** The greeting that gives the rare look. */
export const VISITOR_LOOK_AT = 3;
/** Where the visitor stands in the Hideout room (art px, feet). Right of the cushion, on the walk
 * floor (`check:daily-visitors`); clamped clear of the rails at runtime. */
export const VISITOR_SPOT: readonly [number, number] = [236, 430];
/** While a visitor stands in the room the pet's feet stay this far (art px) to its left — two bodies, no overlap. */
export const VISITOR_CLEAR_PX = 48;
/** …but only if that still leaves the pet at least this much floor (art px); else the pet roams as usual. */
export const VISITOR_MIN_PET_STRIP_PX = 64;

export type VisitorBook = {
  /** Greetings per visitor hero (stickers = every hero with ≥ 1). */
  greets: Record<string, number>;
  /** The local day of the last greeting (one greeting a day). */
  greeted_ymd: string | null;
};

export const EMPTY_VISITOR_BOOK: VisitorBook = { greets: {}, greeted_ymd: null };

export type TodayVisitor = {
  heroId: string;
  /** True when a stand-in came because the day's visitor is your pet's own hero. */
  standIn: boolean;
  ymd: string;
};

export type VisitorReward =
  | { kind: 'sticker'; heroId: string }
  | { kind: 'line'; heroId: string }
  | { kind: 'look'; heroId: string; cosmeticId: string }
  | { kind: 'visit'; heroId: string };

/** Days since 1970-01-01 for a local `YYYY-MM-DD` (calendar arithmetic, no time zone). */
export function ymdDayNumber(ymd: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return 0;
  return Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000);
}

const mod = (n: number, k: number) => ((n % k) + k) % k;

/** Today's visitor. `petHeroId` = your pet's hero (null for an egg or a non-hero look). */
export function visitorFor(ymd: string, petHeroId: string | null): TodayVisitor {
  const day = ymdDayNumber(ymd) - ymdDayNumber(VISITOR_DAY0);
  const heroId = VISITOR_ROTATION[mod(day, VISITOR_ROTATION.length)]!;
  if (heroId !== petHeroId) return { heroId, standIn: false, ymd };
  const first = VISITOR_STAND_INS[mod(day, VISITOR_STAND_INS.length)]!;
  const pick = first !== petHeroId ? first : VISITOR_STAND_INS[mod(day + 1, VISITOR_STAND_INS.length)]!;
  return { heroId: pick, standIn: true, ymd };
}

/** The 7 visitors of the Monday-to-Sunday week holding `ymd` (before any stand-in swap). */
export function weekLineup(ymd: string): string[] {
  const day = ymdDayNumber(ymd);
  // 1970-01-01 was a Thursday: Monday-based weekday = (day + 3) mod 7.
  const monday = day - mod(day + 3, 7);
  const start = monday - ymdDayNumber(VISITOR_DAY0);
  return Array.from({ length: 7 }, (_, i) => VISITOR_ROTATION[mod(start + i, VISITOR_ROTATION.length)]!);
}

export function greetedToday(book: VisitorBook, ymd: string): boolean {
  return book.greeted_ymd === ymd;
}

export function hasSticker(book: VisitorBook, heroId: string): boolean {
  return (book.greets[heroId] ?? 0) >= 1;
}

export function stickerCount(book: VisitorBook): number {
  return VISITOR_STICKER_HEROES.filter((id) => hasSticker(book, id)).length;
}

/** What greeting number `n` (1-based) of a visitor gives. */
export function rewardFor(heroId: string, n: number, ownedCosmetics: readonly string[]): VisitorReward {
  if (n <= 1) return { kind: 'sticker', heroId };
  if (n < VISITOR_LOOK_AT) return { kind: 'line', heroId };
  const cosmeticId = visitorTintId(heroId);
  if (n === VISITOR_LOOK_AT && !ownedCosmetics.includes(cosmeticId)) return { kind: 'look', heroId, cosmeticId };
  return { kind: 'visit', heroId };
}

/** One greeting of today's visitor, or null when you already said hi today. */
export function greetVisitor(
  book: VisitorBook,
  visitor: TodayVisitor,
  ownedCosmetics: readonly string[],
): { book: VisitorBook; reward: VisitorReward } | null {
  if (greetedToday(book, visitor.ymd)) return null;
  const n = (book.greets[visitor.heroId] ?? 0) + 1;
  return {
    book: { greets: { ...book.greets, [visitor.heroId]: n }, greeted_ymd: visitor.ymd },
    reward: rewardFor(visitor.heroId, n, ownedCosmetics),
  };
}

/** Tolerant read of a saved book: unknown heroes and bad counts are dropped, never a crash. */
export function parseVisitorBook(raw: unknown): VisitorBook {
  if (typeof raw !== 'object' || raw == null) return { greets: {}, greeted_ymd: null };
  const r = raw as Record<string, unknown>;
  const greets: Record<string, number> = {};
  const bag = typeof r.greets === 'object' && r.greets != null ? (r.greets as Record<string, unknown>) : {};
  for (const id of VISITOR_STICKER_HEROES) {
    const v = bag[id];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 1) greets[id] = Math.min(9999, Math.floor(v));
  }
  const ymd = typeof r.greeted_ymd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.greeted_ymd) ? r.greeted_ymd : null;
  return { greets, greeted_ymd: ymd };
}
