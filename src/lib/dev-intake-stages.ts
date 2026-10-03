import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';
import {
  STABILITY_FLOOR_N,
  applyEwmaAnswer,
  emptyTrack,
  trackFor,
  type TraitTrack,
} from '@/lib/trait-stability';
import { LEGACY_INTAKE_AXIS_COUNTS } from '@/lib/questions/bank';
import { INTAKE_SET_SIZE } from '@/lib/questions/intake-stage';
import { bankQuestionCount } from '@/lib/questions/local';
import { allocateRound } from '@/lib/questions/tiered-axis-plan';

/* ---------------------------------------------------------------------------
 * "Jump this account" presets — put the signed-in account at a known point in
 * the question flow without answering anything.
 *
 * Progress is never stored as a counter: `bankTotalProgress`
 * (questions/local.ts) derives it live by summing each axis's report-track
 * `answer_count`, capped at that axis's bank size. So "jump to N answered" is
 * exactly "write per-axis answer_count rows" — no schema change, no fake
 * question_items rows — and every real predicate (the full-profile gate, the
 * settled count, Story and category readiness) reads the seeded state through
 * its normal path rather than being stubbed.
 *
 * FAITHFUL BY CONSTRUCTION (2026-10-01). A jump must leave the account where
 * real answering would have, or the next real answer behaves differently:
 *   - Source is `self_situation`, the source a real question answer writes. It
 *     used to be `self_scenario`, a DIRECT source, which made every later real
 *     answer count-only (me.ts `collectAnswers`): scores never moved again and
 *     no trait could ever settle.
 *   - Each track row is the real `applyEwmaAnswer` run N times on the preset
 *     value, not a hand-set stability. A flat 0.8 over-read a 2-answer axis.
 *
 * The bank is 3 per trait, 48 total, asked as 3 sets of 16 (staged intake,
 * 2026-10-02). "Old 50" seeds the shape an account that finished the old
 * tiered intake has (6/6/6, 4/4/4, 2 on the other ten), to test that it keeps
 * every unlock.
 *
 * Pure, and deliberately free of the supabase client, so
 * scripts/dev-test-user-check can import and run these functions for real
 * rather than mirroring their arithmetic. The write side lives in
 * dev-test-user.ts's applyDevIntakeStagePreset.
 * ------------------------------------------------------------------------ */

export type DevIntakeStageId =
  | 'first-read'
  | 'set-two'
  | 'one-short'
  | 'intake-done'
  | 'round-one-done'
  | 'old-fifty';

/**
 * One coherent profile shared by every stage, so the only thing changing
 * between them is HOW MANY answers are recorded — which is what is being
 * tested.
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

/** What a real question answer writes. Inferred, so later answers still blend. */
export const DEV_INTAKE_PRESET_SOURCE = 'self_situation';

export type DevAnswerPlan = Record<TraitAxis, number>;

export interface DevIntakeStage {
  stage: DevIntakeStageId;
  label: string;
  hint: string;
  /** Per-axis report answer counts this stage leaves. */
  plan: () => DevAnswerPlan;
}

/** How many questions the intake bank holds (48). */
export function devBankSize(): number {
  return TRAIT_AXES.reduce((sum, axis) => sum + bankQuestionCount([axis]), 0);
}

/**
 * Per-axis report-track answer_count whose capped sum is exactly `total`.
 *
 * Round-robin over TRAIT_AXES, skipping any axis already at its bank size, so
 * the plan sums to exactly the requested total for any N up to the bank.
 * Refuses above it rather than silently clamping: the stage past the intake
 * builds on this with `planAfterRoundOne` instead. Round-robin means 16 is
 * exactly set 1 and 32 exactly set 2.
 */
