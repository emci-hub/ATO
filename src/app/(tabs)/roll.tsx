import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RebuiltNotice } from '@/components/rebuilt-notice';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { NAV_PIXEL_HEADER_INSET } from '@/components/nav-pixel';
import { NO_PINCH_ZOOM } from '@/lib/theme/chrome';

/**
 * Roll — placeholder pending rebuild (docs/ISOLATION_PLAN.md Card 3, 2026-09-15).
 *
 * This is Legends' reveal screen; parking Legends stranded it, so it is
 * parked in the same pass. The roll/reveal RPCs, trait-track reads, and
 * token spend are all disconnected. `src/lib/rolls/*` is untouched — only
 * this screen's call sites are gone, per the "delete the call site, not the
 * callee" rule.
 *
 * This screen is deliberately kept as a registered route rendering a visible
 * "rebuild" state rather than removed, so it keeps working and ships over
 * OTA. When Roll is rebuilt, wire it back against the same `lib/rolls/*`
 * modules — they were never touched.
 */
export default function RollScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          {...NO_PINCH_ZOOM}
          contentContainerStyle={styles.scroll}
          contentInsetAdjustmentBehavior="never">
          <RebuiltNotice title="Roll" />
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
