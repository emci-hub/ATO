/**
 * Divecore settings, journal and milestones (v24, 2026-09-30) — pure rules.
 *
 *   - Settings live in the Play save (they follow the player's progress);
 *     Effects and the reduce-motion override are device-only (per phone).
 *   - Quiet hours: a notification that would land inside the window waits
 *     until it ends (never dropped). Bedtime drives the sleep LOOK and the
 *     Sleepy status only — hunger, mood, care and odds never read it.
 *   - Chatter sets how often the pet talks while idle; tapping it and the
 *     coach tips always work.
 *   - Journal counters start when this ships (older numbers aren't stored),
 *     except TD waves and rebirths, which were always kept.
 *   - Milestone rewards are looks / egg-grade only: trade-up tickets, existing
 *     Wardrobe cosmetics, a hero's dye unlocked early, a card ribbon. Never
 *     tokens or shells (those buy TD Powers).
 */
import { petDayHolds } from '@/play/pet';
import type { Grade } from './pet-eggs';

/* ------------------------------------------------------------ settings --- */

export type NotifKind = 'hunger' | 'egg' | 'expedition' | 'charges';
export const NOTIF_KINDS: readonly NotifKind[] = ['hunger', 'egg', 'expedition', 'charges'];
export const NOTIF_LABEL: Record<NotifKind, string> = {
  hunger: 'Pet getting hungry',
  egg: 'Egg hatched / hero revealed',
  expedition: 'Back from an expedition',
  charges: 'Dive charges full',
};

export const CHATTER_LEVELS = ['chatty', 'normal', 'quiet', 'off'] as const;
export type ChatterLevel = (typeof CHATTER_LEVELS)[number];
export const CHATTER_LABEL: Record<ChatterLevel, string> = {
  chatty: 'Chatty',
  normal: 'Normal',
  quiet: 'Quiet',
  off: 'Off',
};

/** A daily window in minutes since local midnight; `from > to` crosses midnight. */
export type DayWindow = { from: number; to: number };

export type PlaySettings = {
  notif: Record<NotifKind, boolean>;
  quiet: DayWindow;
  bedtime: DayWindow;
  chatter: ChatterLevel;
  skipReveals: boolean;
  /** Seen (or skipped) the first-time tutorial. */
  tutorialSeen: boolean;
};

export const DEFAULT_WINDOW: DayWindow = { from: 22 * 60, to: 7 * 60 };

/** New saves: hunger, egg and expedition on; charges full off (emci). */
export function defaultSettings(): PlaySettings {
  return {
    notif: { hunger: true, egg: true, expedition: true, charges: false },
    quiet: { ...DEFAULT_WINDOW },
    bedtime: { ...DEFAULT_WINDOW },
    chatter: 'normal',
    skipReveals: false,
    tutorialSeen: false,
  };
}

function minuteOf(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(24 * 60 - 1, Math.floor(v))) : fallback;
}

function parseWindow(raw: unknown, fallback: DayWindow): DayWindow {
  if (typeof raw !== 'object' || raw == null) return { ...fallback };
  const r = raw as Record<string, unknown>;
  return { from: minuteOf(r.from, fallback.from), to: minuteOf(r.to, fallback.to) };
}

/**
 * Settings from a save. A save from before settings (v23 and older): the
 * hunger reminder keeps what the player had chosen (`pet_remind`), egg and
 * expedition notices on, charges full off; the tutorial counts as seen when
 * the save already has progress (a revealed pet or a Hall).
 */
export function parseSettings(raw: unknown, legacy: { remind: boolean; hasProgress: boolean } | null): PlaySettings {
  const base = defaultSettings();
  if (legacy) {
    return { ...base, notif: { ...base.notif, hunger: legacy.remind }, tutorialSeen: legacy.hasProgress };
  }
  if (typeof raw !== 'object' || raw == null) return base;
  const r = raw as Record<string, unknown>;
  const n = (typeof r.notif === 'object' && r.notif != null ? r.notif : {}) as Record<string, unknown>;
  const flag = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
  return {
    notif: {
      hunger: flag(n.hunger, base.notif.hunger),
      egg: flag(n.egg, base.notif.egg),
      expedition: flag(n.expedition, base.notif.expedition),
      charges: flag(n.charges, base.notif.charges),
    },
    quiet: parseWindow(r.quiet, DEFAULT_WINDOW),
    bedtime: parseWindow(r.bedtime, DEFAULT_WINDOW),
    chatter: (CHATTER_LEVELS as readonly string[]).includes(r.chatter as string) ? (r.chatter as ChatterLevel) : base.chatter,
    skipReveals: flag(r.skipReveals, false),
    tutorialSeen: flag(r.tutorialSeen, false),
  };
}

/* -------------------------------------------------- windows (local time) --- */

export function inWindow(minute: number, w: DayWindow): boolean {
  if (w.from === w.to) return false; // an empty window
  return w.from < w.to ? minute >= w.from && minute < w.to : minute >= w.from || minute < w.to;
}

