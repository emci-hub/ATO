import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCrisisRegion } from '@/lib/crisis/region-context';
import { crisisRegionLabel, type CrisisRegion } from '@/lib/crisis/region';

type PickerValue = 'auto' | CrisisRegion;

const OPTIONS: { value: PickerValue; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'other', label: 'Other region' },
];

/**
 * Visible Settings picker for the crisis resource card region.
 * Auto uses the stored device locale/timezone; US/Canada/other are overrides.
 */
export function CrisisRegionPicker() {
  const theme = useTheme();
  const { autoRegion, override, setOverride } = useCrisisRegion();
  const selected: PickerValue = override ?? 'auto';

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold" style={styles.heading}>
        Crisis line
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.lede}>
        Auto uses this device&apos;s locale and timezone. Only the United States
        and Canada have a confirmed number.
      </ThemedText>
      {OPTIONS.map((option) => {
        const isSelected = selected === option.value;
        const subtitle =
          option.value === 'auto' ? `Detected: ${crisisRegionLabel(autoRegion)}` : null;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              void setOverride(option.value === 'auto' ? null : option.value);
            }}
            style={({ pressed }) => [
              styles.row,
              isSelected && { backgroundColor: theme.backgroundSelected },
              pressed && styles.pressed,
            ]}>
            <View style={styles.rowText}>
              <ThemedText type="smallBold">{option.label}</ThemedText>
              {subtitle ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {subtitle}
                </ThemedText>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.four,
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
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  rowText: {
    gap: Spacing.half,
  },
  pressed: {
    opacity: 0.8,
  },
});
