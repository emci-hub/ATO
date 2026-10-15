/**
 * "While you were away" — the pure summary (2026-10-15, roadmap step 1).
 *
 * Worked out by comparing the Play save BEFORE and AFTER the on-open catch-up (`touchPet` in
 * use-play-store hydrate), so no event log is needed. Shown only after an hour or more away.
 * Hatching, the grade and growing up are left out: the reveal ceremony already celebrates them
 * (and the card waits until it closes). Research is left out: it is ready within half an hour of every claim, and the top bar's CLAIM
 * chip already says so. Good news first, then what would help; at most 3 lines, each ≤ 10 words; never blame
 * ("could use a snack", never "starved"). Something a push already said while you were away is
 * left out. Pure: no React Native, no storage.
 */
import { HIDEOUT_ROOM_IDS, roomDef } from '@/play/hideout-progress';
import { diveChargeAt, type PlayStoreDoc } from '@/play/playStore';

/** Shorter gaps (switching apps, a quick look) show nothing. */
export const AWAY_MIN_MS = 60 * 60 * 1000;
/** At most this many lines on the card. */
export const AWAY_MAX_LINES = 3;
/** Words per line (the notice limit). */
export const AWAY_MAX_WORDS = 10;

export type AwayLineId =
  | 'expedition_back'
  | 'room_done'
  | 'charges_full'
  | 'snack'
  | 'play';

export type AwayLine = { id: AwayLineId; kind: 'good' | 'help'; text: string };

export type AwaySummary = { awayMs: number; lines: AwayLine[] };

/** Push notices that fired while away (ms timestamps); their news is not repeated. */
export type AwayPushes = { hungerAt?: number | null; chargesAt?: number | null };

function pushedWhileAway(at: number | null | undefined, since: number, now: number): boolean {
  return at != null && at > since && at <= now;
}

function nameOf(doc: PlayStoreDoc): string {
  const n = doc.pet.name?.trim();
  return n && n.length <= 16 ? n : 'Your pet';
}

/** "Away 9h", "Away 2 days" — the card's small subtitle. */
export function awayLabel(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  if (h < 24) return `Away ${Math.max(1, h)}h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'Away 1 day' : `Away ${d} days`;
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * The card for one open, or null when there is nothing to say (or not away long enough).
 * `before` = the save as loaded, `after` = after the catch-up at `now`.
 */
export function awaySummary(before: PlayStoreDoc, after: PlayStoreDoc, now: number, pushes: AwayPushes = {}): AwaySummary | null {
  const since = before.pet.seen_at;
  if (typeof since !== 'number' || !Number.isFinite(since)) return null;
  const awayMs = now - since;
  if (awayMs < AWAY_MIN_MS) return null;
  const name = nameOf(after);
  const good: AwayLine[] = [];
  const help: AwayLine[] = [];

  const a = after.pet;
  if (before.pet_expedition != null && after.pet_expedition == null) {
    good.push({ id: 'expedition_back', kind: 'good', text: `${name} is back from the trip.` });
  }
  for (const id of HIDEOUT_ROOM_IDS) {
    if (before.hideout.builds[id] && !after.hideout.builds[id] && after.hideout.rooms_unlocked[id]) {
      good.push({ id: 'room_done', kind: 'good', text: `The ${roomDef(id).label} is finished.` });
      break;
    }
  }
  if (!diveChargeAt(before, since).full && diveChargeAt(after, now).full && !pushedWhileAway(pushes.chargesAt, since, now)) {
    good.push({ id: 'charges_full', kind: 'good', text: 'Subway Tokens are full again.' });
  }
  // Only when the pet is home now (one just back from a trip can be hungry too).
  if (a.stage !== 'egg' && !after.pet_expedition) {
    if (a.hunger <= 1 && !pushedWhileAway(pushes.hungerAt, since, now)) {
      help.push({ id: 'snack', kind: 'help', text: `${name} could use a snack.` });
    } else if (a.mood <= 1) {
      help.push({ id: 'play', kind: 'help', text: `${name} would love some play time.` });
    }
  }

  // Good news first; keep one slot for "what would help" when there is one.
  const room = Math.max(0, AWAY_MAX_LINES - Math.min(help.length, 1));
  const lines = [...good.slice(0, room), ...help].slice(0, AWAY_MAX_LINES);
  return lines.length > 0 ? { awayMs, lines } : null;
}
