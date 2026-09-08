/**
 * "5 questions per category" — a fixed, closed batch per category,
 * independent of Full Profile's frozen-50-question tracking (trait-system
 * redesign §3) and of Infinite Questions' rotating daily pack. Pure/testable
 * here (no Supabase import);
 * the actual DB reads/writes live in category-batch-store.ts and are
 * injected as deps into `composeCategoryBatch` below, same pattern
 * `routeQuestions` (route.ts) already uses for `RouteQuestionsDeps`.
 */
import { getCategoryDefs, type CategoryId } from '@/lib/categories';
import { effectiveStability, rankAxesByStability, trackFor, type TraitTrack } from '@/lib/trait-stability';
import type { TraitAxis } from '@/lib/traits';
import type { TalkStyle } from '@/lib/voice/types';

import { buildQuestionsPrompt } from './prompt';
import type { QuestionDraft, QuestionOption } from './types';

/**
 * 5, not 10 — the proven-reliable size for one `generateQuestionBatch` call
 * (same size Infinite Questions already uses). A category batch is filled
 * in a single generation call; no chunking or resume-mid-batch logic.
 */
export const CATEGORY_BATCH_SIZE = 5;

/** New user-facing copy for this mode (lock/submit/cancel strings) — not yet reviewed by emci. */
export const CATEGORY_BATCH_COPY_REVIEWED = false;

/** Sum-of-options tally, e.g. {openness: 4, conscientiousness: 3, playfulness: 3}. */
export function tallyAxisPlan(plan: readonly TraitAxis[]): Partial<Record<TraitAxis, number>> {
  const out: Partial<Record<TraitAxis, number>> = {};
  for (const axis of plan) out[axis] = (out[axis] ?? 0) + 1;
  return out;
}

/**
 * 5 axis slots for one category's batch: the category's own axes first
 * (round-robin, in `CategoryDef.axes` order), then single-axis "filler"
 * questions for lagging axes outside the category, replacing — never
 * adding to — the total.
 *
 * "Lagging" reuses the existing binary least-answered signal
 * (`effectiveStability === 0`, the same condition `unfilledAxes` checks)
 * rather than an invented continuous cutoff — an axis is either past the
 * stability floor or it isn't. Filler is capped at half the batch (2 of 5,
 * floored) and never exceeds the number of actually-lagging axes available,
 * so a category batch can never lose its own identity entirely even when
 * most of the other axes are lagging.
 */
export function categoryBatchAxisPlan(
  categoryId: CategoryId,
  tracks: readonly TraitTrack[],
  now: Date = new Date(),
): TraitAxis[] {
  const def = getCategoryDefs().find((row) => row.id === categoryId);
  const categoryAxes = def?.axes ?? [];
  if (categoryAxes.length === 0) return [];

  const ranked = rankAxesByStability(tracks, now);
  const lagging = ranked.filter(
    (axis) =>
      !categoryAxes.includes(axis) &&
      effectiveStability(trackFor(tracks, axis, 'report'), now) === 0,
  );

  const fillerCount = Math.min(lagging.length, Math.floor(CATEGORY_BATCH_SIZE / 2));
  const normalCount = CATEGORY_BATCH_SIZE - fillerCount;

  const plan: TraitAxis[] = [];
  for (let i = 0; i < normalCount; i += 1) {
    plan.push(categoryAxes[i % categoryAxes.length]!);
  }
  for (let i = 0; i < fillerCount; i += 1) {
    plan.push(lagging[i % lagging.length]!);
  }
  return plan;
}

export interface CategoryBatchItemState {
  id: string;
  axis: TraitAxis;
  prompt: string;
  options: readonly QuestionOption[];
  answeredOption: number | null;
}

export interface CategoryBatchState {
  id: string;
  categoryId: string;
  finalizedAt: string | null;
  items: readonly CategoryBatchItemState[];
}

export interface CategoryBatchProgress {
  categoryId: CategoryId;
  batchId: string | null;
  questionIds: string[];
  answeredCount: number;
  /** True only once all 5 slots exist AND all 5 are answered. */
  locked: boolean;
  finalizedAt: string | null;
}

export function categoryBatchProgressFrom(
  categoryId: CategoryId,
  batch: CategoryBatchState | null,
): CategoryBatchProgress {
  if (!batch) {
    return {
      categoryId,
      batchId: null,
      questionIds: [],
      answeredCount: 0,
      locked: false,
      finalizedAt: null,
    };
  }
  const answeredCount = batch.items.filter((item) => item.answeredOption != null).length;
  return {
    categoryId,
    batchId: batch.id,
    questionIds: batch.items.map((item) => item.id),
    answeredCount,
    locked: batch.items.length >= CATEGORY_BATCH_SIZE && answeredCount >= CATEGORY_BATCH_SIZE,
    finalizedAt: batch.finalizedAt,
  };
}

/** True once every one of `getCategoryDefs()`'s categories reports locked. */
export function allCategoryBatchesLocked(
  progresses: readonly CategoryBatchProgress[],
): boolean {
  const total = getCategoryDefs().length;
  if (total === 0) return false;
  const byId = new Map(progresses.map((p) => [p.categoryId, p]));
  return getCategoryDefs().every((def) => byId.get(def.id)?.locked === true);
}

export interface ComposeCategoryBatchDeps {
  generateBatch: (prompt: string, count: number) => Promise<QuestionDraft[] | null>;
  /** Question text already served to this user (Infinite Questions history). */
  fetchAskedTexts: () => Promise<string[]>;
  /** Persists the generated drafts for this category's batch. */
  saveItems: (categoryId: CategoryId, drafts: readonly QuestionDraft[]) => Promise<CategoryBatchState>;
}

/**
 * Fills a category's 5-question batch in a single generation call: builds
 * the axis plan, excludes exact-duplicate text (Infinite Questions history),
 * generates, and saves whatever comes back. 5 is the same size Infinite
 * Questions already generates reliably in one call under `ai-generate`'s
 * shared 1024-token server-side output cap — no chunking or resume-mid-batch
 * logic here (that complexity existed only for the 10-question version).
 */
export async function composeCategoryBatch(
  categoryId: CategoryId,
  tracks: readonly TraitTrack[],
  me: { name: string; talk_style: TalkStyle; voice_preset: string },
  deps: ComposeCategoryBatchDeps,
  now: Date = new Date(),
): Promise<CategoryBatchState> {
  const plan = categoryBatchAxisPlan(categoryId, tracks, now);
  if (plan.length === 0) {
    throw new Error(`category-batch: unknown or empty category "${categoryId}"`);
  }
  const allowedAxes = new Set<TraitAxis>(plan);
  const axisCounts = tallyAxisPlan(plan);

  const excludeText = await deps.fetchAskedTexts();
  const prompt = buildQuestionsPrompt({
    me,
    grounding: { kind: 'none', detail: null },
    priorityAxes: plan,
    tracks,
    count: CATEGORY_BATCH_SIZE,
    axisCounts,
    excludeText,
  });
  const drafts = await deps.generateBatch(prompt, CATEGORY_BATCH_SIZE);
  const kept = (drafts ?? []).filter((draft) => allowedAxes.has(draft.axis)).slice(0, CATEGORY_BATCH_SIZE);
  if (kept.length === 0) {
    throw new Error(`category-batch: generation returned nothing for "${categoryId}"`);
  }
  return deps.saveItems(categoryId, kept);
}
