import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ProfileBinder } from '@/components/profile-binder';
import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { AXIS_POLE_NAME, AXIS_SHORT_NAME } from '@/lib/axis-poles';
import type { Me } from '@/lib/me';
import { currentProfileCard, type ProfileSnapshot } from '@/lib/profile-history';
import { BANK_BY_TRAIT } from '@/lib/questions/bank/index';
import {
  BANK_SET_COUNT,
  BANK_SET_SIZE,
  CHANGE_REASON_LABEL,
  changeRecommendations,
  TRAIT_CONFIDENCE_LABEL,
  traitConfidence,
  type BankProgress,
} from '@/lib/questions/bank-sets';
import {
  changeBankAnswer,
  fetchMyBankAnswers,
  fetchProfileSnapshots,
  fetchTraitFlags,
  startFresh,
  undoChangeSession,
} from '@/lib/questions/bank-sets-server';
import { isPremiumGated, premiumPriceFor } from '@/lib/questions/premium-gate';
import { controlBorderColor } from '@/lib/theme/chrome';
import { trackFor, type TraitTrack } from '@/lib/trait-stability';
import { TRAIT_AXES, traitStateFromRow, type TraitAxis } from '@/lib/traits';

/** Hold this long to Start Fresh — a tap can never wipe a profile. */
const START_FRESH_HOLD_MS = 2500;

function leaningLine(axis: TraitAxis, value: number | null | undefined): string {
  if (value == null) return 'No answers';
  if (value > 0.6) return `Leans ${AXIS_POLE_NAME[axis].high}`;
  if (value < 0.4) return `Leans ${AXIS_POLE_NAME[axis].low}`;
  return 'Right in the middle';
}

/**
 * After all 25 sets (emci 2026-10-06):
 *  - where each trait landed and how sure it is, suggested order first
 *    (flagged "this isn't me", mixed, low confidence, near the middle);
 *  - Change answers per trait: every question they answered, their answer
 *    marked; tap another option, tap again to confirm. The first change of a
 *    visit saves the profile as it was (the Undo point, saved by the server
 *    inside that first change_bank_answer); each change replaces the old answer and the
 *    server re-scores the trait. Undo puts every change of this visit back;
 *  - Start Fresh (hold to confirm) with keep (default) or wipe for the cards;
 *  - the card binder: the live profile and every saved one, tap two to compare.
 * Change answers and Start Fresh are free while the premium gate is off.
 */
