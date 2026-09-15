import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RebuiltNotice } from '@/components/rebuilt-notice';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { NAV_PIXEL_HEADER_INSET } from '@/components/nav-pixel';
import { SAGE_COACH_LABEL } from '@/lib/sage-copy';
import { NO_PINCH_ZOOM } from '@/lib/theme/chrome';

/**
 * Talk — placeholder pending rebuild (2026-09-14).
 *
 * The whole Talk backend was deleted with the old voice lane: routeTalkReply,
 * the provider layer (local/remote/gemini), select-provider and the voice
 * config. This screen is deliberately kept as a registered route rendering a
 * visible "rebuild" state rather than removed, because pulling a tab would mean
 * a native build — and the point of the placeholder is that it ships over OTA.
 *
 * Nothing here calls a model, claims quota, reads `sage_messages`, or asks for
 * AI consent. The consent gate now lives on Home, which owns the only surface
 * that still generates anything (the daily insight).
 *
 * When Talk is rebuilt it should be rebuilt against `generateText` →
 * `ai-generate` like every other current AI surface, not against the deleted
 * provider layer. `sage_messages` still exists; a drop migration is written and
 * awaiting review (wave71), so decide whether Talk keeps that table before
 * applying it.
 */
export default function SageScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          {...NO_PINCH_ZOOM}
          contentContainerStyle={styles.scrollContent}
          contentInsetAdjustmentBehavior="never">
          <View style={styles.header}>
            <ThemedText type="code" themeColor="textSecondary">
              {SAGE_COACH_LABEL}
            </ThemedText>
          </View>

          <RebuiltNotice title="Talk" note="Your daily insight on Home is unaffected." />
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
    paddingTop: NAV_PIXEL_HEADER_INSET,
    paddingBottom: BottomTabInset,
  },
  header: {
    paddingTop: Spacing.two,
  },
});
