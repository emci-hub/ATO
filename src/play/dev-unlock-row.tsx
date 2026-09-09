/**
 * Play Dev kit unlock row — the small "Dev" PIN field on the Grove hub.
 *
 * Rendered only when `PRE_LAUNCH_DEV` is on and the kit is still locked
 * (`src/play/dev-lock.ts`). A correct PIN unlocks the Dev kit for the rest of
 * the app session (the parent re-renders via `usePlayDevUnlocked`); a wrong
 * one keeps the kit hidden and just shows a brief error on this row. Soft
 * gate only — see dev-lock.ts for why that is fine.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { controlBorderColor } from '@/lib/theme/chrome';
import { unlockPlayDev } from '@/play/dev-lock';

export function DevUnlockRow() {
  const theme = useTheme();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  function submit() {
    if (!unlockPlayDev(pin)) {
      setError(true);
      setPin('');
      return;
    }
    // Unlocked — this row unmounts as the Dev kit takes its place.
    setError(false);
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        Dev
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        The testing kit is locked. Enter the dev PIN to show it.
      </ThemedText>
      <View style={styles.row}>
        <TextInput
          value={pin}
          onChangeText={(text) => {
            setPin(text);
            setError(false);
          }}
          placeholder="PIN"
          placeholderTextColor={theme.textSecondary}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={submit}
          style={[
            styles.input,
            {
              color: theme.text,
              backgroundColor: theme.backgroundSelected,
              borderColor: error ? '#E5484D' : controlBorderColor(theme),
            },
          ]}
        />
        <Pressable
          onPress={submit}
          disabled={pin.length === 0}
          accessibilityRole="button"
          accessibilityLabel="Unlock dev kit"
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: pin.length > 0 ? theme.accentFill : theme.backgroundSelected },
            pressed && styles.pressed,
            pin.length === 0 && styles.disabled,
          ]}>
          <ThemedText
            type="smallBold"
            style={{ color: pin.length > 0 ? theme.onAccent : theme.textSecondary }}>
            Unlock
          </ThemedText>
        </Pressable>
      </View>
      {error ? (
        <ThemedText type="small" style={{ color: '#E5484D' }}>
          Wrong PIN — the kit stays hidden.
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.four,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
    alignItems: 'stretch',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  button: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.6,
  },
});
