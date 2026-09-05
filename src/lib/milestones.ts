/**
 * Generic milestone definitions and crossing check.
 * Distinct from me.milestones_celebrated (presence-streak celebrations in
 * NavPixel/useGrowth) — this is a separate mechanism, not wired to any
 * metric or screen yet.
 */

export type MilestoneMetric = 'bankTotalProgress';

export interface MilestoneDef {
  id: string;
  metric: MilestoneMetric;
  threshold: number;
  title: string;
  body: string;
}

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
