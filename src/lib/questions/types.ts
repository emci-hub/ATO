import type { CategoryId } from '@/lib/categories';
import type { TraitTrack } from '@/lib/trait-stability';
import type { TraitAxis } from '@/lib/traits';
import type { CheckHistory } from '@/lib/voice/types';

export const QUESTIONS_BATCH_SIZE = 5;
export const QUESTIONS_CALL_TYPE = 'questions';

export interface QuestionOption {
  text: string;
  value: number;
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

export interface RouteQuestionsMe {
  name: string;
  timezone: string;
  talk_style: 'quiet' | 'even' | 'loud';
  voice_preset: string;
  sage_knows: unknown;
  facts?: string[] | null;
  ai_consent?: boolean | null;
}

export interface RouteQuestionsInput {
  me: RouteQuestionsMe;
  history: CheckHistory[];
  aiConsent?: boolean | null;
  crisisToday?: boolean;
  now?: Date;
  /**
   * Deferred-unanswered axes (skipped earlier in a questionnaire sweep) to
   * cover first in the next generated batch. Empty when none.
   */
  priorityAxes?: readonly TraitAxis[];
  /**
   * Report-track rows, used only to decide whether the profile is complete
   * (every axis has >=1 answer). An incomplete profile is served from the
   * static bank and never reaches the model. Omitted/empty reads as
   * incomplete, which is the safe direction — no paid call.
   */
  tracks?: readonly TraitTrack[];
}

export type QuestionsKind =
  | 'item'
  | 'cached'
  | 'consent-pending'
  | 'consent-denied'
  | 'crisis'
  | 'quota'
  | 'empty'
  | 'paused';

export interface RouteQuestionsResult {
  kind: QuestionsKind;
  pack: QuestionPackRow | null;
  item: QuestionItemRow | null;
}
