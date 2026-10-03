/**
 * Generic milestone definitions and crossing check, wired into
 * src/app/(tabs)/intake-sweep.tsx's crossedMilestonesFor. Replaces the old
 * one-time presence-milestone celebration (me.milestones_celebrated /
 * PRESENCE_MILESTONES, removed 2026-09-06 — confirmed zero real-account
 * firings) — current_streak below is the real day-streak equivalent.
 */
import { INTAKE_TOTAL } from '@/lib/questions/intake-stage';
import { bankQuestionCount } from '@/lib/questions/local';
import {
  INTAKE_SET_PAYOFF_LINES,
  INTAKE_SET_PAYOFF_TITLES,
  intakeRevealTitle,
} from '@/lib/questions/staged-intake-copy';
import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';

export type MilestoneMetric =
  /** `intakeStage(tracks)` — 1, 2, 3 = set 1, 2, 3 of the intake done. */
  | 'intakeStage'
  | 'bankTotalProgress'
  | 'profile_percent'
  | 'current_streak'
  | 'profile_settled'
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
export function humanizeAxis(axis: TraitAxis): string {
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
  /*
   * The intake's three sets (staged intake, 2026-10-02). Each set ends with a
   * payoff the mini guy says. Set 3 is the full-profile reveal itself
   * (`profile_fully_unlocked` below), so it is not repeated as a bubble.
   * The old answers_12/24/36/50 count milestones were retired with the 50;
   * accounts that crossed them keep them in celebrated_milestone_ids, unread.
   */
  {
    id: 'intake_set_1',
    metric: 'intakeStage',
    threshold: 1,
    title: INTAKE_SET_PAYOFF_TITLES[0]!,
    body: INTAKE_SET_PAYOFF_LINES[0]!,
  },
  {
    id: 'intake_set_2',
    metric: 'intakeStage',
    threshold: 2,
    title: INTAKE_SET_PAYOFF_TITLES[1]!,
    body: INTAKE_SET_PAYOFF_LINES[1]!,
  },
  {
    // Id kept (progressive unlock §6). Sage is a placeholder, so this is
    // remembered silently (use-buddy-milestones) — set 2's payoff is the line.
    id: 'sage_unlocked',
    metric: 'intakeStage',
    threshold: 2,
    title: 'Set 2 done',
    body: 'Two answers on every trait.',
  },
  {
    id: 'profile_50',
    metric: 'profile_percent',
    threshold: 50,
    title: 'Halfway there',
    body: 'Half of your traits have settled. The other half is still deciding.',
  },
  {
    id: 'streak_3',
    metric: 'current_streak',
    threshold: 3,
    title: '3-day streak',
    body: 'Three days in a row. That counts as a pattern now.',
  },
  {
    id: 'streak_7',
    metric: 'current_streak',
    threshold: 7,
    title: '7-day streak',
    body: 'Seven days straight. A whole week of showing up.',
  },
  {
    id: 'streak_21',
    metric: 'current_streak',
    threshold: 21,
    title: '21-day streak',
    body: 'Twenty-one days. This is just part of the day now.',
  },
  {
    // Fires at the full profile, the same crossing as `legendsUnlocked`
    // (progressive-unlock.ts). Remembered silently: Legends is a placeholder.
    id: 'legends_unlocked',
    metric: 'intakeStage',
    threshold: 3,
    title: `All ${INTAKE_TOTAL} answered`,
    body: 'Legends is being rebuilt, so it is not open yet.',
  },
  {
    // Separate from legends_unlocked above per §6: "plus a separate 'you are
    // now fully unlocked' banner" — same full-profile crossing, distinct copy.
    id: 'profile_fully_unlocked',
    metric: 'intakeStage',
    threshold: 3,
    // The after-intake reveal (components/full-profile-banner.tsx) shows this
    // title and body (INTAKE_REVEAL_MILESTONE_ID). Set 3's payoff line.
    title: intakeRevealTitle(INTAKE_TOTAL),
    body: INTAKE_SET_PAYOFF_LINES[2]!,
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
