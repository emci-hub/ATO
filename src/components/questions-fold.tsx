import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CategoryPagedQuestions } from '@/components/category-paged-questions';
import { SettingsFold } from '@/components/settings-fold';
import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCategoryDefs, type CategoryId } from '@/lib/categories';
import { useCategoryDefs } from '@/lib/category-catalog';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { updateTraits, type Me } from '@/lib/me';
import { earnTokensQuiet } from '@/lib/tokens-server';
import { deferredUnansweredAxes, mergeCategoryPriority } from '@/lib/questions/deferral';
import { contradictedAxesFrom, type TraitHistoryRow } from '@/lib/trait-history';
import { fetchTraitHistory } from '@/lib/trait-history-store';
import { unansweredAxisLabel, type TraitTrack } from '@/lib/trait-stability';
import { TRAIT_AXES, traitStateFromRow, type TraitAxis } from '@/lib/traits';
import {
  QUESTIONS_CHECKPOINT,
  QUESTIONS_CHECKPOINT_AFTER,
  QUESTIONS_EMPTY_CONSENT,
  QUESTIONS_EMPTY_CRISIS,
  QUESTIONS_EMPTY_DENIED,
  QUESTIONS_EMPTY_QUOTA,
  QUESTIONS_EMPTY_TRY,
  QUESTIONS_KEEP_GOING,
  QUESTIONS_LABEL,
  QUESTIONS_LEDE,
  QUESTIONS_SKIP_REST,
  QUESTIONS_SKIP_THIS,
} from '@/lib/questions/copy';
import { applyQuestionAnswer } from '@/lib/questions/answer';
import {
  categoryBatchProgressFrom,
  composeCategoryBatch,
  CATEGORY_BATCH_COPY_REVIEWED,
  CATEGORY_BATCH_SIZE,
  type CategoryBatchState,
} from '@/lib/questions/category-batch';
import {
  answerCategoryQuestionItem,
  fetchAskedQuestionTexts,
  fetchCategoryBatch,
  saveCategoryBatchItems,
} from '@/lib/questions/category-batch-store';
import { generateQuestionBatch } from '@/lib/questions/generate';
import { bankProgressForAxis, bankTotalProgress } from '@/lib/questions/local';
import { nextPlayableItem, routeQuestions } from '@/lib/questions/route';
import {
  answerQuestionItem,
  fetchLatestQuestionPack,
  saveQuestionPack,
  skipQuestionItem,
  skipRestOfQuestionPack,
} from '@/lib/questions/store';
import type {
  QuestionDraft,
  QuestionItemRow,
  QuestionOption,
  QuestionPackRow,
  RouteQuestionsResult,
} from '@/lib/questions/types';
import { controlBorderColor } from '@/lib/theme/chrome';
import { shouldUseLocalAi } from '@/lib/ai/override';
import { claimQuestionsBatch, logJargonGuard, logPhraseGuard } from '@/lib/voice/quota-server';
import type { CheckHistory } from '@/lib/voice/types';
import { withTimeout } from '@/lib/timeout';

function emptyCopy(kind: RouteQuestionsResult['kind']): string | null {
  switch (kind) {
    case 'consent-pending':
      return QUESTIONS_EMPTY_CONSENT;
    case 'consent-denied':
      return QUESTIONS_EMPTY_DENIED;
    case 'crisis':
      return QUESTIONS_EMPTY_CRISIS;
    case 'quota':
      return QUESTIONS_EMPTY_QUOTA;
    case 'empty':
      return QUESTIONS_EMPTY_TRY;
    case 'paused':
      return QUESTIONS_CHECKPOINT;
    default:
      return null;
  }
}

function isLocalId(id: string): boolean {
  return id.startsWith('local-') || id === 'local';
}

function markSkipped(pack: QuestionPackRow, itemId: string): QuestionPackRow {
  return {
    ...pack,
    items: pack.items.map((row) =>
      row.id === itemId ? { ...row, skippedAt: new Date().toISOString() } : row,
    ),
  };
}

