import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { IntakeChip } from '@/lib/intake';

/** Same tappable chips as onboarding. Multi = toggle; single = radio. */
export function ChipGroup({
  chips,
  selected,
  multi,
  disabled,
  inset,
  onSelect,
}: {
  chips: IntakeChip[];
  selected: string[];
  multi?: boolean;
  disabled: boolean;
  /** Unselected chips sit on a card (`backgroundElement`); use page fill so they stay visible. */
  inset?: boolean;
  onSelect: (value: string) => void;
}) {
  const theme = useTheme();
  const offFill = inset ? theme.background : theme.backgroundElement;

  return (
    <View style={styles.chipWrap}>
      {chips.map((chip) => {
        const on = selected.includes(chip.value);
        return (
          <Pressable
            key={chip.value}
            onPress={() => onSelect(chip.value)}
            disabled={disabled}
            accessibilityRole={multi ? 'checkbox' : 'radio'}
            accessibilityState={{ checked: on, selected: on }}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: on ? theme.backgroundSelected : offFill,
                borderColor: on ? theme.text : offFill,
              },
              pressed && styles.pressed,
              disabled && styles.disabled,
            ]}>
            <ThemedText type="small" themeColor={on ? 'text' : 'textSecondary'}>
              {chip.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderRadius: Spacing.five,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    flexShrink: 1,
    maxWidth: '100%',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.6,
  },
});
