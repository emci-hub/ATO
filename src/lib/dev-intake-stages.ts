import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';
import type { TraitTrack } from '@/lib/trait-stability';
import { bankQuestionCount } from '@/lib/questions/local';
import {
  LEGENDS_UNLOCK_THRESHOLD,
  SAGE_UNLOCK_THRESHOLD,
} from '@/lib/questions/progressive-unlock';

/* ---------------------------------------------------------------------------
 * Intake-stage presets — jump the dev-test account to a known point in the
 * onboarding / frozen-intake flow without filling a single form.
 *
 * Progress across the 50-question frozen intake is never stored as a counter:
 * `bankTotalProgress` (questions/local.ts) derives it live by summing each
 * axis's report-track `answer_count`, capped at that axis's bank size. So
 * "seed the user to N answered" is exactly "write per-axis answer_count rows
 * that sum to N under those caps" — no schema change, no fake question_items
 * rows, and the real `sageUnlocked` / `legendsUnlocked` predicates then read
 * the seeded state through their normal path rather than being stubbed.
 *
 * The bank is NOT 3-per-axis: it is 6/6/6 on openness, conscientiousness and
 * extraversion, 4 each on agreeableness, conflict_assertiveness and
 * relatedness, and 2 on the remaining ten — 50 total. devIntakeAnswerPlan
 * therefore fills round-robin in TRAIT_AXES order, skipping axes that have hit
 * their cap, which both spreads the answers the way a real rotation would and
 * guarantees the plan sums to exactly the requested total for any N <= 50.
 *
 * Pure, and deliberately free of the supabase client, so
 * scripts/dev-test-user-check can import and run these functions for real
 * rather than mirroring their arithmetic. The write side — and the
 * pre-launch + dev-test-user guards that make it safe — lives in
 * dev-test-user.ts's applyDevIntakeStagePreset.
 * ------------------------------------------------------------------------ */

export type DevIntakeStageId =
  | 'fresh'
  | 'scenarios-only'
  | 'sage-boundary'
  | 'pre-legends'
  | 'legends';

/**
 * One coherent profile shared by every stage that has a profile at all, so the
 * only thing changing between 'scenarios-only', 'sage-boundary',
 * 'pre-legends' and 'legends' is HOW MANY intake answers are recorded — which
 * is the boundary being tested. Deliberately a flat top-level const, not an
 * entry in dev-test-user.ts's DEV_ARCHETYPE_PRESETS: scripts/dev-test-user-check
 * parses those four out of that file by indentation and must find exactly four.
 */
export const DEV_INTAKE_PRESET_VALUES: Record<TraitAxis, number> = {
  openness: 0.62,
  conscientiousness: 0.58,
  extraversion: 0.44,
  agreeableness: 0.66,
  steadiness: 0.52,
  attachment_anxiety: 0.38,
  attachment_avoidance: 0.42,
  conflict_assertiveness: 0.47,
  conflict_cooperativeness: 0.61,
  autonomy: 0.57,
  competence: 0.55,
  relatedness: 0.6,
  growth_mindset: 0.64,
  locus_of_control: 0.53,
  self_efficacy: 0.56,
  playfulness: 0.49,
};

/**
 * Scenario answers are a DIRECT source (self_scenario), so the optional phase
 * genuinely locks each axis against later inferred writes — that stickiness is
 * part of what the scenarios-only stage exists to test.
 */
export const DEV_INTAKE_PRESET_SOURCE = 'self_scenario';

/**
 * Stability written on every seeded track row that has answers. Clears
 * TITLE_STABLE_MIN; rows under STABILITY_FLOOR_N still read as unsettled
 * because effectiveStability floors on answerCount, not on this number.
 */
export const DEV_INTAKE_PRESET_STABILITY = 0.8;

/**
 * What the optional scenario phase alone leaves on the counter: 8 two-axis
 * scenarios = one report-track answer on each of the 16 axes. Equal to
 * TRAIT_AXES.length by construction, not by coincidence — every axis is
 * covered exactly once (OPTIONAL_INTAKE_TOTAL * 2 axes per screen).
 */
export const SCENARIO_PHASE_ANSWERS = TRAIT_AXES.length;

export interface DevIntakeStage {
  stage: DevIntakeStageId;
  label: string;
  /** Target `bankTotalProgress(tracks).answered` after the preset applies. */
  answered: number;
  /** Whether the me trait columns are cleared (null) rather than filled. */
  clearsProfile: boolean;
  hint: string;
}

