/**
 * "Does Sage know you?" — recurring check-in on a filled trait axis.
 *
 * Banked paraphrase lines only. No live model call, no quota. Confirm never
 * moves the 0–1 number (confirmTraitSource). Correct is a Settings write.
 */

import { addDaysYmd, daysBetweenYmd, localYmd } from '@/lib/local-date';
import {
  TRAIT_AXES,
  TRAIT_POLE_LINES,
  traitBand,
  traitPoleLine,
  type TraitAxis,
  type TraitBand,
  type TraitTouched,
  type TraitValues,
} from '@/lib/traits';
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';
import { findNudgeSignal, type NudgeSignal } from '@/lib/voice/nudge';
import type { CheckHistory } from '@/lib/voice/types';

export const SAGE_KNOWS_COOLDOWN_DAYS = 14;
export const SAGE_KNOWS_GRADUATE_STREAK = 2;
export const SAGE_KNOWS_THREE_MONTH_DAYS = 90;

export type SageKnowsWeekSlot = 'sage_knows' | 'game_invite' | 'ranking';
export type SageKnowsWeekDone = 'dismissed' | 'answered';
export type YouTabSoftAsk = 'completeness' | 'three_month';

export interface SageKnowsState {
  last_axis: TraitAxis | null;
  week_key: string | null;
  week_slot: SageKnowsWeekSlot | null;
  week_done: SageKnowsWeekDone | null;
  ranking_last_axis: TraitAxis | null;
  scenario_last_axis: TraitAxis | null;
  you_week_key: string | null;
  you_slot: YouTabSoftAsk | null;
  streaks: Partial<Record<TraitAxis, number>>;
  graduated: Partial<Record<TraitAxis, string>>;
}

export interface SageKnowsPrompt {
  axis: TraitAxis;
  line: string;
  kind: 'check-in' | 'signal';
}

/**
 * Poles that must never appear on this surface — guess or check-in.
 * The axis can still show on the opposite pole.
 */
export const CRUEL_CHECKIN_POLES: ReadonlyArray<{ axis: TraitAxis; band: TraitBand }> = [
  { axis: 'self_efficacy', band: 'low' },
  { axis: 'growth_mindset', band: 'low' },
  { axis: 'attachment_anxiety', band: 'high' },
  { axis: 'competence', band: 'low' },
];

/** Plain-language editor copy. No framework names. */
export const AXIS_EDITOR_COPY: Record<TraitAxis, { label: string; hint: string }> = {
  openness: {
    label: 'How you feel about trying something new',
    hint: 'Left = stick with what I know. Right = try the untried path.',
  },
  conscientiousness: {
    label: 'How you handle sticking to a plan',
    hint: 'Left = keep plans loose. Right = see a plan through.',
  },
  extraversion: {
    label: 'How much people time you actually need',
    hint: 'Left = quieter time. Right = energy from people.',
  },
  agreeableness: {
    label: 'How much you go along to keep things easy',
    hint: 'Left = hold my ground. Right = keep things easy.',
  },
  steadiness: {
    label: 'How rattled a bad day gets you',
    hint: 'Some people shake it off fast, some carry it longer — no wrong answer here.',
  },
  attachment_anxiety: {
    label: 'How you handle getting close to people',
    hint: "Everyone's a little different here — this just helps Sage read the room right.",
  },
  attachment_avoidance: {
    label: "How much space you like, even with people you're close to",
    hint: 'Left = I stay close once I am in. Right = I keep some distance.',
  },
  conflict_assertiveness: {
    label: 'How you show up in a disagreement',
    hint: 'Left = I step back. Right = I put my own point on the table.',
  },
  conflict_cooperativeness: {
    label: 'How much room you leave for the other person',
    hint: 'Left = I protect my outcome first. Right = I look for something they can live with.',
  },
  autonomy: {
    label: 'How much you like doing it your own way',
    hint: 'Left = a path already set is fine. Right = I want to do it my way.',
  },
  competence: {
    label: 'How you feel about tackling something hard',
    hint: 'Left = I doubt I can pull it off. Right = I feel I can handle it.',
  },
  relatedness: {
    label: 'How much real connection you need day to day',
    hint: 'Left = a day can land without much of it. Right = I need a real connection.',
  },
  growth_mindset: {
    label: 'What happens after you miss the mark',
    hint: 'Left = maybe I am not good at that. Right = I look for what to change.',
  },
  locus_of_control: {
    label: 'What you tell yourself when something falls apart',
    hint: 'Left = it was bound to happen. Right = what might I have done differently.',
  },
  self_efficacy: {
    label: 'How you feel facing something big',
    hint: 'Left = not sure I can pull this off. Right = I have got this.',
  },
  playfulness: {
    label: 'How much a day wants a little play',
    hint: 'Left = treat the day as a job. Right = look for the lighter take.',
  },
};