export function BankFinishFold({
  me,
  tracks,
  progress,
  onUpdated,
  onReload,
  preview,
}: {
  me: Me;
  tracks: readonly TraitTrack[];
  progress: BankProgress;
  onUpdated: () => Promise<void>;
  onReload: () => Promise<void>;
  /** Dev lab only (/profile-card-lab): fixed data, no server reads or writes. */
  preview?: { snapshots: ProfileSnapshot[]; answers: Map<string, number>; flags?: Set<TraitAxis> };
}) {
  const theme = useTheme();
  const border = { borderColor: controlBorderColor(theme) };
  const [flags, setFlags] = useState<Set<TraitAxis>>(preview?.flags ?? new Set());
  const [snapshots, setSnapshots] = useState<ProfileSnapshot[]>(preview?.snapshots ?? []);
  const [answers, setAnswers] = useState<Map<string, number>>(preview?.answers ?? new Map());
  const [open, setOpen] = useState<TraitAxis | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [session, setSession] = useState<string | null>(null);
  const [changed, setChanged] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [keepHistory, setKeepHistory] = useState(true);
  // Each changed question's answer from before this visit, so the lab preview
  // can put them back on Undo (the real Undo reloads them from the server).
  const originals = useRef<Map<string, number | undefined>>(new Map());

  const load = useCallback(async () => {
    if (preview) return;
    try {
      const [nextFlags, nextSnapshots, nextAnswers] = await Promise.all([
        fetchTraitFlags(),
        fetchProfileSnapshots(),
        fetchMyBankAnswers(),
      ]);
      setFlags(nextFlags);
      setSnapshots(nextSnapshots);
      setAnswers(nextAnswers);
    } catch (err) {
      console.log('[bank-finish] load error:', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- preview is fixed for the life of the lab screen
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const picks = changeRecommendations(tracks, flags);
  const pickReason = new Map(picks.map((p) => [p.axis, p.reason]));
  const ordered = [...picks.map((p) => p.axis), ...TRAIT_AXES.filter((axis) => !pickReason.has(axis))];

  const values = traitStateFromRow(me).values;
  const cards = useMemo(
    () => [currentProfileCard(values, progress.answeredIds.size, new Date().toISOString()), ...snapshots],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the values themselves (me.updated_at does not move on a re-score)
    [JSON.stringify(values), snapshots, progress.answeredIds.size],
  );

  async function pickOption(questionId: string, optionIndex: number) {
    if (busy || isPremiumGated('change_answers')) return;
    // The current answer: tapping it again does nothing (no write, no snapshot).
    if (answers.get(questionId) === optionIndex) {
      setArmed(null);
      return;
    }
    const key = `${questionId}:${optionIndex}`;
    if (armed !== key) {
      setArmed(key);
      return;
    }
    setArmed(null);
    setBusy(true);
    setNote(null);
    try {
      // The first change of this visit (session null) makes the server save
      // the Undo point first; the lab preview never calls the server.
      const id = preview ? (session ?? 'preview') : await changeBankAnswer(session, questionId, optionIndex);
      if (!session) setSession(id);
      if (!originals.current.has(questionId)) originals.current.set(questionId, answers.get(questionId));
      setAnswers((prev) => new Map(prev).set(questionId, optionIndex));
      setChanged((n) => n + 1);
      await onUpdated();
    } catch (err) {
      console.log('[bank-finish] change error:', err);
      setNote("Couldn't change that answer. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (busy || !session) return;
    if (armed !== 'undo') {
      setArmed('undo');
      return;
    }
    setArmed(null);
    setBusy(true);
    setNote(null);
    try {
      const n = preview ? changed : await undoChangeSession(session);
      setSession(null);
      setChanged(0);
      // Taken before the ref is cleared: the state updater runs later.
      const restore = originals.current;
      if (preview) {
        setAnswers((prev) => {
          const next = new Map(prev);
          for (const [id, option] of restore) {
            if (option == null) next.delete(id);
            else next.set(id, option);
          }
          return next;
        });
      }
      originals.current = new Map();
      await load();
      await onUpdated();
      setNote(`Undone. ${n} answer${n === 1 ? '' : 's'} back the way they were.`);
    } catch (err) {
      console.log('[bank-finish] undo error:', err);
      setNote("Couldn't undo right now. Your changes are still in place.");
    } finally {
      setBusy(false);
    }
  }

  async function doStartFresh() {
    if (busy || isPremiumGated('start_fresh')) return;
    if (preview) {
      setNote(`Lab: Start Fresh would run here (${keepHistory ? 'keeping' : 'wiping'} the cards). Nothing was sent.`);
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      await startFresh(keepHistory);
      await onUpdated();
      await onReload();
    } catch (err) {
      console.log('[bank-finish] start fresh error:', err);
      setNote("Couldn't start fresh. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.body}>
      <ThemedText type="smallBold">All {BANK_SET_COUNT} sets done</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {BANK_SET_COUNT * BANK_SET_SIZE} answers in. Here is where each trait landed. Change any answer, or start fresh.
      </ThemedText>
      {note ? (
        <ThemedText type="small" themeColor="textSecondary">
          {note}
        </ThemedText>
      ) : null}
      {session && changed > 0 ? (
        <View style={[styles.row, border]}>
          <ThemedText type="small">
            {changed} answer{changed === 1 ? '' : 's'} changed this visit. Undo works until you leave this screen.
          </ThemedText>
          <ThemedPressable onPress={() => void undo()} disabled={busy} style={[styles.chip, border]}>
            <ThemedText type="smallBold">{armed === 'undo' ? 'Tap again to undo all of them' : 'Undo'}</ThemedText>
          </ThemedPressable>
        </View>
      ) : null}

      {ordered.map((axis) => {
        const track = trackFor(tracks, axis, 'report');
        const reason = pickReason.get(axis);
        const answered = BANK_BY_TRAIT[axis].filter((q) => progress.answeredIds.has(q.id));
        return (
          <View key={axis} style={[styles.row, border]}>
            <ThemedText type="smallBold">{AXIS_SHORT_NAME[axis]}</ThemedText>
            <ThemedText type="small">
              {leaningLine(axis, track?.value)} · {TRAIT_CONFIDENCE_LABEL[traitConfidence(track)]}
            </ThemedText>
            {reason ? (
              <ThemedText type="code" themeColor="textSecondary">
                Worth a look: {CHANGE_REASON_LABEL[reason]}
              </ThemedText>
            ) : null}
            {open === axis ? (
              <View style={styles.list}>
                {answered.map((q) => {
                  const prior = answers.get(q.id);
                  return (
                    <View key={q.id} style={styles.question}>
                      <ThemedText type="small">{q.prompt}</ThemedText>
                      {prior == null ? (
                        <ThemedText type="code" themeColor="textSecondary">
                          Answered before answers were kept. Pick one to set it.
                        </ThemedText>
                      ) : null}
                      {q.options.map((opt, i) => {
                        const isPrior = prior === i;
                        const isArmed = armed === `${q.id}:${i}`;
                        return (
                          <ThemedPressable
                            key={opt.text}
                            disabled={busy}
                            onPress={() => void pickOption(q.id, i)}
                            accessibilityState={{ selected: isPrior }}
                            accessibilityHint={isPrior ? 'Your current answer' : 'Tap twice to change to this answer'}
                            style={[
                              styles.option,
                              border,
                              // The same selected look as a picked answer in a set (paged-questions.tsx).
                              isPrior && { backgroundColor: theme.backgroundSelected, borderColor: theme.accent, borderWidth: 2 },
                            ]}>
                            <ThemedText type={isPrior ? 'smallBold' : 'small'}>
                              {isArmed ? `Tap again: change to “${opt.text}”` : isPrior ? `✓ ${opt.text}` : opt.text}
                            </ThemedText>
                          </ThemedPressable>
                        );
                      })}
                    </View>
                  );
                })}
                <ThemedPressable onPress={() => setOpen(null)} style={styles.link}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Done
                  </ThemedText>
                </ThemedPressable>
              </View>
            ) : answered.length > 0 ? (
              <ThemedPressable onPress={() => setOpen(axis)} disabled={busy} style={styles.link}>
                <ThemedText type="small">
                  Change answers
                  {isPremiumGated('change_answers') ? ` · ${premiumPriceFor('change_answers')} premium` : ' · free'}
                </ThemedText>
              </ThemedPressable>
            ) : null}
          </View>
        );
      })}

      <View style={[styles.row, border]}>
        <ThemedText type="smallBold">Start fresh</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Wipes all 16 traits so you can answer everything again. Tokens and your account stay as they are.
        </ThemedText>
        <View style={styles.chips}>
          <ThemedPressable
            onPress={() => setKeepHistory(true)}
            accessibilityState={{ selected: keepHistory }}
            style={[styles.chip, border, keepHistory && styles.prior]}>
            <ThemedText type={keepHistory ? 'smallBold' : 'small'}>Keep my cards</ThemedText>
          </ThemedPressable>
          <ThemedPressable
            onPress={() => setKeepHistory(false)}
            accessibilityState={{ selected: !keepHistory }}
            style={[styles.chip, border, !keepHistory && styles.prior]}>
            <ThemedText type={!keepHistory ? 'smallBold' : 'small'}>Wipe my cards too</ThemedText>
          </ThemedPressable>
        </View>
        <ThemedText type="code" themeColor="textSecondary">
          {keepHistory
            ? 'Your current profile is saved as a card first, with all the others.'
            : 'Every saved card is deleted too. This cannot be undone.'}
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityHint="Press and hold to start fresh"
          delayLongPress={START_FRESH_HOLD_MS}
          onLongPress={() => void doStartFresh()}
          disabled={busy || isPremiumGated('start_fresh')}
          style={({ pressed }) => [styles.chip, border, pressed && styles.holding]}>
          <ThemedText type="smallBold">{busy ? 'Starting fresh…' : 'Hold to start fresh'}</ThemedText>
        </Pressable>
      </View>

      <View style={styles.binder}>
        <ThemedText type="smallBold">Your cards</ThemedText>
        <ProfileBinder cards={cards} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: Spacing.three,
  },
  row: {
    gap: Spacing.one,
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  list: {
    gap: Spacing.three,
    paddingTop: Spacing.two,
  },
  question: {
    gap: Spacing.one,
  },
  option: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  prior: {
    borderWidth: 2,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    alignItems: 'center',
  },
  chip: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    alignSelf: 'flex-start',
  },
  link: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  holding: {
    opacity: 0.6,
  },
  binder: {
    gap: Spacing.two,
  },
});
