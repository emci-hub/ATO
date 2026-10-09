/**
 * Dev Hub → Account → AI limits (PRE_LAUNCH_DEV only: mounted inside the
 * `tools` branch of dev-lab.tsx). Clears today's AI counters (Story, Legends,
 * deep dive, the shared daily quota) for this account or a named handle, so a
 * tester can run the AI again (emci, 2026-10-09: "me or any account"). Root
 * only — the server checks `me.is_root` (dev_reset_ai_limits, wave92). Two
 * taps; a different account also needs its handle typed. Touches no tokens,
 * no cards, no answers.
 */
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { bumpAccountDataEpoch } from '@/lib/account-data-epoch';
import { devResetAiLimits } from '@/lib/ato-tokens-server';
import { devResetLegendDay } from '@/lib/legend-figures/museum-store';

export function AiLimitsDev({ userId }: { userId: string }) {
  const theme = useTheme();
  const [handle, setHandle] = useState('');
  const [armed, setArmed] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const press = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!armed) {
      setArmed(true);
      timer.current = setTimeout(() => setArmed(false), 5000);
      return;
    }
    setArmed(false);
    const target = handle.trim() ? handle.trim() : null;
    void devResetAiLimits(target)
      .then(async (result) => {
        // Own account: also forget today's Legends reveals on this phone.
        if (!target) {
          await devResetLegendDay(userId);
          bumpAccountDataEpoch();
        }
        setNote(`AI limits cleared for ${result.handle ? `@${result.handle.replace(/^@/, '')}` : 'this account'}.`);
      })
      .catch((err: unknown) => {
        const message = (err as { message?: unknown } | null)?.message;
        setNote(typeof message === 'string' && message ? `Not cleared: ${message}` : 'Not cleared.');
      });
  }, [armed, handle, userId]);

  return (
    <View style={styles.wrap}>
      <ThemedText type="small" themeColor="textSecondary">
        Clears today’s AI counters (Story, Legends, deep dive, daily quota). Tokens, cards and answers stay. Root only.
      </ThemedText>
      <TextInput
        value={handle}
        onChangeText={setHandle}
        placeholder="Handle (empty = this account)"
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="Handle of the account to reset, empty for this account"
        style={[styles.input, { color: theme.text, borderColor: theme.border }]}
      />
      <Pressable
        onPress={press}
        accessibilityRole="button"
        accessibilityLabel={armed ? 'Tap again to reset AI limits' : 'Reset today’s AI limits'}
        style={({ pressed }) => [
          styles.button,
          { borderColor: armed ? theme.accent : theme.border },
          pressed && styles.pressed,
        ]}>
        <ThemedText type="smallBold">{armed ? 'Tap again to confirm' : 'Reset today’s AI limits'}</ThemedText>
      </Pressable>
      {note ? <ThemedText type="small">{note}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: Spacing.two, paddingVertical: 8 },
  button: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  pressed: { opacity: 0.7 },
});
