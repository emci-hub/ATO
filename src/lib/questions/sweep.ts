/**
 * Full-sweep mode: one item per axis, all TRAIT_AXES, one batch.
 * Distinct from the 5-item soft-rotation used by Tell Sage more.
 */
import { composeLocalSweep } from './local';
import type { TraitTrack } from '@/lib/trait-stability';
import type { QuotaDecision } from '@/lib/voice/quota';
import type { TalkStyle } from '@/lib/voice/types';
import type { QuestionDraft } from './types';

export {
  INTAKE_SWEEP_COPY_REVIEWED,
  QUESTIONS_SWEEP_SIZE,
  axisVariant,
  bankByAxis,
  bankDraftFor,
  bankLeadDrafts,
  composeLocalSweep,
  unansweredSweep,
} from './local';

export type SweepKind = 'questions' | 'crisis' | 'quota';

export interface RouteQuestionSweepResult {
  kind: SweepKind;
  drafts: QuestionDraft[];
}

/**
 * One item per axis, always from the fixed local bank — no model call.
 * Does not touch the 5-item rotation used by Tell Sage more.
 *
 * No AI-consent gate: unlike `routeQuestions`, this path never calls a model,
 * so there is nothing consent would be protecting. It used to gate on
 * `aiConsent` from when this was AI-backed; that gate outlived the rewrite to
 * `composeLocalSweep` and quietly blocked a purely local feature behind an
 * unrelated permission (2026-09-15 — found via a report that Home's link to
 * the 50-question bank dead-ended for anyone who hadn't answered the AI
 * prompt). Still gated on crisis, which is a real safety concern here.
 *
 * `aiConsent`, `useLocal` and `claimBatch` are accepted for call-site
 * compatibility with the prior AI-backed version but are no longer read.
 *
 * NOTE: this path deliberately has NO profile-completeness gate, unlike
 * `routeQuestions`. The sweep's whole job is to fill every axis in one pass, so
 * gating it on a filled profile would make it unreachable exactly when it is
 * most useful.
 *
 * T-04, deliberately NOT wired here: `contradictedAxesFrom` (`trait-history.ts`)
 * has no plug-in point in this path — the sweep always serves ALL TRAIT_AXES
 * in one pass, unconditionally (`composeLocalSweep`), with no priority/
 * ordering concept at all (unlike `routeQuestions`'s `priorityAxes`/
 * `contradictedAxes`). Wiring contradiction-awareness here would mean adding
 * an ordering mechanism to a path whose whole point is "everything, in a
 * fixed pass" — a bigger, separate change, not a trivial one. `questions-fold.tsx`
 * (Tell Sage more / the 5-item rotation) is the one caller wired to real
 * `contradictedAxes` data.
 */
export async function routeQuestionSweep(input: {
  me: { name: string; talk_style: TalkStyle; voice_preset: string };
  /** No longer read — the local sweep calls no model, so there's nothing to consent to. Kept for call-site compatibility. */
  aiConsent?: boolean | null;
  crisisToday?: boolean;
  useLocal?: boolean;
  claimBatch?: () => Promise<QuotaDecision>;
  /**
   * Report tracks. Each axis's `answerCount` picks which of its three bank
   * drafts to show. Omitted/empty = the locked draft for every axis, which is
   * exactly what a brand-new profile should see.
   */
  tracks?: readonly TraitTrack[];
}): Promise<RouteQuestionSweepResult> {
  if (input.crisisToday) return { kind: 'crisis', drafts: [] };

  return { kind: 'questions', drafts: composeLocalSweep(input.tracks ?? []) };
}
