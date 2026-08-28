/**
 * Home reveal. Daily tap-to-open. Pool is week Read/Do pattern, a stored
 * fact, or badge-proximity — priority-picked like Nudge (first real signal
 * wins). No model call, no chance, no worth-variance.
 */
import { keywordDetect } from '@/lib/crisis/detect';
import { checkWasCut, type BadgeCheck } from '@/lib/badges';
import { addDaysYmd, localYmd } from '@/lib/local-date';
import { REVEAL_EMPTY, REVEAL_LABEL } from '@/lib/sage-copy';
import { checksInRecapWeek } from '@/lib/week-window';
import { isCruelCut } from '@/lib/voice/filters';
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';

/** Unfold duration. Same for every pool kind. Gesture-tied, not a wait. */
export const REVEAL_UNFOLD_MS = 300;

/** Remaining 1–3 counts as proximity; 4+ is not close enough to be true. */
export const REVEAL_PROXIMITY_MAX = 3;

export const REVEAL_KINDS = ['week-pattern', 'fact', 'badge-proximity'] as const;
export type RevealKind = (typeof REVEAL_KINDS)[number];

export interface RevealCheck extends BadgeCheck {
  do_text?: string | null;
}

export interface RevealPick {
  kind: RevealKind;
  text: string;
}

export interface ResolveRevealInput {
  checks: RevealCheck[];
  facts: string[];
  checkCount: number;
  factCount: number;
  timeZone: string;
  now?: Date;
  crisisToday?: boolean;
  crisisYesterday?: boolean;
  crisisDetected?: boolean;
}

export { REVEAL_EMPTY, REVEAL_LABEL };

export const REVEAL_SEALED_PROMPT = 'Open';

function clipFact(fact: string): string {
  return fact.length > 80 ? `${fact.slice(0, 77)}…` : fact;
}

function latestSafeFact(facts: string[]): string | null {
  const trimmed = facts.map((fact) => fact.trim()).filter((fact) => fact.length > 0);
  for (let i = trimmed.length - 1; i >= 0; i -= 1) {
    const fact = trimmed[i]!;
    if (keywordDetect(fact)) continue;
    if (isCruelCut(fact)) continue;
    if (containsFrameworkTerm(fact)) continue;
    return clipFact(fact);
  }
  return null;
}

function weekPatternLine(week: RevealCheck[]): string | null {
  if (week.length < 2) return null;
  const skips = week.filter((row) => row.status === 'skipped').length;
  const dones = week.filter((row) => row.status === 'done').length;
  if (skips >= 2) {
    return "This week's Checks include more than one skip. That's a week pattern, not a verdict.";
  }
  if (dones >= 1 && skips >= 1) {
    return "This week's Checks mixed showing up and skipping. The reads stayed specific.";
  }
  if (dones >= 2) {
    return `You showed up on ${dones} Checks this week. The Dos stayed one-step sized.`;
  }
  return null;
}

function orderedByYmd(checks: RevealCheck[], timeZone: string): RevealCheck[] {
  return [...checks].sort((a, b) => {
    const ay = a.logged_on || (a.created_at ? localYmd(new Date(a.created_at), timeZone) : '');
    const by = b.logged_on || (b.created_at ? localYmd(new Date(b.created_at), timeZone) : '');
    if (ay !== by) return ay < by ? -1 : 1;
    return a.day - b.day;
  });
}

/** Consecutive clean logged days ending today (or yesterday if today is empty). */
export function cleanTrailingStreak(
  checks: RevealCheck[],
  timeZone: string,
  todayYmd: string,
): number {
  const ordered = orderedByYmd(checks, timeZone);
  const byYmd = new Map<string, { check: RevealCheck; previous: RevealCheck | undefined }>();
  for (let i = 0; i < ordered.length; i += 1) {
    const check = ordered[i]!;
    const ymd = check.logged_on || (check.created_at ? localYmd(new Date(check.created_at), timeZone) : null);
    if (!ymd) continue;
    byYmd.set(ymd, { check, previous: ordered[i - 1] });
  }

  let cursor = todayYmd;
  if (!byYmd.has(cursor)) {
    cursor = addDaysYmd(todayYmd, -1);
  }

  let streak = 0;
  while (streak < 7) {
    const row = byYmd.get(cursor);
    if (!row || checkWasCut(row.check, row.previous)) break;
    streak += 1;
    cursor = addDaysYmd(cursor, -1);
  }
  return streak;
}

export interface BadgeProximity {
  remaining: number;
  text: string;
}

export function findBadgeProximity(input: {
  checks: RevealCheck[];
  checkCount: number;
  timeZone: string;
  todayYmd: string;
}): BadgeProximity | null {
  const candidates: BadgeProximity[] = [];
  const checksRemaining = 7 - input.checkCount;
  if (checksRemaining >= 1 && checksRemaining <= REVEAL_PROXIMITY_MAX) {
    candidates.push({
      remaining: checksRemaining,
      text:
        checksRemaining === 1
          ? '1 Check from the 7-Check mark.'
          : `${checksRemaining} Checks from the 7-Check mark.`,
    });
  }

  const streak = cleanTrailingStreak(input.checks, input.timeZone, input.todayYmd);
  const weekRemaining = 7 - streak;
  if (streak > 0 && weekRemaining >= 1 && weekRemaining <= REVEAL_PROXIMITY_MAX) {
    candidates.push({
      remaining: weekRemaining,
      text:
        weekRemaining === 1
          ? '1 day from a week without a cut.'
          : `${weekRemaining} days from a week without a cut.`,
    });
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.remaining - b.remaining);
  return candidates[0]!;
}

/**
 * First real, specific, recent signal — never talk_style, never filler.
 * Order: this week's Read/Do pattern (2+ Checks), then the latest safe fact,
 * then badge-proximity (1–3 remaining).
 */
export function findRevealSignal(input: ResolveRevealInput): RevealPick | null {
  const now = input.now ?? new Date();
  const timeZone = input.timeZone || 'UTC';
  const week = checksInRecapWeek(input.checks, now, timeZone);
  const weekLine = weekPatternLine(week);
  if (weekLine) return { kind: 'week-pattern', text: weekLine };

  const fact = latestSafeFact(input.facts);
  if (fact) return { kind: 'fact', text: `Still true: ${fact}` };

  const todayYmd = localYmd(now, timeZone);
  const proximity = findBadgeProximity({
    checks: input.checks,
    checkCount: input.checkCount,
    timeZone,
    todayYmd,
  });
  if (proximity) return { kind: 'badge-proximity', text: proximity.text };

  return null;
}

export function resolveReveal(input: ResolveRevealInput): RevealPick | null {
  if (input.crisisDetected || input.crisisToday || input.crisisYesterday) return null;
  const pick = findRevealSignal(input);
  if (!pick) return null;
  const text = pick.text.trim();
  if (text.length === 0) return null;
  if (isCruelCut(text)) return null;
  if (containsFrameworkTerm(text)) return null;
  return { kind: pick.kind, text };
}

export function revealOpenedStorageKey(userId: string): string {
  return `ato.reveal.opened.v1:${userId}`;
}
