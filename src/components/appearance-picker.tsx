import { StyleSheet, View } from 'react-native';

import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  APPEARANCE_IDS,
  APPEARANCE_LABELS,
  APPEARANCES,
  type AppearanceId,
} from '@/constants/appearance';
import { Spacing } from '@/constants/theme';
import { useAppearance } from '@/lib/theme/context';
import { useTheme } from '@/hooks/use-theme';

export function AppearancePicker() {
  const theme = useTheme();
  const { id, setAppearance } = useAppearance();

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold" style={styles.heading}>
        Appearance
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.lede}>
        Soft is the default. Saved on this device.
      </ThemedText>
      {APPEARANCE_IDS.map((option: AppearanceId) => {
        const selected = id === option;
        return (
          <ThemedPressable
            key={option}
            accessibilityRole="button"
            accessibilityLabel={APPEARANCE_LABELS[option]}
            accessibilityState={{ selected }}
            onPress={() => {
              void setAppearance(option);
            }}
            style={[
              styles.row,
              selected && { backgroundColor: theme.backgroundSelected },
            ]}>
            <View style={styles.swatches}>
              <View style={[styles.swatch, { backgroundColor: APPEARANCES[option].background }]} />
              <View style={[styles.swatch, { backgroundColor: APPEARANCES[option].accentFill }]} />
            </View>
            <ThemedText type="smallBold">{APPEARANCE_LABELS[option]}</ThemedText>
          </ThemedPressable>
        );
      })}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.two,
  },
  heading: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  lede: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  swatches: {
    flexDirection: 'row',
    gap: 4,
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: 4,
  },
});
