import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';

import { chunkAxisCounts, MAX_SHORTFALL_RETRIES } from './chunked-generate';
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


/** Most a single Fill run asks for: one per trait. */
export const EVEN_FILL_MAX = 16;
/** A trait that is behind may get at most this many in one run. */
export const EVEN_FILL_PER_TRAIT = 2;

/**
 * Keeps the pool even (emci 2026-10-06): every trait gets one question per
 * run, and a trait that is behind the best-stocked one gets a second, so the
 * gaps close over a few runs. Never more than 16 in one run: when the extras
 * push past it, the best-stocked traits wait for the next run.
 */
export function evenFillPlan(
  depth: Partial<Record<TraitAxis, number>>,
  max: number = EVEN_FILL_MAX,
): Partial<Record<TraitAxis, number>> {
  const top = Math.max(0, ...TRAIT_AXES.map((a) => depth[a] ?? 0));
  const rows = TRAIT_AXES.map((axis) => {
    const behind = top - (depth[axis] ?? 0);
    return { axis, want: Math.min(EVEN_FILL_PER_TRAIT, 1 + (behind > 0 ? 1 : 0)), behind };
  });
  let total = rows.reduce((n, r) => n + r.want, 0);
  // Over budget: the best-stocked traits sit this run out first.
  for (const r of [...rows].sort((a, b) => a.behind - b.behind || TRAIT_AXES.indexOf(a.axis) - TRAIT_AXES.indexOf(b.axis))) {
    if (total <= max) break;
    if (r.want > 0) {
      r.want -= 1;
      total -= 1;
    }
  }
  const plan: Partial<Record<TraitAxis, number>> = {};
  for (const r of rows) if (r.want > 0) plan[r.axis] = r.want;
  return plan;
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
  plan: Partial<Record<TraitAxis, number>>;
  /** Pool questions waiting per trait, before and after. */
  depthBefore: Partial<Record<TraitAxis, number>>;
  depthAfter: Partial<Record<TraitAxis, number>>;
  saved: QuestionDraft[];
  /** AI calls this run used (each counts against today's quota). */
  calls: number;
  /** Set when a call came back empty (AI off, quota spent, offline): the run stopped there. */
  stoppedEarly: boolean;
}

/**
 * The lab's Fill: the even plan above, asked in chunks of CHUNK_SIZE (one
 * reply cannot safely hold 16 questions under ai-generate's output cap), with
 * one retry per chunk for what was dropped — the round's own pattern
 * (chunked-generate.ts). Every question passes the voice gate and the slot
 * rule (only traits still owed, one slot each) before it is written to the
 * pool through the round's write (owner = this account, wave74). A dropped
 * question is shown with its reason and never saved.
 */
export async function fillPoolEven(deps: LabFillDeps): Promise<LabFillResult> {
  const depthBefore = await deps.fetchDepth();
  const plan = evenFillPlan(depthBefore);
  const seen = await deps.fetchRecent();
  const verdicts: LabVerdict[] = [];
  const saved: QuestionDraft[] = [];
  let calls = 0;
  let parsedAny = false;
  let stoppedEarly = false;

  outer: for (const chunk of chunkAxisCounts(plan)) {
    const owed = new Map(Object.entries(chunk) as [TraitAxis, number][]);
    for (let attempt = 0; attempt <= MAX_SHORTFALL_RETRIES; attempt += 1) {
      const axes = [...owed].flatMap(([axis, n]) => Array.from({ length: n }, () => axis));
      if (axes.length === 0) break;
      calls += 1;
      const text = await deps.generate(buildLabPrompt(axes, seen));
      if (!text) {
        stoppedEarly = true;
        break outer;
      }
      const judged = judgeLabOutput(text, axes.length, seen);
      if (!judged.parseFailed) parsedAny = true;
      const passing: QuestionDraft[] = [];
      for (const v of judged.verdicts) {
        const left = owed.get(v.draft.axis) ?? 0;
        const verdict = !v.failure && left <= 0 ? { ...v, failure: 'slot: this trait was not asked for, or already has its question' } : v;
        verdicts.push(verdict);
        seen.push(v.draft.prompt);
        if (verdict.failure) continue;
        owed.set(v.draft.axis, left - 1);
        passing.push(v.draft);
      }
      if (passing.length > 0) {
        await deps.save(passing);
        saved.push(...passing);
      }
    }
  }

  // The saves already happened: a failed recount must not hide them.
  const depthAfter = saved.length > 0 ? await deps.fetchDepth().catch(() => depthBefore) : depthBefore;
  return { verdicts, parseFailed: !parsedAny, plan, depthBefore, depthAfter, saved, calls, stoppedEarly };
}
