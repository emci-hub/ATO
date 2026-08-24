import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
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
import { supabase } from '@/lib/supabase';

export default function AuthScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();

  async function sendCode() {
    if (!normalizedEmail) {
      setError('Enter your email first.');
      return;
    }

    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: true,
      },
    });
    setBusy(false);

    if (error) {
      // TEMP debug: capture the raw error for diagnosis
      console.log('[auth] sendCode raw error:', JSON.stringify(error));
      console.log('[auth] name:', error.name, '| status:', error.status, '| code:', error.code, '| message:', error.message);
      setError(error.message);
      return;
    }
    setCode('');
    setStep('code');
  }

  async function verifyCode() {
    const trimmed = code.trim();
    if (!/^\d{6,10}$/.test(trimmed)) {
      setError('Enter the code from your email.');
      return;
    }

    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: trimmed,
      type: 'email',
    });
    setBusy(false);

    if (error) {
      // TEMP debug: capture the raw error for diagnosis
      console.log('[auth] verifyOtp raw error:', JSON.stringify(error));
      console.log('[auth] name:', error.name, '| status:', error.status, '| code:', error.code, '| message:', error.message);
      setError(error.message);
      return;
    }
    router.replace('/');
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled">
            {step === 'email' ? (
              <>
                <ThemedText type="subtitle">Sign in</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.lede}>
                  Enter your email and we&apos;ll send you a code. No password needed.
                </ThemedText>

                <ThemedView type="backgroundElement" style={styles.card}>
                  <TextInput
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      setError(null);
                    }}
                    placeholder="you@example.com"
                    placeholderTextColor={theme.textSecondary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    textContentType="emailAddress"
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

                  <Pressable
                    onPress={sendCode}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.button,
                      { backgroundColor: '#3c87f7' },
                      pressed && styles.pressed,
                      busy && styles.disabled,
                    ]}>
                    <ThemedText type="smallBold" style={styles.buttonText}>
                      {busy ? 'Sending…' : 'Send code'}
                    </ThemedText>
                  </Pressable>
                </ThemedView>
              </>
            ) : (
              <>
                <ThemedText type="subtitle">Enter the code</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.lede}>
                  We sent a code to {normalizedEmail}.
                </ThemedText>

                <ThemedView type="backgroundElement" style={styles.card}>
                  <TextInput
                    value={code}
                    onChangeText={(text) => {
                      setCode(text.replace(/[^0-9]/g, '').slice(0, 10));
                      setError(null);
                    }}
                    placeholder="Code"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="number-pad"
                    maxLength={10}
                    autoFocus
                    editable={!busy}
                    style={[
                      styles.input,
                      styles.codeInput,
                      { color: theme.text, backgroundColor: theme.backgroundSelected },
                    ]}
                  />

                  {error ? (
                    <ThemedText type="small" style={[styles.error, { color: '#E5484D' }]}>
                      {error}
                    </ThemedText>
                  ) : null}

                  <Pressable
                    onPress={verifyCode}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.button,
                      { backgroundColor: '#3c87f7' },
                      pressed && styles.pressed,
                      busy && styles.disabled,
                    ]}>
                    <ThemedText type="smallBold" style={styles.buttonText}>
                      {busy ? 'Verifying…' : 'Verify'}
                    </ThemedText>
                  </Pressable>

                  <View style={styles.codeLinks}>
                    <Pressable onPress={sendCode} disabled={busy}>
                      <ThemedText type="link">Resend code</ThemedText>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setStep('email');
                        setError(null);
                      }}
                      disabled={busy}>
                      <ThemedText type="link">Use a different email</ThemedText>
                    </Pressable>
                  </View>
                </ThemedView>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    gap: Spacing.three,
  },
  lede: {
    paddingBottom: Spacing.two,
  },
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  input: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  codeInput: {
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 6,
    minWidth: 200,
    alignSelf: 'center',
  },
  button: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
  },
  error: {
    fontWeight: 600,
  },
  codeLinks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.6,
  },
});
