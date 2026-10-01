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

/**
 * Which rows still need an answer — the rows to point at when someone reaches
 * the end with questions left over.
 *
 * `row.answered` alone cannot say: for the bank it is derived from the axis's
 * answer COUNT (the first N rows of an axis read as answered), not from which
 * question was answered, so skipping an axis's first question and answering
 * its second marks the wrong one. So this works per axis: the number still
 * open is the rows not yet answered, less the unsaved picks about to land on
 * them; those are assigned to rows with no local pick, preferring rows that
 * also read as unanswered. `picked` is every row with a local pick (a saved
 * stamp or a pending one); `pending` is the unsaved subset.
 */
export function unansweredRowKeys(
  rows: readonly CategoryQuestionRow[],
  picked: ReadonlySet<string>,
  pending: ReadonlySet<string>,
): Set<string> {
  const byAxis = new Map<TraitAxis, CategoryQuestionRow[]>();
  for (const row of rows) {
    const list = byAxis.get(row.axis);
    if (list) list.push(row);
    else byAxis.set(row.axis, [row]);
  }
  const out = new Set<string>();
  for (const axisRows of byAxis.values()) {
    const unanswered = axisRows.filter((row) => !row.answered);
    const open = unanswered.length - unanswered.filter((row) => pending.has(row.key)).length;
    if (open <= 0) continue;
    const unpicked = axisRows.filter((row) => !picked.has(row.key));
    // Last resort: local stamps can outlive the answers behind them (a cleared
    // account on the same device), leaving open questions with a pick on every
    // row. Flag the unanswered ones anyway rather than leave Finish doing nothing.
    const stale = unanswered.filter((row) => picked.has(row.key) && !pending.has(row.key));
    const candidates = [
      ...unpicked.filter((row) => !row.answered),
      ...unpicked.filter((row) => row.answered),
      ...stale,
    ];
    for (const row of candidates.slice(0, open)) out.add(row.key);
  }
  return out;
}
