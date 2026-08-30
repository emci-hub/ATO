import { StyleSheet, TextInput, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * YYYY / MM / DD inputs. Same fields onboarding uses at signup — keep the
 * two surfaces in lockstep so You cannot invent a different date picker.
 */
export function BornOnFields({
  year,
  month,
  day,
  onYearChange,
  onMonthChange,
  onDayChange,
  editable = true,
}: {
  year: string;
  month: string;
  day: string;
  onYearChange: (value: string) => void;
  onMonthChange: (value: string) => void;
  onDayChange: (value: string) => void;
  editable?: boolean;
}) {
  const theme = useTheme();
  const inputStyle = [
    styles.input,
    { color: theme.text, backgroundColor: theme.backgroundSelected },
  ];

  return (
    <View style={styles.dateRow}>
      <TextInput
        value={year}
        onChangeText={(text) => onYearChange(text.replace(/\D/g, '').slice(0, 4))}
        placeholder="YYYY"
        placeholderTextColor={theme.textSecondary}
        keyboardType="number-pad"
        maxLength={4}
        editable={editable}
        accessibilityLabel="Birth year"
        style={[inputStyle, styles.dateYear]}
      />
      <TextInput
        value={month}
        onChangeText={(text) => onMonthChange(text.replace(/\D/g, '').slice(0, 2))}
        placeholder="MM"
        placeholderTextColor={theme.textSecondary}
        keyboardType="number-pad"
        maxLength={2}
        editable={editable}
        accessibilityLabel="Birth month"
        style={[inputStyle, styles.datePart]}
      />
      <TextInput
        value={day}
        onChangeText={(text) => onDayChange(text.replace(/\D/g, '').slice(0, 2))}
        placeholder="DD"
        placeholderTextColor={theme.textSecondary}
        keyboardType="number-pad"
        maxLength={2}
        editable={editable}
        accessibilityLabel="Birth day"
        style={[inputStyle, styles.datePart]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  input: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  dateYear: {
    flex: 1.2,
  },
  datePart: {
    flex: 1,
  },
});
