import { Pressable, TextInput, View } from 'react-native';

import { authStyles } from '@/components/auth-scaffold';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';

export function AuthOtpCodeCard({
  email,
  code,
  error,
  busy,
  onChangeCode,
  onVerify,
  onResend,
  onBack,
  backLabel,
}: {
  email: string;
  code: string;
  error: string | null;
  busy: boolean;
  onChangeCode: (text: string) => void;
  onVerify: () => void;
  onResend: () => void;
  onBack: () => void;
  backLabel: string;
}) {
  const theme = useTheme();

  return (
    <>
      <ThemedText type="subtitle">Enter the code</ThemedText>
      <ThemedText themeColor="textSecondary" style={authStyles.lede}>
        We sent a code to {email}.
      </ThemedText>

      <ThemedView type="backgroundElement" style={authStyles.card}>
        <TextInput
          value={code}
          onChangeText={(text) => onChangeCode(text.replace(/[^0-9]/g, '').slice(0, 10))}
          placeholder="Code"
          placeholderTextColor={theme.textSecondary}
          keyboardType="number-pad"
          maxLength={10}
          autoFocus
          editable={!busy}
          style={[
            authStyles.input,
            authStyles.codeInput,
            { color: theme.text, backgroundColor: theme.backgroundSelected },
          ]}
        />

        {error ? (
          <ThemedText type="smallBold" style={{ color: '#E5484D' }}>
            {error}
          </ThemedText>
        ) : null}

        <Pressable
          onPress={onVerify}
          disabled={busy}
          style={({ pressed }) => [
            authStyles.button,
            { backgroundColor: theme.accentFill },
            pressed && authStyles.pressed,
            busy && authStyles.disabled,
          ]}>
          <ThemedText type="smallBold" style={authStyles.buttonText}>
            {busy ? 'Verifying…' : 'Verify'}
          </ThemedText>
        </Pressable>

        <View style={authStyles.codeLinks}>
          <Pressable onPress={onResend} disabled={busy}>
            <ThemedText type="link">Resend code</ThemedText>
          </Pressable>
          <Pressable onPress={onBack} disabled={busy}>
            <ThemedText type="link">{backLabel}</ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    </>
  );
}
