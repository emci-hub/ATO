import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PagedQuestions } from '@/components/paged-questions';
import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { AXIS_POLE_NAME, AXIS_SHORT_NAME } from '@/lib/axis-poles';
import type { Me } from '@/lib/me';
import {
  BANK_SET_COUNT,
  BANK_SET_SIZE,
  RETEST_REASON_LABEL,
  retestRecommendations,
  retestSizes,
  TRAIT_CONFIDENCE_LABEL,
  traitConfidence,
  type BankProgress,
} from '@/lib/questions/bank-sets';
import {
  fetchProfileSnapshots,
  fetchTraitFlags,
  serveBankRetest,
  startFresh,
  type ProfileSnapshot,
} from '@/lib/questions/bank-sets-server';
import { mixSeed } from '@/lib/questions/mix-order';
import { isPremiumGated, premiumPriceFor } from '@/lib/questions/premium-gate';
import { fetchOpenRetestPack, fetchQuestionPack } from '@/lib/questions/store';
import type { QuestionPackRow } from '@/lib/questions/types';
import { controlBorderColor } from '@/lib/theme/chrome';
import { answerBankItem } from '@/lib/trait-checkpoint';
import { trackFor, type TraitTrack } from '@/lib/trait-stability';
import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';

/** Hold this long to Start Fresh — a tap can never wipe a profile. */
const START_FRESH_HOLD_MS = 2500;

function leaningLine(axis: TraitAxis, value: number | null | undefined): string {
  if (value == null) return 'No answers';
  if (value > 0.6) return `Leans ${AXIS_POLE_NAME[axis].high}`;
  if (value < 0.4) return `Leans ${AXIS_POLE_NAME[axis].low}`;
  return 'Right in the middle';
}

/**
 * After all 25 sets (emci 2026-10-06): where each trait landed and how sure
 * it is, which traits are worth a retest, the retest itself (that trait's
 * old questions again; each new answer REPLACES the old one, server-side),
 * Start Fresh (hold to confirm; the old profile is saved first) and the saved
 * earlier profiles. Retest and Start Fresh are free while the premium gate
 * (premium-gate.ts) is off.
 */
