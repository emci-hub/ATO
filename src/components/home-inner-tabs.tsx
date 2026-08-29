import { StyleSheet, View } from 'react-native';

import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { EXPLORE_LABEL, TODAY_LABEL } from '@/lib/explore/copy';
import { controlBorderColor } from '@/lib/theme/chrome';

export type HomeInnerTab = 'today' | 'explore';

export function HomeInnerTabs({
  value,
  onChange,
}: {
  value: HomeInnerTab;
  onChange: (next: HomeInnerTab) => void;
}) {
  const theme = useTheme();
  const border = controlBorderColor(theme);

  return (
    <View style={[styles.row, { borderColor: border }]}>
      <ThemedPressable
        filled={value === 'today'}
        onPress={() => onChange('today')}
        accessibilityRole="tab"
        accessibilityState={{ selected: value === 'today' }}
        style={[styles.tab, value === 'today' && styles.selected]}>
        <ThemedText
          type="smallBold"
          style={value === 'today' ? { color: theme.onAccent } : undefined}
          themeColor={value === 'today' ? undefined : 'textSecondary'}>
          {TODAY_LABEL}
        </ThemedText>
      </ThemedPressable>
      <ThemedPressable
        filled={value === 'explore'}
        onPress={() => onChange('explore')}
        accessibilityRole="tab"
        accessibilityState={{ selected: value === 'explore' }}
        style={[styles.tab, value === 'explore' && styles.selected]}>
        <ThemedText
          type="smallBold"
          style={value === 'explore' ? { color: theme.onAccent } : undefined}
          themeColor={value === 'explore' ? undefined : 'textSecondary'}>
          {EXPLORE_LABEL}
        </ThemedText>
      </ThemedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.half,
    gap: Spacing.half,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  selected: {},
});
