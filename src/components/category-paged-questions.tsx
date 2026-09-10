import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CategoryDef } from '@/lib/categories';
import { humanizeAxis } from '@/lib/milestones';
import {
  loadAnsweredOptions,
  saveAnsweredOption,
} from '@/lib/questions/answered-option-storage';
import {
  loadCategoryPagePosition,
  saveCategoryPagePosition,
} from '@/lib/questions/category-page-position';
import {
  completedAxesFrom,
  uniqueCategoryAxes,
  type CategoryQuestionRow,
} from '@/lib/questions/category-paged';
import type { QuestionDraft, QuestionOption } from '@/lib/questions/types';
import { controlBorderColor } from '@/lib/theme/chrome';
import { hexToRgb } from '@/lib/theme/contrast';
import type { TraitAxis } from '@/lib/traits';

export type { CategoryQuestionRow };
export { completedAxesFrom, uniqueCategoryAxes };

/**
 * Translucent fill for the "Answered" stamp, derived from the same
 * `textSecondary` token the old text label used (there is no dedicated
 * green/success token in this theme system — see `constants/appearance.ts`)
 * so the stamp reads as the same color in every appearance. Falls back to
 * the token itself (opaque) if it's ever not a plain 6-digit hex — every
 * appearance's `textSecondary` is today, but this degrades safely rather
 * than rendering `undefined` as a background.
 */
