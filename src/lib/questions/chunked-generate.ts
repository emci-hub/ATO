/**
 * Multi-call chunked generation (trait-system redesign §3). Rebuilds the
 * save-immediately/retry-only-the-shortfall pattern the 10-question
 * category-batch feature used before it was reverted to a single call (see
 * PROJECT_CONTEXT.md 2026-09-07) — needed here because a 25-question tiered
 * round genuinely can't fit in one `generateQuestionBatch` call the way a
 * 5-question category batch can (ai-generate's shared 1024-token
 * server-side output cap makes >5 questions/call unreliable, per
 * generate.ts's own comment). Deliberately NOT added back into
 * category-batch.ts — that file is intentionally single-call now for its
 * own feature; this is new, separate infrastructure for the larger rounds
 * the redesign introduces.
 *
 * Pure/testable — no Supabase or ai-generate import; callers inject
 * `generateBatch`/`saveItems` the same dependency-injection shape
 * `composeCategoryBatch` already uses.
 */
import type { TraitAxis } from '@/lib/traits';

import type { QuestionDraft } from './types';

/** Proven-reliable size for one generation call (same size category-batch.ts and Infinite Questions already use). */
export const CHUNK_SIZE = 5;
/** Per-chunk retry budget for the shortfall only — never the whole chunk from scratch. */
export const MAX_SHORTFALL_RETRIES = 2;

function normalizeText(text: string): string {
  return text.trim().toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
}

/** Exact-text-after-normalization match (§3 layer 1 + verify-after-generation layer 2). */
export function isNearDuplicate(text: string, against: readonly string[]): boolean {
  const norm = normalizeText(text);
  return norm.length > 0 && against.some((t) => normalizeText(t) === norm);
}

/**
 * Splits an axisCounts map into chunks of at most CHUNK_SIZE total question
 * slots each, preserving per-axis counts. Fills sequentially axis-by-axis
 * (not interleaved/round-robin) — a single axis needing more than CHUNK_SIZE
 * questions can occupy a whole chunk on its own, but never crosses a chunk
 * boundary mid-axis in a way that loses count.
 */
export function chunkAxisCounts(
  axisCounts: Partial<Record<TraitAxis, number>>,
): Partial<Record<TraitAxis, number>>[] {
  const slots: TraitAxis[] = [];
  for (const [axis, n] of Object.entries(axisCounts) as [TraitAxis, number][]) {
    for (let i = 0; i < (n ?? 0); i += 1) slots.push(axis);
  }
  const chunks: Partial<Record<TraitAxis, number>>[] = [];
  for (let i = 0; i < slots.length; i += CHUNK_SIZE) {
    const chunk: Partial<Record<TraitAxis, number>> = {};
    for (const axis of slots.slice(i, i + CHUNK_SIZE)) {
      chunk[axis] = (chunk[axis] ?? 0) + 1;
    }
    chunks.push(chunk);
  }
  return chunks;
}

export interface ChunkedGenerateDeps {
  /** Builds the prompt for one chunk — axis-restricted, exclusion list included. Callers pass buildQuestionsPrompt bound to their own `me`/grounding/tracks. */
  buildPrompt: (
    axisCounts: Partial<Record<TraitAxis, number>>,
    count: number,
    excludeText: readonly string[],
  ) => string;
  generateBatch: (prompt: string, count: number) => Promise<QuestionDraft[] | null>;
  /** Persists drafts immediately, before the next chunk (or retry) runs. */
  saveItems: (drafts: readonly QuestionDraft[]) => Promise<void>;
}

function subtractKept(
  remaining: Partial<Record<TraitAxis, number>>,
  kept: readonly QuestionDraft[],
): Partial<Record<TraitAxis, number>> {
  const next: Partial<Record<TraitAxis, number>> = { ...remaining };
  for (const draft of kept) {
    const left = (next[draft.axis] ?? 0) - 1;
    if (left > 0) next[draft.axis] = left;
    else delete next[draft.axis];
  }
  return next;
}

function totalCount(axisCounts: Partial<Record<TraitAxis, number>>): number {
  return Object.values(axisCounts).reduce((sum, n) => sum + (n ?? 0), 0);
}

/**
 * Fills a large axisCounts target across as many <=CHUNK_SIZE calls as
 * needed. Each chunk's successful, non-duplicate drafts are saved
 * immediately; only the shortfall (missing or filtered-as-duplicate) is
 * retried, up to MAX_SHORTFALL_RETRIES per chunk. `recentText` is the
 * caller-supplied bounded (~25-30 question) recent-text window (§3 layer 1)
 * — it grows with every draft this call saves too, so later chunks also
 * exclude earlier chunks' output in the same round, not just prior history.
 */
export async function fillAxisCountsChunked(
  axisCounts: Partial<Record<TraitAxis, number>>,
  recentText: readonly string[],
  deps: ChunkedGenerateDeps,
): Promise<QuestionDraft[]> {
  const saved: QuestionDraft[] = [];
  const excludeText = [...recentText];

  for (const chunk of chunkAxisCounts(axisCounts)) {
    let remaining = chunk;
    let attempts = 0;

    while (totalCount(remaining) > 0 && attempts <= MAX_SHORTFALL_RETRIES) {
      attempts += 1;
      const count = totalCount(remaining);
      const prompt = deps.buildPrompt(remaining, count, excludeText);
      const drafts = await deps.generateBatch(prompt, count);

      // Per-axis slot cap (never keep more than `remaining` asked for, even
      // if the model over-delivers on one axis) and intra-batch dedup (a
      // single call returning two near-identical drafts must not let both
      // through just because neither is in `excludeText` yet).
      const slotsLeft: Partial<Record<TraitAxis, number>> = { ...remaining };
      const kept: QuestionDraft[] = [];
      const seenThisAttempt: string[] = [];
      for (const draft of drafts ?? []) {
        if ((slotsLeft[draft.axis] ?? 0) <= 0) continue;
        if (isNearDuplicate(draft.prompt, excludeText) || isNearDuplicate(draft.prompt, seenThisAttempt)) continue;
        kept.push(draft);
        seenThisAttempt.push(draft.prompt);
        slotsLeft[draft.axis] = (slotsLeft[draft.axis] ?? 0) - 1;
      }

      if (kept.length > 0) {
        await deps.saveItems(kept);
        saved.push(...kept);
        for (const draft of kept) excludeText.push(draft.prompt);
        remaining = subtractKept(remaining, kept);
      }
      // A short/empty result just narrows `remaining` for the next retry
      // attempt (or, once attempts are exhausted, is left unfilled this
      // round) — never re-requested as a full chunk from scratch.
    }
  }

  return saved;
}
