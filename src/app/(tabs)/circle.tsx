import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RebuiltNotice } from '@/components/rebuilt-notice';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { NAV_PIXEL_HEADER_INSET } from '@/components/nav-pixel';
import { NO_PINCH_ZOOM } from '@/lib/theme/chrome';

/**
 * Circle — placeholder pending rebuild (docs/ISOLATION_PLAN.md §7 Card F,
 * 2026-09-15).
 *
 * The scanned-in Circle is disconnected: peer resolve/confirm, the realtime
 * peer subscription, the shared circle context reads and the per-peer chat
 * entry points are all gone from this screen. `lib/circle*` is untouched —
 * only the call sites, per "delete the call site, not the callee".
 *
 * Kept as a registered route rendering a visible "rebuild" state rather than
 * removed: pulling a route would mean a native build, and the whole point of
 * the placeholder is that it ships over OTA. Every link that used to lead here
 * now lands on this notice.
 */
export default function CircleScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          {...NO_PINCH_ZOOM}
          contentContainerStyle={styles.scroll}
          contentInsetAdjustmentBehavior="never">
          <RebuiltNotice title="Circle" />
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
