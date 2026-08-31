/**
 * Scenario swipe-deck for the six extra axes. Path (c) Play instead.
 * One axis per card, two forced choices. Writes `self_game` (inferred).
 * Soft-ask: same weekly slot as ranking and Does-Sage-know-you.
 */
import { localYmd } from '@/lib/local-date';
import { resolveRanking } from '@/lib/ranking';
import {
  applyScenarioWeek,
  hasUnfilledTraitAxis,
  sageKnowsWeekKey,
  weekSlotTaken,
  youTabSlotTaken,
  type SageKnowsState,
} from '@/lib/sage-knows';
import {
  EXTRA_AXES,
  emptyTraitState,
  mergeTraitWrite,
  type TraitAxis,
  type TraitState,
  type TraitValues,
} from '@/lib/traits';
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';

export const SCENARIO_HIGH = 0.8;
export const SCENARIO_LOW = 0.2;

export type ExtraAxis = (typeof EXTRA_AXES)[number];
export type ScenarioPole = 'high' | 'low';

export interface ScenarioChoice {
  pole: ScenarioPole;
  label: string;
  value: number;
}

export interface ScenarioDef {
  axis: ExtraAxis;
  setup: string;
  high: ScenarioChoice;
  low: ScenarioChoice;
}

export interface ScenarioPrompt {
  axis: ExtraAxis;
  def: ScenarioDef;
  weekKey: string;
}

function choice(pole: ScenarioPole, label: string): ScenarioChoice {
  return {
    pole,
    label,
    value: pole === 'high' ? SCENARIO_HIGH : SCENARIO_LOW,
  };
}

/**
 * One axis per card. SDT is three cards, never a three-way pick.
 * Copy is banked; no framework names.
 */
export const SCENARIO_DECK: Record<ExtraAxis, ScenarioDef> = {
  locus_of_control: {
    axis: 'locus_of_control',
    setup: 'A project falls apart. First thought:',
    high: choice('high', "I could've done something differently"),
    low: choice('low', 'That was bound to happen'),
  },
  growth_mindset: {
    axis: 'growth_mindset',
    setup: 'You bomb a presentation. Gut reaction:',
    high: choice('high', 'Let me figure out what went wrong'),
    low: choice('low', "Guess I'm not good at this"),
  },
  self_efficacy: {
    axis: 'self_efficacy',
    setup: 'Big task, tight deadline. You feel:',
    high: choice('high', "I've got this"),
    low: choice('low', 'Not sure I can pull this off'),
  },
  autonomy: {
    axis: 'autonomy',
    setup: 'Best day at work is one where:',
    high: choice('high', 'I did it my way'),
    low: choice('low', 'I followed a plan that worked'),
  },
  competence: {
    axis: 'competence',
    setup: 'The work day that sticks with you most is one where:',
    high: choice('high', 'I nailed something hard'),
    low: choice('low', 'I got through the day fine'),
  },
  relatedness: {
    axis: 'relatedness',
    setup: 'A day at work actually feels good when:',
    high: choice('high', 'I connected with people'),
    low: choice('low', 'I got a lot done on my own'),
  },
};

/**
 * Second stems for the six extra axes. UNREVIEWED — same copy discipline
 * as crisis. Weekly Ask still uses SCENARIO_DECK only.
 */
