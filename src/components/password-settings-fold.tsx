import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';

import { SettingsFold } from '@/components/settings-fold';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  changeAuthPassword,
  CURRENT_PASSWORD_WRONG,
  fetchAuthHasPassword,
  PASSWORD_CHANGED_OK,
  PASSWORD_MISMATCH,
  PASSWORD_SET_OK,
  PASSWORD_TOO_SHORT,
  passwordMeetsLength,
  passwordsMatch,
  setAuthPassword,
} from '@/lib/auth-password';

export function PasswordSettingsFold() {
  const theme = useTheme();
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetchAuthHasPassword().then((value) => {
      if (active) setHasPassword(value);
    });
    return () => {
      active = false;
    };
  }, []);

  function clearSecrets() {
    setCurrent('');
    setNext('');
    setConfirm('');
  }

  async function submit() {
    setError(null);
    setOk(null);
    if (!passwordMeetsLength(next)) {
      setError(PASSWORD_TOO_SHORT);
      return;
    }
    if (!passwordsMatch(next, confirm)) {
      setError(PASSWORD_MISMATCH);
      return;
    }

    setBusy(true);
    const result =
      hasPassword === true
        ? await changeAuthPassword(current, next)
        : await setAuthPassword(next);
    setBusy(false);

    if (result.error) {
      setError(result.error === CURRENT_PASSWORD_WRONG ? CURRENT_PASSWORD_WRONG : result.error);
      return;
    }

    clearSecrets();
    setHasPassword(true);
    setOk(hasPassword === true ? PASSWORD_CHANGED_OK : PASSWORD_SET_OK);
  }

  const title = hasPassword === true ? 'Change password' : 'Set password';

  return (
    <SettingsFold title={title}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
        Optional. A code to your email still works if you skip this. Apple Sign-In is
        unchanged.
      </ThemedText>

      {hasPassword === true ? (
        <TextInput
          value={current}
          onChangeText={(text) => {
            setCurrent(text);
            setError(null);
            setOk(null);
          }}
          placeholder="Current password"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          textContentType="password"
          autoComplete="password"
          editable={!busy}
          style={[
            styles.input,
            { color: theme.text, backgroundColor: theme.backgroundSelected },
          ]}
        />
      ) : null}

      <TextInput
        value={next}
        onChangeText={(text) => {
          setNext(text);
          setError(null);
          setOk(null);
        }}
        placeholder={hasPassword === true ? 'New password' : 'Password'}
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        textContentType="newPassword"
        autoComplete="new-password"
        editable={!busy}
        style={[
          styles.input,
          { color: theme.text, backgroundColor: theme.backgroundSelected },
        ]}
      />

      <TextInput
        value={confirm}
        onChangeText={(text) => {
          setConfirm(text);
          setError(null);
          setOk(null);
        }}
        placeholder="Confirm password"
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        textContentType="newPassword"
        editable={!busy}
        style={[
          styles.input,
          { color: theme.text, backgroundColor: theme.backgroundSelected },
        ]}
      />

      {error ? (
        <ThemedText type="smallBold" style={[styles.hint, { color: '#E5484D' }]}>
          {error}
        </ThemedText>
      ) : null}
      {ok ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
          {ok}
        </ThemedText>
      ) : null}

      <Pressable
        onPress={() => {
          void submit();
        }}
        disabled={busy}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: theme.accentFill },
          pressed && styles.pressed,
          busy && styles.disabled,
        ]}>
        <ThemedText type="smallBold" style={styles.buttonText}>
          {busy ? 'Saving…' : hasPassword === true ? 'Update password' : 'Save password'}
        </ThemedText>
      </Pressable>
    </SettingsFold>
  );
}

const styles = StyleSheet.create({
  hint: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.one,
  },
  input: {
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  button: {
    marginHorizontal: Spacing.three,
    marginTop: Spacing.one,
    marginBottom: Spacing.two,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.6,
  },
});
