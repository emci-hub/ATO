import * as AppleAuthentication from 'expo-apple-authentication';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, TextInput } from 'react-native';

import { AuthAppleBlock } from '@/components/auth-apple-block';
import { AuthOtpCodeCard } from '@/components/auth-otp-code';
import { AuthScaffold, authStyles } from '@/components/auth-scaffold';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { isAppleSignInAvailable, signInWithApple } from '@/lib/auth-apple';
import { sendEmailOtp, verifyEmailOtp } from '@/lib/auth-otp';
import {
  LOGIN_PASSWORD_FAILED,
  LOGIN_PASSWORD_HINT,
  resolveLoginEmail,
} from '@/lib/auth-password';
import { setPendingInviteCode } from '@/lib/invite';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const theme = useTheme();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  const normalizedIdentifier = identifier.trim();

  useEffect(() => {
    let active = true;
    isAppleSignInAvailable().then((available) => {
      if (active) setAppleAvailable(available);
    });
    return () => {
      active = false;
    };
  }, []);

  async function handleApple() {
    if (busy) return;
    setBusy(true);
    setError(null);
    await setPendingInviteCode('');
    const outcome = await signInWithApple();
    setBusy(false);

    if (outcome.status === 'error') {
      setError(outcome.message);
      return;
    }
    if (outcome.status === 'signed-in' && !outcome.linkedForRevocation) {
      console.log('[auth] Apple sign-in succeeded without storing a revocation token');
    }
  }

  async function handlePasswordSignIn() {
    if (!normalizedIdentifier) {
      setError('Enter your email or @handle first.');
      return;
    }
    if (!password) {
      setError('Enter your password.');
      return;
    }

    setBusy(true);
    setError(null);
    await setPendingInviteCode('');
    const email = await resolveLoginEmail(normalizedIdentifier);
    if (!email) {
      setBusy(false);
      setError(LOGIN_PASSWORD_FAILED);
      setPassword('');
      return;
    }
    const { error: signError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);
    setPassword('');

    if (signError) {
      setError(LOGIN_PASSWORD_FAILED);
    }
  }

  async function sendCode() {
    if (!normalizedIdentifier) {
      setError('Enter your email first.');
      return;
    }
    if (!normalizedIdentifier.includes('@')) {
      setError('Codes go to email. Enter the email on this account, or use a password / Apple.');
      return;
    }

    const email = normalizedIdentifier.toLowerCase();
    setBusy(true);
    setError(null);
    await setPendingInviteCode('');
    const { error: sendError } = await sendEmailOtp(email, false);
    setBusy(false);

    if (sendError) {
      setError(
        sendError.toLowerCase().includes('signups not allowed') ||
          sendError.toLowerCase().includes('user not found')
          ? 'No account for that email. Create one on Sign up.'
          : sendError,
      );
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
    const { error: verifyError } = await verifyEmailOtp(
      normalizedIdentifier.toLowerCase(),
      trimmed,
    );
    setBusy(false);

    if (verifyError) {
      setError(verifyError);
    }
  }

  return (
    <AuthScaffold>
      {step === 'form' ? (
        <>
          <ThemedText type="subtitle">Log in</ThemedText>
          <ThemedText themeColor="textSecondary" style={authStyles.lede}>
            Apple is the fast path. A code always works. Password is optional —
            set it in Settings after you&apos;re in.
          </ThemedText>

          {appleAvailable ? (
            <AuthAppleBlock
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              disabled={busy}
              onPress={handleApple}
            />
          ) : null}

          <ThemedView type="backgroundElement" style={authStyles.card}>
            <TextInput
              value={identifier}
              onChangeText={(text) => {
                setIdentifier(text);
                setError(null);
              }}
              placeholder="Email or @handle"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
              autoComplete="username"
              editable={!busy}
              style={[
                authStyles.input,
                { color: theme.text, backgroundColor: theme.backgroundSelected },
              ]}
            />

            <ThemedText type="small" themeColor="textSecondary">
              {LOGIN_PASSWORD_HINT}
            </ThemedText>

            <TextInput
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setError(null);
              }}
              placeholder="Password"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              textContentType="password"
              autoComplete="password"
              editable={!busy}
              style={[
                authStyles.input,
                { color: theme.text, backgroundColor: theme.backgroundSelected },
              ]}
            />

            {error ? (
              <ThemedText type="smallBold" style={{ color: '#E5484D' }}>
                {error}
              </ThemedText>
            ) : null}

            <Pressable
              onPress={handlePasswordSignIn}
              disabled={busy}
              style={({ pressed }) => [
                authStyles.button,
                { backgroundColor: theme.accentFill },
                pressed && authStyles.pressed,
                busy && authStyles.disabled,
              ]}>
              <ThemedText type="smallBold" style={authStyles.buttonText}>
                {busy ? 'Signing in…' : 'Log in with password'}
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={sendCode}
              disabled={busy}
              style={({ pressed }) => [authStyles.passwordLink, pressed && authStyles.pressed]}>
              <ThemedText type="link">
                {busy ? 'Sending…' : 'Email me a code instead'}
              </ThemedText>
            </Pressable>
          </ThemedView>

          <Link href="/auth" asChild>
            <Pressable style={authStyles.switchRow}>
              <ThemedText type="small" themeColor="textSecondary">
                New here?
              </ThemedText>
              <ThemedText type="link">Sign up</ThemedText>
            </Pressable>
          </Link>
        </>
      ) : (
        <AuthOtpCodeCard
          email={normalizedIdentifier.toLowerCase()}
          code={code}
          error={error}
          busy={busy}
          onChangeCode={(text) => {
            setCode(text);
            setError(null);
          }}
          onVerify={verifyCode}
          onResend={sendCode}
          onBack={() => {
            setStep('form');
            setError(null);
          }}
          backLabel="Back to log in"
        />
      )}
    </AuthScaffold>
  );
}
