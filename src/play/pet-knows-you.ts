/**
 * The pet that knows you — the rules (hideout roadmap step 3). Pure: no storage, no network, so
 * `check:pet-knows-you` can pin it. The adapter is `pet-knows-you-store.ts`; the screen hook is
 * `use-pet-knows-you.ts`.
 *
 * A personal line is RARE: at most one per visit to the pet screen, never within a cooldown of the
 * last one, only on the idle timer (never on a tap or an event), never the same line twice, and not
 * the same trait twice in a row. Thin data gets a hedge line, never silence. A broken streak gets
 * nothing. Nothing here is ever sent anywhere.
 */
import { traitBand, TRAIT_AXES, type TraitAxis } from '@/lib/traits';
import type { TraitTrack } from '@/lib/trait-stability';
import {
  PKY_STREAK_TIERS,
  PKY_THIN_LINES,
  PKY_TRAIT_LINES,
  axisOfPkyId,
  type PkyEnd,
  type PkyLine,
} from '@/play/pet-knows-you-bank';

/** A trait needs this many report answers before the pet talks about it. */
export const PKY_MIN_ANSWERS = 3;
/** Fewer confident traits than this and the pet hedges instead of guessing. */
export const PKY_MIN_AXES = 3;
/** At most this many personal lines per visit to the pet screen. */
export const PKY_MAX_PER_VISIT = 1;
/** Between two personal lines, across visits. */
export const PKY_COOLDOWN_MS = 25 * 60 * 1000;
/** Each idle tick that is allowed rolls this chance. */
export const PKY_ROLL = 0.4;
/** With a streak running, this share of personal lines is about the streak. */
export const PKY_STREAK_SHARE = 0.3;
/** How many shown ids are remembered (no repeats inside this window while others remain). */
export const PKY_RECENT_CAP = 12;
/** The same trait is not picked again while it is one of the last this-many shown. */
export const PKY_AXIS_GAP = 2;

/** What the pet knows, kept small: ends only, no raw values, no answers. */
export interface PetKnowsProfile {
  /** Only the traits with a clear end and enough answers. */
  ends: Partial<Record<TraitAxis, PkyEnd>>;
  streak: number;
  doneToday: boolean;
}

export const THIN_PROFILE: PetKnowsProfile = { ends: {}, streak: 0, doneToday: false };

/** Report track only (a game pick is a gut call, not what the person said about themselves). */
export function buildEnds(tracks: readonly TraitTrack[]): PetKnowsProfile['ends'] {
  const ends: PetKnowsProfile['ends'] = {};
  for (const axis of TRAIT_AXES) {
    const track = tracks.find((t) => t.axis === axis && t.track === 'report');
    if (!track || track.answerCount < PKY_MIN_ANSWERS) continue;
    const band = traitBand(track.value);
    if (band === 'high') ends[axis] = 'high';
    else if (band === 'low') ends[axis] = 'low';
  }
  return ends;
}

export function isThin(profile: PetKnowsProfile): boolean {
  return Object.keys(profile.ends).length < PKY_MIN_AXES;
}

/** Talk style: how readily the pet speaks up. Shifts with the traits, never what it says. */
export type PkyStyle = 'lively' | 'steady' | 'calm';

export function talkStyle(profile: PetKnowsProfile): PkyStyle {
  const lively = profile.ends.extraversion === 'high' || profile.ends.playfulness === 'high';
  const calm = profile.ends.extraversion === 'low' || profile.ends.steadiness === 'low';
  if (lively && !calm) return 'lively';
  if (calm && !lively) return 'calm';
  return 'steady';
}

export function styleCooldownMs(style: PkyStyle): number {
  return Math.round(PKY_COOLDOWN_MS * (style === 'lively' ? 0.7 : style === 'calm' ? 1.3 : 1));
}

export function styleRoll(style: PkyStyle): number {
  return style === 'lively' ? 0.5 : style === 'calm' ? 0.3 : PKY_ROLL;
}

export interface PkyGate {
  nowMs: number;
  lastShownAt: number | null;
  shownThisVisit: number;
  /** Egg stage, away, or any sheet open: the pet is not free to chat. */
  busy: boolean;
}

/** May a personal line be considered right now? (The roll comes after.) */
export function personalLineAllowed(gate: PkyGate, style: PkyStyle): boolean {
  if (gate.busy) return false;
  if (gate.shownThisVisit >= PKY_MAX_PER_VISIT) return false;
  if (gate.lastShownAt != null && gate.nowMs - gate.lastShownAt < styleCooldownMs(style)) return false;
  return true;
}

