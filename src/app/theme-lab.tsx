import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppearancePicker } from '@/components/appearance-picker';
import { QuestGrowthBars } from '@/components/quest-growth-bars';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAppearance } from '@/lib/theme/context';
import { useTheme } from '@/hooks/use-theme';

/**
 * Dev harness for the five appearance modes. Mirrors Home card chrome so
 * modes can be compared without a session. Production: /theme-lab is blocked.
 */
export default function ThemeLabScreen() {
  const theme = useTheme();
  const { id } = useAppearance();

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
            <ThemedText type="subtitle">Home</ThemedText>
            <ThemedText themeColor="textSecondary">
              mode {id} · theme lab
            </ThemedText>
          </View>

          <ThemedView type="backgroundElement" style={styles.todayCard}>
            <ThemedText type="code" themeColor="textSecondary">
              SAGE · coach · read
            </ThemedText>
            <ThemedText>First one logged. No pressure — just seeing what&apos;s actually true day to day.</ThemedText>
          </ThemedView>
          <ThemedView type="backgroundElement" style={styles.todayCard}>
            <ThemedText type="code" themeColor="textSecondary">
              do
            </ThemedText>
            <ThemedText>After you make coffee, sit for one minute before opening your phone.</ThemedText>
          </ThemedView>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: theme.accentFill }]}>
            <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
              Logged it
            </ThemedText>
          </Pressable>

          <ThemedView type="backgroundElement" style={styles.faceCard}>
            <ThemedText type="code" themeColor="textSecondary">
              face · shape
            </ThemedText>
            <QuestGrowthBars presence={2} depth={1} />
          </ThemedView>

          <AppearancePicker />

          <View style={styles.header}>
            <ThemedText type="subtitle">Talk</ThemedText>
            <ThemedText themeColor="textSecondary">Sage composer chrome</ThemedText>
          </View>
          <ThemedView type="backgroundElement" style={styles.todayCard}>
            <ThemedText>
              First one logged. No pressure — just seeing what&apos;s actually true day to day.
            </ThemedText>
          </ThemedView>
          <View style={[styles.userBubble, { backgroundColor: theme.accentFill }]}>
            <ThemedText style={{ color: theme.onAccent }}>logged it. coffee before phone.</ThemedText>
          </View>
          <View style={styles.inputRow}>
            <View style={[styles.inputFake, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText themeColor="textSecondary">Ask Sage…</ThemedText>
            </View>
            <View style={[styles.sendFake, { backgroundColor: theme.accentFill }]}>
              <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                Send
              </ThemedText>
            </View>
          </View>
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
  },
  todayCard: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  primaryButton: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  faceCard: {
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
  },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  inputRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'flex-end',
  },
  inputFake: {
    flex: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  sendFake: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
