import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { SettingsFold } from '@/components/settings-fold';
import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCategoryDefs, type CategoryDef, type CategoryId } from '@/lib/categories';
import { updateTraits, type Me } from '@/lib/me';
import { earnTokensQuiet } from '@/lib/tokens-server';
import { deferredUnansweredAxes } from '@/lib/questions/deferral';
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
import { generateQuestionBatch } from '@/lib/questions/generate';
import {
  bankProgressForAxes,
  bankQuestionCount,
  bankTotalProgress,
  type BankProgressItem,
} from '@/lib/questions/local';
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
   * Report tracks, for the profile-completeness gate in `routeQuestions`.
   * Absent reads as incomplete: static bank only, no model call.
   */
  tracks?: readonly TraitTrack[];
}) {
  const theme = useTheme();
  const [result, setResult] = useState<RouteQuestionsResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [checkpoint, setCheckpoint] = useState(false);
  const [keptGoing, setKeptGoing] = useState(false);
  /**
   * Category picker. No category selected = today's default axis-driven
   * rotation, entirely unchanged below. Picking a category switches to a
   * self-contained list of that category's bank questions (rendered
   * straight from `bankProgressForAxes`, never routed through
   * `routeQuestions`/`priorityAxes`) — so a bad or stale selection can never
   * block or alter the default rotation; it only decides which block below
   * renders.
   */
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | null>(null);

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
    const priorityAxes =
      focusAxis && (TRAIT_AXES as readonly string[]).includes(focusAxis)
        ? [focusAxis, ...deferred.filter((axis) => axis !== focusAxis)]
        : deferred;
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
  }, [me, history, crisisToday, focusAxis, tracks, contradictedAxes]);

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
   * Tapping the active category clears it, back to the default rotation
   * (resumed with a fresh `load()`, same as opening the fold); tapping
   * another switches the list. Never touches sessionCount/checkpoint/
   * keptGoing — those govern the unrelated pause-after-N-answers flow, which
   * does not apply to the category list.
   */
  function handleSelectCategory(id: CategoryId) {
    if (busy) return;
    const next = selectedCategory === id ? null : id;
    setSelectedCategory(next);
    if (next === null) {
      void load().catch((err) => {
        console.log('[questions] route error:', err);
        setResult({ kind: 'empty', pack: null, item: null });
      });
    }
  }

  /**
   * Answers one bank question directly from the category list. Local
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

  // Fail-open: a broken/empty catalog just hides the picker row and the
  // progress header, and a selection that no longer resolves to a def falls
  // through to the default chain below (activeCategory reads null) — the
  // question below never depends on any of this.
  let categoryDefs: ReturnType<typeof getCategoryDefs> = [];
  try {
    categoryDefs = getCategoryDefs();
  } catch (err) {
    console.log('[questions] category list error:', err);
  }
  const activeCategory = selectedCategory
    ? (categoryDefs.find((def) => def.id === selectedCategory) ?? null)
    : null;
  const progress = bankTotalProgress(tracks ?? []);

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
      {categoryDefs.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}>
          {categoryDefs.map((def) => {
            const active = selectedCategory === def.id;
            const count = bankQuestionCount(def.axes);
            return (
              <Pressable
                key={def.id}
                onPress={() => handleSelectCategory(def.id)}
                disabled={busy}
                style={({ pressed }) => [
                  styles.categoryChip,
                  { borderColor: controlBorderColor(theme) },
                  active && [styles.categoryChipActive, { borderColor: theme.accent }],
                  pressed && styles.pressed,
                  busy && styles.disabled,
                ]}>
                <ThemedText type="smallBold" themeColor={active ? undefined : 'textSecondary'}>
                  {count > 0 ? `${def.name} · ${count} questions` : def.name}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      {activeCategory ? (
        <CategoryQuestionsList
          def={activeCategory}
          tracks={tracks ?? []}
          busy={busy}
          onPick={(draft, option) => void pickBankItem(draft, option)}
        />
      ) : checkpoint ? (
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
 * A category's bank questions as a browsable list, straight from the static
 * bank (`bankProgressForAxes`) — never routed through `routeQuestions`. Each
 * axis unlocks its own 3 drafts in order: the current one is answerable
 * inline, earlier ones show answered, later ones show locked. No skip / no
 * pause-after-N here — those belong to the endless single-item rotation this
 * list replaces while a category is selected.
 */
function CategoryQuestionsList({
  def,
  tracks,
  busy,
  onPick,
}: {
  def: CategoryDef;
  tracks: readonly TraitTrack[];
  busy: boolean;
  onPick: (draft: QuestionDraft, option: QuestionOption) => void;
}) {
  const theme = useTheme();
  const rows: BankProgressItem[] = bankProgressForAxes(def.axes, tracks);

  return (
    <View style={styles.categoryList}>
      {rows.map((row) => (
        <View key={`${row.axis}-${row.variant}`} style={styles.categoryListItem}>
          {row.state === 'current' ? (
            <>
              <ThemedText type="smallBold">{row.draft.prompt}</ThemedText>
              <View style={styles.options}>
                {row.draft.options.map((option, index) => (
                  <ThemedPressable
                    key={`${row.axis}-${row.variant}-${index}`}
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
            </>
          ) : (
            <View style={styles.categoryListRow}>
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={row.state === 'locked' ? styles.disabled : undefined}>
                {row.draft.prompt}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {row.state === 'answered' ? 'Answered' : 'Locked'}
              </ThemedText>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  categoryRow: {
    gap: Spacing.two,
    paddingRight: Spacing.three,
  },
  categoryChip: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  categoryChipActive: {
    borderWidth: 2,
  },
  categoryList: {
    gap: Spacing.three,
  },
  categoryListItem: {
    gap: Spacing.two,
  },
  categoryListRow: {
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