function markRestSkipped(pack: QuestionPackRow): QuestionPackRow {
  return {
    ...pack,
    items: pack.items.map((row) =>
      row.answeredOption == null && row.skippedAt == null
        ? { ...row, skippedAt: new Date().toISOString() }
        : row,
    ),
  };
}

export function QuestionsFold({
  me,
  history,
  crisisToday,
  onUpdated,
  alwaysOpen = false,
  focusAxis,
  category,
  tracks,
}: {
  me: Me;
  history: CheckHistory[];
  crisisToday: boolean;
  onUpdated: () => Promise<void>;
  alwaysOpen?: boolean;
  /** Front-loads this axis in the next batch (e.g. deep-linked from Legends). */
  focusAxis?: TraitAxis;
  /**
   * Front-loads a whole category's axes ahead of the base priority list (no
   * caller passes this yet — plumbing for a future "generate for category X"
   * entry point). Resolved to axes here, via `getCategoryDefs`; `category`
   * never reaches `routeQuestions`/the model/the DB — only the resulting
   * `TraitAxis[]` does, same as `focusAxis`.
   */
  category?: CategoryId;
  /**
   * Report tracks, for the profile-completeness gate in `routeQuestions`.
   * Absent reads as incomplete: static bank only, no model call.
   */
  tracks?: readonly TraitTrack[];
}) {
  const theme = useTheme();
  // Live-subscribed catalog (same hook categories-fold.tsx/category-teaser.tsx
  // already use) — CategoryPagedQuestions needs the current list, not a
  // mount-time snapshot, since a category_defs fetch can swap the array
  // while this screen is open.
  const liveCategoryDefs = useCategoryDefs();
  const [result, setResult] = useState<RouteQuestionsResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [checkpoint, setCheckpoint] = useState(false);
  const [keptGoing, setKeptGoing] = useState(false);

  // T-04: real caller of Phase 6's hasContradictedAnswers. Fetched here
  // (route-level), not from any shared cache — none exists for trait_history
  // anywhere in the app; every screen that reads it (e.g. full-profile-fold.tsx)
  // fetches it fresh, unbounded, same as here — no windowing/limit is applied,
  // matching that existing precedent, not a new tradeoff introduced by this
  // fetch. Keyed on the whole `me` object, same convention `load` below
  // already uses — `useMe`'s `refresh()` always returns a new `Me` object, so
  // this re-fires after an answer lands, same pattern this codebase's other
  // staleness fixes rely on. One caveat: `pick()`'s `load()` call below still
  // runs against the PRE-answer `contradictedAxes` from this render's closure
  // (the fetch is async) — a just-created contradiction leads the FOLLOWING
  // batch, not the very next one.
  const [traitHistory, setTraitHistory] = useState<TraitHistoryRow[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetchTraitHistory(me.id)
      .then((rows) => {
        if (!cancelled) setTraitHistory(rows);
      })
      .catch((err) => {
        console.log('[questions] trait history fetch error:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [me]);
  const contradictedAxes = useMemo(() => contradictedAxesFrom(traitHistory), [traitHistory]);

  const load = useCallback(async () => {
    const deferred = deferredUnansweredAxes(
      traitStateFromRow(me).values,
      me.question_deferred,
    );
    const base =
      focusAxis && (TRAIT_AXES as readonly string[]).includes(focusAxis)
        ? [focusAxis, ...deferred.filter((axis) => axis !== focusAxis)]
        : deferred;
    const categoryAxes = category
      ? (getCategoryDefs().find((def) => def.id === category)?.axes ?? [])
      : [];
    const priorityAxes = mergeCategoryPriority(categoryAxes, base);
    const next = await withTimeout(
      routeQuestions(
        {
          me: { ...me, talk_style: me.talk_style ?? 'even' },
          history,
          aiConsent: me.ai_consent,
          crisisToday,
          priorityAxes,
          tracks,
          contradictedAxes,
        },
        {
          loadLatestPack: fetchLatestQuestionPack,
          savePack: saveQuestionPack,
          claimBatch: claimQuestionsBatch,
          generateBatch: generateQuestionBatch,
          logJargonHit: logJargonGuard,
          logPhraseHit: logPhraseGuard,
          useLocal: await shouldUseLocalAi(),
        },
      ),
      25000,
      'questions',
    );
    setResult(next);
  }, [me, history, crisisToday, focusAxis, category, tracks, contradictedAxes]);

  function handleOpen() {
    setSessionCount(0);
    setCheckpoint(false);
    setKeptGoing(false);
    void load().catch((err) => {
      console.log('[questions] route error:', err);
      setResult({ kind: 'empty', pack: null, item: null });
    });
  }

  useEffect(() => {
    if (!alwaysOpen) return;
    handleOpen();
    // One session when the screen mounts. Answering already calls load().
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only session
  }, [alwaysOpen]);

  function handleKeepGoing() {
    setKeptGoing(true);
    setCheckpoint(false);
    void load().catch((err) => {
      console.log('[questions] route error:', err);
      setResult({ kind: 'empty', pack: null, item: null });
    });
  }

  /**
   * Answers one bank question directly from the Full Profile list. Local
   * (bank-sourced) `QuestionDraft`, never a persisted `QuestionItemRow` — so
   * this can safely carry primaryAxes/secondaryAxes (Phase 4) via the shared
   * `applyQuestionAnswer`, same as intake-sweep. `pick()` below (the
   * persisted-pack path) cannot: `QuestionItemRow` has no axis-weight
   * fields, and adding them would be a `question_items` schema change.
   */
  async function pickBankItem(draft: QuestionDraft, option: QuestionOption) {
    if (busy) return;
    setBusy(true);
    try {
      await applyQuestionAnswer(me.id, draft, option, tracks ?? []);
      earnTokensQuiet('game_round');
      await onUpdated();
    } catch (err) {
      console.log('[questions] category answer error:', err);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Answers a persisted pack item. `QuestionItemRow` (unlike `QuestionDraft`
   * above) has no primaryAxes/secondaryAxes fields — `insert_question_pack`
   * and this table only ever store axis/prompt/options — so this path stays
   * single-axis until/unless a `question_items` schema change is proposed
   * and signed off. Not done, not asked (Phase 4 decision, see
   * PROJECT_CONTEXT.md).
   */
  async function pick(item: QuestionItemRow, index: number) {
    const option = item.options[index];
    if (!option || busy) return;
    setBusy(true);
    try {
      if (!isLocalId(item.id)) {
        await answerQuestionItem(item.id, index);
      }
      await updateTraits(me.id, { [item.axis]: option.value }, 'self_situation', [item.axis]);
      earnTokensQuiet('game_round');
      await onUpdated();
      const nextCount = sessionCount + 1;
      setSessionCount(nextCount);
      if (!keptGoing && nextCount >= QUESTIONS_CHECKPOINT_AFTER) {
        setCheckpoint(true);
      } else {
        await load();
      }
    } catch (err) {
      console.log('[questions] answer error:', err);
    } finally {
      setBusy(false);
    }
  }

  async function skipThis(item: QuestionItemRow) {
    if (busy) return;
    setBusy(true);
    try {
      const nextCount = sessionCount + 1;
      const pause = !keptGoing && nextCount >= QUESTIONS_CHECKPOINT_AFTER;
      if (isLocalId(item.id) && result?.pack) {
        const pack = markSkipped(result.pack, item.id);
        setResult({
          kind: nextPlayableItem(pack) ? 'cached' : 'paused',
          pack,
          item: nextPlayableItem(pack),
        });
      } else {
        await skipQuestionItem(item.id);
        if (!pause) await load();
      }
      setSessionCount(nextCount);
      if (pause) setCheckpoint(true);
    } catch (err) {
      console.log('[questions] skip error:', err);
    } finally {
      setBusy(false);
    }
  }

  async function skipRest() {
    if (busy) return;
    const pack = result?.pack;
    if (!pack) {
      setCheckpoint(false);
      return;
    }
    setBusy(true);
    try {
      if (isLocalId(pack.id)) {
        const next = markRestSkipped(pack);
        setResult({ kind: 'paused', pack: next, item: null });
      } else {
        await skipRestOfQuestionPack(pack.id);
        setResult({ kind: 'paused', pack, item: null });
      }
      setCheckpoint(false);
    } catch (err) {
      console.log('[questions] skip-rest error:', err);
    } finally {
      setBusy(false);
    }
  }

  const empty = result ? emptyCopy(result.kind) : null;
  const item = checkpoint ? null : (result?.item ?? null);

  const progress = bankTotalProgress(tracks ?? []);
  // Full Profile is exactly the required 48 (3 per axis) — once every axis
  // has all 3, the whole section goes read-only. Re-answering past that
  // point would only add an invisible extra EWMA sample (no milestone, no
  // stability change worth showing), so it's clearer to just stop offering
  // it than to let taps silently do nothing meaningful.
  const fullProfileLocked = progress.total > 0 && progress.answered >= progress.total;

  const body = (
    <View style={styles.body}>
      <ThemedText type="small" themeColor="textSecondary">
        {QUESTIONS_LEDE}
      </ThemedText>
      {progress.total > 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {progress.answered} of {progress.total} answered
        </ThemedText>
      ) : null}
      <CategoryPagedQuestions
        storageKey="full-profile"
        categories={liveCategoryDefs}
        rowsForAxis={(axis) =>
          bankProgressForAxis(axis, tracks ?? []).map((row) => ({
            key: `${row.axis}-${row.variant}`,
            axis: row.axis,
            draft: row.draft,
            answered: row.state === 'answered',
          }))
        }
        busy={busy}
        locked={fullProfileLocked}
        onPick={(draft, option) => void pickBankItem(draft, option)}
      />
      {checkpoint ? (
        <>
          <ThemedText>{QUESTIONS_CHECKPOINT}</ThemedText>
          <ThemedPressable
            disabled={busy}
            onPress={handleKeepGoing}
            style={[styles.option, { borderColor: controlBorderColor(theme) }]}>
            <ThemedText type="smallBold">{QUESTIONS_KEEP_GOING}</ThemedText>
          </ThemedPressable>
          <View style={styles.skipRow}>
            <View />
            <Pressable
              onPress={() => void skipRest()}
              disabled={busy}
              style={({ pressed }) => [
                styles.skipLink,
                pressed && styles.pressed,
                busy && styles.disabled,
              ]}>
              <ThemedText type="smallBold">{QUESTIONS_SKIP_REST}</ThemedText>
            </Pressable>
          </View>
        </>
      ) : empty ? (
        <ThemedText type="small" themeColor="textSecondary">
          {empty}
        </ThemedText>
      ) : item ? (
        <>
          <ThemedText>{item.prompt}</ThemedText>
          <View style={styles.options}>
            {item.options.map((option, index) => (
              <ThemedPressable
                key={`${item.id}-${index}`}
                disabled={busy}
                onPress={() => void pick(item, index)}
                style={[
                  styles.option,
                  { borderColor: controlBorderColor(theme) },
                  busy && styles.disabled,
                ]}>
                <ThemedText type="smallBold">{option.text}</ThemedText>
              </ThemedPressable>
            ))}
          </View>
          <View style={styles.skipRow}>
            <Pressable
              onPress={() => void skipThis(item)}
              disabled={busy}
              style={({ pressed }) => [
                styles.skipLink,
                pressed && styles.pressed,
                busy && styles.disabled,
              ]}>
              <ThemedText type="smallBold">{QUESTIONS_SKIP_THIS}</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => void skipRest()}
              disabled={busy}
              style={({ pressed }) => [
                styles.skipLink,
                pressed && styles.pressed,
                busy && styles.disabled,
              ]}>
              <ThemedText type="smallBold">{QUESTIONS_SKIP_REST}</ThemedText>
            </Pressable>
          </View>
        </>
      ) : (
        <ThemedText themeColor="textSecondary">Loading…</ThemedText>
      )}
    </View>
  );

  if (alwaysOpen) return body;

  const title = tracks ? `${QUESTIONS_LABEL} · ${unansweredAxisLabel(tracks)}` : QUESTIONS_LABEL;

  return (
    <SettingsFold title={title} onOpen={handleOpen}>
      {body}
    </SettingsFold>
  );
}

/**
 * "5 questions per category" (separate mode from Infinite Questions above
 * — sibling component, not a branch inside `QuestionsFold`, so the existing
 * rotation/skip/checkpoint machinery there stays completely untouched).
 * Entered via `category`, same prop `QuestionsFold` already accepted as
 * unused plumbing. Generates a fixed 5-question batch for this category on
 * mount (a single generation call — 5 is the proven-reliable size, no
 * chunking/resume logic), answers write traits immediately (same
 * `applyQuestionAnswer` as `pickBankItem` above), and once all 5 are
 * answered the whole list locks read-only in place — same visual as Full
 * Profile's (`CategoryPagedQuestions`'s `locked` prop) lock, no navigation,
 * no toast. Skip is not offered in this mode at all (no shared code path
 * with `skipThis`/`skipRest` above).
 */
export function CategoryBatchFold({
  me,
  tracks,
  category,
  onUpdated,
}: {
  me: Me;
  tracks: readonly TraitTrack[];
  category: CategoryId;
  onUpdated: () => Promise<void>;
}) {
  const theme = useTheme();
  const [batch, setBatch] = useState<CategoryBatchState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const existing = await fetchCategoryBatch(category);
      if (existing && existing.items.length >= CATEGORY_BATCH_SIZE) {
        setBatch(existing);
        return;
      }
      const composed = await composeCategoryBatch(
        category,
        tracks,
        { name: me.name, talk_style: me.talk_style ?? 'even', voice_preset: me.voice_preset },
        {
          generateBatch: generateQuestionBatch,
          fetchAskedTexts: fetchAskedQuestionTexts,
          saveItems: saveCategoryBatchItems,
        },
      );
      setBatch(composed);
    } catch (err) {
      console.log('[category-batch] load error:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [category, tracks, me]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one generation per category mount
  }, [category]);

  async function pick(item: CategoryBatchState['items'][number], index: number) {
    const option = item.options[index];
    if (!option || busy || !batch) return;
    setBusy(true);
    try {
      await answerCategoryQuestionItem(item.id, index);
      const draft: QuestionDraft = { axis: item.axis, prompt: item.prompt, options: [...item.options] };
      await applyQuestionAnswer(me.id, draft, option, tracks);
      setBatch({
        ...batch,
        items: batch.items.map((row) =>
          row.id === item.id ? { ...row, answeredOption: index } : row,
        ),
      });
      earnTokensQuiet('game_round');
      await onUpdated();
    } catch (err) {
      console.log('[category-batch] answer error:', err);
    } finally {
      setBusy(false);
    }
  }

  const progress = categoryBatchProgressFrom(category, batch);

  return (
    <View style={styles.body}>
      {!CATEGORY_BATCH_COPY_REVIEWED && PRE_LAUNCH_DEV ? (
        <ThemedText type="code" themeColor="textSecondary">
          Draft copy — waiting on emci review.
        </ThemedText>
      ) : null}
      {loading ? (
        <ThemedText themeColor="textSecondary">Loading…</ThemedText>
      ) : error ? (
        <ThemedText type="small" themeColor="textSecondary">
          Could not generate this category&apos;s questions. Try again.
        </ThemedText>
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            {progress.answeredCount} of {CATEGORY_BATCH_SIZE} answered
          </ThemedText>
          {(batch?.items ?? []).map((item) => (
            <View key={item.id} style={styles.axisItem}>
              <View style={styles.axisItemHeader}>
                <ThemedText type="small">{item.prompt}</ThemedText>
                {item.answeredOption != null ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    Answered
                  </ThemedText>
                ) : null}
              </View>
              {progress.locked ? null : (
                <View style={styles.options}>
                  {item.options.map((option, index) => (
                    <ThemedPressable
                      key={`${item.id}-${index}`}
                      disabled={busy || item.answeredOption != null}
                      onPress={() => void pick(item, index)}
                      style={[
                        styles.option,
                        { borderColor: controlBorderColor(theme) },
                        (busy || item.answeredOption != null) && styles.disabled,
                      ]}>
                      <ThemedText type="smallBold">{option.text}</ThemedText>
                    </ThemedPressable>
                  ))}
                </View>
              )}
            </View>
          ))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
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
  skipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  skipLink: {
    paddingVertical: Spacing.two,
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
});
