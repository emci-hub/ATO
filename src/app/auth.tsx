import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
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
import { isAppleSignInAvailable, signInWithApple } from '@/lib/auth-apple';
import {
  assertInviteUsable,
  errorMessageForInvite,
  fetchSignupMode,
  setPendingInviteCode,
  type SignupMode,
} from '@/lib/invite';
import { supabase } from '@/lib/supabase';

export default function AuthScreen() {
  const theme = useTheme();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [signupMode, setSignupMode] = useState<SignupMode>('invite_only');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();

  useEffect(() => {
    let active = true;
    isAppleSignInAvailable().then((available) => {
      if (active) setAppleAvailable(available);
    });
    fetchSignupMode()
      .then((mode) => {
        if (active) setSignupMode(mode);
      })
      .catch(() => {
        // Fail closed: keep invite_only so a config fetch error cannot open signup.
      });
    return () => {
      active = false;
    };
  }, []);

  async function stashInviteIfNeeded(): Promise<boolean> {
    if (signupMode !== 'invite_only') {
      await setPendingInviteCode('');
      return true;
    }
    const trimmed = inviteCode.trim();
    if (!trimmed) {
      // Returning users sign in without a code. New accounts are rejected at
      // complete_signup if they still have none.
      await setPendingInviteCode('');
      return true;
    }
    try {
      await assertInviteUsable(trimmed);
    } catch (err) {
      setError(
        errorMessageForInvite(err) ??
          'That invite code is missing, already used, or invalid.',
      );
      return false;
    }
    await setPendingInviteCode(trimmed);
    return true;
  }

  async function handleApple() {
    setBusy(true);
    setError(null);
    if (!(await stashInviteIfNeeded())) {
      setBusy(false);
      return;
    }
    const outcome = await signInWithApple();
    setBusy(false);

    if (outcome.status === 'error') {
      setError(outcome.message);
      return;
    }
    if (outcome.status === 'signed-in' && !outcome.linkedForRevocation) {
      // Sign-in worked but the Apple token was not stored, which means a later
      // account deletion could not revoke at Apple. Worth a log line now rather
      // than a surprise at delete time.
      console.log('[auth] Apple sign-in succeeded without storing a revocation token');
    }
    // 'cancelled' and 'unavailable' need no message. On success the session
    // guard in the root layout routes declaratively — same as verifyCode.
  }

  async function sendCode() {
    if (!normalizedEmail) {
      setError('Enter your email first.');
      return;
    }

    setBusy(true);
    setError(null);
    if (!(await stashInviteIfNeeded())) {
      setBusy(false);
      return;
    }
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

    // No imperative router.replace('/') here: on AUTHENTICATED, the session
    // guard in the root layout flips isAuthed and declaratively routes to
    // (tabs) (or onboarding if there's no ME row yet). Calling router.replace
    // here races that state flip — the REPLACE can fire before (tabs) is
    // mounted, producing "was not handled by any navigator".
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
                  {signupMode === 'invite_only'
                    ? ' New accounts need an invite code.'
                    : ''}
                </ThemedText>

                <ThemedView type="backgroundElement" style={styles.card}>
                  {signupMode === 'invite_only' ? (
                    <TextInput
                      value={inviteCode}
                      onChangeText={(text) => {
                        setInviteCode(text);
                        setError(null);
                      }}
                      placeholder="Invite code (new accounts)"
                      placeholderTextColor={theme.textSecondary}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      editable={!busy}
                      style={[
                        styles.input,
                        { color: theme.text, backgroundColor: theme.backgroundSelected },
                      ]}
                    />
                  ) : null}

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
                    <ThemedText type="smallBold" style={{ color: '#E5484D' }}>
                      {error}
                    </ThemedText>
                  ) : null}

                  <Pressable
                    onPress={sendCode}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.button,
                      { backgroundColor: theme.accentFill },
                      pressed && styles.pressed,
                      busy && styles.disabled,
                    ]}>
                    <ThemedText type="smallBold" style={styles.buttonText}>
                      {busy ? 'Sending…' : 'Send code'}
                    </ThemedText>
                  </Pressable>
                </ThemedView>

                {appleAvailable ? (
                  <>
                    <View style={styles.dividerRow}>
                      <View
                        style={[styles.dividerLine, { backgroundColor: theme.backgroundSelected }]}
                      />
                      <ThemedText type="small" themeColor="textSecondary">
                        or
                      </ThemedText>
                      <View
                        style={[styles.dividerLine, { backgroundColor: theme.backgroundSelected }]}
                      />
                    </View>

                    {/* Apple requires their own button component, not a custom one. */}
                    <AppleAuthentication.AppleAuthenticationButton
                      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                      buttonStyle={
                        theme.scheme === 'light'
                          ? AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                          : AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                      }
                      cornerRadius={Spacing.three}
                      style={styles.appleButton}
                      onPress={handleApple}
                    />

                    <ThemedText type="small" themeColor="textSecondary" style={styles.appleNote}>
                      You can hide your email — ATO works the same either way.
                    </ThemedText>
                  </>
                ) : null}
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
                    <ThemedText type="smallBold" style={{ color: '#E5484D' }}>
                      {error}
                    </ThemedText>
                  ) : null}

                  <Pressable
                    onPress={verifyCode}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.button,
                      { backgroundColor: theme.accentFill },
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
  codeLinks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  appleButton: {
    height: 48,
    width: '100%',
  },
  appleNote: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.6,
  },
});
