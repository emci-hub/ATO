import { keywordDetect } from '@/lib/crisis/detect';
import { isCruelCut } from '@/lib/voice/filters';
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';
import type { CheckHistory } from '@/lib/voice/types';

/** Lookback for skip-pattern and knock-in-text. Same window as last-7 valence. */
export const NUDGE_RECENT_DAYS = 7;

export type NudgeSignalKind = 'skip-pattern' | 'knock' | 'fact';

/** Internal id; user-facing label is always "Nudge". */
export const NUDGE_INTERNAL_NAME = 'zGlitch';

export { NUDGE_LABEL } from '@/lib/sage-copy';

export interface NudgeSignal {
  kind: NudgeSignalKind;
  detail: string;
}

export interface ResolveNudgeInput {
  knocksYouOff: string;
  facts: string[];
  history: CheckHistory[];
  /** Today's Do must be on screen whenever a Nudge is shown. */
  hasDo: boolean;
  crisisToday?: boolean;
  crisisDetected?: boolean;
  /** Previous local calendar day had a crisis flag. */
  crisisYesterday?: boolean;
}

const KNOCK_ALIASES: Record<string, string[]> = {
  sleep: ['sleep', 'slept', 'insomnia', 'tired'],
  workload: ['workload', 'work load', 'overwork', 'deadline'],
  'people/conflict': ['people/conflict', 'conflict', 'argument', 'fight'],
  health: ['health', 'sick', 'illness'],
  money: ['money', 'rent', 'bills'],
};

function parseKnockChips(knocks: string): string[] {
  return knocks
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0 && part !== 'something else');
}

function recentCorpus(history: CheckHistory[]): string {
  return history
    .slice(-NUDGE_RECENT_DAYS)
    .flatMap((row) => [row.read ?? '', row.do ?? ''])
    .join(' ')
    .toLowerCase();
}

/**
 * First real, specific, recent signal — never talk_style.
 * Order: skip pattern (2+ skips in last 7), then a knock chip that actually
 * appeared in recent Read/Do text, then the latest safe stored fact.
 */
export function findNudgeSignal(input: {
  knocksYouOff: string;
  facts: string[];
  history: CheckHistory[];
}): NudgeSignal | null {
  const recent = input.history.slice(-NUDGE_RECENT_DAYS);
  const skipCount = recent.filter((row) => row.status === 'skipped').length;
  if (skipCount >= 2) {
    return { kind: 'skip-pattern', detail: String(skipCount) };
  }

  const corpus = recentCorpus(input.history);
  if (corpus.trim().length > 0) {
    for (const chip of parseKnockChips(input.knocksYouOff)) {
      const tokens = KNOCK_ALIASES[chip] ?? [chip.split('/')[0] ?? chip];
      if (tokens.some((token) => token.length >= 4 && corpus.includes(token))) {
        return { kind: 'knock', detail: chip };
      }
    }
  }

  const facts = input.facts.map((fact) => fact.trim()).filter((fact) => fact.length > 0);
  for (let i = facts.length - 1; i >= 0; i -= 1) {
    const fact = facts[i];
    if (keywordDetect(fact)) continue;
    if (isCruelCut(fact)) continue;
    if (containsFrameworkTerm(fact)) continue;
    const clipped = fact.length > 80 ? `${fact.slice(0, 77)}…` : fact;
    return { kind: 'fact', detail: clipped };
  }

  return null;
}

function knockLine(chip: string): string {
  switch (chip) {
    case 'sleep':
      return "Sleep is what you said knocks you off, and it showed up in this week's Checks. Today's step stays small so bedtime is still reachable.";
    case 'workload':
      return "Workload showed up in this week's Checks — the thing you already named. Today's Do is one next piece, not the whole list.";
    case 'people/conflict':
      return "People / conflict showed up in this week's Checks. Name the one moment that happened, not a global verdict on anyone.";
    case 'health':
      return "Health is what you said knocks you off, and it showed up recently. One small repeat attached to something you already do — no heroics.";
    case 'money':
      return "Money is what you said knocks you off, and it showed up in this week's Checks. Today's Do is one concrete step, not the whole problem.";
    default:
      return "Something you named as a knock-off showed up in this week's Checks. Today's Do is the smaller next step.";
  }
}

export function composeNudge(signal: NudgeSignal): string {
  switch (signal.kind) {
    case 'skip-pattern':
      return "A few skips this week is a pattern worth noticing — not a verdict. Today's Do is the smaller next step. That's enough.";
    case 'knock':
      return knockLine(signal.detail);
    case 'fact':
      return `You told Sage something that's still true: ${signal.detail} Today's Do is how you stay with that — no speech required.`;
  }
}

/**
 * Home-only Nudge copy, or null when the slot must stay empty.
 * Does not call a model (existing per-user quota stays on Read/Do + Talk).
 */
export function resolveNudge(input: ResolveNudgeInput): string | null {
  if (!input.hasDo) return null;
  if (input.crisisDetected || input.crisisToday || input.crisisYesterday) return null;
  const last = input.history[input.history.length - 1];
  if (last?.nudge && last.nudge.trim().length > 0) return null;
  const signal = findNudgeSignal(input);
  if (!signal) return null;
  const text = composeNudge(signal).trim();
  if (text.length === 0) return null;
  if (isCruelCut(text)) return null;
  if (containsFrameworkTerm(text)) return null;
  return text;
}
