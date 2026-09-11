/**
 * Pure logic for `PagedQuestions` (src/components/paged-questions.tsx),
 * kept in a react-native-free module on purpose — the component file imports
 * `react-native`, which breaks `tsx`'s esbuild transform when pulled into a
 * plain Node check script (confirmed: `react-native/index.js` fails with
 * "Unexpected typeof", the same class of issue already documented for
 * growth.ts). Splitting the row-grouping/dedup math out here keeps it
 * directly Node-testable, same convention as every other `src/lib/questions/*`
 * pure module.
 */
import type { CategoryDef } from '@/lib/categories';
import type { QuestionDraft } from '@/lib/questions/types';
import type { TraitAxis } from '@/lib/traits';

export interface CategoryQuestionRow {
  /** Unique within its axis (e.g. a bank draft's variant, or a batch item id). */
  key: string;
  axis: TraitAxis;
  draft: QuestionDraft;
  answered: boolean;
}

/**
 * Every axis referenced by any of `categories`, deduped in first-seen order —
 * an axis shared by two categories (e.g. `extraversion` in both "Openness to
 * life" and "Everyday social energy") is only ever counted once here, so a
 * completion count built from this list can never double-count it.
 */
export function uniqueCategoryAxes(categories: readonly CategoryDef[]): TraitAxis[] {
  const seen = new Set<TraitAxis>();
  const out: TraitAxis[] = [];
  for (const def of categories) {
    for (const axis of def.axes) {
      if (seen.has(axis)) continue;
      seen.add(axis);
      out.push(axis);
    }
  }
  return out;
}

/**
 * Of `uniqueAxes` (already deduped — see `uniqueCategoryAxes`), which ones
 * have every one of their questions answered.
 */
export function completedAxesFrom(
  uniqueAxes: readonly TraitAxis[],
  rowsForAxis: (axis: TraitAxis) => readonly CategoryQuestionRow[],
): TraitAxis[] {
  return uniqueAxes.filter((axis) => {
    const rows = rowsForAxis(axis);
    return rows.length > 0 && rows.every((row) => row.answered);
  });
}
