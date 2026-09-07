/**
 * "10 questions per category" — a fixed, closed batch per category,
 * independent of Full Profile's 48/3-per-axis tracking and of Infinite
 * Questions' rotating daily pack. Pure/testable here (no Supabase import);
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

export const CATEGORY_BATCH_SIZE = 10;

/** New user-facing copy for this mode (lock/submit/cancel strings) — not yet reviewed by emci. */
export const CATEGORY_BATCH_COPY_REVIEWED = false;

/** Sum-of-options tally, e.g. {openness: 4, conscientiousness: 3, playfulness: 3}. */
export function tallyAxisPlan(plan: readonly TraitAxis[]): Partial<Record<TraitAxis, number>> {
  const out: Partial<Record<TraitAxis, number>> = {};
  for (const axis of plan) out[axis] = (out[axis] ?? 0) + 1;
  return out;
}

/**
 * 10 axis slots for one category's batch: the category's own axes first
 * (round-robin, in `CategoryDef.axes` order), then single-axis "filler"
 * questions for lagging axes outside the category, replacing — never
 * adding to — the total.
 *
 * "Lagging" reuses the existing binary least-answered signal
 * (`effectiveStability === 0`, the same condition `unfilledAxes` checks)
 * rather than an invented continuous cutoff — an axis is either past the
 * stability floor or it isn't. Filler is capped at half the batch (5 of 10)
 * and never exceeds the number of actually-lagging axes available, so a
 * category batch can never lose its own identity entirely even when most
 * of the other 13 axes are lagging.
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
  /** True only once all 10 slots exist AND all 10 are answered. */
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
  /** Persists a chunk of drafts (up to the remaining slot count) for this category's batch. */
  saveItems: (categoryId: CategoryId, drafts: readonly QuestionDraft[]) => Promise<CategoryBatchState>;
}

/**
 * The shared `ai-generate` Edge Function hard-clamps `maxOutputTokens` to
 * 1024 server-side regardless of what the client asks for (a fixed quota
 * config, not something this feature changes) — the existing 5-question
 * Infinite Questions batch already runs at that ceiling. Asking for 10
 * multiple-choice questions in one call risks truncation well before that
 * ceiling. Each generation call here is capped at this size instead — the
 * proven-safe request shape — and 10 are assembled across as many calls as
 * it takes via the same "save immediately, retry only for the shortfall"
 * loop, rather than by raising the per-call size.
 */
const MAX_PER_CALL = 5;
const MAX_ATTEMPTS = 6;

/**
 * Fills a category's 10-question batch: builds the axis plan, excludes
 * exact-duplicate text (Infinite Questions history + whatever this batch
 * already has saved — including from a previous, interrupted session, via
 * `existing`), generates in chunks of at most `MAX_PER_CALL`, saves whatever
 * comes back immediately, and keeps requesting only the remaining count
 * (never the original 10) until the batch is full or attempts run out.
 */
export async function composeCategoryBatch(
  categoryId: CategoryId,
  tracks: readonly TraitTrack[],
  me: { name: string; talk_style: TalkStyle; voice_preset: string },
  deps: ComposeCategoryBatchDeps,
  now: Date = new Date(),
  existing: CategoryBatchState | null = null,
): Promise<CategoryBatchState> {
  const plan = categoryBatchAxisPlan(categoryId, tracks, now);
  if (plan.length === 0) {
    throw new Error(`category-batch: unknown or empty category "${categoryId}"`);
  }
  const allowedAxes = new Set<TraitAxis>(plan);

  const askedBefore = await deps.fetchAskedTexts();
  // Resuming a partial batch (a prior session stopped short of 10) must
  // count what is already saved server-side, both toward the remaining
  // slot count and toward the exclusion list — otherwise every reopen of a
  // partial category re-requests all 10 from scratch, which the
  // insert_category_batch_items RPC rejects outright (it never allows more
  // than 10 items total) and would spend a paid call for nothing.
  const savedThisBatch: string[] = existing ? existing.items.map((item) => item.prompt) : [];
  let latest: CategoryBatchState | null = existing && existing.items.length > 0 ? existing : null;
  let remaining = CATEGORY_BATCH_SIZE - savedThisBatch.length;
  let attempts = 0;

  while (remaining > 0 && attempts < MAX_ATTEMPTS) {
    attempts += 1;
    const requestCount = Math.min(remaining, MAX_PER_CALL);
    // Axis-count hint scoped to exactly this call's slice of the plan (not
    // the whole 10-slot plan) so a shrunk retry request's axis counts still
    // sum to `requestCount`, not to the original total.
    const sliceStart = CATEGORY_BATCH_SIZE - remaining;
    const axisCounts = tallyAxisPlan(plan.slice(sliceStart, sliceStart + requestCount));
    const excludeText = [...askedBefore, ...savedThisBatch];
    const prompt = buildQuestionsPrompt({
      me,
      grounding: { kind: 'none', detail: null },
      priorityAxes: plan,
      tracks,
      count: requestCount,
      axisCounts,
      excludeText,
      retryHint: attempts > 1,
    });
    const drafts = await deps.generateBatch(prompt, requestCount);
    const kept = (drafts ?? []).filter((draft) => allowedAxes.has(draft.axis)).slice(0, remaining);
    if (kept.length === 0) continue;

    latest = await deps.saveItems(categoryId, kept);
    for (const draft of kept) savedThisBatch.push(draft.prompt);
    remaining = CATEGORY_BATCH_SIZE - savedThisBatch.length;
  }

  if (!latest) {
    throw new Error(`category-batch: generation returned nothing for "${categoryId}"`);
  }
  return latest;
}
