/**
 * Generic milestone definitions and crossing check, wired into
 * src/app/(tabs)/intake-sweep.tsx's crossedMilestonesFor. Replaces the old
 * one-time presence-milestone celebration (me.milestones_celebrated /
 * PRESENCE_MILESTONES, removed 2026-09-06 — confirmed zero real-account
 * firings) — current_streak below is the real day-streak equivalent.
 */
import { bankQuestionCount } from '@/lib/questions/local';
import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';

export type MilestoneMetric =
  | 'bankTotalProgress'
  | 'profile_percent'
  | 'current_streak'
  | `axisComplete:${TraitAxis}`;

export interface MilestoneDef {
  id: string;
  metric: MilestoneMetric;
  threshold: number;
  title: string;
  body: string;
}

/**
 * Overrides for axes whose plain humanized name hits the framework fence
 * (src/lib/voice/framework-fence.ts PHRASES: "growth mindset", "locus of
 * control", "self efficacy" are banned framework terms). Every other axis
 * humanizes fine as-is.
 */
const AXIS_DISPLAY_OVERRIDES: Partial<Record<TraitAxis, string>> = {
  growth_mindset: 'growth',
  locus_of_control: 'control',
  self_efficacy: 'confidence',
};

/** Placeholder copy — unreviewed. "attachment_anxiety" -> "attachment anxiety". */
function humanizeAxis(axis: TraitAxis): string {
  return AXIS_DISPLAY_OVERRIDES[axis] ?? axis.replace(/_/g, ' ');
}

/**
 * One entry per axis, threshold = that axis's own bank draft count (not
 * hardcoded — reads bankQuestionCount so this stays correct if the bank's
 * per-axis draft count ever changes). Metric is per-axis so the caller
 * passes axisVariant(tracks, axis) as currentValue for that one axis;
 * checkMilestones itself needs no change to support this.
 */
const AXIS_COMPLETE_DEFS: readonly MilestoneDef[] = TRAIT_AXES.map((axis) => ({
  id: `axis_complete_${axis}`,
  metric: `axisComplete:${axis}` as const,
  threshold: bankQuestionCount([axis]),
  title: `${humanizeAxis(axis)} axis complete`,
  body: `You've completed the ${humanizeAxis(axis)} axis!`,
}));

export const MILESTONE_DEFS: readonly MilestoneDef[] = [
  {
    id: 'answers_12',
    metric: 'bankTotalProgress',
    threshold: 12,
    title: '12 answers in',
    body: 'You have answered 12 questions from the bank.',
  },
  {
    id: 'answers_24',
    metric: 'bankTotalProgress',
    threshold: 24,
    title: '24 answers in',
    body: 'You have answered 24 questions from the bank.',
  },
  {
    id: 'answers_36',
    metric: 'bankTotalProgress',
    threshold: 36,
    title: '36 answers in',
    body: 'You have answered 36 questions from the bank.',
  },
  {
    id: 'answers_48',
    metric: 'bankTotalProgress',
    threshold: 48,
    title: '48 answers in',
    body: 'You have answered every question in the bank.',
  },
  {
    id: 'profile_50',
    metric: 'profile_percent',
    threshold: 50,
    title: 'Halfway there',
    body: "You've completed half of your profile!",
  },
  {
    id: 'streak_3',
    metric: 'current_streak',
    threshold: 3,
    title: '3-day streak',
    body: "You've checked in 3 days in a row.",
  },
  {
    id: 'streak_7',
    metric: 'current_streak',
    threshold: 7,
    title: '7-day streak',
    body: "You've checked in 7 days in a row.",
  },
  {
    id: 'streak_21',
    metric: 'current_streak',
    threshold: 21,
    title: '21-day streak',
    body: "You've checked in 21 days in a row.",
  },
  ...AXIS_COMPLETE_DEFS,
];

/**
 * Returns MILESTONE_DEFS entries for `metric` whose threshold `currentValue`
 * has reached, and whose id is not already in `celebratedIds`.
 */
export function checkMilestones(
  metric: MilestoneMetric,
  currentValue: number,
  celebratedIds: readonly string[],
): MilestoneDef[] {
  const celebrated = new Set(celebratedIds);
  return MILESTONE_DEFS.filter(
    (def) => def.metric === metric && currentValue >= def.threshold && !celebrated.has(def.id),
  );
}
