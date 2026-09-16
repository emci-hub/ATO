import type { CategoryId } from '@/lib/categories';
import type { TraitAxis } from '@/lib/traits';

export const QUESTIONS_BATCH_SIZE = 5;
export const QUESTIONS_CALL_TYPE = 'questions';

export interface QuestionOption {
  text: string;
  value: number;
}

export interface AxisWeight {
  axis: TraitAxis;
  /** 0-1. Primary-axis weights should dominate; secondary weights are weaker. */
  weight: number;
  /** Documented psychological/behavioral reason for this axis mapping. */
  reason?: string;
}

export interface QuestionDraft {
  axis: TraitAxis;
  /**
   * The category this question is filed under for the Questions-screen
   * category picker (additive, does not affect axis rotation/routing).
   * Deterministic: the first CATEGORY_DEFS entry (in defined order) whose
   * `axes` includes this question's axis. Only the static bank (bank.ts)
   * sets this — AI-generated drafts (parse.ts) have no fixed category, so
   * this stays optional rather than required.
   */
  category?: CategoryId;
  prompt: string;
  options: QuestionOption[];
  /**
   * Multi-axis question engine fields (additive, not yet consumed anywhere).
   * Absent on every existing bank/AI-generated draft today — `primaryAxesFor`
   * below is the backward-compatible read: a draft with none of these still
   * behaves exactly as a single-axis question at weight 1 on `axis`.
   */
  /** 1-2 axes this question is specifically designed to measure. */
  primaryAxes?: readonly AxisWeight[];
  /** 0-3 weaker, supporting axes. */
  secondaryAxes?: readonly AxisWeight[];
  /** Axes explicitly not touched by this question (prevents unsupported trait leakage). */
  excludedAxes?: readonly TraitAxis[];
  /** Dedup-by-meaning tags for future adaptive/redundancy-aware selection. */
  redundancyTags?: readonly string[];
  /**
   * Which question_bank_pool row (wave49) this draft came from — set by
   * bank-pool.ts, either drawn directly (fetchBankCandidates) or written
   * back after fresh AI generation (addToBankPool). Never set for the
   * static intake bank (bank.ts) or Infinite Questions drafts, which have
   * no bank-pool concept.
   */
  bankItemId?: string;
}

/**
 * Backward-compatible primary-axis view of a draft: explicit `primaryAxes` if
 * set, else the legacy single `axis` at weight 1. Nothing reads this yet —
 * groundwork for the scoring-apply loop, kept here so that loop and this
 * schema can't drift apart.
 */
export function primaryAxesFor(draft: QuestionDraft): readonly AxisWeight[] {
  return draft.primaryAxes ?? [{ axis: draft.axis, weight: 1 }];
}

export interface QuestionItemRow {
  id: string;
  packId: string;
  sortIndex: number;
  axis: TraitAxis;
  prompt: string;
  options: QuestionOption[];
  answeredOption: number | null;
  skippedAt: string | null;
}

export interface QuestionPackRow {
  id: string;
  generatedOn: string;
  createdAt: string;
  items: QuestionItemRow[];
}

export type QuestionGroundingKind = 'do' | 'read' | 'fact' | 'pattern' | 'none';

export interface QuestionGrounding {
  kind: QuestionGroundingKind;
  detail: string | null;
}



