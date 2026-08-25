import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CrisisCard } from '@/components/crisis-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { CRISIS_KEYWORDS } from '@/lib/crisis/detect';

/**
 * Dev harness for the static crisis card. Not linked in production: open
 * /crisis-lab directly. Detection is the user-reviewed keyword/phrase list
 * (plan's original spec — no sentiment model in v1).
 */
export default function CrisisLabScreen() {
  if (!__DEV__) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText>Dev only.</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Crisis card</ThemedText>
            <ThemedText themeColor="textSecondary">
              Static, never AI-generated. Shown before any router call when a
              message is crisis-flagged. Flags log timestamp + user only.
            </ThemedText>
            <ThemedText type="code" themeColor="textSecondary">
              detection: keyword list · {CRISIS_KEYWORDS.length} phrases + regex · no model call
            </ThemedText>
          </View>

          <CrisisCard />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
  },
  scrollContent: {
    gap: Spacing.three,
    paddingVertical: Spacing.four,
  },
  header: {
    gap: Spacing.half,
    paddingBottom: Spacing.two,
  },
});
