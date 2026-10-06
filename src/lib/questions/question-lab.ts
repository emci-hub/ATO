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

/** The N traits with the fewest pool questions waiting for this account (ties in TRAIT_AXES order). */
export function thinnestAxes(depth: Partial<Record<TraitAxis, number>>, count: number): TraitAxis[] {
  return [...TRAIT_AXES]
    .sort((a, b) => (depth[a] ?? 0) - (depth[b] ?? 0) || TRAIT_AXES.indexOf(a) - TRAIT_AXES.indexOf(b))
    .slice(0, count);
}

export interface LabFillDeps {
  fetchDepth: () => Promise<Partial<Record<TraitAxis, number>>>;
  /** This account's already-asked prompts plus the bank (fetch-recent-texts.ts). */
  fetchRecent: () => Promise<string[]>;
  generate: (prompt: string) => Promise<string | null>;
  /** Writes into question_bank_pool (bank-pool.ts addToBankPool) and stamps bankItemId. */
  save: (drafts: QuestionDraft[]) => Promise<void>;
}

export interface LabFillResult extends LabResult {
  axes: TraitAxis[];
  /** Pool questions waiting, per filled trait, before and after. */
  depthBefore: Partial<Record<TraitAxis, number>>;
  depthAfter: Partial<Record<TraitAxis, number>>;
  saved: QuestionDraft[];
}

/**
 * The lab's "fill the pool" run: the round prompt for the thinnest traits,
 * the voice gate, then ONLY the questions that pass are written to the shared
 * pool — the same write a round makes (owner = this account, wave74), so a
 * later round draws them bank-first. One AI call; a dropped question is shown
 * with its reason and never saved.
 */
export async function fillPoolFromLab(count: number, deps: LabFillDeps): Promise<LabFillResult> {
  const depthBefore = await deps.fetchDepth();
  const axes = thinnestAxes(depthBefore, count);
  const recent = await deps.fetchRecent();
  const text = await deps.generate(buildLabPrompt(axes, recent));
  const judged = judgeLabOutput(text, count, recent);
  // Same slot rule as a round (chunked-generate.ts): only the traits asked
  // for, one question each. Anything else is shown as dropped, never saved.
  const slots = new Map<TraitAxis, number>();
  for (const axis of axes) slots.set(axis, (slots.get(axis) ?? 0) + 1);
  const verdicts = judged.verdicts.map((v) => {
    if (v.failure) return v;
    const left = slots.get(v.draft.axis) ?? 0;
    if (left <= 0) return { ...v, failure: 'slot: this trait was not asked for, or already has its question' };
    slots.set(v.draft.axis, left - 1);
    return v;
  });
  const passing = verdicts.filter((v) => !v.failure).map((v) => v.draft);
  if (passing.length > 0) await deps.save(passing);
  // The save already happened: a failed recount must not hide what was saved.
  const depthAfter = passing.length > 0 ? await deps.fetchDepth().catch(() => depthBefore) : depthBefore;
  return { ...judged, verdicts, axes, depthBefore, depthAfter, saved: passing };
}
