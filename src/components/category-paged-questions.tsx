import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CategoryDef } from '@/lib/categories';
import { humanizeAxis } from '@/lib/milestones';
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
import type { TraitAxis } from '@/lib/traits';

export type { CategoryQuestionRow };
export { completedAxesFrom, uniqueCategoryAxes };

/**
 * One category's worth of questions per screen — every question belonging to
 * that category shown together (not one-at-a-time), with Back/Next/Skip
 * category navigation and a "Category X of Y" + dedup'd axis-completion
 * indicator. Generic over the question source: the caller supplies
 * `rowsForAxis`, so this component never assumes a fixed question count per
 * category or where the questions come from (the static Full Profile bank
 * today; a future "questions stack" source later, same component).
 *
 * Per-row rendering (prompt, options, "Answered" label, themed border/colors)
 * is the same shape Full Profile's old flat list already used — same
 * `ThemedText`/`ThemedPressable`/`controlBorderColor` components, so it
 * follows whatever the active appearance theme renders (dark background,
 * themed borders/highlight color) exactly as before, nothing hardcoded here.
 *
 * Saving an answer is entirely the caller's responsibility via `onPick` —
 * this component never calls a save function itself, so the existing
 * answer-write path is untouched.
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
  onPick: (draft: QuestionDraft, option: QuestionOption) => void;
}) {
  const theme = useTheme();
  const [index, setIndex] = useState(0);
  const [positionReady, setPositionReady] = useState(false);

  // Restore the last-viewed category for this question set on mount. Scoped
  // to `storageKey` only (not `categories`) — categories is a live catalog
  // that can reorder/grow without invalidating a remembered position, since
  // the lookup below matches by id, not index.
  useEffect(() => {
    let cancelled = false;
    setPositionReady(false);
    loadCategoryPagePosition(storageKey)
      .then((savedId) => {
        if (cancelled || !savedId) return;
        const at = categories.findIndex((def) => def.id === savedId);
        if (at >= 0) setIndex(at);
      })
      .finally(() => {
        if (!cancelled) setPositionReady(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time position load per storageKey/mount
  }, [storageKey]);

  const clampedIndex = categories.length === 0 ? 0 : Math.min(index, categories.length - 1);
  const current = categories[clampedIndex] ?? null;

  // Persist the position on every change, but only after the initial load
  // above resolves — otherwise the default index=0 would overwrite a real
  // saved position in the instant before it loads.
  useEffect(() => {
    if (!positionReady || !current) return;
    void saveCategoryPagePosition(storageKey, current.id);
  }, [positionReady, storageKey, current]);

  const uniqueAxes = useMemo(() => uniqueCategoryAxes(categories), [categories]);
  const completedAxes = useMemo(
    () => completedAxesFrom(uniqueAxes, rowsForAxis),
    [uniqueAxes, rowsForAxis],
  );

  const goTo = useCallback(
    (next: number) => {
      if (categories.length === 0) return;
      setIndex(Math.max(0, Math.min(categories.length - 1, next)));
    },
    [categories.length],
  );

  if (!current) return null;

  const atFirst = clampedIndex === 0;
  const atLast = clampedIndex >= categories.length - 1;

  return (
    <View style={styles.container}>
      <View style={styles.progressRow}>
        <ThemedText type="small" themeColor="textSecondary">
          Category {clampedIndex + 1} of {categories.length}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {completedAxes.length} of {uniqueAxes.length} axes complete
        </ThemedText>
      </View>
      <ThemedText type="smallBold">{current.name}</ThemedText>
      <View style={styles.axisSections}>
        {current.axes.map((axis) => {
          const rows = rowsForAxis(axis);
          const answeredCount = rows.filter((row) => row.answered).length;
          return (
            <View key={axis} style={styles.axisSection}>
              <ThemedText type="smallBold">
                {`${humanizeAxis(axis)} · ${answeredCount}/${rows.length}`}
              </ThemedText>
              {rows.map((row) => (
                <View key={row.key} style={styles.axisItem}>
                  <View style={styles.axisItemHeader}>
                    <ThemedText type="small">{row.draft.prompt}</ThemedText>
                    {row.answered ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        Answered
                      </ThemedText>
                    ) : null}
                  </View>
                  {locked ? null : (
                    <View style={styles.options}>
                      {row.draft.options.map((option, optIndex) => (
                        <ThemedPressable
                          key={`${row.key}-${optIndex}`}
                          disabled={busy}
                          onPress={() => onPick(row.draft, option)}
                          style={[
                            styles.option,
                            { borderColor: controlBorderColor(theme) },
                            busy && styles.disabled,
                          ]}>
                          <ThemedText type="smallBold">{option.text}</ThemedText>
                        </ThemedPressable>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </View>
          );
        })}
      </View>
      <View style={styles.navRow}>
        <Pressable
          onPress={() => goTo(clampedIndex - 1)}
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
        <Pressable
          onPress={() => goTo(clampedIndex + 1)}
          disabled={busy || atLast}
          style={({ pressed }) => [
            styles.navLink,
            pressed && styles.pressed,
            (busy || atLast) && styles.disabled,
          ]}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            Skip
          </ThemedText>
        </Pressable>
        <ThemedPressable
          disabled={busy || atLast}
          onPress={() => goTo(clampedIndex + 1)}
          style={[
            styles.option,
            styles.nextButton,
            { borderColor: controlBorderColor(theme) },
            (busy || atLast) && styles.disabled,
          ]}>
          <ThemedText type="smallBold">Next</ThemedText>
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
  axisSections: {
    gap: Spacing.four,
  },
  axisSection: {
    gap: Spacing.two,
  },
  axisItem: {
    gap: Spacing.two,
  },
  axisItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
