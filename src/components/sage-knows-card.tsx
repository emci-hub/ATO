import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AxisTaps } from '@/components/axis-taps';
import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  recordSageKnowsCorrection,
  recordSageKnowsDismiss,
  recordSageKnowsFits,
  type Me,
} from '@/lib/me';
import {
  AXIS_EDITOR_COPY,
  parseSageKnowsState,
  resolveSageKnows,
  type SageKnowsPrompt,
} from '@/lib/sage-knows';
import { SAGE_KNOWS_LABEL } from '@/lib/sage-copy';
import { traitStateFromRow } from '@/lib/traits';
import { controlBorderColor } from '@/lib/theme/chrome';
import type { CheckHistory } from '@/lib/voice/types';

/**
 * Home/Sage check-in. Banked copy only — no router, no quota.
 * Still fits confirms the source. Not quite is a Settings write on one axis.
 */
export function SageKnowsCard({
  me,
  history,
  onUpdated,
}: {
  me: Me;
  history: CheckHistory[];
  onUpdated: () => Promise<void>;
}) {
  const traits = useMemo(() => traitStateFromRow(me), [me]);
  const prompt = useMemo(
    () =>
      resolveSageKnows({
        values: traits.values,
        touched: traits.touched,
        knows: parseSageKnowsState(me.sage_knows),
        knocksYouOff: me.knocks_you_off,
        facts: me.facts ?? [],
        history,
        now: new Date(),
        timeZone: me.timezone || 'UTC',
      }),
    [traits, me.sage_knows, me.knocks_you_off, me.facts, me.timezone, history],
  );

  if (!prompt) return null;

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="code" themeColor="textSecondary" style={styles.kicker}>
        {SAGE_KNOWS_LABEL}
      </ThemedText>
      <SageKnowsBody
        prompt={prompt}
        userId={me.id}
        current={traits.values[prompt.axis]}
        onUpdated={onUpdated}
      />
    </ThemedView>
  );
}

/** Question line + Still fits / Not quite. Frame and mechanic label stay on the card. */
export function SageKnowsBody({
  prompt,
  userId,
  current,
  onUpdated,
}: {
  prompt: SageKnowsPrompt;
  userId?: string;
  current?: number | null;
  onUpdated?: () => Promise<void>;
}) {
  const theme = useTheme();
  const [busy, setBusy] = useState<'fits' | 'correct' | 'dismiss' | null>(null);
  const [editing, setEditing] = useState(false);
  const copy = AXIS_EDITOR_COPY[prompt.axis];
  const canSave = Boolean(userId);

  async function run(kind: 'fits' | 'correct' | 'dismiss', work: () => Promise<Me>) {
    if (busy || !userId) return;
    setBusy(kind);
    try {
      await work();
      if (onUpdated) await onUpdated();
      setEditing(false);
    } catch (err) {
      console.log('[sage-knows] save error:', err);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <ThemedText style={styles.line}>{prompt.line}</ThemedText>
      {editing ? (
        <View style={styles.editor}>
          <AxisTaps
            label={copy.label}
            hint={copy.hint}
            value={typeof current === 'number' ? current : null}
            disabled={busy !== null || !canSave}
            onChange={(next) => {
              if (!userId) return;
              void run('correct', () => recordSageKnowsCorrection(userId, prompt.axis, next));
            }}
          />
          <ThemedPressable
            onPress={() => setEditing(false)}
            disabled={busy !== null}
            style={styles.quietButton}>
            <ThemedText type="small" themeColor="textSecondary">
              Keep the note
            </ThemedText>
          </ThemedPressable>
        </View>
      ) : (
        <View style={styles.actions}>
          <ThemedPressable
            filled
            onPress={() => {
              if (!userId) return;
              void run('fits', () => recordSageKnowsFits(userId, prompt.axis));
            }}
            disabled={busy !== null || !canSave}
            style={[styles.primary, (busy !== null || !canSave) && styles.disabled]}>
            <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
              {busy === 'fits' ? 'Saving\u2026' : 'Still fits'}
            </ThemedText>
          </ThemedPressable>
          <ThemedPressable
            onPress={() => setEditing(true)}
            disabled={busy !== null}
            style={[
              styles.secondary,
              { borderColor: controlBorderColor(theme) },
              busy !== null && styles.disabled,
            ]}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Not quite
            </ThemedText>
          </ThemedPressable>
          <ThemedPressable
            onPress={() => {
              if (!userId) return;
              void run('dismiss', () => recordSageKnowsDismiss(userId, prompt.axis));
            }}
            disabled={busy !== null || !canSave}
            style={styles.quietButton}>
            <ThemedText type="small" themeColor="textSecondary">
              {busy === 'dismiss' ? 'Saving\u2026' : 'Not this week'}
            </ThemedText>
          </ThemedPressable>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  kicker: {
    textTransform: 'none',
  },
  line: {
    lineHeight: 26,
  },
  actions: {
    gap: Spacing.two,
  },
  editor: {
    gap: Spacing.two,
  },
  primary: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  secondary: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    borderWidth: 1,
  },
  quietButton: {
    alignItems: 'center',
    paddingVertical: Spacing.one,
  },
  disabled: {
    opacity: 0.5,
  },
});
