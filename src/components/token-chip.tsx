import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { atoTokenBalanceOf } from '@/lib/ato-tokens';
import { useMeContext } from '@/lib/me-context';
import { controlBorderColor } from '@/lib/theme/chrome';

/**
 * Read-only ATO token balance for the Insights and Legends headers (IA P7).
 * Shows the balance already in `me`; spends, claims and fetches nothing. A tap
 * opens the balance on You. No animation, so Reduce Motion needs no branch.
 */
export function TokenChip() {
  const theme = useTheme();
  const { me } = useMeContext();
  if (!me) return null;
  const balance = atoTokenBalanceOf(me);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`ATO tokens: ${balance}. Open your balance`}
      onPress={() => router.push('/you?section=tokens')}
      testID="token-chip"
      hitSlop={4}
      style={({ pressed }) => [styles.chip, { borderColor: controlBorderColor(theme) }, pressed && styles.pressed]}>
      <ThemedText type="smallBold">{balance}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        ATO
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 44,
    minWidth: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 12,
    borderRadius: 22,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
