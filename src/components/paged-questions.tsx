import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
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
 * Generic over the question source: the caller supplies an already-flat
 * `rows` list and its own `progressLabel` line, so this component never
 * assumes where the questions come from or how progress toward them is
 * measured — the static Full Profile bank (axis-based) and the ongoing-round
 * generator (answered-count-based) both use it, unchanged otherwise.
 *
 * Per-row rendering (prompt, options, an "Answered" stamp overlaid on the
 * picked option, themed border/colors) is unchanged from the prior layout —
 * same `ThemedText`/`ThemedPressable`/`controlBorderColor` components, so it
 * follows whatever the active appearance theme renders exactly as before.
 * The stamp itself has never had any entrance animation; the only motion the
 * old layout had was a busy-dim opacity flash on the just-picked option,
 * already excluded from the dim.
 *
 * Saving is entirely the caller's responsibility via `onSaveBatch` — this
 * component never calls a save function itself. Answers picked on a page
 * are held locally (nothing saved yet) until the viewer taps Next Page,
 * which sends the whole page's picks in one batch and only advances if it
 * resolves true; a false result leaves the page in place with an inline
 * error so nothing is silently lost. No auto-scroll on answer (removed
 * deliberately — it could overshoot); the page itself never moves until
 * that batch save succeeds.
 */
