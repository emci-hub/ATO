import { checkOdds } from '@/lib/quests/d20';
import type { Replay } from '@/lib/quests/run';
import type { AxisVerdict, RunScore } from '@/lib/quests/score';
import { UI_COPY, STAT_LABEL, fmt } from '@/lib/quests/strings';
import { STATS } from '@/lib/quests/types';
import type { QuestCheck, Stat, StoryLine } from '@/lib/quests/types';
import { AXIS_POLES } from '@/lib/axis-poles';
import type { TraitAxis } from '@/lib/traits';

/**
 * Pure helpers behind the Quests screens (ATO-BUILD PHASE-16): no React, no
 * I/O, so `check:quest-ui` can pin them offline.
 */

// --- typewriter ----------------------------------------------------------------

export const TYPE = {
  charsPerSecond: 70,
  /** Extra pause after a comma, a full stop or a dash. */
  pauseMs: 120,
  pauseChars: '.,—',
  /** Chapter title: one letter every 40 ms, the whole card 1.2 s. */
  chapterCharMs: 40,
  chapterTotalMs: 1200,
} as const;

/** Time (ms from start) at which character i+1 is on screen. */
export function typeSchedule(text: string): number[] {
  const per = 1000 / TYPE.charsPerSecond;
  const out: number[] = [];
  let t = 0;
  for (const ch of Array.from(text)) {
    t += per;
    out.push(t);
    if (TYPE.pauseChars.includes(ch)) t += TYPE.pauseMs;
  }
  return out;
}

/** How many characters are showing `ms` after the start. */
export function charsAt(schedule: readonly number[], ms: number): number {
  let n = 0;
  while (n < schedule.length && schedule[n] <= ms) n += 1;
  return n;
}

export const typeTotalMs = (text: string): number => {
  const s = typeSchedule(text);
  return s.length ? s[s.length - 1] : 0;
};

// --- keyword tint --------------------------------------------------------------

export interface Seg {
  text: string;
  hot: boolean;
}

/** Splits a line so each keyword (first match, case-sensitive) is its own tinted segment. */
export function splitKeywords(text: string, keywords: readonly string[] | undefined): Seg[] {
  const spans: { from: number; to: number }[] = [];
  for (const kw of keywords ?? []) {
    const from = kw ? text.indexOf(kw) : -1;
    if (from >= 0 && !spans.some((s) => from < s.to && from + kw.length > s.from)) spans.push({ from, to: from + kw.length });
  }
  spans.sort((a, b) => a.from - b.from);
  const out: Seg[] = [];
  let at = 0;
  for (const s of spans) {
    if (s.from > at) out.push({ text: text.slice(at, s.from), hot: false });
    out.push({ text: text.slice(s.from, s.to), hot: true });
    at = s.to;
  }
  if (at < text.length) out.push({ text: text.slice(at), hot: false });
  return out.length ? out : [{ text, hot: false }];
}

/** The first `n` characters of the segments (by code point), keeping the tint. */
export function sliceSegs(segs: readonly Seg[], n: number): Seg[] {
  const out: Seg[] = [];
  let left = n;
  for (const s of segs) {
    if (left <= 0) break;
    const chars = Array.from(s.text);
    out.push({ text: chars.slice(0, left).join(''), hot: s.hot });
    left -= chars.length;
  }
  return out;
}

export const lineLength = (line: StoryLine): number => Array.from(line.text).length;

/** The label on a speaker pill; narration has none. */
export function speakerOf(line: StoryLine): string | null {
  if (line.kind === 'narrator') return null;
  return line.speaker ?? null;
}

// --- choices -------------------------------------------------------------------

/** "CHECK: SUPPLIES ≥ 11 · 55%" for a choice with a check; the dc shown is the one the odds use. */
export function checkBadge(check: QuestCheck, stats: Record<Stat, number>): { text: string; a11y: string; odds: number } {
  const odds = Math.round(checkOdds(check.dc, stats[check.stat]) * 100);
  const stat = STAT_LABEL[check.stat];
  return {
    odds,
    text: fmt(UI_COPY.checkBadge, { stat: stat.toUpperCase(), dc: check.dc, odds }),
    a11y: fmt(UI_COPY.checkBadgeA11y, { stat, dc: check.dc, odds }),
  };
}

// --- stats ---------------------------------------------------------------------

export interface StatChange {
  stat: Stat;
  delta: number;
}

/** What changed between two stat lines, in STATS order. */
export function statChanges(from: Record<Stat, number>, to: Record<Stat, number>): StatChange[] {
  return STATS.flatMap((stat) => (to[stat] !== from[stat] ? [{ stat, delta: to[stat] - from[stat] }] : []));
}

/** The VoiceOver announcement for a beat's stat changes. */
export function statAnnouncement(changes: readonly StatChange[]): string {
  return changes
    .map((c) =>
      fmt(UI_COPY.statChange, {
        stat: STAT_LABEL[c.stat],
        dir: c.delta > 0 ? UI_COPY.statUp : UI_COPY.statDown,
        n: Math.abs(c.delta),
      }),
    )
    .join('. ');
}

// --- progress ------------------------------------------------------------------

/** 0…1 for the "Ending n of m" bar. */
export const endingProgress = (found: number, total: number): number => (total > 0 ? Math.min(1, found / total) : 0);

/** The chapter count of a campaign (highest chapter number among live scenes). */
export function chapterCount(scenes: readonly { chapter: number; retired?: true }[]): number {
  return scenes.reduce((m, s) => (s.retired ? m : Math.max(m, s.chapter)), 1);
}

/** The last live pick of a replay, used to find the choice a beat shows. */
export const lastLivePick = (history: Replay['history']) => [...history].reverse().find((p) => !p.undone);

// --- the Said screen -----------------------------------------------------------

export interface SaidCard {
  axis: TraitAxis;
  /** The pole phrase the player kept picking. */
  phrase: string;
  scenes: number;
  same: number;
  /** 0…1 */
  consistency: number;
}

export interface SaidModel {
  /** Up to 3 cards, none ticked. */
  cards: SaidCard[];
  notEnough: TraitAxis[];
  /** Shown once when a story-self run contradicted a solid report value. */
  contradiction: boolean;
  /** Why a run does not count, if it does not. */
  note: 'for_fun' | 'evidence_window' | null;
}

function cardOf(v: AxisVerdict): SaidCard {
  const poles = AXIS_POLES[v.axis];
  return {
    axis: v.axis,
    phrase: v.lean > 0 ? poles.high : poles.low,
    scenes: v.scenes,
    same: v.agreeing,
    consistency: v.consistency,
  };
}

/** The screen's cards from a scored run. A run that does not count shows no cards. */
export function saidModel(score: RunScore): SaidModel {
  return {
    cards: score.counts ? score.apply.map(cardOf) : [],
    notEnough: score.notEnough,
    contradiction: score.axes.some((a) => a.status === 'contradiction'),
    note: score.counts ? null : (score.why ?? null),
  };
}

/** Save stays off until at least one shown card is ticked and not turned away. */
export function canSave(ticked: ReadonlySet<TraitAxis>, notMe: ReadonlySet<TraitAxis>): boolean {
  return [...ticked].some((a) => !notMe.has(a));
}