function stampBackground(textSecondary: string): string {
  const rgb = hexToRgb(textSecondary);
  return rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.16)` : textSecondary;
}

/** Questions shown per page, book-style — the last page can be shorter. */
const PAGE_SIZE = 5;

/**
 * A flat, book-style pager over every question across every category — 5
 * questions per page, in stable axis order, "Next Page"/"Back" only. Replaces
 * the earlier one-category-per-screen layout (Back/Skip/Next per category):
 * with the questions no longer grouped by category, "skip this category"
 * stopped making sense as a control, so it's gone along with the grouping.
 * Generic over the question source: the caller supplies `rowsForAxis`, so
 * this component never assumes a fixed question count per axis or where the
 * questions come from (the static Full Profile bank today; a future
 * "questions stack" source later, same component).
 *
 * Per-row rendering (prompt, options, an "Answered" stamp overlaid on the
 * picked option, themed border/colors) is unchanged from the prior layout —
 * same `ThemedText`/`ThemedPressable`/`controlBorderColor` components, so it
 * follows whatever the active appearance theme renders exactly as before.
 * The stamp itself has never had any entrance animation; the only motion the
 * old layout had was a busy-dim opacity flash on the just-picked option,
 * already excluded from the dim.
 *
 * Saving an answer is entirely the caller's responsibility via `onPick` —
 * this component never calls a save function itself, so the existing
 * answer-write path is untouched. No auto-scroll on answer (removed
 * deliberately — it could overshoot); the page itself never moves until the
 * viewer taps Next Page.
 */
export function CategoryPagedQuestions({
  storageKey,
  categories,
  rowsForAxis,
  busy,
  locked = false,
  onPick,
}: {
  /** Unique id for this question set (e.g. "full-profile", "questions-stack") — scopes remembered position. */
  storageKey: string;
  categories: readonly CategoryDef[];
  /** Caller-supplied accessor so this component never assumes where questions come from. */
  rowsForAxis: (axis: TraitAxis) => readonly CategoryQuestionRow[];
  busy: boolean;
  /** Hides every option everywhere, same meaning as Full Profile's old global lock. */
  locked?: boolean;
  /**
   * Resolves to whether the write actually succeeded. The picked-option
   * highlight itself stays optimistic/instant (session-local, same as
   * before — a false one just disappears on remount, harmless), but the
   * "Answered" stamp is only PERSISTED (answered-option-storage.ts, so it
   * survives remounts/paging back) once this confirms true — otherwise a
   * failed write would leave a permanent stamp that contradicts the real
   * answered-count elsewhere on screen (found in review, kept from the prior
   * layout).
   */
  onPick: (draft: QuestionDraft, option: QuestionOption) => Promise<boolean>;
}) {
  const theme = useTheme();
  const [pageIndex, setPageIndex] = useState(0);
  const [positionReady, setPositionReady] = useState(false);
  // Tracks which option was picked per row — rows here are intentionally
  // re-answerable, so this is a display hint, not a lock. Seeded from
  // AsyncStorage (answered-option-storage.ts) on mount so a row answered in
  // an earlier session/visit still shows its stamp when paged back to, not
  // just the option just tapped this session; a fresh tap updates both this
  // state and storage together (see the option's onPress below).
  const [pickedByRow, setPickedByRow] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    loadAnsweredOptions(storageKey).then((saved) => {
      if (cancelled) return;
      setPickedByRow((prev) => ({ ...saved, ...prev }));
    });
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  // Restore the last-viewed page for this question set on mount. Scoped to
  // `storageKey` only (not the row list) — the row list can reorder/grow
  // (a new bank draft, a catalog change) without invalidating a remembered
  // page number; a stale page index simply clamps to the new last page below.
  useEffect(() => {
    let cancelled = false;
    setPositionReady(false);
    loadCategoryPagePosition(storageKey)
      .then((saved) => {
        if (cancelled || !saved) return;
        const parsed = Number(saved);
        if (Number.isInteger(parsed) && parsed >= 0) setPageIndex(parsed);
      })
      .finally(() => {
        if (!cancelled) setPositionReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  const uniqueAxes = useMemo(() => uniqueCategoryAxes(categories), [categories]);
  const completedAxes = useMemo(
    () => completedAxesFrom(uniqueAxes, rowsForAxis),
    [uniqueAxes, rowsForAxis],
  );
  // Flat, axis-order list of every question across every category — the
  // book pager's whole "auto-sorted, not grouped by category" shape. Axes
  // shared by two categories only contribute their rows once, since
  // `uniqueAxes` is already deduped.
  const allRows = useMemo(
    () => uniqueAxes.flatMap((axis) => rowsForAxis(axis)),
    [uniqueAxes, rowsForAxis],
  );

  const totalPages = Math.max(1, Math.ceil(allRows.length / PAGE_SIZE));
  const clampedPage = Math.min(pageIndex, totalPages - 1);

  // Persist the position on every change, but only after the initial load
  // above resolves — otherwise the default index=0 would overwrite a real
  // saved position in the instant before it loads. Also skipped while
  // `allRows` is empty (nothing loaded yet for this caller) — writing "0"
  // then would clobber a real remembered position before real rows arrive
  // (found in review; not reachable today since the Full Profile bank is
  // always non-empty, but this component is explicitly generic over the
  // question source).
  useEffect(() => {
    if (!positionReady || allRows.length === 0) return;
    void saveCategoryPagePosition(storageKey, String(clampedPage));
  }, [positionReady, storageKey, clampedPage, allRows.length]);

  const goTo = useCallback(
    (next: number) => {
      setPageIndex(Math.max(0, Math.min(totalPages - 1, next)));
    },
    [totalPages],
  );

  if (categories.length === 0) return null;

  const atFirst = clampedPage === 0;
  const atLast = clampedPage >= totalPages - 1;
  const pageRows = allRows.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);

  return (
    <View style={styles.container}>
      <View style={styles.progressRow}>
        <ThemedText type="small" themeColor="textSecondary">
          Page {clampedPage + 1} of {totalPages}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {completedAxes.length} of {uniqueAxes.length} axes complete
        </ThemedText>
      </View>
      <View style={styles.rows}>
        {pageRows.map((row) => (
          <View key={row.key} style={styles.axisItem}>
            <ThemedText type="small" themeColor="textSecondary">
              {humanizeAxis(row.axis)}
            </ThemedText>
            <ThemedText style={styles.questionPrompt}>{row.draft.prompt}</ThemedText>
            {locked ? null : (
              <View style={styles.options}>
                {row.draft.options.map((option, optIndex) => {
                  const picked = pickedByRow[row.key] === optIndex;
                  return (
                    <ThemedPressable
                      key={`${row.key}-${optIndex}`}
                      disabled={busy}
                      accessibilityState={{ selected: picked }}
                      onPress={async () => {
                        setPickedByRow((prev) => ({ ...prev, [row.key]: optIndex }));
                        const ok = await onPick(row.draft, option);
                        if (ok) {
                          void saveAnsweredOption(storageKey, row.key, optIndex);
                        }
                      }}
                      style={[
                        styles.option,
                        { borderColor: controlBorderColor(theme) },
                        picked && { backgroundColor: theme.backgroundSelected },
                        // Deliberately excludes every ALREADY-PICKED option
                        // (not just the one just tapped) from the busy dim —
                        // dimming the just-answered option the instant its
                        // stamp mounts read as "the tap didn't register".
                        // Every UNPICKED option still dims/disables while
                        // busy, so double-tapping a different, still-open
                        // option mid-save is still blocked.
                        busy && !picked && styles.disabled,
                      ]}>
                      <ThemedText type="smallBold">{option.text}</ThemedText>
                      {picked ? (
                        <View pointerEvents="none" style={styles.stampWrap}>
                          <View
                            style={[
                              styles.stamp,
                              {
                                borderColor: theme.textSecondary,
                                backgroundColor: stampBackground(theme.textSecondary),
                              },
                            ]}>
                            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.stampText}>
                              Answered
                            </ThemedText>
                          </View>
                        </View>
                      ) : null}
                    </ThemedPressable>
                  );
                })}
              </View>
            )}
          </View>
        ))}
      </View>
      <View style={styles.navRow}>
        <Pressable
          onPress={() => goTo(clampedPage - 1)}
          disabled={busy || atFirst}
          style={({ pressed }) => [
            styles.navLink,
            pressed && styles.pressed,
            (busy || atFirst) && styles.disabled,
          ]}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            Back
          </ThemedText>
        </Pressable>
        <ThemedPressable
          disabled={busy || atLast}
          onPress={() => goTo(clampedPage + 1)}
          style={[
            styles.option,
            styles.nextButton,
            { borderColor: controlBorderColor(theme) },
            (busy || atLast) && styles.disabled,
          ]}>
          <ThemedText type="smallBold">Next Page</ThemedText>
        </ThemedPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  rows: {
    gap: Spacing.four,
  },
  // A bit larger than ThemedText's "small" (14/20) — this screen shows 5
  // questions per page, denser than the single-question flow elsewhere in
  // Questions, so a smaller bump than that flow's own override.
  questionPrompt: {
    fontSize: 16,
    lineHeight: 22,
  },
  axisItem: {
    gap: Spacing.two,
  },
  options: {
    gap: Spacing.two,
  },
  option: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    position: 'relative',
  },
  stampWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stamp: {
    borderWidth: 1.5,
    borderRadius: Spacing.one,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
    transform: [{ rotate: '-10deg' }],
  },
  stampText: {
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  navLink: {
    paddingVertical: Spacing.two,
  },
  nextButton: {
    flexGrow: 1,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
});