export const SCENARIO_DECK_MORE: Record<ExtraAxis, ScenarioDef> = {
  locus_of_control: {
    axis: 'locus_of_control',
    setup: 'The thing you were counting on does not happen.',
    high: choice('high', 'What could I have set up differently'),
    low: choice('low', "That's just how it goes sometimes"),
  },
  growth_mindset: {
    axis: 'growth_mindset',
    setup: 'You flub a thing you thought you were decent at.',
    high: choice('high', 'Okay, what would I change next time'),
    low: choice('low', "Maybe that just isn't my thing"),
  },
  self_efficacy: {
    axis: 'self_efficacy',
    setup: 'A bigger-than-usual ask lands in your lap.',
    high: choice('high', 'I can figure this out'),
    low: choice('low', "Not sure I'm the one for this"),
  },
  autonomy: {
    axis: 'autonomy',
    setup: 'A friend offers to plan the whole day for you.',
    high: choice('high', "I'd rather pick it myself"),
    low: choice('low', 'Sure, save me the deciding'),
  },
  competence: {
    axis: 'competence',
    setup: 'Someone asks you to take the hard part of a shared job.',
    high: choice('high', 'Yeah, I can take that'),
    low: choice('low', "I'd rather they keep it"),
  },
  relatedness: {
    axis: 'relatedness',
    setup: 'A quiet evening, phone in the other room.',
    high: choice('high', "I'd rather have someone to check in with"),
    low: choice('low', 'Quiet on my own is enough'),
  },
};

export function isExtraAxis(axis: TraitAxis): axis is ExtraAxis {
  return (EXTRA_AXES as readonly string[]).includes(axis);
}

export function scenarioDefsFor(axis: ExtraAxis): ScenarioDef[] {
  return [SCENARIO_DECK[axis], SCENARIO_DECK_MORE[axis]];
}

/**
 * Standalone gut-call for one extra axis — no weekly Ask slot, no Home.
 * `preferAlt` uses the second stem when this axis already has a reading.
 */
export function scenarioForAxis(
  axis: ExtraAxis,
  preferAlt = false,
  weekKey = 'standalone',
): ScenarioPrompt | null {
  const def = preferAlt ? SCENARIO_DECK_MORE[axis] : SCENARIO_DECK[axis];
  if (!def) return null;
  const copy = `${def.setup} ${def.high.label} ${def.low.label}`;
  if (containsFrameworkTerm(copy)) return null;
  return { axis, def, weekKey };
}

export function pickScenarioAxis(
  values: TraitValues,
  last: TraitAxis | null,
): ExtraAxis | null {
  const unfilled = EXTRA_AXES.filter((axis) => values[axis] == null);
  if (unfilled.length === 0) return null;
  if (last == null || !(EXTRA_AXES as readonly string[]).includes(last)) {
    return unfilled[0] ?? null;
  }
  const start = EXTRA_AXES.indexOf(last as ExtraAxis);
  for (let step = 1; step <= EXTRA_AXES.length; step += 1) {
    const axis = EXTRA_AXES[(start + step) % EXTRA_AXES.length];
    if (unfilled.includes(axis)) return axis;
  }
  return unfilled[0] ?? null;
}

export function resolveScenario(input: {
  values: TraitValues;
  knows: SageKnowsState;
  now?: Date;
  timeZone: string;
}): ScenarioPrompt | null {
  const now = input.now ?? new Date();
  const timeZone = input.timeZone || 'UTC';
  const todayYmd = localYmd(now, timeZone);
  const weekKey = sageKnowsWeekKey(todayYmd);

  if (youTabSlotTaken(input.knows, weekKey) === 'completeness') return null;
  if (weekSlotTaken(input.knows, weekKey)) return null;
  if (resolveRanking(input) != null) return null;

  const axis = pickScenarioAxis(input.values, input.knows.scenario_last_axis);
  if (!axis) return null;
  const def = SCENARIO_DECK[axis];
  const copy = `${def.setup} ${def.high.label} ${def.low.label}`;
  if (containsFrameworkTerm(copy)) return null;
  return { axis, def, weekKey };
}

export function applyScenarioWrite(
  current: TraitState,
  axis: ExtraAxis,
  pole: ScenarioPole,
  nowIso: string = new Date().toISOString(),
): TraitState {
  const def = SCENARIO_DECK[axis];
  const value = pole === 'high' ? def.high.value : def.low.value;
  return mergeTraitWrite(current, { [axis]: value }, 'self_game', [axis], nowIso);
}

export function hasUnfilledExtraAxis(values: TraitValues): boolean {
  return EXTRA_AXES.some((axis) => values[axis] == null);
}

export { applyScenarioWeek, emptyTraitState, hasUnfilledTraitAxis };
