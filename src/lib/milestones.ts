/**
 * Generic milestone definitions and crossing check.
 * Distinct from me.milestones_celebrated (presence-streak celebrations in
 * NavPixel/useGrowth) — this is a separate mechanism, not wired to any
 * metric or screen yet.
 */
import { bankQuestionCount } from '@/lib/questions/local';
import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';

export type MilestoneMetric =
  | 'bankTotalProgress'
  | 'profile_percent'
  | 'bank_percent'
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
    id: 'profile_100',
    metric: 'bank_percent',
    threshold: 100,
    title: 'Profile complete',
    body: "You've completed your full profile!",
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
