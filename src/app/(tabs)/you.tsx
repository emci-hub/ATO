import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AtoTokenCard } from '@/components/ato-token-card';
import { IdentityCard } from '@/components/identity-card';
import { NAV_PIXEL_HEADER_INSET } from '@/components/nav-pixel';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { YourWeekCard } from '@/components/your-week-card';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useMeContext } from '@/lib/me-context';
import { SETTINGS_TITLE } from '@/lib/polish-copy';
import { NO_PINCH_ZOOM } from '@/lib/theme/chrome';

/**
 * You — who you are, your tokens, and your week. Every settings control (look,
 * city, birthday, notifications, AI consent, help, legal, sign out, delete
 * account, build info, developer rows) moved to the pushed `/settings` screen
 * (IA phase P1, docs/ato-ia-runner.md); this screen keeps one "Settings ›" row.
 *
 * The saved-facts list ("Teach Sage") has been hidden since 2026-10-14; the
 * data stays until docs/sage-cleanup.md drops it.
 */
export default function YouScreen() {
  const router = useRouter();
  const { me, refresh } = useMeContext();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          {...NO_PINCH_ZOOM}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <ThemedText type="subtitle">You</ThemedText>
          </View>

          {/* Who you are in two or three words, and the image to send a friend. */}
          {me ? <IdentityCard me={me} onUpdated={refresh} /> : null}

          {/* Tokens: the balance and the last few earns / spends. */}
          {me ? <AtoTokenCard me={me} /> : null}

          {/* The last seven days in three counts. Local + one read, no AI. */}
          {me ? <YourWeekCard me={me} /> : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={SETTINGS_TITLE}
            onPress={() => router.push('/settings')}
            style={({ pressed }) => [styles.settingsRow, pressed && styles.pressed]}>
            <ThemedView type="backgroundElement" style={styles.settingsCard}>
              <ThemedText type="smallBold">{SETTINGS_TITLE}</ThemedText>
              <ThemedText themeColor="textSecondary">›</ThemedText>
            </ThemedView>
          </Pressable>
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
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.five,
  },
  header: {
    paddingRight: NAV_PIXEL_HEADER_INSET,
  },
  settingsRow: {
    minHeight: 44,
  },
  settingsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Spacing.four,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  pressed: {
    opacity: 0.8,
  },
});
