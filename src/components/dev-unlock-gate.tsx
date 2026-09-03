import Constants from 'expo-constants';
import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { setDevAccessUnlocked, useDevAccessUnlocked } from '@/lib/dev-access-unlock';
import { verifyDevUnlockPassword } from '@/lib/dev-unlock-server';
import { controlBorderColor } from '@/lib/theme/chrome';

const TAP_THRESHOLD = 7;
const TAP_WINDOW_MS = 2500;

/**
 * Tapping the version number this many times opens the dev-unlock password
 * prompt. Renders unconditionally (not PRE_LAUNCH_DEV-gated) — this is the
 * only entrance to Dev Tools once PRE_LAUNCH_DEV flips off for a public
 * build. A correct password only sets an in-memory flag for this app
 * session (`dev-access-unlock.ts`); nothing is written to disk or the server.
 */
export function AppVersionDevUnlock() {
  const theme = useTheme();
  const unlocked = useDevAccessUnlocked();
  const tap = useRef({ count: 0, at: 0 });
  const [promptOpen, setPromptOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const version = Constants.expoConfig?.version ?? '—';

  function handleTap() {
    const now = Date.now();
    if (now - tap.current.at > TAP_WINDOW_MS) tap.current.count = 0;
    tap.current.at = now;
    tap.current.count += 1;
    if (tap.current.count >= TAP_THRESHOLD) {
      tap.current.count = 0;
      setError(null);
      setPassword('');
      setPromptOpen(true);
    }
  }

  function close() {
    if (busy) return;
    setPromptOpen(false);
    setPassword('');
    setError(null);
  }

  async function submit() {
    if (busy || !password) return;
    setBusy(true);
    setError(null);
    try {
      const ok = await verifyDevUnlockPassword(password);
      if (ok) {
        setDevAccessUnlocked(true);
        setPromptOpen(false);
        setPassword('');
      } else {
        setError('Wrong password.');
      }
    } catch {
      setError('Could not check that. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Pressable
        onPress={handleTap}
        accessibilityRole="button"
        accessibilityLabel={`App version ${version}`}
        style={styles.row}>
        <ThemedText type="small" themeColor="textSecondary">
          Version
        </ThemedText>
        <ThemedText type="small" style={styles.value}>
          {version}
          {unlocked ? ' · dev unlocked' : ''}
        </ThemedText>
      </Pressable>

      <Modal visible={promptOpen} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.backdrop}>
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">Dev access</ThemedText>
            <TextInput
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setError(null);
              }}
              placeholder="Password"
              placeholderTextColor={theme.textSecondary}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              editable={!busy}
              onSubmitEditing={submit}
              style={[
                styles.input,
                {
                  color: theme.text,
                  backgroundColor: theme.backgroundSelected,
                  borderColor: controlBorderColor(theme),
                },
              ]}
            />
            {error ? (
              <ThemedText type="small" style={{ color: '#E5484D' }}>
                {error}
              </ThemedText>
            ) : null}
            <View style={styles.buttonRow}>
              <Pressable
                onPress={close}
                disabled={busy}
                style={({ pressed }) => [
                  styles.button,
                  { borderWidth: 1, borderColor: controlBorderColor(theme) },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold">Cancel</ThemedText>
              </Pressable>
              <Pressable
                onPress={submit}
                disabled={busy || !password}
                style={({ pressed }) => [
                  styles.button,
                  { backgroundColor: theme.accentFill },
                  pressed && styles.pressed,
                  (busy || !password) && styles.disabled,
                ]}>
                <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                  {busy ? 'Checking…' : 'Unlock'}
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  value: {
    flex: 1,
    textAlign: 'right',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    alignSelf: 'stretch',
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  input: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  button: {
    flex: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.6,
  },
});