export function devIntakeAnswerPlan(total: number): DevAnswerPlan {
  const plan = {} as DevAnswerPlan;
  for (const axis of TRAIT_AXES) plan[axis] = 0;
  const capacity = devBankSize();
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
 * The 48, plus exactly the round the app would compose next: `allocateRound`
 * run on the finished intake, so this can never drift from the real round.
 */
export function planAfterRoundOne(): DevAnswerPlan {
  const plan = devIntakeAnswerPlan(devBankSize());
  const nowIso = new Date().toISOString();
  const round = allocateRound(devIntakeTracks(DEV_INTAKE_PRESET_VALUES, plan, nowIso));
  for (const axis of TRAIT_AXES) plan[axis] += round[axis] ?? 0;
  return plan;
}

/** The shape of an account that finished the OLD tiered 50 (ten traits at 2). */
export function planOldFifty(): DevAnswerPlan {
  const plan = {} as DevAnswerPlan;
  for (const axis of TRAIT_AXES) plan[axis] = LEGACY_INTAKE_AXIS_COUNTS[axis] ?? 0;
  return plan;
}

/** Every trait at the 3-answer floor: the least that reads 16 of 16 (= the 48). */
export function planAllSettled(): DevAnswerPlan {
  const plan = devIntakeAnswerPlan(devBankSize());
  for (const axis of TRAIT_AXES) plan[axis] = Math.max(plan[axis], STABILITY_FLOOR_N);
  return plan;
}

export const DEV_INTAKE_STAGES: readonly DevIntakeStage[] = [
  {
    stage: 'first-read',
    label: `First read (set 1, ${INTAKE_SET_SIZE} of 48)`,
    hint: 'One answer on every trait: a first lean everywhere, set 2 next.',
    plan: () => devIntakeAnswerPlan(INTAKE_SET_SIZE),
  },
  {
    stage: 'set-two',
    label: `Set 2 done (${INTAKE_SET_SIZE * 2} of 48)`,
    hint: 'Two answers on every trait. Set 3 next; nothing settled yet.',
    plan: () => devIntakeAnswerPlan(INTAKE_SET_SIZE * 2),
  },
  {
    stage: 'one-short',
    label: 'One short (47 of 48)',
    hint: 'One question left. Answer it to see the full-profile reveal for real.',
    plan: () => devIntakeAnswerPlan(devBankSize() - 1),
  },
  {
    stage: 'intake-done',
    label: 'Finished the 48',
    hint: 'Home unlocked, the reveal shows again, 16 of 16 settled, "Next 16" on offer.',
    plan: () => devIntakeAnswerPlan(devBankSize()),
  },
  {
    stage: 'round-one-done',
    label: 'Round 1 finished',
    hint: 'The 48 plus the round the app would build next (64 answers). Scores only: no saved round, so no round +21.',
    plan: planAfterRoundOne,
  },
  {
    stage: 'old-fifty',
    label: 'Finished the old 50',
    hint: 'The shape the old intake left (ten traits at 2). Everything stays open; those ten show their third question as optional.',
    plan: planOldFifty,
  },
];

export function devIntakeStageById(stage: DevIntakeStageId): DevIntakeStage | null {
  return DEV_INTAKE_STAGES.find((row) => row.stage === stage) ?? null;
}

export function devPlanTotal(plan: DevAnswerPlan): number {
  return TRAIT_AXES.reduce((sum, axis) => sum + (plan[axis] ?? 0), 0);
}

/**
 * Which stage the account is sitting on right now, by its report answer
 * counts — so the menu can mark "you are here". Null when it matches none
 * (real answers, or a different point).
 */
export function devStageMatching(tracks: readonly TraitTrack[]): DevIntakeStageId | null {
  for (const stage of DEV_INTAKE_STAGES) {
    const plan = stage.plan();
    if (TRAIT_AXES.every((axis) => (trackFor(tracks, axis, 'report')?.answerCount ?? 0) === plan[axis])) {
      return stage.stage;
    }
  }
  return null;
}

/**
 * Track rows for a plan: for each axis, the real `applyEwmaAnswer` run
 * `plan[axis]` times on the preset value, so value, stability and count are
 * what the same number of agreeing answers would have produced. Both tracks
 * get the same rows: the game track is not what progress reads, but leaving it
 * stale would make told-vs-played divergence disagree with the seeded state.
 * `values` null (or a zero count) writes the neutral empty row — NOT NULL in
 * the table, and the client cannot delete track rows.
 */
export function devIntakeTracks(
  values: Record<TraitAxis, number> | null,
  plan: DevAnswerPlan,
  nowIso: string,
): TraitTrack[] {
  const rows: TraitTrack[] = [];
  for (const axis of TRAIT_AXES) {
    const answerCount = values ? (plan[axis] ?? 0) : 0;
    for (const track of ['report', 'game'] as const) {
      let row: TraitTrack = { ...emptyTrack(axis, track), value: values ? values[axis] : 0.5, lastTouched: nowIso };
      for (let i = 0; i < answerCount; i += 1) {
        row = applyEwmaAnswer(i === 0 ? null : row, axis, track, values![axis], nowIso);
      }
      rows.push(row);
    }
  }
  return rows;
}

/**
 * The answer-history rows a plan stands for, in the order answering would have
 * written them (round-robin by axis). Since wave78 the first +21 reads the
 * trait tracks (every trait at 3) — these rows only matter for the old-50 rule
 * (50 `self_situation` rows), which is kept so nobody who qualified loses it.
 */
export function devHistoryRows(
  plan: DevAnswerPlan,
  limit: number,
): { axis: TraitAxis; value: number; source: typeof DEV_INTAKE_PRESET_SOURCE }[] {
  const rows: { axis: TraitAxis; value: number; source: typeof DEV_INTAKE_PRESET_SOURCE }[] = [];
  const left = { ...plan };
  let progressed = true;
  while (rows.length < limit && progressed) {
    progressed = false;
    for (const axis of TRAIT_AXES) {
      if (rows.length >= limit) break;
      if ((left[axis] ?? 0) <= 0) continue;
      left[axis] -= 1;
      rows.push({ axis, value: DEV_INTAKE_PRESET_VALUES[axis], source: DEV_INTAKE_PRESET_SOURCE });
      progressed = true;
    }
  }
  return rows;
}
