import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { deleteAccount, DeleteAccountError } from '@/lib/delete-account';
import { controlBorderColor } from '@/lib/theme/chrome';

const DANGER = '#E5484D';

/** Typed-confirmation gate. A destructive tap alone can happen by accident;
 *  typing this word cannot. Separate from the phrase the server requires. */
const TYPED_CONFIRMATION = 'DELETE';

/** Named so the copy stays honest about what actually goes away — this list
 *  matches the cascade paths in the schema, not a guess. */
const WHAT_GOES = [
  'Your profile, handle and pixel',
  'Every Check you have ever made',
  'Your Circle connections, on both sides',
  'Your chat threads and the messages in them',
  'Everything you told Sage, including saved facts',
];

export function DeleteAccountSheet({
  visible,
  onClose,
  hasAppleIdentity,
}: {
  visible: boolean;
  onClose: () => void;
  /** Drives the revocation line in the copy so we only promise what we do. */
  hasAppleIdentity?: boolean;
}) {
  const theme = useTheme();
  const [typed, setTyped] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setTyped('');
      setWorking(false);
      setError(null);
    }
  }, [visible]);

  const confirmed = typed.trim().toUpperCase() === TYPED_CONFIRMATION;

  async function handleDelete() {
    if (!confirmed || working) return;
    setWorking(true);
    setError(null);
    try {
      await deleteAccount();
      // No success toast and no navigation call: the account is gone, so the
      // session guard in the root layout drops straight back to /auth.
    } catch (thrown) {
      setError(
        thrown instanceof DeleteAccountError
          ? thrown.message
          : 'We could not delete your account. Nothing was changed. Try again.',
      );
      setWorking(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={working ? undefined : onClose}>
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safe}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.flex}>
            <View style={styles.header}>
              <ThemedText type="subtitle">Delete your account</ThemedText>
              <Pressable
                onPress={onClose}
                disabled={working}
                hitSlop={12}
                style={({ pressed }) => [pressed && styles.pressed, working && styles.disabled]}>
                <MaterialCommunityIcons name="close" size={24} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled">
              <ThemedView type="backgroundElement" style={[styles.warning, { borderColor: DANGER }]}>
                <MaterialCommunityIcons name="alert-circle-outline" size={22} color={DANGER} />
                <ThemedText type="smallBold" style={{ color: DANGER }}>
                  Are you sure? This can&apos;t be undone.
                </ThemedText>
              </ThemedView>

              <ThemedText themeColor="textSecondary">
                Deleting your account permanently removes:
              </ThemedText>

              <ThemedView type="backgroundElement" style={styles.list}>
                {WHAT_GOES.map((item) => (
                  <View key={item} style={styles.listRow}>
                    <MaterialCommunityIcons name="close" size={16} color={DANGER} />
                    <ThemedText type="small" style={styles.listText}>
                      {item}
                    </ThemedText>
                  </View>
                ))}
              </ThemedView>

              {hasAppleIdentity ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Your Sign in with Apple authorization is revoked with Apple at the same time, so
                  ATO loses access to your Apple ID entirely.
                </ThemedText>
              ) : null}

              <ThemedText type="small" themeColor="textSecondary">
                There is no recovery, no grace period, and no export. If you sign up again later you
                start from nothing — your @handle may be taken by then.
              </ThemedText>

              <ThemedText type="smallBold" style={styles.typePrompt}>
                Type {TYPED_CONFIRMATION} to confirm
              </ThemedText>

              <TextInput
                value={typed}
                onChangeText={(text) => {
                  setTyped(text);
                  setError(null);
                }}
                placeholder={TYPED_CONFIRMATION}
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!working}
                style={[
                  styles.input,
                  { color: theme.text, backgroundColor: theme.backgroundSelected },
                ]}
              />

              {error ? (
                <ThemedText type="small" style={{ color: DANGER }}>
                  {error}
                </ThemedText>
              ) : null}

              <Pressable
                onPress={handleDelete}
                disabled={!confirmed || working}
                style={({ pressed }) => [
                  styles.deleteButton,
                  { backgroundColor: DANGER },
                  pressed && styles.pressed,
                  (!confirmed || working) && styles.disabled,
                ]}>
                <ThemedText type="smallBold" style={styles.deleteText}>
                  {working ? 'Deleting…' : 'Delete my account forever'}
                </ThemedText>
              </Pressable>

              <Pressable
                onPress={onClose}
                disabled={working}
                style={({ pressed }) => [
                  styles.cancelButton,
                  { borderColor: controlBorderColor(theme) },
                  pressed && styles.pressed,
                  working && styles.disabled,
                ]}>
                <ThemedText type="smallBold">Keep my account</ThemedText>
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safe: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
  },
  scrollContent: {
    gap: Spacing.three,
    paddingBottom: Spacing.four,
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: 1,
    padding: Spacing.three,
  },
  list: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  listText: {
    flex: 1,
  },
  typePrompt: {
    paddingTop: Spacing.one,
  },
  input: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 18,
    letterSpacing: 2,
  },
  deleteButton: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  deleteText: {
    color: '#ffffff',
    fontSize: 16,
  },
  cancelButton: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
});
