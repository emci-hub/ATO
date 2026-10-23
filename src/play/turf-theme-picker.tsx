/**
 * Turf War map theme picker (step T8, emci 2026-10-17: option A) — one row of theme chips for the Setup sheet's Maps
 * card (Main) or its own small card (Trial). Same board, path and pads in every theme; the pick is device-local
 * (turf-theme-store.ts). Lives in the Setup sheet only: nothing floats over the screen regions.
 */
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { SHEET } from '@/play/sheet-kit';
import { TURF_THEME_IDS, TURF_THEME_LABEL } from '@/play/turf-theme';
import { setTurfTheme, useTurfTheme } from '@/play/turf-theme-store';

export function TurfThemePicker() {
  const theme = useTheme();
  const picked = useTurfTheme();
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <ThemedText type="smallBold">Theme</ThemedText>
        <ThemedText type="code" themeColor="textSecondary">
          {TURF_THEME_LABEL[picked]}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Same path, same pads. Only the street changes.
      </ThemedText>
      <View style={styles.row}>
        {TURF_THEME_IDS.map((id) => {
          const active = picked === id;
          return (
            <Pressable
              key={id}
              onPress={() => setTurfTheme(id)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Theme ${TURF_THEME_LABEL[id]}`}
              style={({ pressed }) => [
                styles.chip,
                { borderColor: active ? theme.accent : theme.border },
                active && { backgroundColor: theme.backgroundSelected },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="smallBold" themeColor={active ? 'emphasis' : undefined} numberOfLines={1}>
                {TURF_THEME_LABEL[id]}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.one },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: SHEET.gap, marginTop: Spacing.one },
  chip: {
    minHeight: SHEET.tap,
    minWidth: SHEET.tap,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  pressed: { opacity: 0.8 },
});
