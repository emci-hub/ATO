import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BankFinishFold } from '@/components/bank-finish-fold';
import { PagedQuestions } from '@/components/paged-questions';
import { SkeletonCard } from '@/components/motion';
import { SetDoneMoment, type SetDoneMomentState } from '@/components/set-done-moment';
import { SetProgress } from '@/components/set-progress';
import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { claimFullProfileCompleteQuiet, claimOngoingRoundCompleteQuiet } from '@/lib/ato-tokens-server';
import { ROUND_PAYOUTS_PER_DAY } from '@/lib/ato-tokens';
import { pushBuddyNote } from '@/lib/buddy/notes';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { isFullProfileDone } from '@/lib/full-profile-gate';
import type { Me } from '@/lib/me';
import {
  BANK_COPY_REVIEWED,
  BANK_SET_SIZE,
  BANK_STAGE_LABEL,
  bankStageLine,
  type BankProgress,
} from '@/lib/questions/bank-sets';
import { fetchBankProgress, serveBankSet } from '@/lib/questions/bank-sets-server';
import { mixSeed } from '@/lib/questions/mix-order';
import { ROUND_COMPLETE_TITLE, roundCompleteBody } from '@/lib/questions/progressive-unlock';
import { roundCapLine } from '@/lib/questions/staged-intake-copy';
import { fetchQuestionPack } from '@/lib/questions/store';
import type { QuestionPackRow } from '@/lib/questions/types';
import { Sentry } from '@/lib/sentry';
import { controlBorderColor } from '@/lib/theme/chrome';
import { answerBankItem } from '@/lib/trait-checkpoint';
import { type TraitTrack } from '@/lib/trait-stability';
import { withTimeout } from '@/lib/timeout';
import type { CheckHistory } from '@/lib/voice/types';

function packDone(pack: QuestionPackRow): boolean {
  return pack.items.every((item) => item.answeredOption != null || item.skippedAt != null);
}

/**
 * The Questions screen (fixed bank, emci 2026-10-06). Every visit is a set of
 * 16 from the stored bank — one per trait, picked and scored by the server
 * (`serve_bank_set` / `answer_bank_item`, wave85). No AI, no consent gate, no
 * waiting: a set is a database read. Sets 1-3 are the first read (the
 * once-ever +21 when the 48 are in), 4-8 complete the profile, 9-25 are
 * bonus sets that pay like the old rounds. After set 25 the screen becomes
 * the Change answers / history view (BankFinishFold).
 */
