import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';

import { parseQuestionBatch } from './parse';
import { buildQuestionsPrompt } from './prompt';
import { assessQuestion, generatedQuestionFailure, type VoiceIssue } from './question-voice';
import type { QuestionDraft } from './types';

/**
 * The Question lab (forever loop testing, 2026-10-05): the exact round prompt
 * the app sends, for N traits, and a per-rule verdict on what comes back.
 * Shared by the dev panel (src/components/question-lab-panel.tsx, one call
 * per tap, never on mount) and the live check (scripts/question-live-check.ts).
 * Nothing here calls a model; callers pass the text back in.
 */

export const QUESTION_LAB_SIZES = [3, 5] as const;

/** N different traits, rotated by `turn` so repeated taps cover all 16. */
export function labAxes(count: number, turn: number): TraitAxis[] {
  const out: TraitAxis[] = [];
  for (let i = 0; i < count; i += 1) out.push(TRAIT_AXES[(turn * count + i) % TRAIT_AXES.length]!);
  return out;
}

export function buildLabPrompt(axes: readonly TraitAxis[], recent: readonly string[] = []): string {
  const axisCounts: Partial<Record<TraitAxis, number>> = {};
  for (const axis of axes) axisCounts[axis] = (axisCounts[axis] ?? 0) + 1;
  // Same call the round makes (ongoing-round.ts), with no personal context:
  // the round prompt never carries the user's name or facts either.
  return buildQuestionsPrompt({
    me: { name: '', talk_style: 'even', voice_preset: 'close_friend' },
    grounding: { kind: 'none', detail: null },
    count: axes.length,
    axisCounts,
    excludeText: recent,
  });
}

export interface LabVerdict {
  draft: QuestionDraft;
  /** Null when it would be shown; otherwise why the gate drops it. */
  failure: string | null;
  issues: VoiceIssue[];
}

export interface LabResult {
  verdicts: LabVerdict[];
  /** The model's text did not parse into any question. */
  parseFailed: boolean;
}

export function judgeLabOutput(text: string | null, count: number, recent: readonly string[] = []): LabResult {
  const drafts = text ? parseQuestionBatch(text, count) : [];
  const seen: string[] = [...recent];
  const verdicts = drafts.map((draft) => {
    const verdict = { draft, failure: generatedQuestionFailure(draft, seen), issues: assessQuestion(draft, { others: seen }) };
    seen.push(draft.prompt);
    return verdict;
  });
  return { verdicts, parseFailed: drafts.length === 0 };
}