export function BankFinishFold({
  tracks,
  progress,
  onUpdated,
  onReload,
}: {
  me: Me;
  tracks: readonly TraitTrack[];
  progress: BankProgress;
  onUpdated: () => Promise<void>;
  onReload: () => Promise<void>;
}) {
  const theme = useTheme();
  const border = { borderColor: controlBorderColor(theme) };
  const [flags, setFlags] = useState<Set<TraitAxis>>(new Set());
  const [snapshots, setSnapshots] = useState<ProfileSnapshot[]>([]);
  const [retest, setRetest] = useState<QuestionPackRow | null>(null);
  const [choosing, setChoosing] = useState<TraitAxis | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [nextFlags, nextSnapshots, open] = await Promise.all([
        fetchTraitFlags(),
        fetchProfileSnapshots(),
        fetchOpenRetestPack(),
      ]);
      setFlags(nextFlags);
      setSnapshots(nextSnapshots);
      setRetest(open);
    } catch (err) {
      console.log('[bank-finish] load error:', err);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const picks = retestRecommendations(tracks, flags);
  const pickReason = new Map(picks.map((p) => [p.axis, p.reason]));
  const ordered = [...picks.map((p) => p.axis), ...TRAIT_AXES.filter((axis) => !pickReason.has(axis))];

  async function beginRetest(axis: TraitAxis, count: number) {
    if (busy || isPremiumGated('retest')) return;
    setBusy(true);
    setNote(null);
    try {
      const packId = await serveBankRetest(axis, count);
      setRetest(await fetchQuestionPack(packId));
      setChoosing(null);
    } catch (err) {
      console.log('[bank-finish] retest error:', err);
      setNote("Couldn't start that retest. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function saveRetest(answers: readonly { key: string; optIndex: number }[]): Promise<boolean> {
    if (!retest) return false;
    try {
      for (const { key, optIndex } of answers) {
        await answerBankItem(key, optIndex);
      }
      const keys = new Map(answers.map((a) => [a.key, a.optIndex]));
      const next = {
        ...retest,
        items: retest.items.map((row) => (keys.has(row.id) ? { ...row, answeredOption: keys.get(row.id) ?? null } : row)),
      };
      await onUpdated();
      if (next.items.every((row) => row.answeredOption != null)) {
        setRetest(null);
        setNote(`Retest done. ${AXIS_SHORT_NAME[next.items[0]!.axis]} now reflects your new answers.`);
      } else {
        setRetest(next);
      }
      return true;
    } catch (err) {
      console.log('[bank-finish] retest answer error:', err);
      return false;
    }
  }

  async function doStartFresh() {
    if (busy || isPremiumGated('start_fresh')) return;
    setBusy(true);
    setNote(null);
    try {
      await startFresh();
      await onUpdated();
      await onReload();
    } catch (err) {
      console.log('[bank-finish] start fresh error:', err);
      setNote("Couldn't start fresh. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  }

  if (retest) {
    const answered = retest.items.filter((item) => item.answeredOption != null).length;
    const axis = retest.items[0]?.axis;
    return (
      <View style={styles.body}>
        <ThemedText type="smallBold">Retest{axis ? ` · ${AXIS_SHORT_NAME[axis]}` : ''}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Questions you answered before. Each new answer replaces the old one.
        </ThemedText>
        <PagedQuestions
          key={retest.id}
          storageKey={`bank-retest:${retest.id}`}
          mixSeed={mixSeed(retest.id, 'retest')}
          rows={retest.items.map((item) => ({
            key: item.id,
            axis: item.axis,
            draft: { axis: item.axis, prompt: item.prompt, options: item.options },
            answered: item.answeredOption != null,
            answeredIndex: item.answeredOption,
          }))}
          progressLabel={`${answered} of ${retest.items.length} answered`}
          onSaveBatch={saveRetest}
        />
      </View>
    );
  }

  return (
    <View style={styles.body}>
      <ThemedText type="smallBold">All {BANK_SET_COUNT} sets done</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {BANK_SET_COUNT * BANK_SET_SIZE} answers in. Here is where each trait landed. Retest any one, or start fresh.
      </ThemedText>
      {note ? (
        <ThemedText type="small" themeColor="textSecondary">
          {note}
        </ThemedText>
      ) : null}

      {ordered.map((axis) => {
        const track = trackFor(tracks, axis, 'report');
        const reason = pickReason.get(axis);
        const sizes = retestSizes(progress.answeredByAxis[axis]);
        return (
          <View key={axis} style={[styles.row, border]}>
            <ThemedText type="smallBold">{AXIS_SHORT_NAME[axis]}</ThemedText>
            <ThemedText type="small">
              {leaningLine(axis, track?.value)} · {TRAIT_CONFIDENCE_LABEL[traitConfidence(track)]}
            </ThemedText>
            {reason ? (
              <ThemedText type="code" themeColor="textSecondary">
                Worth a retest: {RETEST_REASON_LABEL[reason]}
              </ThemedText>
            ) : null}
            {choosing === axis ? (
              <View style={styles.chips}>
                {sizes.map((n) => (
                  <ThemedPressable
                    key={n}
                    disabled={busy}
                    onPress={() => void beginRetest(axis, n)}
                    style={[styles.chip, border]}>
                    <ThemedText type="smallBold">{n}</ThemedText>
                  </ThemedPressable>
                ))}
                <ThemedPressable onPress={() => setChoosing(null)} style={styles.link}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Not now
                  </ThemedText>
                </ThemedPressable>
              </View>
            ) : sizes.length > 0 ? (
              <ThemedPressable onPress={() => setChoosing(axis)} disabled={busy} style={styles.link}>
                <ThemedText type="small">
                  Retest this trait{isPremiumGated('retest') ? ` · ${premiumPriceFor('retest')} premium` : ' · free'}
                </ThemedText>
              </ThemedPressable>
            ) : null}
          </View>
        );
      })}

      <View style={[styles.row, border]}>
        <ThemedText type="smallBold">Start fresh</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Wipes all 16 traits so you can answer everything again. Your current profile is saved below first, so you can
          look back at it.
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

      {snapshots.length > 0 ? (
        <View style={[styles.row, border]}>
          <ThemedText type="smallBold">Earlier profiles</ThemedText>
          {snapshots.map((snap) => (
            <View key={snap.id} style={styles.snapshot}>
              <ThemedText type="code" themeColor="textSecondary">
                {new Date(snap.createdAt).toLocaleDateString()}
              </ThemedText>
              {TRAIT_AXES.map((axis) => (
                <ThemedText key={axis} type="small" themeColor="textSecondary">
                  {AXIS_SHORT_NAME[axis]}: {leaningLine(axis, snap.values[axis])}
                </ThemedText>
              ))}
            </View>
          ))}
        </View>
      ) : null}
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
  snapshot: {
    gap: 2,
    paddingTop: Spacing.two,
  },
});
