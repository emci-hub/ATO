import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AROUND_CITIES, DEFAULT_AROUND_CITY } from '@/constants/around-cities';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { slugifyCity } from '@/lib/around/slug';

/**
 * Typed city for Around. Wave 2 lists Calgary; typing still slugifies so a
 * later city is a new JSON file, not a code fork.
 */
export function CityPicker({
  value,
  onChange,
  compact = false,
}: {
  value: string | null;
  onChange: (slug: string | null) => void;
  compact?: boolean;
}) {
  const theme = useTheme();
  const selected = value ?? DEFAULT_AROUND_CITY.slug;
  const [typed, setTyped] = useState(value ?? '');

  useEffect(() => {
    setTyped(value ?? '');
  }, [value]);

  return (
    <ThemedView type="backgroundElement" style={compact ? styles.compact : styles.card}>
      {compact ? null : (
        <>
          <ThemedText type="smallBold" style={styles.heading}>
            City
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.lede}>
            Typed here, not taken from GPS. Around uses this to load a weekend
            list. Calgary is the city we refresh today.
          </ThemedText>
        </>
      )}
      {AROUND_CITIES.map((city) => {
        const isSelected = selected === city.slug;
        return (
          <Pressable
            key={city.slug}
            onPress={() => onChange(city.slug)}
            style={({ pressed }) => [
              styles.row,
              isSelected && { backgroundColor: theme.backgroundSelected },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="smallBold">{city.label}</ThemedText>
          </Pressable>
        );
      })}
      <View style={styles.typed}>
        <ThemedText type="small" themeColor="textSecondary">
          Or type a city
        </ThemedText>
        <TextInput
          value={typed}
          onChangeText={setTyped}
          onEndEditing={() => onChange(slugifyCity(typed))}
          onSubmitEditing={() => onChange(slugifyCity(typed))}
          placeholder={DEFAULT_AROUND_CITY.label}
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="words"
          autoCorrect={false}
          style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
        />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  compact: {
    padding: 0,
    backgroundColor: 'transparent',
  },
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
  typed: {
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  pressed: {
    opacity: 0.8,
  },
});