export function PagedQuestions({
  storageKey,
  rows,
  progressLabel,
  locked = false,
  onSaveBatch,
  renderRowExtra,
}: {
  /** Unique id for this question set (e.g. "full-profile", "ongoing-round:<packId>") — scopes remembered position. */
  storageKey: string;
  /** Already-flat, caller-ordered row list — this component never assumes where the questions come from. */
  rows: readonly CategoryQuestionRow[];
  /** Caller-supplied secondary line under "Page X of Y" (e.g. "16 of 16 axes complete", "12 of 25 answered"). */
  progressLabel: string;
  /** Hides every option everywhere, same meaning as Full Profile's old global lock. */
  locked?: boolean;
  /**
   * Resolves to whether the batch write actually succeeded. The picked-option
   * highlight itself stays optimistic/instant (session-local — a false one
   * just disappears on remount, harmless), but the "Answered" stamp is only
   * PERSISTED (answered-option-storage.ts, so it survives remounts/paging
   * back) once this confirms true — otherwise a failed write would leave a
   * permanent stamp that contradicts the real answered-count elsewhere on
   * screen (found in review, kept from the prior per-tap layout). Each entry
   * carries `key`/`optIndex` alongside `draft`/`option` — the Full Profile
   * bank's save function ignores them (its write is content-addressed by
   * axis/draft), but the ongoing-round save function needs `key` (the
   * underlying `question_items.id`) and `optIndex` to call
   * `answerQuestionItem`, which this component has no other way to supply.
   */
  onSaveBatch: (
    answers: readonly { key: string; draft: QuestionDraft; option: QuestionOption; optIndex: number }[],
  ) => Promise<boolean>;
  /**
   * Optional extra content rendered under a row's options (e.g. a reroll
   * control). `isPending` is true while that row has a local, not-yet-saved
   * pick — callers must not offer an action here that would invalidate a
   * pending pick (e.g. rerolling a question out from under an unsaved
   * answer), since this component has no way to know what the extra content
   * does.
   */
  renderRowExtra?: (row: CategoryQuestionRow, isPending: boolean) => ReactNode;
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
  // Answers picked on the current page but not yet saved — sent as one
  // batch when Next Page is pressed, cleared only on a confirmed success so
  // a failed save keeps them queued for the retry (pressing Next again).
  const [pendingByRow, setPendingByRow] = useState<
    Record<string, { draft: QuestionDraft; option: QuestionOption; optIndex: number }>
  >({});
  // Batch saves now run in the background — Next Page advances immediately
  // instead of waiting on the network round trip. `savingCount` is just a
  // "something is still saving" indicator (never blocks navigation); a
  // batch that fails lands in `failedBatches` instead of being lost, with
  // its own retry, regardless of which page is showing when it resolves.
  const [savingCount, setSavingCount] = useState(0);
  const [failedBatches, setFailedBatches] = useState<
    readonly { id: number; rows: readonly { key: string; draft: QuestionDraft; option: QuestionOption; optIndex: number }[] }[]
  >([]);
  const nextFailedBatchId = useRef(0);

  function runBatchSave(
    rows: readonly { key: string; draft: QuestionDraft; option: QuestionOption; optIndex: number }[],
  ) {
    setSavingCount((n) => n + 1);
    onSaveBatch(rows)
      .then((ok) => {
        if (ok) {
          for (const row of rows) void saveAnsweredOption(storageKey, row.key, row.optIndex);
          setPendingByRow((prev) => {
            const next = { ...prev };
            for (const row of rows) delete next[row.key];
            return next;
          });
        } else {
          const id = ++nextFailedBatchId.current;
          setFailedBatches((prev) => [...prev, { id, rows }]);
        }
      })
      .catch(() => {
        const id = ++nextFailedBatchId.current;
        setFailedBatches((prev) => [...prev, { id, rows }]);
      })
      .finally(() => setSavingCount((n) => Math.max(0, n - 1)));
  }

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

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const clampedPage = Math.min(pageIndex, totalPages - 1);

  // Persist the position on every change, but only after the initial load
  // above resolves — otherwise the default index=0 would overwrite a real
  // saved position in the instant before it loads. Also skipped while `rows`
  // is empty (nothing loaded yet for this caller) — writing "0" then would
  // clobber a real remembered position before real rows arrive (found in
  // review; not reachable today since the Full Profile bank is always
  // non-empty, but this component is explicitly generic over the source).
  useEffect(() => {
    if (!positionReady || rows.length === 0) return;
    void saveCategoryPagePosition(storageKey, String(clampedPage));
  }, [positionReady, storageKey, clampedPage, rows.length]);

  const goTo = useCallback(
    (next: number) => {
      setPageIndex(Math.max(0, Math.min(totalPages - 1, next)));
    },
    [totalPages],
  );

  if (rows.length === 0) return null;

  const atFirst = clampedPage === 0;
  const atLast = clampedPage >= totalPages - 1;
  const pageRows = rows.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);

  return (
    <View style={styles.container}>
      <View style={styles.progressRow}>
        <ThemedText type="small" themeColor="textSecondary">
          Page {clampedPage + 1} of {totalPages}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {progressLabel}
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
                      accessibilityState={{ selected: picked }}
                      onPress={() => {
                        setPickedByRow((prev) => ({ ...prev, [row.key]: optIndex }));
                        setPendingByRow((prev) => ({
                          ...prev,
                          [row.key]: { draft: row.draft, option, optIndex },
                        }));
                      }}
                      style={[
                        styles.option,
                        { borderColor: controlBorderColor(theme) },
                        picked && { backgroundColor: theme.backgroundSelected },
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
            {locked || !renderRowExtra ? null : renderRowExtra(row, pendingByRow[row.key] != null)}
          </View>
        ))}
      </View>
      {savingCount > 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Saving…
        </ThemedText>
      ) : null}
      {failedBatches.map((batch) => (
        <View key={batch.id} style={styles.saveErrorRow}>
          <ThemedText type="small" themeColor="textSecondary">
            Couldn&apos;t save {batch.rows.length} answer{batch.rows.length === 1 ? '' : 's'}.
          </ThemedText>
          <Pressable
            onPress={() => {
              setFailedBatches((prev) => prev.filter((b) => b.id !== batch.id));
              runBatchSave(batch.rows);
            }}>
            <ThemedText type="smallBold">Retry</ThemedText>
          </Pressable>
        </View>
      ))}
      <View style={styles.navRow}>
        <Pressable
          onPress={() => goTo(clampedPage - 1)}
          disabled={atFirst}
          style={({ pressed }) => [
            styles.navLink,
            pressed && styles.pressed,
            atFirst && styles.disabled,
          ]}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            Back
          </ThemedText>
        </Pressable>
        <ThemedPressable
          onPress={() => {
            const pending = pageRows
              .map((row) => (pendingByRow[row.key] ? { key: row.key, ...pendingByRow[row.key] } : null))
              .filter(
                (entry): entry is { key: string; draft: QuestionDraft; option: QuestionOption; optIndex: number } =>
                  entry != null,
              );
            // Fires in the background — the page advances immediately rather
            // than waiting on the network round trip. A failed batch surfaces
            // in `failedBatches` (with its own retry) instead of blocking here.
            if (pending.length > 0) runBatchSave(pending);
            goTo(clampedPage + 1);
          }}
          style={[
            styles.option,
            styles.nextButton,
            { borderColor: controlBorderColor(theme) },
          ]}>
          <ThemedText type="smallBold">{atLast ? 'Finish' : 'Next Page'}</ThemedText>
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
  saveErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
