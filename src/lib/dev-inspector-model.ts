/**
 * Dev Inspector — pure rules (scripts/dev-inspector-check.ts pins them).
 *
 * Turns data the app already has into the four things a tester wants to SEE:
 *   1. the 16 axes as points, with their low / mid / high band, and what the
 *      last answers did to them;
 *   2. each category, with the axes (and scores) behind it;
 *   3. the AI gates — what a tap needs before a model call may happen;
 *   4. where the current round's questions came from (shared bank or AI).
 *
 * Read-only. Nothing here calls a model or writes anything.
 */
import { readAllCategories, type CategoryReading } from '@/lib/categories';
import type { TraitHistoryRow } from '@/lib/trait-history';
import {
  STABILITY_FLOOR_N,
  effectiveStability,
  trackFor,
  type TraitTrack,
} from '@/lib/trait-stability';
import {
  TRAIT_AXES,
  TRAIT_BAND_HIGH_CUT,
  TRAIT_BAND_LOW_CUT,
  isDirectTraitSource,
  traitBand,
  type TraitAxis,
  type TraitBand,
  type TraitState,
} from '@/lib/traits';

/** 0–1 → whole points out of 100. Null stays null (not answered). */
export function toPoints(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 100) : null;
}

/** "conflict_assertiveness" → "Conflict assertiveness". */
export function axisName(axis: TraitAxis): string {
  const words = axis.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export const BAND_LABEL: Record<TraitBand, string> = { low: 'LOW', mid: 'MID', high: 'HIGH' };

/** The band cut-offs, in points, for the legend. */
export const BAND_CUTS = { low: Math.round(TRAIT_BAND_LOW_CUT * 100), high: Math.round(TRAIT_BAND_HIGH_CUT * 100) };

export type AxisInspect = {
  axis: TraitAxis;
  name: string;
  points: number | null;
  band: TraitBand | null;
  /** Answers counted on the "what you said" track. */
  answers: number;
  /** 0–100: how consistent the answers are. */
  stability: number;
  /**
   * Settled = categories and the daily insight will use it. That is exactly
   * `effectiveStability > 0` (categories.ts reportStable, generate-insight.ts) —
   * NOT the stricter Sage-title rule.
   */
  settled: boolean;
  /** Where the number came from: you set it (sticky) or worked out from answers. */
  origin: 'you set it' | 'from answers' | 'not answered';
  /** The score AFTER each of the last few answers, oldest → newest, in points. */
  recent: number[];
};

export function inspectAxes(
  state: TraitState,
  tracks: readonly TraitTrack[],
  history: readonly TraitHistoryRow[],
  now: Date = new Date(),
): AxisInspect[] {
  return TRAIT_AXES.map((axis) => {
    const row = trackFor(tracks, axis, 'report');
    // Same number Explore's bands and the categories read: the report track
    // first, the profile column only as a fallback.
    const value = row && row.answerCount > 0 ? row.value : state.values[axis];
    const source = state.sources[axis];
    // trait_history stores the score AFTER each write. Game-track rows are a
    // different track and never feed these numbers, so they are left out.
    const recent = history
      .filter((h) => h.axis === axis && h.source !== 'self_game')
      .slice(-4)
      .map((h) => Math.round(h.value * 100));
    return {
      axis,
      name: axisName(axis),
      points: toPoints(value),
      band: traitBand(value),
      answers: row?.answerCount ?? 0,
      stability: Math.round(effectiveStability(row, now) * 100),
      settled: effectiveStability(row, now) > 0,
      origin: value == null ? 'not answered' : isDirectTraitSource(source) ? 'you set it' : 'from answers',
      recent,
    };
  });
}

/** One line a tester can read: "62 pts · MID · 4 answers · settled". */
export function axisLine(a: AxisInspect): string {
  if (a.points == null) return 'not answered yet';
  return [
    `${a.points} pts`,
    a.band ? BAND_LABEL[a.band] : '—',
    `${a.answers} answer${a.answers === 1 ? '' : 's'}`,
    a.settled ? 'settled' : a.answers < STABILITY_FLOOR_N ? `needs ${STABILITY_FLOOR_N} answers to settle` : 'not settled yet',
  ].join(' · ');
}

export type CategoryInspect = {
  id: string;
  name: string;
  shape: 'bar' | 'map';
  ready: boolean;
  /** The category's own result in points: one number (bar) or two (map). */
  result: string;
  /** What it still needs, when not ready. */
  needs: string | null;
  axes: { axis: TraitAxis; name: string; points: number | null; used: boolean }[];
};

export function inspectCategory(reading: CategoryReading, tracks: readonly TraitTrack[]): CategoryInspect {
  const { def } = reading;
  const axes = def.axes.map((axis) => {
    const row = trackFor(tracks, axis, 'report');
    return {
      axis,
      name: axisName(axis),
      points: row && row.answerCount > 0 ? toPoints(row.value) : null,
      used: reading.stableAxes.includes(axis),
    };
  });
  const need = def.shape === 'map' ? def.axes.length : def.minStable;
  const have = reading.stableAxes.length;
  return {
    id: def.id,
    name: def.name,
    shape: def.shape,
    ready: reading.ready,
    result: !reading.ready
      ? 'not open yet'
      : reading.map
        ? `${toPoints(reading.map.x)} / ${toPoints(reading.map.y)} pts (two axes plotted against each other)`
        : `${toPoints(reading.bar)} pts (average of the settled axes below)`,
    needs: reading.ready ? null : `${have} of ${need} axes settled — needs ${need - have} more`,
    axes,
  };
}

export function inspectCategories(tracks: readonly TraitTrack[], now: Date = new Date()): CategoryInspect[] {
  return readAllCategories(tracks, now).map((reading) => inspectCategory(reading, tracks));
}

/** Every live AI feature, what starts it, and its own extra limit. */
export const AI_GATE_FEATURES = [
  { feature: 'Daily insight', starts: 'Tapping "Load insight" on Home', extra: 'none' },
  { feature: 'Story', starts: 'Tapping the Story button on Home', extra: '1 a day' },
  { feature: 'Category read', starts: 'Tapping a category on Explore', extra: 'reroll: 1 token, once a day' },
  { feature: 'Round questions', starts: 'Tapping "Next 25 questions"', extra: 'only what the bank cannot fill' },
] as const;

export type AiGate = { label: string; pass: boolean; detail: string };

/** The three conditions every AI call needs — two of them enforced on the server. */
export function aiGates(input: {
  consent: 'granted' | 'denied' | 'pending';
  profileDone: boolean;
  usedToday: number | null;
  dailyCap: number | null;
  usedMonth?: number | null;
  monthlyCap?: number | null;
}): AiGate[] {
  const left = input.usedToday != null && input.dailyCap != null ? Math.max(0, input.dailyCap - input.usedToday) : null;
  const monthLeft =
    input.usedMonth != null && input.monthlyCap != null ? Math.max(0, input.monthlyCap - input.usedMonth) : null;
  return [
    {
      label: 'A tap',
      pass: true,
      detail: 'Nothing generates on its own. A check (check:no-auto-ai) fails the build if any screen calls AI without a tap.',
    },
    {
      label: 'Profile done',
      pass: input.profileDone,
      detail: input.profileDone ? 'All 50 questions are answered.' : 'Insight, Story, categories and rounds stay locked until the 50 are done.',
    },
    {
      label: 'AI consent',
      pass: input.consent === 'granted',
      detail:
        input.consent === 'granted'
          ? 'On. Also enforced on the server.'
          : input.consent === 'denied'
            ? 'Off — the server refuses every AI call.'
            : 'Not answered yet — the server refuses every AI call.',
    },
    {
      label: 'A call left',
      // Both limits are enforced by the server. Unknown usage is NOT shown as a pass.
      pass: left != null && left > 0 && (monthLeft == null || monthLeft > 0),
      detail:
        left == null
          ? 'Usage could not be loaded, so this is unknown.'
          : `Today: ${input.usedToday} of ${input.dailyCap} used, ${left} left.` +
            (monthLeft == null ? '' : ` This month: ${input.usedMonth} of ${input.monthlyCap} used, ${monthLeft} left.`) +
            ' Counted on the server.',
    },
  ];
}

export type RoundItemInspect = { axis: string; prompt: string; answered: boolean; from: 'shared bank' | 'written by AI' | 'unknown' };

/**
 * `hasBankId` + no readable row = an AI question whose pool row this account may
 * no longer read (the hand-written bank is always readable), so it is AI too.
 */
export function roundItemFrom(source: string | null | undefined, hasBankId = false): RoundItemInspect['from'] {
  if (source === 'authored') return 'shared bank';
  if (source === 'ai') return 'written by AI';
  return hasBankId ? 'written by AI' : 'unknown';
}

export function roundSummary(items: readonly RoundItemInspect[]): string {
  const bank = items.filter((i) => i.from === 'shared bank').length;
  const ai = items.filter((i) => i.from === 'written by AI').length;
  const done = items.filter((i) => i.answered).length;
  return `${items.length} questions · ${bank} from the shared bank · ${ai} written by AI · ${done} answered`;
}
