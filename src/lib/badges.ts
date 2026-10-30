/**
 * Home milestone badges. Each one is a pure function of already-logged
 * facts — check count, Teach-Sage facts, and Check rows. No randomness,
 * no chance, no "maybe this time."
 */
import { addDaysYmd, localYmd } from '@/lib/local-date';
import { hasCut } from '@/lib/voice/filters';

export const BADGE_IDS = ['checks-7', 'first-fact', 'week-no-cut', 'full-picture'] as const;
export type BadgeId = (typeof BADGE_IDS)[number];

export interface BadgeCheck {
  day: number;
  status: 'done' | 'skipped';
  /** Calendar date this Check is for (YYYY-MM-DD). */
  logged_on?: string | null;
  created_at?: string;
  read_text?: string | null;
}

export interface BadgeInput {
  checkCount: number;
  factCount: number;
  checks: BadgeCheck[];
  timeZone?: string;
  /** All currently-defined categories independently past the stability floor. */
  fullPicture?: boolean;
}

export interface BadgeState {
  id: BadgeId;
  unlocked: boolean;
}

const EVEN_READ = 'Ordinary day. Nothing to dramatize.';

function checkYmd(check: BadgeCheck, timeZone: string): string | null {
  if (check.logged_on) return check.logged_on;
  if (check.created_at) return localYmd(new Date(check.created_at), timeZone);
  return null;
}

function orderedChecks(checks: BadgeCheck[], timeZone: string): BadgeCheck[] {
  return [...checks].sort((a, b) => {
    const ay = checkYmd(a, timeZone) ?? '';
    const by = checkYmd(b, timeZone) ?? '';
    if (ay !== by) return ay < by ? -1 : 1;
    return a.day - b.day;
  });
}

/**
 * A Check is a cut when Sage called out a skip. Live Reads use `hasCut`.
 * After Read text is pruned, infer from the previous Check's skip — the same
 * signal `deriveTone` uses. Never invent a cut that the rows don't support.
 */
export function checkWasCut(check: BadgeCheck, previous: BadgeCheck | undefined): boolean {
  const read = check.read_text?.trim() ?? '';
  if (read.length > 0) return hasCut(read);
  return previous?.status === 'skipped';
}

export function hasSevenChecks(checkCount: number): boolean {
  return checkCount >= 7;
}

export function hasFirstFact(factCount: number): boolean {
  return factCount >= 1;
}

/** Any 7 consecutive calendar days, each logged, none of them a cut. */
export function hasWeekWithoutCut(checks: BadgeCheck[], timeZone = 'UTC'): boolean {
  if (checks.length < 7) return false;
  const ordered = orderedChecks(checks, timeZone);
  const byYmd = new Map<string, { check: BadgeCheck; previous: BadgeCheck | undefined }>();
  for (let i = 0; i < ordered.length; i += 1) {
    const check = ordered[i]!;
    const ymd = checkYmd(check, timeZone);
    if (!ymd) continue;
    byYmd.set(ymd, { check, previous: ordered[i - 1] });
  }
  const starts = [...byYmd.keys()].sort();
  for (const start of starts) {
    let clean = true;
    for (let offset = 0; offset < 7; offset += 1) {
      const ymd = addDaysYmd(start, offset);
      const row = byYmd.get(ymd);
      if (!row || checkWasCut(row.check, row.previous)) {
        clean = false;
        break;
      }
    }
    if (clean) return true;
  }
  return false;
}

export function resolveBadges(input: BadgeInput): BadgeState[] {
  const timeZone = input.timeZone ?? 'UTC';
  return [
    { id: 'checks-7', unlocked: hasSevenChecks(input.checkCount) },
    { id: 'first-fact', unlocked: hasFirstFact(input.factCount) },
    { id: 'week-no-cut', unlocked: hasWeekWithoutCut(input.checks, timeZone) },
    { id: 'full-picture', unlocked: input.fullPicture === true },
  ];
}

// ── Seasonal badges (PHASE-11e, L3) ─────────────────────────────────────────
// Cosmetic and local: earned by answering a Pick while a season or an event's
// build/peak window is on. They never unlock anything and never expire.

export interface SeasonalBadge {
  /** `event_<id>_<year>` or `season_<id>_<year>`. Forever. */
  id: string;
  name: string;
  /** The local day it was earned. */
  ymd: string;
}

export interface SeasonalBadgeWindow {
  ymd: string;
  seasonId: string;
  seasonName: string;
  eventId: string | null;
  eventName: string | null;
  eventPhase?: string;
}

/** The badges a Pick answered today can earn: the season, and the event while it builds or peaks. */
export function earnableSeasonalBadges(w: SeasonalBadgeWindow): SeasonalBadge[] {
  const year = w.ymd.slice(0, 4);
  // New Year's late-December build belongs to next year's New Year (one badge).
  const eventYear = w.eventId === 'new_year' && w.ymd.slice(5, 7) === '12' ? String(Number(year) + 1) : year;
  const out: SeasonalBadge[] = [{ id: `season_${w.seasonId}_${year}`, name: w.seasonName, ymd: w.ymd }];
  if (w.eventId && w.eventName && (w.eventPhase === 'build' || w.eventPhase === 'peak')) {
    out.push({ id: `event_${w.eventId}_${eventYear}`, name: w.eventName, ymd: w.ymd });
  }
  return out;
}

export function addSeasonalBadges(
  have: readonly SeasonalBadge[],
  earned: readonly SeasonalBadge[],
): { list: SeasonalBadge[]; added: SeasonalBadge[] } {
  const list = [...have];
  const added: SeasonalBadge[] = [];
  for (const badge of earned) {
    if (list.some((b) => b.id === badge.id)) continue;
    list.push(badge);
    added.push(badge);
  }
  return { list, added };
}

export function parseSeasonalBadges(raw: string | null, userId: string): SeasonalBadge[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as { userId?: unknown; badges?: unknown } | null;
    if (!v || v.userId !== userId || !Array.isArray(v.badges)) return [];
    return v.badges.filter(
      (b): b is SeasonalBadge =>
        !!b && typeof b.id === 'string' && typeof b.name === 'string' && typeof b.ymd === 'string',
    );
  } catch {
    return [];
  }
}

export function unlockedCount(states: BadgeState[]): number {
  return states.filter((badge) => badge.unlocked).length;
}

/**
 * Fixture that unlocks all three from real-shaped rows (11 consecutive
 * done Checks, one stored fact). Used by theme-lab; same resolver as Home.
 */
export function unlockedBadgeFixture(): BadgeInput {
  const checks: BadgeCheck[] = [];
  for (let i = 0; i < 11; i += 1) {
    checks.push({
      day: i + 1,
      status: 'done',
      logged_on: addDaysYmd('2026-08-18', i),
      read_text: EVEN_READ,
    });
  }
  return { checkCount: 11, factCount: 1, checks, timeZone: 'UTC' };
}
