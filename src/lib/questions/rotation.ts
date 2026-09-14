import { effectiveStability, trackFor, type TraitTrack } from '@/lib/trait-stability';
import type { TraitAxis } from '@/lib/traits';

import { QUESTIONS_BATCH_SIZE } from './types';
import type { QuestionDraft, QuestionItemRow, QuestionPackRow } from './types';

/** Soft memory — last 2–3 asked axes, not a round-robin through the live inventory. */
export const QUESTIONS_AXIS_MEMORY = 3;

export function isOpenQuestionItem(item: QuestionItemRow): boolean {
  return item.answeredOption == null && item.skippedAt == null;
}

/**
 * First genuinely UNANSWERED item — skips are not treated as resolved.
 *
 * The ongoing-round path must use this, not `nextUnansweredItem`
 * (route.ts, built on `isOpenQuestionItem` above), because the two have
 * opposite ideas of what a skip means and only one of them matches the
 * server. `claim_ongoing_round_complete` (wave52) requires all 25 items to
 * have `answered_option is not null` and does not consult `skipped_at` at
 * all — it was patched that way to close an exploit where skipping a whole
 * round still paid out its +21. A skip-tolerant completion check on the
 * client would therefore mark a round finished, stop offering its remaining
 * questions, and fire a claim the server silently refuses.
 *
 * Nothing sets `skippedAt` on an ongoing-round item today — the round pager
 * (PagedQuestions) has no skip control, only reroll; skip belongs to the
 * Infinite Questions fold, which keeps `isOpenQuestionItem`'s
 * skip-is-resolved semantics on purpose. So this is latent rather than live.
 * It is still the correct predicate for the caller that has a server-side
 * counterpart, and pinning it here means adding a skip to the round later
 * cannot quietly reintroduce the mismatch.
 */
export function isUnansweredQuestionItem(item: QuestionItemRow): boolean {
  return item.answeredOption == null;
}

export function recentAskedAxes(
  pack: QuestionPackRow | null,
  n = QUESTIONS_AXIS_MEMORY,
): TraitAxis[] {
  if (!pack) return [];
  return pack.items
    .filter((item) => !isOpenQuestionItem(item))
    .sort((a, b) => a.sortIndex - b.sortIndex)
    .map((item) => item.axis)
    .slice(-n);
}

function sharesChosenTag(draft: QuestionDraft, chosenTags: ReadonlySet<string>): boolean {
  return (draft.redundancyTags ?? []).some((tag) => chosenTags.has(tag));
}

/**
 * Ascending-stability sort, engine-independent regardless of whether the
 * runtime's `Array.prototype.sort` is actually stable (React Native ships
 * Hermes, not V8 — its sort-stability guarantee is not something this repo
 * can assume) — decorate-sort-undecorate with the original index as an
 * explicit tie-break, so ties are provably order-preserving on every engine.
 */
function byAscendingStability(
  drafts: readonly QuestionDraft[],
  tracks: readonly TraitTrack[],
  now: Date,
): QuestionDraft[] {
  return drafts
    .map((draft, index) => ({
      draft,
      index,
      stability: effectiveStability(trackFor(tracks, draft.axis, 'report'), now),
    }))
    .sort((a, b) => a.stability - b.stability || a.index - b.index)
    .map((row) => row.draft);
}

/**
 * Resolves one tier (fresh, or overlap) in place into `out`: prefers a
 * candidate whose `redundancyTags` don't overlap an already-chosen draft's
 * tags, but never lets that shrink the batch — a tag-overlapping candidate
 * is deferred and only backfilled from WITHIN THIS SAME TIER if there
 * weren't enough non-overlapping ones. Scoped per-tier (never crossing fresh
 * into overlap) so redundancy-avoidance can never let an overlap (recently
 * asked) draft leapfrog ahead of any fresh draft — freshness still outranks
 * redundancy-avoidance, exactly like before this existed.
 */
function selectTier(
  tierDrafts: readonly QuestionDraft[],
  seen: Set<TraitAxis>,
  chosenTags: Set<string>,
  out: QuestionDraft[],
): void {
  const deferred: QuestionDraft[] = [];
  for (const draft of tierDrafts) {
    if (seen.has(draft.axis)) continue;
    if (sharesChosenTag(draft, chosenTags)) {
      deferred.push(draft);
      continue;
    }
    seen.add(draft.axis);
    out.push(draft);
    for (const tag of draft.redundancyTags ?? []) chosenTags.add(tag);
    if (out.length >= QUESTIONS_BATCH_SIZE) return;
  }
  for (const draft of deferred) {
    if (out.length >= QUESTIONS_BATCH_SIZE) break;
    if (seen.has(draft.axis)) continue;
    seen.add(draft.axis);
    out.push(draft);
  }
}

/**
 * Prefer axes not in the last 2–3. Overlap is allowed if the batch would
 * otherwise shrink. `priority` (deferred-unanswered axes) leads the batch in
 * the given order, before recency is considered; empty priority preserves
 * today's behavior exactly.
 *
 * Phase 5 (additive to this function's existing behavior, not a new one):
 * within the fresh tier, and separately within the overlap tier — never
 * within `priority`, which stays a must-include set in its given order, and
 * never letting overlap leapfrog ahead of fresh — axes are sorted by
 * ascending `effectiveStability` (least-confident axis first) using
 * `tracks`, and a candidate whose `redundancyTags` fully overlap an
 * already-chosen draft's tags is deferred within its own tier (never
 * dropped — redundancy avoidance must never shrink the batch, backfilling
 * if there weren't enough non-overlapping candidates in that tier).
 * `tracks` defaults to `[]`, under which every axis reads stability 0
 * uniformly, and the tie-break-by-original-index in `byAscendingStability`
 * makes an empty/absent `tracks` (or a draft with no `redundancyTags`, true
 * of every bank/AI question today) a genuine no-op on every engine — not a
 * special fallback branch.
 */
export function preferFreshAxes(
  drafts: QuestionDraft[],
  recent: TraitAxis[],
  priority: readonly TraitAxis[] = [],
  tracks: readonly TraitTrack[] = [],
  now: Date = new Date(),
): QuestionDraft[] {
  const avoid = new Set(recent.slice(-QUESTIONS_AXIS_MEMORY));
  const prioritySet = new Set(priority);
  const prioritized: QuestionDraft[] = [];
  for (const axis of priority) {
    const match = drafts.find((draft) => draft.axis === axis);
    if (match) prioritized.push(match);
  }
  const rest = drafts.filter((draft) => !prioritySet.has(draft.axis));
  const fresh = byAscendingStability(rest.filter((draft) => !avoid.has(draft.axis)), tracks, now);
  const overlap = byAscendingStability(rest.filter((draft) => avoid.has(draft.axis)), tracks, now);

  const seen = new Set<TraitAxis>();
  const chosenTags = new Set<string>();
  const out: QuestionDraft[] = [];

  for (const draft of prioritized) {
    if (seen.has(draft.axis)) continue;
    seen.add(draft.axis);
    out.push(draft);
    for (const tag of draft.redundancyTags ?? []) chosenTags.add(tag);
    if (out.length >= QUESTIONS_BATCH_SIZE) return out;
  }

  selectTier(fresh, seen, chosenTags, out);
  if (out.length >= QUESTIONS_BATCH_SIZE) return out;
  selectTier(overlap, seen, chosenTags, out);
  return out;
}
