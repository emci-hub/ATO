import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  PagedQuestions,
  completedAxesFrom,
  uniqueCategoryAxes,
  type CategoryQuestionRow,
} from '@/components/paged-questions';
import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCategoryDefs } from '@/lib/category-catalog';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { AI_CONSENT_NEEDED_COPY, aiConsentFor, type Me } from '@/lib/me';
import { answerRoundItem } from '@/lib/trait-checkpoint';
import { claimFullProfileCompleteQuiet, claimOngoingRoundCompleteQuiet } from '@/lib/ato-tokens-server';
import { ATO_TOKEN_PRICE, atoPriceLine, atoTokenBalanceOf, ATO_TOKEN_NEED_MORE } from '@/lib/ato-tokens';
import { rerollQuestionItem } from '@/lib/questions/reroll';
import { Sentry } from '@/lib/sentry';
import { type TraitTrack } from '@/lib/trait-stability';
import { type TraitAxis } from '@/lib/traits';
import { applyQuestionAnswer } from '@/lib/questions/answer';
import { bankProgressForAxis, bankTotalProgress } from '@/lib/questions/local';
import {
  currentIntakeSet,
  hasOptionalLegacyQuestions,
  INTAKE_SETS,
} from '@/lib/questions/intake-stage';
import {
  intakeSetHeader,
  legacyNewQuestionsLine,
  nextRoundLabel,
  STAGED_INTAKE_COPY_REVIEWED,
} from '@/lib/questions/staged-intake-copy';
import { ONGOING_ROUND_SIZE } from '@/lib/questions/tiered-axis-plan';
import { fullProfileLockedLine, isFullProfileDone } from '@/lib/full-profile-gate';
import {
  ROUND_COMPLETE_TITLE,
  UNLOCK_COPY_REVIEWED,
  roundCompleteBody,
  roundStandingLine,
} from '@/lib/questions/progressive-unlock';
import { runOngoingRound } from '@/lib/questions/run-ongoing-round';
import { prewarmBankPool } from '@/lib/questions/run-prewarm';
import { isUnansweredQuestionItem } from '@/lib/questions/rotation';
import { fetchLatestOngoingRoundPack } from '@/lib/questions/store';
import type {
  QuestionDraft,
  QuestionOption,
  QuestionPackRow,
} from '@/lib/questions/types';
import { controlBorderColor } from '@/lib/theme/chrome';
import { pushBuddyNote } from '@/lib/buddy/notes';
import type { CheckHistory } from '@/lib/voice/types';
import { withTimeout } from '@/lib/timeout';

/**
 * Ongoing-round completion, matching `claim_ongoing_round_complete` (wave52)
 * exactly: every item answered, skips NOT treated as resolved. Deliberately
 * not a "next unanswered" scan — see `isUnansweredQuestionItem` (rotation.ts)
 * for why the round path needs this stricter predicate. The looser one existed
 * for the Infinite Questions feed, deleted 2026-09-16.
 */
function roundFullyAnswered(pack: QuestionPackRow): boolean {
  return !pack.items.some((item) => isUnansweredQuestionItem(item));
}

/**
 * REMOVED 2026-09-16 (emci): the Infinite Questions inline feed that used to
 * render here — the single routed question, its options, "Skip this one" /
 * "Skip the rest", the checkpoint/"Keep going" pause, the empty-state copy
 * and the "Load more" press. It rendered UNCONDITIONALLY below the branch
 * below, so once the profile was done it sat underneath "Next 25 questions"
 * inside the same card, as a second, unrelated question feed nobody asked
 * for. Its whole pipeline went with it (`routeQuestions`, the
 * `question_packs` cache reads/writes, the skip writes) — see the deletion
 * note in `lib/questions/route.ts`'s removal.
 *
 * The card chrome went too: the old title (the section label plus an
 * unanswered-axis count) and the lede under it both described that feed,
 * not the bank and not the round. Their strings lived in the deleted
 * `lib/questions/copy.ts`; `check:questions` asserts neither comes back.
 */
