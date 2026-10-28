import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { loadSeasonalBadges } from '@/lib/almanac-badges-store';
import type { SeasonalBadge } from '@/lib/badges';
import { controlBorderColor } from '@/lib/theme/chrome';

export const SEASONAL_BADGES_TITLE = 'Seasonal badges';
export const badgeLabel = (b: SeasonalBadge) => `${b.name} ${b.id.slice(-4)}`;

/**
 * You: the seasonal badges earned on this phone, as plain chips (the art comes
 * with PHASE-11g). Cosmetic. Nothing renders until the first one is earned, so
 * there is no empty state to apologise for.
 */
export function SeasonalBadges({ userId }: { userId: string }) {
  const theme = useTheme();
  const [badges, setBadges] = useState<SeasonalBadge[]>([]);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      void loadSeasonalBadges(userId).then((list) => live && setBadges(list));
      return () => {
        live = false;
      };
    }, [userId]),
  );

  if (badges.length === 0) return null;
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">{SEASONAL_BADGES_TITLE}</ThemedText>
      <View style={styles.row}>
        {badges.map((b) => (
          <View
            key={b.id}
            accessible
            accessibilityLabel={`Badge: ${badgeLabel(b)}`}
            style={[styles.chip, { borderColor: controlBorderColor(theme), borderRadius: theme.cutCorners ? 0 : 999 }]}>
            <ThemedText type="small">{badgeLabel(b)}</ThemedText>
          </View>
        ))}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { borderWidth: 1, paddingVertical: Spacing.one, paddingHorizontal: Spacing.three },
});
