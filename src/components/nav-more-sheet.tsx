import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useNavOrder } from '@/lib/nav/nav-context';
import { NAV_TABS, type ReorderableTabId } from '@/lib/nav/nav-order';
import { controlBorderColor } from '@/lib/theme/chrome';

/**
 * The fixed rightmost "More" slot, opened as a bottom sheet. Lists the pool
 * tabs not currently placed in slots 1–4 (More is their spillover). Tapping
 * one navigates to it; long-press opens edit mode so it can be added to the
 * bar.
 *
 * Divecore (Play) is appended as a fixed module row in every build (emci
 * 2026-10-15: Divecore stays on) — it is a pushed room (root /play route), not
 * a pool tab, so it never appears in the bar or the edit pool.
 */
// RN's default Modal `animationType="fade"` runs ~300ms on both platforms.
const MODAL_FADE_MS = 300;

export function NavMoreSheet({
  open,
  moreIds,
  onClose,
}: {
  open: boolean;
  moreIds: ReorderableTabId[];
  onClose: () => void;
}) {
  const theme = useTheme();
  const { startEditing } = useNavOrder();

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaProvider style={styles.provider}>
        <View style={styles.backdrop}>
        {/* Flex spacer above the sheet — not absoluteFill, so row taps never
            hit the dismiss layer. */}
        <Pressable style={styles.backdropDismiss} onPress={onClose} accessibilityLabel="Dismiss More" />
        <SafeAreaView
          edges={['bottom']}
          style={[styles.sheet, { backgroundColor: theme.background, borderColor: controlBorderColor(theme) }]}>
          <View style={styles.header}>
            <ThemedText type="smallBold">More</ThemedText>
            <Pressable hitSlop={8} onPress={onClose}>
              <ThemedText type="small" themeColor="textSecondary">
                Close
              </ThemedText>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.list}>
            {moreIds.filter((id) => id !== 'play').map((id) => (
              <Pressable
                key={id}
                accessibilityRole="button"
                accessibilityLabel={`Open ${NAV_TABS[id].label}`}
                onPress={() => {
                  // Push first so closing the Modal cannot unmount before
                  // the tab navigator receives the route.
                  router.push(NAV_TABS[id].href as never);
                  onClose();
                }}
                onLongPress={() => {
                  // Close this Modal and wait for its fade-out to finish
                  // before opening the edit overlay's Modal — two sibling
                  // RN Modals toggling in the same tick (or mid-animation)
                  // desyncs the native modal host until a screen focus
                  // event forces a resync. Matches this Modal's fade
                  // animationType duration.
                  onClose();
                  setTimeout(startEditing, MODAL_FADE_MS);
                }}
                style={({ pressed }) => [
                  styles.row,
                  { borderColor: controlBorderColor(theme) },
                  pressed && styles.pressed,
                ]}>
                <MaterialCommunityIcons name={NAV_TABS[id].icon as never} size={22} color={theme.text} />
                <ThemedText type="small" style={styles.rowLabel}>
                  {NAV_TABS[id].label}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  ›
                </ThemedText>
              </Pressable>
            ))}

            {/* "Open Divecore" shows only when Play is not already a bar slot (IA phase P3). */}
            {moreIds.includes('play') ? (
              <Pressable
                key="play"
                accessibilityRole="button"
                accessibilityLabel="Open Divecore"
                onPress={() => {
                  // Push first so closing the Modal cannot unmount before
                  // the route is received (same pattern as the rows above).
                  router.push('/play');
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.row,
                  { borderColor: controlBorderColor(theme) },
                  pressed && styles.pressed,
                ]}>
                <MaterialCommunityIcons name="play-circle" size={22} color={theme.accent} />
                <ThemedText type="smallBold" style={styles.rowLabel}>
                  Divecore
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  ›
                </ThemedText>
              </Pressable>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </View>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  provider: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  backdropDismiss: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    borderTopWidth: 1,
    padding: Spacing.four,
    gap: Spacing.three,
    maxHeight: '60%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  list: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  rowLabel: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
