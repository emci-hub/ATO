/**
 * Full-sweep mode: one item per axis, all TRAIT_AXES, one batch.
 * Distinct from the 5-item soft-rotation used by Tell Sage more.
 */
import { composeLocalSweep } from './local';
import type { QuotaDecision } from '@/lib/voice/quota';
import type { TalkStyle } from '@/lib/voice/types';
import type { QuestionDraft } from './types';

export {
  INTAKE_SWEEP_COPY_REVIEWED,
  QUESTIONS_SWEEP_SIZE,
  bankByAxis,
  bankDraftFor,
  bankLeadDrafts,
  composeLocalSweep,
  unansweredSweep,
} from './local';

export type SweepKind =
  | 'questions'
  | 'consent-pending'
  | 'consent-denied'
  | 'crisis'
  | 'quota';

export interface RouteQuestionSweepResult {
  kind: SweepKind;
  drafts: QuestionDraft[];
}

/**
 * One item per axis, always from the fixed local bank — no model call.
 * Does not touch the 5-item rotation used by Tell Sage more.
 *
 * Gated consent → crisis, same as before. No quota claim: a deterministic
 * bank costs no model call, so there is nothing to meter.
 *
 * `useLocal` and `claimBatch` are accepted for call-site compatibility with
 * the prior AI-backed version but are no longer read.
 *
 * NOTE: this path deliberately has NO profile-completeness gate, unlike
 * `routeQuestions`. The sweep's whole job is to fill every axis in one pass, so
 * gating it on a filled profile would make it unreachable exactly when it is
 * most useful.
 */
export async function routeQuestionSweep(input: {
  me: { name: string; talk_style: TalkStyle; voice_preset: string };
  aiConsent?: boolean | null;
  crisisToday?: boolean;
  useLocal?: boolean;
  claimBatch?: () => Promise<QuotaDecision>;
}): Promise<RouteQuestionSweepResult> {
  const consent = input.aiConsent ?? null;
  if (consent === false) return { kind: 'consent-denied', drafts: [] };
  if (consent !== true) return { kind: 'consent-pending', drafts: [] };
  if (input.crisisToday) return { kind: 'crisis', drafts: [] };

  return { kind: 'questions', drafts: composeLocalSweep() };
}