export interface PkyPick {
  line: PkyLine;
  kind: 'trait' | 'streak' | 'thin';
}

function pickFrom(pool: readonly PkyLine[], recent: readonly string[], rng: () => number): PkyLine {
  const fresh = pool.filter((l) => !recent.includes(l.id));
  // Never the same line back to back, even when the whole pool was seen lately.
  const from = fresh.length > 0 ? fresh : pool.filter((l) => l.id !== recent[recent.length - 1]);
  const usable = from.length > 0 ? from : pool;
  return usable[Math.min(usable.length - 1, Math.floor(rng() * usable.length))];
}

export function streakPool(streak: number): readonly PkyLine[] {
  let pool: readonly PkyLine[] = [];
  for (const tier of PKY_STREAK_TIERS) if (streak >= tier.min) pool = tier.lines;
  return pool;
}

/**
 * One personal line, always. Thin data → a hedge. A running streak sometimes → a streak line.
 * Otherwise a line for one confident trait, spaced from the last traits shown. `recent` is oldest
 * first.
 */
export function pickPersonalLine(
  profile: PetKnowsProfile,
  recent: readonly string[],
  rng: () => number = Math.random,
): PkyPick {
  // Only once today's check-in is done: the streak survives a day without one, and the lines must be true.
  if (profile.streak >= 1 && profile.doneToday && rng() < PKY_STREAK_SHARE) {
    const pool = streakPool(profile.streak);
    if (pool.length > 0) return { line: pickFrom(pool, recent, rng), kind: 'streak' };
  }
  if (isThin(profile)) return { line: pickFrom(PKY_THIN_LINES, recent, rng), kind: 'thin' };

  const axes = (Object.keys(profile.ends) as TraitAxis[]).filter((a) => profile.ends[a] != null);
  const lastAxes = recent
    .slice(-PKY_AXIS_GAP)
    .map((id) => axisOfPkyId(id))
    .filter((a): a is TraitAxis => a != null);
  const spaced = axes.filter((a) => !lastAxes.includes(a));
  const candidates = spaced.length > 0 ? spaced : axes;
  const axis = candidates[Math.min(candidates.length - 1, Math.floor(rng() * candidates.length))];
  const end = profile.ends[axis] as PkyEnd;
  return { line: pickFrom(PKY_TRAIT_LINES[axis][end], recent, rng), kind: 'trait' };
}

/** What the phone remembers (one key, owned by one account). */
export interface PetKnowsState {
  userId: string;
  cache: { at: number; ends: PetKnowsProfile['ends'] } | null;
  lastShownAt: number | null;
  /** Shown line ids, oldest first. */
  recent: string[];
}

export function emptyState(userId: string): PetKnowsState {
  return { userId, cache: null, lastShownAt: null, recent: [] };
}

/** Tolerant: corrupt JSON, another version or another account's payload all start fresh. Never throws. */
export function parseState(raw: string | null | undefined, userId: string): PetKnowsState {
  if (!raw) return emptyState(userId);
  try {
    const p = JSON.parse(raw) as Partial<PetKnowsState> & { v?: number };
    if (!p || p.v !== 1 || p.userId !== userId) return emptyState(userId);
    const ends: PetKnowsProfile['ends'] = {};
    const rawEnds = p.cache && typeof p.cache === 'object' ? (p.cache as { ends?: unknown }).ends : null;
    if (rawEnds && typeof rawEnds === 'object') {
      for (const [axis, end] of Object.entries(rawEnds)) {
        if ((TRAIT_AXES as readonly string[]).includes(axis) && (end === 'high' || end === 'low')) {
          ends[axis as TraitAxis] = end;
        }
      }
    }
    const at = p.cache && typeof p.cache.at === 'number' && Number.isFinite(p.cache.at) ? p.cache.at : null;
    return {
      userId,
      cache: at != null ? { at, ends } : null,
      lastShownAt: typeof p.lastShownAt === 'number' && Number.isFinite(p.lastShownAt) ? p.lastShownAt : null,
      recent: Array.isArray(p.recent)
        ? p.recent.filter((id): id is string => typeof id === 'string').slice(-PKY_RECENT_CAP)
        : [],
    };
  } catch {
    return emptyState(userId);
  }
}

/** `recent` after showing `id` (oldest first, capped). */
export function rememberShown(recent: readonly string[], id: string): string[] {
  return [...recent.filter((x) => x !== id), id].slice(-PKY_RECENT_CAP);
}
