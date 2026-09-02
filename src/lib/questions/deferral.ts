/**
 * Question deferral — a skipped questionnaire-sweep question relocates its
 * axis into the regular rotating Questions pool instead of being re-asked by
 * the sweep. The persisted set lives on `me.question_deferred` (jsonb array).
 *
 * An axis is only ever "deferred while unanswered": the moment it gains a
 * stored trait value (answered anywhere), the app drops it from the list.
 *
 * Pure helpers only (no Supabase) so Node checks can import this module.
 * The persistence write lives in @/lib/questions/store.
 */
import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';

/** Normalize raw me.question_deferred into a deduped, vocabulary-valid axis list. */
export function normalizeDeferredAxes(raw: unknown): TraitAxis[] {
  if (!Array.isArray(raw)) return [];
  const valid = new Set<string>(TRAIT_AXES);
  const seen = new Set<TraitAxis>();
  for (const item of raw) {
    if (typeof item === 'string' && valid.has(item)) {
      seen.add(item as TraitAxis);
    }
  }
  return TRAIT_AXES.filter((axis) => seen.has(axis));
}

/** Deferred axes whose trait value is still unanswered. */
export function deferredUnansweredAxes(
  values: Partial<Record<TraitAxis, number | null | undefined>>,
  rawDeferred: unknown,
): TraitAxis[] {
  return normalizeDeferredAxes(rawDeferred).filter((axis) => {
    const n = values[axis];
    return n == null || !Number.isFinite(n);
  });
}

/**
 * Merge newly-skipped axes into the current deferred set and prune any axis
 * that has since been answered. Returns the canonical TRAIT_AXES-ordered list
 * ready to persist.
 */
export function mergedDeferral(
  current: readonly TraitAxis[] | unknown,
  values: Partial<Record<TraitAxis, number | null | undefined>>,
  newlySkipped: readonly TraitAxis[],
): TraitAxis[] {
  const out = new Set<TraitAxis>(normalizeDeferredAxes(current));
  for (const axis of newlySkipped) out.add(axis);
  for (const axis of [...out]) {
    const n = values[axis];
    if (n != null && Number.isFinite(n)) out.delete(axis);
  }
  return TRAIT_AXES.filter((axis) => out.has(axis));
}