export function QuestionsFold({
  me,
  onUpdated,
  tracks: tracksProp,
}: {
  me: Me;
  history: CheckHistory[];
  onUpdated: () => Promise<void>;
  /** Kept for the Questions tab's call site: there is no collapsed mode. */
  alwaysOpen?: boolean;
  /** Report tracks — the full-profile gate and the finish view. */
  tracks?: readonly TraitTrack[];
}) {
  const theme = useTheme();
  const tracks = tracksProp ?? [];
  const [progress, setProgress] = useState<BankProgress | null>(null);
  const [pack, setPack] = useState<QuestionPackRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [moment, setMoment] = useState<SetDoneMomentState | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorDetail(null);
    try {
      const next = await withTimeout(fetchBankProgress(), 25000, 'bank-progress');
      setProgress(next);
      if (next.currentSet == null) {
        setPack(null);
        return;
      }
      // Returns the open set if there is one, else picks a new one.
      const packId = await withTimeout(serveBankSet(), 25000, 'bank-serve');
      const loaded = await withTimeout(fetchQuestionPack(packId), 25000, 'bank-pack');
      setPack(loaded);
      // A finished set whose claim was lost (app closed) is re-asked here;
      // the server dedupes on the pack, so a repeat never pays twice.
      if (loaded && loaded.kind === 'ongoing_round' && packDone(loaded)) {
        claimOngoingRoundCompleteQuiet(loaded.id, ({ fresh }) => {
          if (fresh) void onUpdated();
        });
      }
    } catch (err) {
      console.log('[bank] load error:', err);
      Sentry.captureException(err, { tags: { stage: 'bank-load' } });
      setErrorDetail(String(err));
      void Sentry.flush();
    } finally {
      setLoading(false);
    }
  }, [onUpdated]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-once load
  }, []);

  // ATO tokens: +21 for finishing the first read (the 48), once ever. The
  // server enforces the once and that every trait has its 3 (wave78), so a
  // repeat ask is a harmless no-op that also back-pays an earlier finish.
  const fullProfileLocked = isFullProfileDone(tracks, tracksProp != null);
  const intakeClaimAsked = useRef(false);
  useEffect(() => {
    if (!fullProfileLocked || intakeClaimAsked.current) return;
    intakeClaimAsked.current = true;
    claimFullProfileCompleteQuiet(() => {
      // Runs only on a fresh payout: this visit is the one that finished the 48.
      setMoment({ kind: 'all', coin: true });
      void onUpdated();
    });
  }, [fullProfileLocked, onUpdated]);

  async function saveAnswers(
    answers: readonly { key: string; optIndex: number }[],
  ): Promise<boolean> {
    if (!pack) return false;
    try {
      // One checkpoint call per item, in order: each one locks and scores
      // that person's trait row, so they must not run at the same time.
      for (const { key, optIndex } of answers) {
        await answerBankItem(key, optIndex);
      }
      // One pager per pack and one save at a time, so `pack` is current here.
      const keys = new Map(answers.map((a) => [a.key, a.optIndex]));
      const next: QuestionPackRow = {
        ...pack,
        items: pack.items.map((row) => (keys.has(row.id) ? { ...row, answeredOption: keys.get(row.id) ?? null } : row)),
      };
      setPack(next);
      await onUpdated();
      const finished = next;
      if (packDone(finished)) {
        // Sets 1 and 2 pay nothing, so no coin.
        if (finished.setNo === 1 || finished.setNo === 2) {
          setMoment({ kind: finished.setNo === 1 ? 'set1' : 'set2', coin: false });
        }
        // Set 3 finishes the 48: the full-profile claim above shows 'all'.
        if (finished.kind === 'ongoing_round') {
          claimOngoingRoundCompleteQuiet(finished.id, ({ paid, fresh, capped }) => {
            pushBuddyNote({
              id: `round:${finished.id}`,
              title: ROUND_COMPLETE_TITLE,
              body: roundCompleteBody(tracks, paid, capped),
              loud: true,
            });
            setMoment({
              kind: 'round',
              coin: paid && fresh,
              note: capped ? roundCapLine(ROUND_PAYOUTS_PER_DAY) : undefined,
            });
            if (fresh) void onUpdated();
          });
        } else if ((finished.setNo ?? 0) > 3) {
          setMoment({ kind: 'round', coin: false });
        }
        setProgress(await fetchBankProgress());
      }
      return true;
    } catch (err) {
      console.log('[bank] answer error:', err);
      Sentry.captureException(err, { tags: { stage: 'bank-answer' }, extra: { packId: pack.id } });
      void Sentry.flush();
      return false;
    }
  }

  const answered = pack ? pack.items.filter((item) => item.answeredOption != null).length : 0;
  const draftNote =
    !BANK_COPY_REVIEWED && PRE_LAUNCH_DEV ? (
      <ThemedText type="code" themeColor="textSecondary">
        Draft copy — waiting on emci review.
      </ThemedText>
    ) : null;

  let content: React.ReactNode;
  if (loading) {
    content = <SkeletonCard lines={4} />;
  } else if (errorDetail || !progress) {
    content = (
      <>
        <ThemedText type="small" themeColor="textSecondary">
          Couldn&apos;t load your questions. Check your connection and try again.
        </ThemedText>
        {errorDetail && PRE_LAUNCH_DEV ? (
          <ThemedText type="small" themeColor="textSecondary">
            {errorDetail}
          </ThemedText>
        ) : null}
        <ThemedPressable onPress={() => void load()} style={[styles.button, { borderColor: controlBorderColor(theme) }]}>
          <ThemedText type="smallBold">Try again</ThemedText>
        </ThemedPressable>
      </>
    );
  } else if (progress.stage === 'complete') {
    content = <BankFinishFold me={me} tracks={tracks} progress={progress} onUpdated={onUpdated} onReload={load} />;
  } else if (!pack || packDone(pack)) {
    content = (
      <>
        <SetProgress
          title={`${BANK_STAGE_LABEL[progress.stage]} · Set ${progress.currentSet} done`}
          bars={[BANK_SET_SIZE]}
          size={BANK_SET_SIZE}
          footnote={bankStageLine(progress)}
          me={me}
          tracks={tracks}
        />
        {draftNote}
        <ThemedPressable onPress={() => void load()} style={[styles.button, { borderColor: controlBorderColor(theme) }]}>
          <ThemedText type="smallBold">Next set</ThemedText>
        </ThemedPressable>
      </>
    );
  } else {
    content = (
      <>
        <SetProgress
          title={`${BANK_STAGE_LABEL[progress.stage]} · Set ${pack.setNo ?? progress.currentSet}`}
          bars={[answered]}
          size={pack.items.length}
          footnote={bankStageLine(progress)}
          me={me}
          tracks={tracks}
        />
        {draftNote}
        <PagedQuestions
          key={pack.id}
          storageKey={`bank-set:${pack.id}:${me.id}`}
          mixSeed={mixSeed(me.id, `bank:${pack.id}`)}
          rows={pack.items.map((item) => ({
            key: item.id,
            axis: item.axis,
            draft: { axis: item.axis, prompt: item.prompt, options: item.options },
            answered: item.answeredOption != null,
            answeredIndex: item.answeredOption,
          }))}
          progressLabel={`${answered} of ${pack.items.length} answered`}
          onSaveBatch={saveAnswers}
        />
      </>
    );
  }

  return (
    <View style={styles.body}>
      <SetDoneMoment moment={moment} me={me} tracks={tracks} onClose={() => setMoment(null)} />
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  button: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
});
