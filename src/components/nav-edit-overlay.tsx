import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Sortable from 'react-native-sortables';
import { useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useNavOrder } from '@/lib/nav/nav-context';
import { NAV_TABS, type ReorderableTabId } from '@/lib/nav/nav-order';
import { controlBorderColor } from '@/lib/theme/chrome';

/**
 * Full-screen "Edit navigation" overlay. Long-press a tab (or More) to enter.
 * Drag rows to reorder the main bar, tap to move items between the bar and
 * More, swap Home/Sage, then Done commits the whole order atomically.
 *
 * Cross-list moves use explicit affordances ("move to More" / "move to bar")
 * rather than a cross-list drag, keeping the interaction robust.
 */
export function NavEditOverlay() {
  const theme = useTheme();
  const { order, cancelEditing, commitOrder } = useNavOrder();

  const [homeFirst, setHomeFirst] = useState(order.homeFirst);
  const [draftMain, setDraftMain] = useState<ReorderableTabId[]>(order.main);
  const [draftMore, setDraftMore] = useState<ReorderableTabId[]>(order.more);

  function moveToMore(id: ReorderableTabId) {
    setDraftMain((main) => main.filter((item) => item !== id));
    setDraftMore((more) => [...more, id]);
  }

  function moveToBar(id: ReorderableTabId) {
    setDraftMore((more) => more.filter((item) => item !== id));
    setDraftMain((main) => [...main, id]);
  }

  function done() {
    void commitOrder({ homeFirst, main: draftMain, more: draftMore });
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={cancelEditing}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <ThemedText type="subtitle">Edit navigation</ThemedText>
          <Pressable hitSlop={8} onPress={done}>
            <ThemedText type="smallBold" style={{ color: theme.accentFill }}>
              Done
            </ThemedText>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <ThemedText type="small" themeColor="textSecondary">
            Home and Sage always stay on the bar — tap to swap their order.
          </ThemedText>

          <View style={[styles.pinnedRow, { borderColor: controlBorderColor(theme) }]}>
            <PinnedBadge label={homeFirst ? 'Home · Sage' : 'Sage · Home'} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Swap Home and Sage"
              onPress={() => setHomeFirst((v) => !v)}
              style={({ pressed }) => [styles.swap, { borderColor: controlBorderColor(theme) }, pressed && styles.pressed]}>
              <MaterialCommunityIcons name="swap-horizontal" size={18} color={theme.text} />
              <ThemedText type="small">Swap</ThemedText>
            </Pressable>
          </View>

          <ThemedText type="smallBold">On the bar</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Drag the grip to reorder. Tap “More” to move an item off the bar.
          </ThemedText>

          {draftMain.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              Nothing pinned to the bar. Move something here from More.
            </ThemedText>
          ) : (
            <Sortable.Flex
              customHandle
              onDragEnd={({ indexToKey }) => {
                const next = indexToKey.filter(
                  (key): key is ReorderableTabId => key in NAV_TABS,
                );
                setDraftMain(next);
              }}>
              {draftMain.map((id) => (
                <View key={id} style={[styles.sortRow, { borderColor: controlBorderColor(theme) }]}>
                  <Sortable.Handle mode="draggable">
                    <MaterialCommunityIcons name="drag-vertical" size={22} color={theme.textSecondary} />
                  </Sortable.Handle>
                  <MaterialCommunityIcons name={NAV_TABS[id].icon as never} size={22} color={theme.text} />
                  <ThemedText type="small" style={styles.rowLabel}>
                    {NAV_TABS[id].label}
                  </ThemedText>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Move ${NAV_TABS[id].label} to More`}
                    onPress={() => moveToMore(id)}
                    hitSlop={8}
                    style={({ pressed }) => pressed && styles.pressed}>
                    <ThemedText type="small" themeColor="textSecondary">
                      More
                    </ThemedText>
                  </Pressable>
                </View>
              ))}
            </Sortable.Flex>
          )}

          <ThemedText type="smallBold">In More</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            More is the fixed rightmost tab. Tap an item to move it onto the bar.
          </ThemedText>

          {draftMore.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              More is empty.
            </ThemedText>
          ) : (
            <View style={styles.moreList}>
              {draftMore.map((id) => (
                <View key={id} style={[styles.sortRow, { borderColor: controlBorderColor(theme) }]}>
                  <MaterialCommunityIcons name={NAV_TABS[id].icon as never} size={22} color={theme.text} />
                  <ThemedText type="small" style={styles.rowLabel}>
                    {NAV_TABS[id].label}
                  </ThemedText>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Move ${NAV_TABS[id].label} to bar`}
                    onPress={() => moveToBar(id)}
                    hitSlop={8}
                    style={({ pressed }) => pressed && styles.pressed}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Bar
                    </ThemedText>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function PinnedBadge({ label }: { label: string }) {
  return (
    <ThemedText type="smallBold" style={styles.badge}>
      {label}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.four,
  },
  body: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
  },
  pinnedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  badge: {
    flex: 1,
  },
  swap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    backgroundColor: 'transparent',
    marginVertical: Spacing.half,
  },
  rowLabel: {
    flex: 1,
  },
  moreList: {
    gap: Spacing.half,
  },
  pressed: {
    opacity: 0.7,
  },
});
