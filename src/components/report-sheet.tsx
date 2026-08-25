import { useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { REPORT_REASONS, submitReport, type ReportTarget } from '@/lib/moderation';

interface ReportSheetProps {
  visible: boolean;
  /** What's being reported — a message (chat or Sage) or a user. */
  target: ReportTarget;
  /** Shown as the sheet title when present (e.g. the peer's name). */
  title?: string;
  onClose: () => void;
}

/**
 * The report flow: pick a reason, optionally type one for "Something else",
 * then submit. Reports are insert-only from the app — the row is visible to
 * admins in the Supabase dashboard.
 */
export function ReportSheet({ visible, target, title, onClose }: ReportSheetProps) {
  const theme = useTheme();
  const [step, setStep] = useState<'reason' | 'other' | 'done'>('reason');
  const [other, setOther] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setStep('reason');
    setOther('');
    setBusy(false);
    setError(null);
  }

  function close() {
    reset();
    onClose();
  }

  async function send(reason: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await submitReport(target, reason);
      setStep('done');
    } catch (err) {
      console.log('[report] submitReport error:', err);
      setError('Couldn\u2019t send the report. Try again.');
    } finally {
      setBusy(false);
    }
  }

  function pick(id: string) {
    if (id === 'other') {
      setStep('other');
      return;
    }
    const reason = REPORT_REASONS.find((r) => r.id === id);
    if (reason) send(reason.label);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.cardWrap} onPress={() => {}}>
          <ThemedView type="backgroundElement" style={styles.card}>
            {step === 'done' ? (
              <View style={styles.doneBox}>
                <ThemedText type="smallBold">Report sent</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                  Thanks — this goes straight to the ATO team.
                </ThemedText>
                <Pressable
                  onPress={close}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { backgroundColor: '#3c87f7' },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="smallBold" style={styles.primaryText}>
                    Done
                  </ThemedText>
                </Pressable>
              </View>
            ) : step === 'other' ? (
              <View style={styles.formBox}>
                <ThemedText type="smallBold">Something else…</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Tell us what happened.
                </ThemedText>
                <TextInput
                  value={other}
                  onChangeText={setOther}
                  placeholder="What happened?"
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  editable={!busy}
                  style={[
                    styles.input,
                    { color: theme.text, backgroundColor: theme.backgroundSelected },
                  ]}
                />
                {error ? (
                  <ThemedText type="small" style={[styles.error, { color: '#E5484D' }]}>
                    {error}
                  </ThemedText>
                ) : null}
                <View style={styles.row}>
                  <Pressable
                    onPress={() => setStep('reason')}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      { borderColor: theme.backgroundSelected },
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText type="smallBold" themeColor="textSecondary">
                      Back
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => other.trim() && send(other.trim())}
                    disabled={busy || other.trim().length === 0}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      { backgroundColor: '#3c87f7' },
                      pressed && styles.pressed,
                      (busy || other.trim().length === 0) && styles.disabled,
                    ]}>
                    <ThemedText type="smallBold" style={styles.primaryText}>
                      {busy ? 'Sending…' : 'Send report'}
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.formBox}>
                {title ? (
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.title}>
                    {title}
                  </ThemedText>
                ) : null}
                <ThemedText type="smallBold">Report this</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Choose a reason. It stays private.
                </ThemedText>
                {REPORT_REASONS.map((reason) => (
                  <Pressable
                    key={reason.id}
                    disabled={busy}
                    onPress={() => pick(reason.id)}
                    style={({ pressed }) => [
                      styles.option,
                      pressed && styles.pressed,
                      busy && styles.disabled,
                    ]}>
                    <ThemedText type="smallBold">{reason.label}</ThemedText>
                  </Pressable>
                ))}
                {error ? (
                  <ThemedText type="small" style={[styles.error, { color: '#E5484D' }]}>
                    {error}
                  </ThemedText>
                ) : null}
                <Pressable
                  onPress={close}
                  style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Cancel
                  </ThemedText>
                </Pressable>
              </View>
            )}
          </ThemedView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  cardWrap: {
    alignSelf: 'stretch',
    maxWidth: MaxContentWidth - Spacing.five,
  },
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  title: {
    textAlign: 'center',
    lineHeight: 18,
  },
  formBox: {
    gap: Spacing.two,
  },
  doneBox: {
    gap: Spacing.two,
    alignItems: 'center',
  },
  centerText: {
    textAlign: 'center',
    lineHeight: 18,
  },
  input: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  option: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  primaryButton: {
    flex: 1,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  primaryText: {
    color: '#ffffff',
  },
  secondaryButton: {
    flex: 1,
    borderRadius: Spacing.two,
    borderWidth: 1,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  error: {
    textAlign: 'center',
    fontWeight: 600,
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
});
