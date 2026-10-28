/**
 * Almanac seeds (PHASE-11a). Pure.
 *
 * Personal cards: FNV-1a of `userId|ymd|surface`, so two friends see different
 * cards and the same person sees the same card all day.
 * The base Pick is NOT seeded here: it stays the existing global rotation by
 * ymd (`pickIndexForYmd`), the one the server checks (red team M5: no region seed).
 */
import { pickIndexForYmd } from '@/lib/daily-pick/bank';
import { fnv1a } from '@/lib/daily-line/bank';
import { localYmd } from '@/lib/local-date';

import type { AlmanacSurface } from './types';

export function personalSeed(userId: string, ymd: string, surface: AlmanacSurface): number {
  return fnv1a(`${userId}|${ymd}|${surface}`);
}

/** Shared seed for event Picks: the whole community gets the same one. */
export function sharedSeed(ymd: string, surface: AlmanacSurface): number {
  return fnv1a(`${ymd}|${surface}`);
}

/** A number in (0, 1) for this seed and card. Never 0, so `u^(1/w)` stays finite. */
export function unitFor(seed: number, cardId: string): number {
  return (fnv1a(`${seed}|${cardId}`) + 1) / 4_294_967_297;
}

/** Today's base Pick index: the existing global rotation, unchanged. */
export function basePickIndex(ymd: string): number {
  return pickIndexForYmd(ymd);
}

function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * The day key every Almanac surface uses: `localYmd(now, me.timezone)`, the same
 * key as check-window and home-path (R21). Before `me` loads, the device zone.
 */
export function almanacYmd(now: Date, timeZone?: string | null): string {
  const zone = timeZone && timeZone.trim() ? timeZone : deviceTimeZone();
  try {
    return localYmd(now, zone);
  } catch {
    return localYmd(now, 'UTC');
  }
}

/** Local weekday of a ymd, 0 = Sunday. The ymd is already local, so read it as UTC. */
export function weekdayOfYmd(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay();
}
