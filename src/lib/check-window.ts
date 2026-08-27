import { addDaysYmd, daysBetweenYmd, localYmd } from '@/lib/local-date';
import type { VoiceCard } from '@/lib/voice/types';

/** Inclusive lookback: today, yesterday, and 2 days ago. */
export const BACKDATE_DAYS = 2;

/**
 * Inclusive Read/Do keep window: today through today-6 (7 calendar dates).
 * Outcomes (did/skip) are kept forever. Sunday recap's previous Sunday
 * (today-7) may already have text pruned — flagged, not a bug in the cap.
 */
export const TEXT_KEEP_LOOKBACK_DAYS = 6;

export interface OpenLogDay {
  /** 1-based journey day from the user's local signup date. */
  day: number;
  /** YYYY-MM-DD this Check is for. */
  ymd: string;
  /** 0 = today, 1 = yesterday, 2 = two days ago. */
  offset: number;
}

/** Signup-local calendar date is journey day 1. */
export function journeyDay(epochYmd: string, ymd: string): number {
  return daysBetweenYmd(epochYmd, ymd) + 1;
}

export function textKeepStartYmd(todayYmd: string): string {
  return addDaysYmd(todayYmd, -TEXT_KEEP_LOOKBACK_DAYS);
}

export function shouldKeepCheckText(loggedOnYmd: string, todayYmd: string): boolean {
  return loggedOnYmd >= textKeepStartYmd(todayYmd) && loggedOnYmd <= todayYmd;
}

export function openLogDays(opts: {
  epochYmd: string;
  todayYmd: string;
  loggedDays: Iterable<number>;
}): OpenLogDay[] {
  const logged = new Set(opts.loggedDays);
  const open: OpenLogDay[] = [];
  for (let offset = BACKDATE_DAYS; offset >= 0; offset -= 1) {
    const ymd = addDaysYmd(opts.todayYmd, -offset);
    if (ymd < opts.epochYmd) continue;
    const day = journeyDay(opts.epochYmd, ymd);
    if (day < 1) continue;
    if (logged.has(day)) continue;
    open.push({ day, ymd, offset });
  }
  return open;
}

export function canLogDay(opts: {
  epochYmd: string;
  todayYmd: string;
  day: number;
  loggedOnYmd: string;
  loggedDays: Iterable<number>;
  loggedYmds?: Iterable<string>;
}): { ok: true } | { ok: false; reason: 'window' | 'mismatch' | 'taken' } {
  const expected = journeyDay(opts.epochYmd, opts.loggedOnYmd);
  if (opts.day !== expected) return { ok: false, reason: 'mismatch' };
  if (opts.loggedOnYmd > opts.todayYmd) return { ok: false, reason: 'window' };
  if (opts.loggedOnYmd < addDaysYmd(opts.todayYmd, -BACKDATE_DAYS)) {
    return { ok: false, reason: 'window' };
  }
  if (opts.loggedOnYmd < opts.epochYmd) return { ok: false, reason: 'window' };
  if (new Set(opts.loggedDays).has(opts.day)) return { ok: false, reason: 'taken' };
  if (opts.loggedYmds && new Set(opts.loggedYmds).has(opts.loggedOnYmd)) {
    return { ok: false, reason: 'taken' };
  }
  return { ok: true };
}

export function offsetLabel(offset: number): string {
  if (offset <= 0) return 'today';
  if (offset === 1) return 'yesterday';
  return `${offset} days ago`;
}

/** Honest placeholder when the bank has no slot and generation is not allowed. */
export function fallbackCatchUpCard(day: number): VoiceCard {
  return {
    read: `Day ${day} is still open. Log what happened, or skip.`,
    do: "If you did it, log it. If you didn't, skip. Either one counts.",
  };
}

export function checkWindowFor(
  me: { created_at: string; timezone?: string | null },
  loggedDays: Iterable<number>,
  now: Date = new Date(),
): {
  timeZone: string;
  epochYmd: string;
  todayYmd: string;
  todayDay: number;
  open: OpenLogDay[];
} {
  const timeZone = me.timezone?.trim() || 'UTC';
  const epochYmd = localYmd(new Date(me.created_at), timeZone);
  const todayYmd = localYmd(now, timeZone);
  return {
    timeZone,
    epochYmd,
    todayYmd,
    todayDay: journeyDay(epochYmd, todayYmd),
    open: openLogDays({ epochYmd, todayYmd, loggedDays }),
  };
}