export function emptySageKnowsState(): SageKnowsState {
  return {
    last_axis: null,
    week_key: null,
    week_slot: null,
    week_done: null,
    ranking_last_axis: null,
    scenario_last_axis: null,
    you_week_key: null,
    you_slot: null,
    streaks: {},
    graduated: {},
  };
}

function isTraitAxis(value: unknown): value is TraitAxis {
  return typeof value === 'string' && (TRAIT_AXES as readonly string[]).includes(value);
}

export function parseSageKnowsState(raw: unknown): SageKnowsState {
  const empty = emptySageKnowsState();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return empty;
  const row = raw as Record<string, unknown>;
  const last = isTraitAxis(row.last_axis) ? row.last_axis : null;
  const week_key = typeof row.week_key === 'string' && row.week_key.length > 0 ? row.week_key : null;
  const week_slot =
    row.week_slot === 'sage_knows' ||
    row.week_slot === 'game_invite' ||
    row.week_slot === 'ranking'
      ? row.week_slot
      : null;
  const week_done = row.week_done === 'dismissed' || row.week_done === 'answered' ? row.week_done : null;
  const ranking_last_axis = isTraitAxis(row.ranking_last_axis) ? row.ranking_last_axis : null;
  const scenario_last_axis = isTraitAxis(row.scenario_last_axis) ? row.scenario_last_axis : null;
  const you_week_key =
    typeof row.you_week_key === 'string' && row.you_week_key.length > 0 ? row.you_week_key : null;
  const you_slot =
    row.you_slot === 'completeness' || row.you_slot === 'three_month' ? row.you_slot : null;
  const streaks: SageKnowsState['streaks'] = {};
  if (row.streaks && typeof row.streaks === 'object' && !Array.isArray(row.streaks)) {
    const rawStreaks = row.streaks as Record<string, unknown>;
    for (const axis of TRAIT_AXES) {
      const n = rawStreaks[axis];
      if (typeof n === 'number' && Number.isFinite(n) && n > 0) streaks[axis] = Math.floor(n);
    }
  }
  const graduated: SageKnowsState['graduated'] = {};
  if (row.graduated && typeof row.graduated === 'object' && !Array.isArray(row.graduated)) {
    const rawGrad = row.graduated as Record<string, unknown>;
    for (const axis of TRAIT_AXES) {
      const at = rawGrad[axis];
      if (typeof at === 'string' && at.trim().length > 0) graduated[axis] = at;
    }
  }
  return {
    last_axis: last,
    week_key,
    week_slot,
    week_done,
    ranking_last_axis,
    scenario_last_axis,
    you_week_key,
    you_slot,
    streaks,
    graduated,
  };
}

/** Sunday (recap week) that contains `ymd`. */
export function sageKnowsWeekKey(ymd: string): string {
  const [year, month, day] = ymd.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return addDaysYmd(ymd, -utc.getUTCDay());
}

export function hasUnfilledTraitAxis(values: TraitValues): boolean {
  return TRAIT_AXES.some((axis) => values[axis] == null);
}

export function isCruelCheckinPole(axis: TraitAxis, value: number | null | undefined): boolean {
  const pole = traitBand(value);
  if (!pole) return false;
  return CRUEL_CHECKIN_POLES.some((row) => row.axis === axis && row.band === pole);
}

export function isGraduatedAxis(state: SageKnowsState, axis: TraitAxis): boolean {
  if (state.graduated[axis]) return true;
  return (state.streaks[axis] ?? 0) >= SAGE_KNOWS_GRADUATE_STREAK;
}

function touchedYmd(touched: TraitTouched, axis: TraitAxis, timeZone: string): string | null {
  const iso = touched[axis];
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return localYmd(date, timeZone);
}

export function axisPastCooldown(
  touched: TraitTouched,
  axis: TraitAxis,
  todayYmd: string,
  timeZone: string,
  cooldownDays: number = SAGE_KNOWS_COOLDOWN_DAYS,
): boolean {
  const wrote = touchedYmd(touched, axis, timeZone);
  if (!wrote) return true;
  return daysBetweenYmd(wrote, todayYmd) >= cooldownDays;
}

