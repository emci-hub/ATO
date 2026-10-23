import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import {
  CORRECTION_NOT_ME,
  CORRECTION_OTHER,
  CORRECTION_SAVED,
  CORRECTION_SOFTER,
  CORRECTION_STILL_FITS,
  traitNudgeValue,
} from '@/lib/self-correction';

/**
 * On a trait result: Still fits confirms the read. Not me stores one weighted
 * answer (a softer nudge, or one step the other way). Not a settings lock.
 */
export function TraitResultCorrection({
  score,
  disabled,
  onStillFits,
  onNudge,
}: {
  score: number;
  disabled?: boolean;
  onStillFits: () => Promise<void>;
  onNudge: (value: number) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [noted, setNoted] = useState(false);

  async function run(work: () => Promise<void>) {
    if (busy || disabled) return;
    setBusy(true);
    try {
      await work();
      setNoted(true);
      setOpen(false);
    } catch (err) {
      console.log('[trait-correction] save error:', err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <ThemedPressable
          accessibilityRole="button"
          accessibilityLabel={CORRECTION_STILL_FITS}
          disabled={busy || disabled}
          onPress={() => void run(onStillFits)}
          style={styles.tap}>
          <ThemedText type="smallBold">{busy ? 'Saving…' : CORRECTION_STILL_FITS}</ThemedText>
        </ThemedPressable>
        <ThemedPressable
          accessibilityRole="button"
          accessibilityLabel={CORRECTION_NOT_ME}
          disabled={busy || disabled}
          onPress={() => setOpen((value) => !value)}
          style={styles.tap}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {CORRECTION_NOT_ME}
          </ThemedText>
        </ThemedPressable>
      </View>
      {open ? (
        <View style={styles.nudges}>
          <ThemedPressable
            accessibilityRole="button"
            accessibilityLabel={CORRECTION_SOFTER}
            disabled={busy || disabled}
            onPress={() => void run(() => onNudge(traitNudgeValue(score, 'softer')))}
            style={styles.tap}>
            <ThemedText type="small">{CORRECTION_SOFTER}</ThemedText>
          </ThemedPressable>
          <ThemedPressable
            accessibilityRole="button"
            accessibilityLabel={CORRECTION_OTHER}
            disabled={busy || disabled}
            onPress={() => void run(() => onNudge(traitNudgeValue(score, 'other')))}
            style={styles.tap}>
            <ThemedText type="small">{CORRECTION_OTHER}</ThemedText>
          </ThemedPressable>
        </View>
      ) : null}
      {noted ? (
        <ThemedText type="small" themeColor="textSecondary">
          {CORRECTION_SAVED}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  nudges: {
    gap: Spacing.one,
  },
  tap: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
});
