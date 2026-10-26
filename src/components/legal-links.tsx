/**
 * Privacy Policy + Terms links (master plan Step 10, roadmap M8; Apple 5.1.1).
 * Shown on the sign-up screen and on You. They open the published landing pages, which carry the same text
 * as src/content/legal/*.md (check:floor compares them).
 */
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

export const PRIVACY_URL = 'https://ato.emgens.com/privacy.html';
export const TERMS_URL = 'https://ato.emgens.com/terms.html';

function open(url: string) {
  Linking.openURL(url).catch((err) => console.log('[legal-links] open error:', err));
}

export function LegalLinks() {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Privacy Policy"
        hitSlop={8}
        onPress={() => open(PRIVACY_URL)}
        style={({ pressed }) => pressed && styles.pressed}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.link}>
          Privacy Policy
        </ThemedText>
      </Pressable>
      <ThemedText type="small" themeColor="textSecondary">
        ·
      </ThemedText>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Terms of Service"
        hitSlop={8}
        onPress={() => open(TERMS_URL)}
        style={({ pressed }) => pressed && styles.pressed}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.link}>
          Terms of Service
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  link: { textDecorationLine: 'underline' },
  pressed: { opacity: 0.6 },
});