export function eligibleSageKnowsAxes(input: {
  values: TraitValues;
  touched: TraitTouched;
  knows: SageKnowsState;
  todayYmd: string;
  timeZone: string;
}): TraitAxis[] {
  return TRAIT_AXES.filter((axis) => {
    if (input.values[axis] == null) return false;
    if (traitBand(input.values[axis]) === 'mid') return false;
    if (isCruelCheckinPole(axis, input.values[axis])) return false;
    if (isGraduatedAxis(input.knows, axis)) return false;
    if (!axisPastCooldown(input.touched, axis, input.todayYmd, input.timeZone)) return false;
    if (!traitPoleLine(axis, input.values[axis])) return false;
    return true;
  });
}

/**
 * Round-robin through eligible axes after `last_axis`. Oldest last_touched
 * is only a tiebreak when there is no cursor (first show) — never a way
 * for a newly-set axis to jump the queue.
 */
export function pickSageKnowsAxis(
  eligible: readonly TraitAxis[],
  lastAxis: TraitAxis | null,
  touched: TraitTouched,
): TraitAxis | null {
  if (eligible.length === 0) return null;
  const pool =
    lastAxis && eligible.includes(lastAxis) && eligible.length > 1
      ? eligible.filter((axis) => axis !== lastAxis)
      : [...eligible];
  if (pool.length === 0) return null;

  if (lastAxis == null) {
    const ranked = [...pool].sort((a, b) => {
      const at = touched[a] ?? '';
      const bt = touched[b] ?? '';
      if (at !== bt) return at.localeCompare(bt);
      return TRAIT_AXES.indexOf(a) - TRAIT_AXES.indexOf(b);
    });
    return ranked[0] ?? null;
  }

  const start = TRAIT_AXES.indexOf(lastAxis);
  for (let step = 1; step <= TRAIT_AXES.length; step += 1) {
    const axis = TRAIT_AXES[(start + step) % TRAIT_AXES.length];
    if (pool.includes(axis)) return axis;
  }
  return pool[0] ?? null;
}

function secondPerson(line: string): string {
  return line.replace(/\bThey\b/g, 'You').replace(/\bthey\b/g, 'you');
}

function knockLead(chip: string): string {
  switch (chip) {
    case 'sleep':
      return 'Sleep showed up this week';
    case 'workload':
      return 'Workload showed up this week';
    case 'people/conflict':
      return 'People / conflict showed up this week';
    case 'health':
      return 'Health showed up this week';
    case 'money':
      return 'Money showed up this week';
    default:
      return 'Something you named as a knock-off showed up this week';
  }
}

function signalLead(signal: NudgeSignal): string {
  if (signal.kind === 'skip-pattern') return 'A few skips this week';
  if (signal.kind === 'knock') return knockLead(signal.detail);
  return 'Something you told Sage is still in play this week';
}

export function composeSageKnowsLine(bankLine: string, signal: NudgeSignal | null): {
  line: string;
  kind: SageKnowsPrompt['kind'];
} {
  const clause = secondPerson(bankLine).replace(/\.$/, '');
  if (!signal) {
    return { line: `${clause}. Still in the neighborhood?`, kind: 'check-in' };
  }
  return {
    line: `${signalLead(signal)} — ${clause.charAt(0).toLowerCase()}${clause.slice(1)}. Still how it works?`,
    kind: 'signal',
  };
}

export function youTabSoftAsk(
  values: TraitValues,
  touched: TraitTouched,
  todayYmd: string,
  timeZone: string,
): YouTabSoftAsk | null {
  if (hasUnfilledTraitAxis(values)) return 'completeness';
  const stale = TRAIT_AXES.some((axis) => {
    if (values[axis] == null) return false;
    const wrote = touchedYmd(touched, axis, timeZone);
    if (!wrote) return true;
    return daysBetweenYmd(wrote, todayYmd) >= SAGE_KNOWS_THREE_MONTH_DAYS;
  });
  return stale ? 'three_month' : null;
}

export function weekSlotTaken(
  knows: SageKnowsState,
  weekKey: string,
): SageKnowsWeekSlot | SageKnowsWeekDone | null {
  if (knows.week_key !== weekKey) return null;
  if (knows.week_slot === 'game_invite') return 'game_invite';
  if (knows.week_slot === 'ranking') return 'ranking';
  if (knows.week_done === 'dismissed' || knows.week_done === 'answered') return knows.week_done;
  return null;
}

/** You/Settings claim. Completeness UI later; ranking yields when this is set. */
export function youTabSlotTaken(knows: SageKnowsState, weekKey: string): YouTabSoftAsk | null {
  if (knows.you_week_key !== weekKey) return null;
  return knows.you_slot;
}

export function applyCompletenessWeek(state: SageKnowsState, weekKey: string): SageKnowsState {
  return {
    ...state,
    you_week_key: weekKey,
    you_slot: 'completeness',
  };
}

