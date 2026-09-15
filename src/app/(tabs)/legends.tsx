import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RebuiltNotice } from '@/components/rebuilt-notice';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { NAV_PIXEL_HEADER_INSET } from '@/components/nav-pixel';
import { NO_PINCH_ZOOM } from '@/lib/theme/chrome';

/**
 * Legends — placeholder pending rebuild (docs/ISOLATION_PLAN.md Card 3, 2026-09-15).
 *
 * The archetype classifier, story generation, milestone writes, the
 * full-profile-complete token claim, and legend reroll are all disconnected.
 * `src/lib/legends64/*` is untouched — only this screen's call sites are
 * gone, per the "delete the call site, not the callee" rule. Story on Home
 * does not spend ATO tokens (claim_story_generate is a daily quota guard,
 * not a token spend — confirmed 2026-09-15), so parking the token-earn site
 * here does not leave Story unaffordable; there is nothing to resolve.
 *
 * This screen is deliberately kept as a registered route rendering a visible
 * "rebuild" state rather than removed, so the tab keeps working and ships
 * over OTA. When Legends is rebuilt, wire it back against the same
 * `lib/legends64/*` modules — they were never touched.
 */
export default function LegendsScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          {...NO_PINCH_ZOOM}
          contentContainerStyle={styles.scroll}
          contentInsetAdjustmentBehavior="never">
          <RebuiltNotice title="Legends" />
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
  scroll: {
    gap: Spacing.three,
    paddingTop: NAV_PIXEL_HEADER_INSET,
    paddingBottom: BottomTabInset + Spacing.four,
  },
});
