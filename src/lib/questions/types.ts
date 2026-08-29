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