export function resolveSageKnows(input: {
  values: TraitValues;
  touched: TraitTouched;
  knows: SageKnowsState;
  knocksYouOff: string;
  facts: string[];
  history: CheckHistory[];
  now: Date;
  timeZone: string;
}): SageKnowsPrompt | null {
  if (hasUnfilledTraitAxis(input.values)) return null;
  const todayYmd = localYmd(input.now, input.timeZone);
  const weekKey = sageKnowsWeekKey(todayYmd);
  const taken = weekSlotTaken(input.knows, weekKey);
  if (taken) return null;

  const eligible = eligibleSageKnowsAxes({
    values: input.values,
    touched: input.touched,
    knows: input.knows,
    todayYmd,
    timeZone: input.timeZone,
  });
  const axis = pickSageKnowsAxis(eligible, input.knows.last_axis, input.touched);
  if (!axis) return null;
  const bank = traitPoleLine(axis, input.values[axis]);
  if (!bank) return null;
  if (!(axis in TRAIT_POLE_LINES)) return null;

  const signal = findNudgeSignal({
    knocksYouOff: input.knocksYouOff,
    facts: input.facts,
    history: input.history,
  });
  const composed = composeSageKnowsLine(bank, signal);
  if (composed.line.trim().length === 0) return null;
  if (containsFrameworkTerm(composed.line)) {
    const fallback = composeSageKnowsLine(bank, null);
    if (containsFrameworkTerm(fallback.line)) return null;
    return { axis, line: fallback.line, kind: 'check-in' };
  }
  return { axis, line: composed.line, kind: composed.kind };
}

function withWeek(
  state: SageKnowsState,
  axis: TraitAxis,
  weekKey: string,
  done: SageKnowsWeekDone,
): SageKnowsState {
  return {
    ...state,
    last_axis: axis,
    week_key: weekKey,
    week_slot: 'sage_knows',
    week_done: done,
  };
}

export function applySageKnowsStillFits(
  state: SageKnowsState,
  axis: TraitAxis,
  weekKey: string,
  nowIso: string,
): SageKnowsState {
  const streak = (state.streaks[axis] ?? 0) + 1;
  const streaks = { ...state.streaks, [axis]: streak };
  const graduated = { ...state.graduated };
  if (streak >= SAGE_KNOWS_GRADUATE_STREAK) graduated[axis] = nowIso;
  return { ...withWeek(state, axis, weekKey, 'answered'), streaks, graduated };
}

export function applySageKnowsNotQuite(
  state: SageKnowsState,
  axis: TraitAxis,
  weekKey: string,
): SageKnowsState {
  const streaks = { ...state.streaks };
  delete streaks[axis];
  const graduated = { ...state.graduated };
  delete graduated[axis];
  return { ...withWeek(state, axis, weekKey, 'answered'), streaks, graduated };
}

export function applySageKnowsDismiss(
  state: SageKnowsState,
  axis: TraitAxis,
  weekKey: string,
): SageKnowsState {
  return withWeek(state, axis, weekKey, 'dismissed');
}

/** Later box: game invite claims the Home/Sage week so this cannot also show. */
export function applyGameInviteWeek(state: SageKnowsState, weekKey: string): SageKnowsState {
  return {
    ...state,
    week_key: weekKey,
    week_slot: 'game_invite',
    week_done: 'answered',
  };
}

/** Scenario swipe-deck claims the Home/Sage week (game invite slot). */
export function applyScenarioWeek(
  state: SageKnowsState,
  axis: TraitAxis,
  weekKey: string,
  done: SageKnowsWeekDone,
): SageKnowsState {
  return {
    ...state,
    week_key: weekKey,
    week_slot: 'game_invite',
    week_done: done,
    scenario_last_axis: axis,
  };
}

/** Ranking claims the Home/Sage week. Same budget as Does-Sage-know-you. */
export function applyRankingWeek(
  state: SageKnowsState,
  axis: TraitAxis,
  weekKey: string,
  done: SageKnowsWeekDone,
): SageKnowsState {
  return {
    ...state,
    week_key: weekKey,
    week_slot: 'ranking',
    week_done: done,
    ranking_last_axis: axis,
  };
}

/** Later box: 3-month Settings prompt lifts graduation. */
export function clearSageKnowsGraduation(state: SageKnowsState, axis: TraitAxis): SageKnowsState {
  const streaks = { ...state.streaks };
  delete streaks[axis];
  const graduated = { ...state.graduated };
  delete graduated[axis];
  return { ...state, streaks, graduated };
}
