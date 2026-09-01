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
 * The fixed rightmost "More" slot, opened as a bottom sheet. Lists the
 * reorderable tabs currently parked in `more[]`. Tapping one navigates to it;
 * long-press opens edit mode so it can be moved back to the main bar.
 */
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

  if (!open) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaProvider style={styles.provider}>
        <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
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

          {moreIds.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
              Nothing here. Long-press a tab and move it into More.
            </ThemedText>
          ) : (
            <ScrollView contentContainerStyle={styles.list}>
              {moreIds.map((id) => (
                <Pressable
                  key={id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${NAV_TABS[id].label}`}
                  onPress={() => {
                    onClose();
                    router.push(NAV_TABS[id].href as never);
                  }}
                  onLongPress={() => {
                    onClose();
                    startEditing();
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
            </ScrollView>
          )}
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
  empty: {
    paddingVertical: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