export const DEV_INTAKE_STAGES: readonly DevIntakeStage[] = [
  {
    stage: 'fresh',
    label: 'Fresh signup',
    answered: 0,
    clearsProfile: true,
    hint: 'No traits, no scenario answers, the preference taps cleared. 0/50.',
  },
  {
    /**
     * 16, not 0. The optional phase's 8 two-axis scenarios write
     * `self_scenario`, which trackKindForSource routes to the REPORT track
     * (trait-stability.ts) and which is a direct source, so each of the 16
     * axis writes genuinely bumps answer_count by 1 — and bankTotalProgress
     * counts it. A real account that finished the scenarios and nothing else
     * therefore sits at 16/50, never 0/50, so seeding 0 would test a state no
     * user can reach. Still well under the Sage threshold, which is the point
     * of the stage.
     */
    stage: 'scenarios-only',
    label: 'Scenarios only',
    answered: SCENARIO_PHASE_ANSWERS,
    clearsProfile: false,
    hint: '16 axes locked direct (self_scenario) — 16/50, as a real scenario pass leaves it. Sage locked.',
  },
  {
    stage: 'sage-boundary',
    label: 'Sage boundary (25/50)',
    answered: SAGE_UNLOCK_THRESHOLD,
    clearsProfile: false,
    hint: 'Exactly at the Sage threshold. Sage unlocked, Legends locked.',
  },
  {
    stage: 'pre-legends',
    label: 'One short (49/50)',
    answered: LEGENDS_UNLOCK_THRESHOLD - 1,
    clearsProfile: false,
    hint: 'One answer short. Legends must still be locked.',
  },
  {
    stage: 'legends',
    label: 'Full intake (50/50)',
    answered: LEGENDS_UNLOCK_THRESHOLD,
    clearsProfile: false,
    hint: 'Whole bank answered. Legends unlocked.',
  },
];

export function devIntakeStageById(stage: DevIntakeStageId): DevIntakeStage | null {
  return DEV_INTAKE_STAGES.find((row) => row.stage === stage) ?? null;
}

/**
 * Per-axis report-track answer_count whose capped sum is exactly `total`.
 *
 * Round-robin over TRAIT_AXES, skipping any axis already at its bank size.
 * Pure and deterministic — scripts/dev-test-user-check runs it for every
 * stage and re-derives bankTotalProgress's arithmetic from it, so a bank edit
 * that changes an axis's question count is caught before it can make a preset
 * land on the wrong side of a threshold.
 */
export function devIntakeAnswerPlan(total: number): Record<TraitAxis, number> {
  const plan = {} as Record<TraitAxis, number>;
  let capacity = 0;
  for (const axis of TRAIT_AXES) {
    plan[axis] = 0;
    capacity += bankQuestionCount([axis]);
  }
  // Refuse rather than silently clamping: a stage asking for more than the
  // bank holds is a bug in the stage, and a clamped plan would quietly seed
  // the wrong number.
  if (total > capacity) {
    throw new Error(`Cannot plan ${total} answers — the bank holds ${capacity}`);
  }

  let remaining = Math.max(0, Math.floor(total));
  let progressed = true;
  while (remaining > 0 && progressed) {
    progressed = false;
    for (const axis of TRAIT_AXES) {
      if (remaining === 0) break;
      if (plan[axis] >= bankQuestionCount([axis])) continue;
      plan[axis] += 1;
      remaining -= 1;
      progressed = true;
    }
  }
  return plan;
}

/**
 * Track rows carrying a PER-AXIS answer_count, unlike devTracks above which
 * writes one count across every row. Both tracks get the same count: the game
 * track is not what bankTotalProgress reads, but leaving it stale would make
 * divergence and settled math disagree with the seeded state.
 */
export function devIntakeTracks(
  values: Record<TraitAxis, number> | null,
  plan: Record<TraitAxis, number>,
  nowIso: string,
): TraitTrack[] {
  const rows: TraitTrack[] = [];
  for (const axis of TRAIT_AXES) {
    const answerCount = plan[axis] ?? 0;
    for (const track of ['report', 'game'] as const) {
      rows.push({
        axis,
        track,
        // NOT NULL in the table. Mid is the neutral carrier when clearing.
        value: values ? values[axis] : 0.5,
        stability: answerCount > 0 ? DEV_INTAKE_PRESET_STABILITY : 0,
        answerCount,
        lastTouched: nowIso,
        lastDepthAt: null,
      });
    }
  }
  return rows;
}