export function QuestionsFold({
  me,
  history,
  onUpdated,
  alwaysOpen = false,
  tracks,
}: {
  me: Me;
  history: CheckHistory[];
  onUpdated: () => Promise<void>;
  /**
   * Render with no collapse header. The only mode the Questions tab uses, and
   * the only one left: the collapsible path existed to lazy-load the deleted
   * Infinite Questions feed on expand.
   */
  alwaysOpen?: boolean;
  /** Report tracks — the full-profile gate, and the bank's own progress. */
  tracks?: readonly TraitTrack[];
}) {
  // Live-subscribed catalog (same hook categories-fold.tsx/category-teaser.tsx
  // already use) — PagedQuestions needs the current list, not a
  // mount-time snapshot, since a category_defs fetch can swap the array
  // while this screen is open.
  const liveCategoryDefs = useCategoryDefs();
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
      await onUpdated();
      return true;
    } catch (err) {
      console.log('[questions] category batch answer error:', err);
      return false;
    }
  }

  const progress = bankTotalProgress(tracks ?? []);
  // Full Profile is the intake's 48 questions, 3 per trait, asked as 3 sets
  // of 16 (staged intake, 2026-10-02) — once every trait has its 3 (or the
  // account finished the old 50), the whole section goes read-only. Re-answering past that point would only add an invisible
  // extra EWMA sample (no milestone, no stability change worth showing), so
  // it's clearer to just stop offering it than to let taps silently do
  // nothing meaningful.
  // The ONE gate (lib/full-profile-gate.ts) — `tracks == null` means they
  // haven't loaded yet, which is exactly the not-ready case the flag is for.
  const fullProfileLocked = isFullProfileDone(tracks ?? [], tracks != null);

  // ATO tokens: +21 for finishing the intake, once ever. The server enforces
  // the once (and that every trait has its 3, or the old 50 exist; wave78), so asking again on a later visit is a
  // harmless no-op that also back-pays an account that finished earlier. Not an
  // AI call. One ask per mount.
  const intakeClaimAsked = useRef(false);
  useEffect(() => {
    if (!fullProfileLocked || intakeClaimAsked.current) return;
    intakeClaimAsked.current = true;
    claimFullProfileCompleteQuiet(() => void onUpdated());
  }, [fullProfileLocked, onUpdated]);

  const bankAxes = uniqueCategoryAxes(liveCategoryDefs);
  // Set-major, not trait-major: set N is draft N-1 of every trait, so every
  // trait moves one step per set (it used to be all of one trait, then the
  // next, which left the last pages always the same four traits). Only the
  // set in progress is on screen; its own storage key starts it on page 1.
  const set = currentIntakeSet(tracks ?? []);
  const setNumber = set?.set ?? null;
  const optionalLegacy = hasOptionalLegacyQuestions(tracks ?? []);
  const bankRowsForAxis = useCallback(
    (axis: TraitAxis): CategoryQuestionRow[] => {
      if (setNumber == null) return [];
      const row = bankProgressForAxis(axis, tracks ?? [])[setNumber - 1];
      if (!row) return [];
      return [
        {
          key: `${row.axis}-${row.variant}`,
          axis: row.axis,
          draft: row.draft,
          answered: row.state === 'answered',
        },
      ];
    },
    [tracks, setNumber],
  );
  const bankCompletedAxes = completedAxesFrom(bankAxes, bankRowsForAxis);
  const bankRows = bankAxes.flatMap((axis) => bankRowsForAxis(axis));
  const setPager =
    set && bankRows.length > 0 ? (
      <>
        <ThemedText type="smallBold">{intakeSetHeader(set.set, INTAKE_SETS)}</ThemedText>
        {!STAGED_INTAKE_COPY_REVIEWED && PRE_LAUNCH_DEV ? (
          <ThemedText type="code" themeColor="textSecondary">
            Draft copy — waiting on emci review.
          </ThemedText>
        ) : null}
        <PagedQuestions
          // A new set is a new pager: remount so it starts on page 1 with no
          // "missed" flags carried over from the set just finished.
          key={`set-${set.set}`}
          // Scoped per account AND per set. This key backs both the
          // remembered page position (category-page-position.ts) and the
          // answered-option stamps (answered-option-storage.ts); per set, each
          // set opens on its first page.
          storageKey={`full-profile:${me.id}:set${set.set}`}
          rows={bankRows}
          progressLabel={`${set.answered} of ${set.size} in this set · ${bankCompletedAxes.length} of ${bankAxes.length} traits`}
          onSaveBatch={saveBankAnswers}
        />
      </>
    ) : null;

  const body = (
    <View style={styles.body}>
      {fullProfileLocked ? (
        // The finished intake is gone from the screen entirely once a round
        // exists — it used to stay visible (locked) with the round appended
        // below, which read as unrelated/broken UI. Replacing it outright.
        // One exception: an account that finished the OLD 50 still has the
        // restored third questions, offered as optional above its round.
        <>
          {optionalLegacy ? (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                {legacyNewQuestionsLine(set ? set.size - set.answered : 0)}
              </ThemedText>
              {setPager}
            </>
          ) : null}
          <OngoingRoundFold me={me} history={history} tracks={tracks ?? []} onUpdated={onUpdated} />
        </>
      ) : (
        <>
          {progress.total > 0 ? (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                {progress.answered} of {progress.total} answered
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {fullProfileLockedLine(
                  progress,
                  `your next ${ONGOING_ROUND_SIZE}, Home insight and story, and Explore categories`,
                )}
              </ThemedText>
            </>
          ) : null}
          {setPager}
        </>
      )}
    </View>
  );

  // No card wrapper and no title: the chrome belonged to the deleted feed.
  // Whichever branch renders — the bank list, or "Next 25 questions" — now
  // stands on its own in the same spot. `alwaysOpen` is kept as the prop that
  // says "no collapse header" (the only mode the Questions tab uses, and the
  // one `check:questions` pins); the old collapsible `SettingsFold` path went
  // with the feed, since `onOpen` existed only to load it.
  return body;
}

