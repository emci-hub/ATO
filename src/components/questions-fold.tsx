import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  PagedQuestions,
  completedAxesFrom,
  uniqueCategoryAxes,
  type CategoryQuestionRow,
} from '@/components/paged-questions';
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
import { claimOngoingRoundCompleteQuiet } from '@/lib/ato-tokens-server';
import { ATO_TOKEN_PRICE, atoPriceLine, atoTokenBalanceOf, ATO_TOKEN_NEED_MORE } from '@/lib/ato-tokens';
import { rerollQuestionItem } from '@/lib/questions/reroll';
import { Sentry } from '@/lib/sentry';
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
import { generateQuestionBatch } from '@/lib/questions/generate';
import { bankProgressForAxis, bankTotalProgress } from '@/lib/questions/local';
import { runOngoingRound } from '@/lib/questions/run-ongoing-round';
import { nextPlayableItem, nextUnansweredItem, routeQuestions } from '@/lib/questions/route';
import {
  answerQuestionItem,
  fetchLatestOngoingRoundPack,
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
  defaultOpen = false,
  focusAxis,
  category,
  tracks,
}: {
  me: Me;
  history: CheckHistory[];
  crisisToday: boolean;
  onUpdated: () => Promise<void>;
  alwaysOpen?: boolean;
  /**
   * Render the fold already expanded, with its batch loaded. Set when the
   * person arrived on a deep link that named an axis (`focusAxis`) — landing
   * them on a collapsed fold silently threw that axis away, since `load()`
   * only ever ran from `SettingsFold`'s `onOpen`. Unlike `alwaysOpen` this
   * keeps the header and lets them collapse it again.
   */
  defaultOpen?: boolean;
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
  // already use) — PagedQuestions needs the current list, not a
  // mount-time snapshot, since a category_defs fetch can swap the array
  // while this screen is open.
  const liveCategoryDefs = useCategoryDefs();
  const [result, setResult] = useState<RouteQuestionsResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [checkpoint, setCheckpoint] = useState(false);
  const [keptGoing, setKeptGoing] = useState(false);
  // Tracks which option was just tapped so it can highlight while the
  // answer saves — options previously gave no visual confirmation at all,
  // which read as "it answered the wrong question" (bug report). Keyed by
  // itemId so a stale pick from a prior question never matches once `item`
  // advances to the next one.
  const [pickedOption, setPickedOption] = useState<{ itemId: string; index: number } | null>(null);

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

  /**
   * A second deep link naming a DIFFERENT axis, arriving while this screen is
   * still mounted, is a true→true transition for `defaultOpen` — SettingsFold
   * sees no rising edge, so nothing reloads and the new axis is dropped. That
   * is the same defect `defaultOpen` exists to fix (Explore alone has several
   * axis CTAs, so hopping between them is a real path), so track the axis
   * itself. The first axis is claimed without reloading: SettingsFold's own
   * mount edge already ran `handleOpen` for it.
   */
  const loadedFocusRef = useRef<TraitAxis | undefined>(undefined);
  useEffect(() => {
    if (!defaultOpen || !focusAxis) return;
    if (loadedFocusRef.current === undefined) {
      loadedFocusRef.current = focusAxis;
      return;
    }
    if (loadedFocusRef.current === focusAxis) return;
    loadedFocusRef.current = focusAxis;
    handleOpen();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the axis, not handleOpen's identity
  }, [defaultOpen, focusAxis]);

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
  /**
   * Saves a whole page's worth of Full Profile bank answers in one batch,
   * called from PagedQuestions only when Next Page is pressed (never
   * per-tap). Sequential, not `Promise.all` — each call is a
   * read-modify-write against the same user's trait row via
   * `applyQuestionAnswer`, so running them concurrently could race. Returns
   * whether every write succeeded — PagedQuestions only persists its
   * "Answered" stamps and advances the page on a confirmed true; a false
   * result leaves the page in place with an inline error, nothing silently
   * lost.
   */
  async function saveBankAnswers(
    answers: readonly { draft: QuestionDraft; option: QuestionOption }[],
  ): Promise<boolean> {
    try {
      for (const { draft, option } of answers) {
        await applyQuestionAnswer(me.id, draft, option, tracks ?? []);
      }
      earnTokensQuiet('game_round');
      await onUpdated();
      return true;
    } catch (err) {
      console.log('[questions] category batch answer error:', err);
      return false;
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
    setPickedOption({ itemId: item.id, index });
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
      // A failed save must not leave the tapped option looking picked — the
      // question stays on screen (nothing advanced), so the stale highlight
      // would read as "saved" when it wasn't (found in review).
      setPickedOption(null);
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
  // Full Profile is exactly the frozen intake's 50 questions (tiered
  // per-axis counts, trait-system redesign §2/§3 — no longer a flat 3) —
  // once every axis has all of its own drafts, the whole section goes
  // read-only. Re-answering past that point would only add an invisible
  // extra EWMA sample (no milestone, no stability change worth showing), so
  // it's clearer to just stop offering it than to let taps silently do
  // nothing meaningful.
  const fullProfileLocked = progress.total > 0 && progress.answered >= progress.total;

  const bankAxes = uniqueCategoryAxes(liveCategoryDefs);
  const bankRowsForAxis = useCallback(
    (axis: TraitAxis): CategoryQuestionRow[] =>
      bankProgressForAxis(axis, tracks ?? []).map((row) => ({
        key: `${row.axis}-${row.variant}`,
        axis: row.axis,
        draft: row.draft,
        answered: row.state === 'answered',
      })),
    [tracks],
  );
  const bankCompletedAxes = completedAxesFrom(bankAxes, bankRowsForAxis);
  const bankRows = bankAxes.flatMap((axis) => bankRowsForAxis(axis));

  const body = (
    <View style={styles.body}>
      <ThemedText type="small" themeColor="textSecondary">
        {QUESTIONS_LEDE}
      </ThemedText>
      {fullProfileLocked ? (
        // The finished 50-question bank is gone from the screen entirely
        // once a round exists — it used to stay visible (locked) with the
        // round appended below as a small "Submit" sub-block, which read as
        // unrelated/broken UI. Replacing it outright, not stacking.
        <OngoingRoundFold me={me} history={history} tracks={tracks ?? []} onUpdated={onUpdated} />
      ) : (
        <>
          {progress.total > 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              {progress.answered} of {progress.total} answered
            </ThemedText>
          ) : null}
          <PagedQuestions
            // Scoped per account, not just per question-set — this key backs
            // BOTH the remembered scroll position (category-page-position.ts,
            // pre-existing) and the answered-option stamp storage
            // (answered-option-storage.ts, new). Unscoped, a second account
            // signed in on the same device would see the first account's
            // answer stamps on questions it never answered (found in review).
            storageKey={`full-profile:${me.id}`}
            rows={bankRows}
            progressLabel={`${bankCompletedAxes.length} of ${bankAxes.length} axes complete`}
            onSaveBatch={saveBankAnswers}
          />
        </>
      )}
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
          <ThemedText style={styles.questionPrompt}>{item.prompt}</ThemedText>
          <View style={styles.options}>
            {item.options.map((option, index) => {
              const picked = pickedOption?.itemId === item.id && pickedOption.index === index;
              return (
                <ThemedPressable
                  key={`${item.id}-${index}`}
                  disabled={busy}
                  accessibilityState={{ selected: picked }}
                  onPress={() => void pick(item, index)}
                  style={[
                    styles.option,
                    { borderColor: controlBorderColor(theme) },
                    picked && { backgroundColor: theme.backgroundSelected },
                  ]}>
                  <ThemedText type="smallBold">{option.text}</ThemedText>
                </ThemedPressable>
              );
            })}
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
    <SettingsFold title={title} defaultOpen={defaultOpen} onOpen={handleOpen}>
      {body}
    </SettingsFold>
  );
}

/**
 * Post-Full-Profile ongoing round (T-03, core loop redesign §2/§3). Shown
 * once the frozen 50-question intake above (`fullProfileLocked`) is done — a
 * self-contained sibling, not a branch inside the intake/Infinite-Questions
 * state above: it has its own load/answer cycle against its own persisted
 * pack (`question_packs.kind='ongoing_round'`, `fetchLatestOngoingRoundPack`),
 * distinct from both the frozen bank and Infinite Questions' daily-cache
 * pack. No pack yet (or the last one is fully answered) offers a "start"
 * CTA that calls `runOngoingRound` (the real `composeOngoingRound` wiring)
 * and saves the result via `saveOngoingRoundBatch`/`insert_ongoing_round_pack`
 * in one shot; otherwise it serves the pack's next unanswered item, reusing
 * the same `answerQuestionItem` + `updateTraits` write path Infinite
 * Questions' `pick()` above already uses.
 */
function OngoingRoundFold({
  me,
  history,
  tracks,
  onUpdated,
}: {
  me: Me;
  history: CheckHistory[];
  tracks: readonly TraitTrack[];
  onUpdated: () => Promise<void>;
}) {
  const theme = useTheme();
  const [pack, setPack] = useState<QuestionPackRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [errorKind, setErrorKind] = useState<'load' | 'start' | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  // Per-row, not a single flag — a page of the round pager shows several
  // unanswered rows at once, each independently rerollable.
  const [rerollBusyByItem, setRerollBusyByItem] = useState<Record<string, boolean>>({});
  const [rerollNoteByItem, setRerollNoteByItem] = useState<Record<string, string>>({});
  const atoBalance = atoTokenBalanceOf(me);
  const canRerollQuestion = atoBalance >= ATO_TOKEN_PRICE.question_reroll;

  const load = useCallback(async () => {
    setLoading(true);
    setErrorKind(null);
    setErrorDetail(null);
    try {
      const existing = await withTimeout(fetchLatestOngoingRoundPack(), 25000, 'ongoing-round-load');
      setPack(existing);
      // ATO tokens T-04: if the last answer's claim call was lost (app
      // closed/offline before it fired), retry it here on load — the RPC
      // dedupes on pack id, so a redundant claim for an already-claimed
      // pack is a harmless no-op, never a double award.
      if (existing && nextUnansweredItem(existing) === null) {
        claimOngoingRoundCompleteQuiet(existing.id);
      } else if (!existing) {
        // No ongoing round has ever been started for this account — this
        // only happens once, the first time this section mounts after the
        // frozen 50-question intake finishes. Auto-start it (bank-first,
        // AI-fallback) instead of waiting on a manual "Start your next
        // round" tap, so finishing the intake immediately releases the
        // next batch of questions.
        void start();
      }
    } catch (err) {
      console.log('[ongoing-round] load error:', err);
      Sentry.captureException(err, { tags: { stage: 'ongoing-round-load' } });
      setErrorKind('load');
      setErrorDetail(String(err));
      // Bounded, non-blocking — a stalled flush must never leave the error
      // card (and its Try again button) stuck behind a spinner (found in review).
      void Sentry.flush();
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start is a stable function-scope declaration re-created each render, not state; including it would defeat this callback's mount-once identity for no correctness benefit
  }, []);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-once load
  }, []);

  async function start() {
    if (starting) return;
    setStarting(true);
    setErrorKind(null);
    setErrorDetail(null);
    try {
      const ongoingMe = {
        name: me.name,
        talk_style: me.talk_style ?? 'even',
        voice_preset: me.voice_preset,
        sage_knows: me.sage_knows,
        facts: me.facts,
      };
      // 40s, not 25s: composing a 25-item round can take several sequential
      // AI calls (up to 5 chunks, see chunked-generate.ts) — each now has
      // its own bounded per-call timeout (ai/generate.ts, ai-generate edge
      // function), but the outer budget still needs enough room for a
      // realistic (not pathological) chain to finish rather than always
      // racing the whole composition against a ceiling tuned for one call.
      const saved = await withTimeout(runOngoingRound(ongoingMe, history, tracks), 40000, 'ongoing-round-start');
      setPack(saved);
    } catch (err) {
      console.log('[ongoing-round] start error:', err);
      Sentry.captureException(err, { tags: { stage: 'ongoing-round-start' } });
      setErrorKind('start');
      setErrorDetail(String(err));
      void Sentry.flush();
    } finally {
      setStarting(false);
    }
  }

  /**
   * Saves a whole page's worth of ongoing-round answers in one batch, called
   * from the round pager only when Next Page is pressed (never per-tap) —
   * same batch-save discipline as the Full Profile bank's saveBankAnswers,
   * but through the persisted-pack write path (answerQuestionItem +
   * updateTraits per item), since QuestionItemRow — unlike the bank's
   * QuestionDraft — is a real, id-bearing row. Sequential per item: each
   * item can carry a different axis, so this can't collapse into one
   * updateTraits call the way the bank's does. Completion (round fully
   * answered → claim the token bonus) is checked once, against the batch's
   * combined effect, not per item.
   */
  async function saveRoundAnswers(
    answers: readonly { key: string; draft: QuestionDraft; option: QuestionOption; optIndex: number }[],
  ): Promise<boolean> {
    if (!pack) return false;
    try {
      for (const { key, draft, option, optIndex } of answers) {
        await answerQuestionItem(key, optIndex);
        await updateTraits(me.id, { [draft.axis]: option.value }, 'self_situation', [draft.axis]);
      }
      earnTokensQuiet('game_round');
      await onUpdated();
      // Functional update, not a closure read of `pack` — background saves
      // for different pages (or a concurrent reroll) can resolve in any
      // order, and a stale-closure write here would silently revert
      // whichever one landed first (found in review).
      const answeredKeys = new Set(answers.map((a) => a.key));
      const holder: { pack: QuestionPackRow | null } = { pack: null };
      setPack((prev) => {
        if (!prev) return prev;
        const updatedItems = prev.items.map((row) =>
          answeredKeys.has(row.id)
            ? { ...row, answeredOption: answers.find((a) => a.key === row.id)?.optIndex ?? row.answeredOption }
            : row,
        );
        holder.pack = { ...prev, items: updatedItems };
        return holder.pack;
      });
      // ATO tokens T-04: award the round-completion bonus the moment the
      // last item lands, evaluated against this batch's combined effect on
      // top of the true latest state. The RPC re-verifies completion
      // server-side and dedupes on pack id, so this can never double-award
      // even across overlapping batches.
      if (holder.pack && nextUnansweredItem(holder.pack) === null) {
        claimOngoingRoundCompleteQuiet(holder.pack.id);
      }
      return true;
    } catch (err) {
      console.log('[ongoing-round] batch answer error:', err);
      Sentry.captureException(err, { tags: { stage: 'ongoing-round-answer' }, extra: { packId: pack.id } });
      void Sentry.flush();
      return false;
    }
  }

  /**
   * Rerolls one row. Only ever offered (see renderRowExtra below) on a row
   * that is both unanswered AND has no local pending pick — the server's own
   * guard (wave54, `answered_option is not null` → raise) only knows about
   * PERSISTED answers, not a pick sitting unsaved in the pager's local state,
   * so the pending check has to happen here on the client (found during
   * planning, not the server's job to know about unsaved UI state).
   */
  async function reroll(row: CategoryQuestionRow) {
    if (!pack || rerollBusyByItem[row.key] || !canRerollQuestion) return;
    setRerollBusyByItem((prev) => ({ ...prev, [row.key]: true }));
    setRerollNoteByItem((prev) => ({ ...prev, [row.key]: '' }));
    try {
      const { result, item: updated } = await rerollQuestionItem({
        id: row.key,
        axis: row.axis,
        packId: pack.id,
      });
      if (result.reason === 'no_candidates') {
        setRerollNoteByItem((prev) => ({ ...prev, [row.key]: "Couldn't find a fresh question right now. Nothing spent." }));
        return;
      }
      if (!result.ok) {
        setRerollNoteByItem((prev) => ({
          ...prev,
          [row.key]: result.already ? 'Already rerolled today.' : ATO_TOKEN_NEED_MORE,
        }));
        return;
      }
      if (!updated) {
        setRerollNoteByItem((prev) => ({ ...prev, [row.key]: "Couldn't find a fresh question right now." }));
        return;
      }
      // Functional update — same reasoning as saveRoundAnswers: a
      // concurrent background batch save could resolve around this reroll,
      // and a stale-closure write here would revert it.
      setPack((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((item) =>
                item.id === updated.id ? { ...item, prompt: updated.prompt, options: updated.options } : item,
              ),
            }
          : prev,
      );
      // Refresh me so the ATO balance shown next to the (now-disabled-for-today) button is current.
      await onUpdated();
    } catch (err) {
      console.log('[ongoing-round] reroll error:', err);
      setRerollNoteByItem((prev) => ({ ...prev, [row.key]: "Couldn't reroll right now. Try again." }));
    } finally {
      setRerollBusyByItem((prev) => ({ ...prev, [row.key]: false }));
    }
  }

  const answeredCount = pack ? pack.items.filter((item) => item.answeredOption != null).length : 0;

  return (
    <View style={styles.body}>
      {loading ? (
        <ThemedText themeColor="textSecondary">Loading…</ThemedText>
      ) : errorKind ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            {errorKind === 'start'
              ? "Couldn't submit your answers. Try again."
              : "Couldn't load your next round. Try again."}
          </ThemedText>
          {errorDetail && PRE_LAUNCH_DEV ? (
            <ThemedText type="small" themeColor="textSecondary">
              {errorDetail}
            </ThemedText>
          ) : null}
          <ThemedPressable
            disabled={loading || starting}
            onPress={() => void (errorKind === 'start' ? start() : load())}
            style={[styles.option, { borderColor: controlBorderColor(theme) }]}>
            <ThemedText type="smallBold">Try again</ThemedText>
          </ThemedPressable>
        </>
      ) : !pack ? (
        <ThemedPressable
          disabled={starting}
          onPress={() => void start()}
          style={[styles.option, { borderColor: controlBorderColor(theme) }, starting && styles.disabled]}>
          <ThemedText type="smallBold">
            {starting ? 'Putting together your next round…' : 'Start your next round'}
          </ThemedText>
        </ThemedPressable>
      ) : nextUnansweredItem(pack) === null ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Round complete.
          </ThemedText>
          <ThemedPressable
            disabled={starting}
            onPress={() => void start()}
            style={[styles.option, { borderColor: controlBorderColor(theme) }, starting && styles.disabled]}>
            <ThemedText type="smallBold">
              {starting ? 'Putting together your next round…' : 'Start another round'}
            </ThemedText>
          </ThemedPressable>
        </>
      ) : (
        <PagedQuestions
          // Scoped per round, not just per account — a new round is a new
          // pack id, and this key forces PagedQuestions to fully remount
          // (fresh picked/pending/failed-batch state) rather than risk any
          // stale local state bleeding from one round into the next.
          key={pack.id}
          storageKey={`ongoing-round:${pack.id}:${me.id}`}
          rows={pack.items.map((item) => ({
            key: item.id,
            axis: item.axis,
            draft: { axis: item.axis, prompt: item.prompt, options: item.options },
            answered: item.answeredOption != null,
          }))}
          progressLabel={`${answeredCount} of ${pack.items.length} answered`}
          onSaveBatch={saveRoundAnswers}
          renderRowExtra={(row, isPending) => {
            if (row.answered || isPending) return null;
            const busy = rerollBusyByItem[row.key] ?? false;
            const note = rerollNoteByItem[row.key];
            return (
              <>
                <View style={styles.skipRow}>
                  <Pressable
                    onPress={() => void reroll(row)}
                    disabled={busy || !canRerollQuestion}
                    style={({ pressed }) => [
                      styles.skipLink,
                      pressed && styles.pressed,
                      (busy || !canRerollQuestion) && styles.disabled,
                    ]}>
                    <ThemedText type="smallBold">
                      {busy
                        ? 'Rerolling…'
                        : canRerollQuestion
                          ? `Reroll · ${atoPriceLine('question_reroll')}`
                          : ATO_TOKEN_NEED_MORE}
                    </ThemedText>
                  </Pressable>
                </View>
                {note ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {note}
                  </ThemedText>
                ) : null}
              </>
            );
          }}
        />
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
  // A bit larger than ThemedText's shared "default" (16/24) — local override
  // rather than changing the shared type, since that would resize default
  // body text everywhere else in the app too.
  questionPrompt: {
    fontSize: 18,
    lineHeight: 26,
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
