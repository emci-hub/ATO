import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RebuiltNotice } from '@/components/rebuilt-notice';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { NAV_PIXEL_HEADER_INSET } from '@/components/nav-pixel';
import { NO_PINCH_ZOOM } from '@/lib/theme/chrome';

/**
 * This week — placeholder pending rebuild (docs/ISOLATION_PLAN.md §7 Card F,
 * 2026-09-15).
 *
 * The weekly recap read the Check history, and the Check loop is parked (§0
 * decision 1) — so this screen had nothing left to recap. Its only entry
 * point, Home's "This week" row, went with Card C.
 *
 * Kept as a registered route rendering a visible "rebuild" state rather than
 * removed: pulling a route would mean a native build, and the whole point of
 * the placeholder is that it ships over OTA. Every link that used to lead here
 * now lands on this notice.
 */
export default function WeekScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          {...NO_PINCH_ZOOM}
          contentContainerStyle={styles.scroll}
          contentInsetAdjustmentBehavior="never">
          <RebuiltNotice title="This week" />
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
