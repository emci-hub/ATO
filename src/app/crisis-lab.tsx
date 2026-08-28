import { Redirect } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CrisisCard } from '@/components/crisis-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { CRISIS_KEYWORDS } from '@/lib/crisis/detect';
import { useCrisisRegion } from '@/lib/crisis/region-context';

/**
 * Dev harness for the static crisis card. Not linked in production: open
 * /crisis-lab directly. Detection is the user-reviewed keyword/phrase list
 * (plan's original spec — no sentiment model in v1).
 */
export default function CrisisLabScreen() {
  const { region, autoRegion, override } = useCrisisRegion();

  if (!__DEV__) {
    return <Redirect href="/" />;
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
            <ThemedText type="code" themeColor="textSecondary">
              region: {region} · auto: {autoRegion} · override: {override ?? 'auto'}
            </ThemedText>
          </View>

          <CrisisCard onDismiss={() => {}} />
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
