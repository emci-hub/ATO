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
  assertInviteUsable,
  errorMessageForInvite,
  fetchSignupMode,
  setPendingInviteCode,
  type SignupMode,
} from '@/lib/invite';

export default function SignUpScreen() {
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
      // Returning users who picked Sign up can still verify OTP. New accounts
      // are rejected at complete_signup if they still have none.
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
    if (busy) return;
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
      console.log('[auth] Apple sign-in succeeded without storing a revocation token');
    }
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
    const { error: sendError } = await sendEmailOtp(normalizedEmail, true);
    setBusy(false);

    if (sendError) {
      setError(sendError);
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
    const { error: verifyError } = await verifyEmailOtp(normalizedEmail, trimmed);
    setBusy(false);

    if (verifyError) {
      setError(verifyError);
    }
  }

  return (
    <AuthScaffold>
      {step === 'email' ? (
        <>
          <ThemedText type="subtitle">Sign up</ThemedText>
          <ThemedText themeColor="textSecondary" style={authStyles.lede}>
            Enter your email and we&apos;ll send you a code.
            {signupMode === 'invite_only' ? ' New accounts need an invite code.' : ''}
          </ThemedText>

          <ThemedView type="backgroundElement" style={authStyles.card}>
            {signupMode === 'invite_only' ? (
              <TextInput
                value={inviteCode}
                onChangeText={(text) => {
                  setInviteCode(text);
                  setError(null);
                }}
                placeholder="Invite code"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!busy}
                style={[
                  authStyles.input,
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
              onPress={sendCode}
              disabled={busy}
              style={({ pressed }) => [
                authStyles.button,
                { backgroundColor: theme.accentFill },
                pressed && authStyles.pressed,
                busy && authStyles.disabled,
              ]}>
              <ThemedText type="smallBold" style={authStyles.buttonText}>
                {busy ? 'Sending…' : 'Send code'}
              </ThemedText>
            </Pressable>
          </ThemedView>

          {appleAvailable ? (
            <AuthAppleBlock
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
              disabled={busy}
              onPress={handleApple}
            />
          ) : null}

          <Link href="/auth/login" asChild>
            <Pressable style={authStyles.switchRow}>
              <ThemedText type="small" themeColor="textSecondary">
                Already have an account?
              </ThemedText>
              <ThemedText type="link">Log in</ThemedText>
            </Pressable>
          </Link>
        </>
      ) : (
        <AuthOtpCodeCard
          email={normalizedEmail}
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
            setStep('email');
            setError(null);
          }}
          backLabel="Use a different email"
        />
      )}
    </AuthScaffold>
  );
}
