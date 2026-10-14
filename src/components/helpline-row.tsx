import * as Linking from 'expo-linking';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { controlBorderColor } from '@/lib/theme/chrome';

/**
 * ONE static helpline row in Settings (emci 2026-10-14). It replaced the crisis
 * system, which only existed because Sage read what people typed. Fixed text:
 * never a generated number, never a guessed region, no network, no detection.
 * Pinned word for word by `check:helpline-row`.
 */
export const HELPLINE_TITLE = 'Need to talk to someone?';
export const HELPLINE_US_CA = 'US/Canada: call or text 988';
export const HELPLINE_ELSEWHERE = 'Everywhere else: findahelpline.com';
export const HELPLINE_URL = 'https://findahelpline.com';
export const HELPLINE_DANGER = 'If you’re in danger, call your local emergency number.';

export function HelplineRow() {
  const theme = useTheme();
  return (
    <View
      style={[styles.row, { borderColor: controlBorderColor(theme) }]}
      testID="helpline-row">
      <ThemedText type="smallBold">{HELPLINE_TITLE}</ThemedText>
      <Pressable
        accessibilityRole="link"
        onPress={() => {
          void Linking.openURL('tel:988').catch(() => {});
        }}
        style={({ pressed }) => pressed && styles.pressed}>
        <ThemedText type="small">{HELPLINE_US_CA}</ThemedText>
      </Pressable>
      <Pressable
        accessibilityRole="link"
        onPress={() => {
          void Linking.openURL(HELPLINE_URL).catch(() => {});
        }}
        style={({ pressed }) => pressed && styles.pressed}>
        <ThemedText type="small">{HELPLINE_ELSEWHERE}</ThemedText>
      </Pressable>
      <ThemedText type="small" themeColor="textSecondary">
        {HELPLINE_DANGER}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  pressed: {
    opacity: 0.7,
  },
});