export const NEXT_ROUND_LABEL = nextRoundLabel(ONGOING_ROUND_SIZE);
export const NEXT_ROUND_BUSY_LABEL = `Putting together your next ${ONGOING_ROUND_SIZE}…`;

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
 * in one shot; otherwise it serves the pack's next unanswered item through
 * `answerQuestionItem` + `updateTraits`. That write path used to be shared
 * with the Infinite Questions feed above; since that feed was deleted
 * (2026-09-16) this is its only caller.
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
  // Set only by the answer that finishes a round, so the toast fires at that
  // moment and never on a later visit to an already-finished round.
  // Kept as the record that this round's result came back; the announcement
  // itself is the mini guy's (see the claim callback below).
  const [, setRoundToast] = useState<{ paid: boolean } | null>(null);
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
      if (existing && roundFullyAnswered(existing)) {
        claimOngoingRoundCompleteQuiet(existing.id);
      }
      // NO AUTO-START (ISOLATION_PLAN §7 Card D, emci 2026-09-15). This used to
      // call `start()` when no pack existed, so the first mount after the
      // 50-question intake composed a whole 25-item round — several chunked
      // model calls — without anyone asking for it. The "no pack" branch below
      // renders the NEXT_ROUND_LABEL button instead; that press is the only
      // thing that can compose a round.
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

  const consentGranted = aiConsentFor(me) === 'granted';

  async function start() {
    if (starting) return;
    if (!consentGranted) return;
    setStarting(true);
    setRoundToast(null);
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
      // 40s, not 25s: composing a 16-item round can take several sequential
      // AI calls (up to 4 chunks, see chunked-generate.ts) — each now has
      // its own bounded per-call timeout (ai/generate.ts, ai-generate edge
      // function), but the outer budget still needs enough room for a
      // realistic (not pathological) chain to finish rather than always
      // racing the whole composition against a ceiling tuned for one call.
      const saved = await withTimeout(runOngoingRound(ongoingMe, history, tracks), 40000, 'ongoing-round-start');
      setPack(saved);
      // Prewarm the shared bank for the NEXT round, now that this one is in
      // the user's hands. Deliberately after setPack and deliberately not
      // awaited: the whole point is to move generation off the path someone
      // is waiting on, so awaiting it here (or running it before the round
      // is served) would reintroduce exactly the latency it exists to
      // remove. Self-throttling and never throws — see run-prewarm.ts.
      void prewarmBankPool(ongoingMe, history, tracks);
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
      // One checkpoint call per item (wave79 answer_round_item): marks it
      // answered AND scores it in one server transaction, with the value read
      // from the stored item — the phone never sends a score.
      for (const { key, optIndex } of answers) {
        await answerRoundItem(key, optIndex);
      }
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
      // The round-end toast waits for the server's answer so it only names
      // the +21 when it is really in the balance, and a fresh payout refreshes
      // `me` — the balance used to stay stale until some later refresh.
      if (holder.pack && roundFullyAnswered(holder.pack)) {
        claimOngoingRoundCompleteQuiet(holder.pack.id, ({ paid, fresh }) => {
          // Said by the mini guy, pinned beside him, so it is seen wherever the
          // person is — not by a toast inside this fold.
          pushBuddyNote({
            id: `round:${holder.pack?.id ?? 'done'}`,
            title: ROUND_COMPLETE_TITLE,
            body: roundCompleteBody(tracks, paid),
            loud: true,
          });
          setRoundToast({ paid });
          if (fresh) void onUpdated();
        });
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
              ? `Couldn't put together your next ${ONGOING_ROUND_SIZE} — check your connection and try again.`
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
        consentGranted ? (
          <ThemedPressable
            disabled={starting}
            onPress={() => void start()}
            style={[styles.option, { borderColor: controlBorderColor(theme) }, starting && styles.disabled]}>
            <ThemedText type="smallBold">
              {starting ? NEXT_ROUND_BUSY_LABEL : NEXT_ROUND_LABEL}
            </ThemedText>
          </ThemedPressable>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            {AI_CONSENT_NEEDED_COPY}
          </ThemedText>
        )
      ) : roundFullyAnswered(pack) ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Round complete. {roundStandingLine(tracks)}
          </ThemedText>
          {!UNLOCK_COPY_REVIEWED && PRE_LAUNCH_DEV ? (
            <ThemedText type="code" themeColor="textSecondary">
              Draft copy — waiting on emci review.
            </ThemedText>
          ) : null}
          {consentGranted ? (
            <ThemedPressable
              disabled={starting}
              onPress={() => void start()}
              style={[styles.option, { borderColor: controlBorderColor(theme) }, starting && styles.disabled]}>
              <ThemedText type="smallBold">
                {starting ? NEXT_ROUND_BUSY_LABEL : NEXT_ROUND_LABEL}
              </ThemedText>
            </ThemedPressable>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              {AI_CONSENT_NEEDED_COPY}
            </ThemedText>
          )}
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
            answeredIndex: item.answeredOption,
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