function minuteOfDate(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** Bedtime on the phone's clock (looks only). */
export function isBedtime(now: Date, bedtime: DayWindow): boolean {
  return inWindow(minuteOfDate(now), bedtime);
}

/**
 * When a notification meant for `at` may fire: `at` itself, or — when that
 * falls inside quiet hours — the moment quiet hours end (local time).
 */
export function deferForQuiet(at: number, quiet: DayWindow): number {
  const d = new Date(at);
  if (!inWindow(minuteOfDate(d), quiet)) return at;
  const end = new Date(at);
  end.setHours(Math.floor(quiet.to / 60), quiet.to % 60, 0, 0);
  if (end.getTime() <= at) end.setDate(end.getDate() + 1);
  return end.getTime();
}

export function windowLabel(w: DayWindow): string {
  const t = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return `${t(w.from)}–${t(w.to)}`;
}

/** Daily limits (tokens, expedition, free dives) reset at local midnight. */
export function nextDailyReset(now: number): number {
  const d = new Date(now);
  d.setHours(24, 0, 0, 0);
  return d.getTime();
}

/* ------------------------------------------------------------- chatter --- */

/** Idle-talk wait range for a chatter level (null = no idle talk). Tapping
 * the pet and the coach tips are never affected. */
export function idleTalkDelayMs(level: ChatterLevel, min: number, max: number): { min: number; max: number } | null {
  const k = level === 'chatty' ? 0.5 : level === 'normal' ? 1 : level === 'quiet' ? 2.5 : null;
  return k == null ? null : { min: min * k, max: max * k };
}

/* ------------------------------------------------------ charges notice --- */

/** "Charges full" fires at most once in this long. */
export const CHARGES_NOTICE_GAP_MS = 6 * 60 * 60 * 1000;

/**
 * When the "charges full" notice should fire, or null. Only after every
 * charge was spent (armed at 0), only when on, and never within 6h of the
 * last one.
 */
export function chargesNoticeAt(input: {
  on: boolean;
  /** Charges were run down to 0 since the last notice. */
  armed: boolean;
  /** When the charges will be full again (null = full now). */
  fullAt: number | null;
  lastFiredAt: number | null;
  now: number;
}): number | null {
  if (!input.on || !input.armed || input.fullAt == null || input.fullAt <= input.now) return null;
  const earliest = input.lastFiredAt != null ? input.lastFiredAt + CHARGES_NOTICE_GAP_MS : 0;
  return Math.max(input.fullAt, earliest);
}

/* ---------------------------------------------------------------- name --- */

export const PET_NAME_MAX = 12;
/** A small courtesy list — pet names are local to this phone, never shared.
 * Stems match anywhere; short words only as a whole word (so "Grape",
 * "Peacock", "Essex" and "Dickens" are fine). */
const BLOCKED_STEMS = ['fuck', 'shit', 'bitch', 'cunt', 'pussy', 'slut', 'whore', 'nigg', 'retard', 'nazi', 'hitler', 'porn', 'penis', 'vagina', 'asshole', 'bastard', 'wank'];
const BLOCKED_WORDS = ['dick', 'cock', 'fag', 'rape', 'sex', 'twat', 'kkk'];

export type NameCheck = { ok: true; name: string } | { ok: false; reason: 'empty' | 'long' | 'chars' | 'word' };

/** Clean and check a pet name (trimmed, single spaces, up to 12 characters of
 * letters, numbers, spaces, - and '). */
export function checkPetName(raw: string): NameCheck {
  const name = raw.replace(/\s+/g, ' ').trim();
  if (name.length === 0) return { ok: false, reason: 'empty' };
  if ([...name].length > PET_NAME_MAX) return { ok: false, reason: 'long' };
  if (!/^[\p{L}\p{N} '’\-]+$/u.test(name)) return { ok: false, reason: 'chars' };
  const leet = name.toLowerCase().replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's');
  const squashed = leet.replace(/[^a-z]/g, '');
  if (BLOCKED_STEMS.some((w) => squashed.includes(w))) return { ok: false, reason: 'word' };
  const words = leet.split(/[^a-z]+/).filter(Boolean);
  if (words.some((w) => BLOCKED_WORDS.includes(w)) || BLOCKED_WORDS.includes(squashed)) return { ok: false, reason: 'word' };
  return { ok: true, name };
}

/* ------------------------------------------------------------- journal --- */

export type PlayStats = {
  eggs_hatched: number;
  pulled: Record<Grade, number>;
  shinies: number;
  dives: number;
  surfaces: number;
  busts: number;
  best_depth: number;
  expeditions: number;
  releases: number;
  days_played: number;
  last_play_ymd: string | null;
};

export function emptyStats(): PlayStats {
  return {
    eggs_hatched: 0,
    pulled: { common: 0, rare: 0, epic: 0, legendary: 0 },
    shinies: 0,
    dives: 0,
    surfaces: 0,
    busts: 0,
    best_depth: 0,
    expeditions: 0,
    releases: 0,
    days_played: 0,
    last_play_ymd: null,
  };
}

export function parseStats(raw: unknown): PlayStats {
  const base = emptyStats();
  if (typeof raw !== 'object' || raw == null) return base;
  const r = raw as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
  const p = (typeof r.pulled === 'object' && r.pulled != null ? r.pulled : {}) as Record<string, unknown>;
  return {
    eggs_hatched: n(r.eggs_hatched),
    pulled: { common: n(p.common), rare: n(p.rare), epic: n(p.epic), legendary: n(p.legendary) },
    shinies: n(r.shinies),
    dives: n(r.dives),
    surfaces: n(r.surfaces),
    busts: n(r.busts),
    best_depth: n(r.best_depth),
    expeditions: n(r.expeditions),
    releases: n(r.releases),
    days_played: n(r.days_played),
    last_play_ymd: typeof r.last_play_ymd === 'string' ? r.last_play_ymd : null,
  };
}

/** Count a day played (once per local day, by `petDayHolds` — v27: a clock
 * set back a day or two can't count the same days again, now that every 5th
 * day gives a Shine Stone). */
export function countDay(stats: PlayStats, ymd: string): PlayStats {
  if (petDayHolds(ymd, stats.last_play_ymd)) return stats;
  return { ...stats, days_played: stats.days_played + 1, last_play_ymd: ymd };
}

/* ---------------------------------------------------------- milestones --- */

export type MilestoneReward =
  | { kind: 'ticket'; grade: Exclude<Grade, 'common'> }
  | { kind: 'cosmetic'; id: string; fallback: Exclude<Grade, 'common'> }
  | { kind: 'dye'; hero: 'first_legendary' }
  | { kind: 'ribbon'; ribbon: 'collector' | 'legend'; plus?: Exclude<Grade, 'common'> }
  /** v27 — a Shine Stone (looks only). */
  | { kind: 'stone' };

export type MilestoneId =
  | 'heroes_4'
  | 'heroes_8'
  | 'heroes_16'
  | 'first_epic'
  | 'first_legendary'
  | 'first_shiny'
  | 'five_star'
  | 'eggs_10'
  | 'insane_gold';

export type MilestoneInput = {
  heroesFound: number;
  anyEpic: boolean;
  anyLegendary: boolean;
  anyShiny: boolean;
  anyFiveStar: boolean;
  eggsHatched: number;
  /** v27 — a Gold medal on Insane in either mini-game. */
  insaneGold: boolean;
};

export type MilestoneDef = {
  id: MilestoneId;
  label: string;
  reward: MilestoneReward;
  rewardLabel: string;
  done: (m: MilestoneInput) => boolean;
  /** v27 — Shine Stones on top of the reward. */
  stones?: number;
};

export const MILESTONES: readonly MilestoneDef[] = [
  { id: 'heroes_4', label: 'Find 4 heroes', reward: { kind: 'ticket', grade: 'rare' }, rewardLabel: 'Rare+ ticket', done: (m) => m.heroesFound >= 4 },
  {
    id: 'heroes_8',
    label: 'Find 8 heroes',
    reward: { kind: 'cosmetic', id: 'cos_tint_violet', fallback: 'rare' },
    rewardLabel: 'Violet tint (or a Rare+ ticket if owned)',
    done: (m) => m.heroesFound >= 8,
  },
  {
    id: 'heroes_16',
    label: 'Find all 16 heroes',
    reward: { kind: 'ribbon', ribbon: 'collector', plus: 'epic' },
    rewardLabel: 'Collector ribbon + Epic+ ticket',
    done: (m) => m.heroesFound >= 16,
  },
  {
    id: 'first_epic',
    label: 'Pull your first Epic',
    reward: { kind: 'cosmetic', id: 'cos_badge_pearl', fallback: 'rare' },
    rewardLabel: 'Pearl badge (or a Rare+ ticket if owned)',
    done: (m) => m.anyEpic,
  },
  {
    id: 'first_legendary',
    label: 'Pull your first Legendary',
    reward: { kind: 'dye', hero: 'first_legendary' },
    rewardLabel: 'That hero’s dye, unlocked now + Legend ribbon + a Shine Stone',
    done: (m) => m.anyLegendary,
    stones: 1,
  },
  { id: 'first_shiny', label: 'Find your first shiny', reward: { kind: 'ticket', grade: 'epic' }, rewardLabel: 'Epic+ ticket', done: (m) => m.anyShiny },
  { id: 'five_star', label: 'Take a hero to 5★', reward: { kind: 'ticket', grade: 'epic' }, rewardLabel: 'Epic+ ticket', done: (m) => m.anyFiveStar },
  {
    id: 'eggs_10',
    label: 'Hatch 10 eggs',
    reward: { kind: 'ticket', grade: 'rare' },
    rewardLabel: 'Rare+ ticket + a Shine Stone',
    done: (m) => m.eggsHatched >= 10,
    stones: 1,
  },
  { id: 'insane_gold', label: 'Win Gold on Insane', reward: { kind: 'stone' }, rewardLabel: 'A Shine Stone', done: (m) => m.insaneGold },
];

export type Ribbon = 'collector' | 'legend';
