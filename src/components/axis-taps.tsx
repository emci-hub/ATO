import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { SLIDER_STOPS } from '@/lib/traits';

/** Unset until the first tap. An untouched row stays null — never a midpoint default. */
export function AxisTaps({
  label,
  hint,
  value,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  value: number | null;
  disabled: boolean;
  onChange: (next: number) => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.block}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <ThemedText type="code" themeColor="textSecondary">
        {hint}
      </ThemedText>
      <View style={styles.row}>
        {SLIDER_STOPS.map((stop) => {
          const on = value === stop;
          return (
            <Pressable
              key={String(stop)}
              onPress={() => onChange(stop)}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ checked: on, selected: on }}
              style={({ pressed }) => [
                styles.stop,
                {
                  backgroundColor: on ? theme.backgroundSelected : theme.backgroundElement,
                  borderColor: on ? theme.text : theme.backgroundElement,
                },
                pressed && styles.pressed,
                disabled && styles.disabled,
              ]}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: on ? theme.text : theme.textSecondary },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingVertical: Spacing.two,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.6,
  },
});
