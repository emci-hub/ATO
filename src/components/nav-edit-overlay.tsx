import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Sortable from 'react-native-sortables';
import { useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useNavOrder } from '@/lib/nav/nav-context';
import { MAIN_BAR_CAP, NAV_TABS, type ReorderableTabId } from '@/lib/nav/nav-order';
import { controlBorderColor } from '@/lib/theme/chrome';

/**
 * Full-screen "Edit navigation" overlay. Long-press a tab (or More) to enter.
 * Drag rows to reorder the main bar, tap to move items between the bar and
 * More, swap Home/Sage, then Done commits the whole order atomically.
 *
 * Cross-list moves use explicit affordances ("move to More" / "move to bar")
 * rather than a cross-list drag, keeping the interaction robust.
 */


export function NavEditOverlay({
  lockedTabs = [],
}: {
  lockedTabs?: ReorderableTabId[];
}) {
  const theme = useTheme();
  const { order, cancelEditing, commitOrder } = useNavOrder();

  const [homeFirst, setHomeFirst] = useState(order.homeFirst);
  const [draftMain, setDraftMain] = useState<ReorderableTabId[]>(order.main);
  const [draftMore, setDraftMore] = useState<ReorderableTabId[]>(order.more);
  const [barFullNote, setBarFullNote] = useState(false);

  const lockedSet = new Set(lockedTabs);
  const filteredDraftMain = draftMain.filter((id) => !lockedSet.has(id));
  const filteredDraftMore = draftMore.filter((id) => !lockedSet.has(id));

  function moveToMore(id: ReorderableTabId) {
    setDraftMain((main) => main.filter((item) => item !== id));
    setDraftMore((more) => [...more, id]);
  }

  function moveToBar(id: ReorderableTabId) {
    setDraftMore((more) => {
      if (!more.includes(id)) return more;
      setDraftMain((main) => {
        const unlockedCount = main.filter((item) => !lockedSet.has(item)).length;
        if (unlockedCount >= MAIN_BAR_CAP) {
          setBarFullNote(true);
          return main;
        }
        setBarFullNote(false);
        return [...main, id];
      });
      return more.filter((item) => item !== id);
    });
  }

  function done() {
    void commitOrder({ homeFirst, main: draftMain, more: draftMore });
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={cancelEditing}>
      <SafeAreaProvider style={styles.provider}>
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <Pressable style={styles.headerSide} hitSlop={8} onPress={cancelEditing}>
            <ThemedText type="small" themeColor="textSecondary">
              Cancel
            </ThemedText>
          </Pressable>
          <ThemedText type="subtitle" style={styles.headerTitle}>
            Edit navigation
          </ThemedText>
          <Pressable style={[styles.headerSide, styles.headerSideEnd]} hitSlop={8} onPress={done}>
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
            2 slots — Home and Sage always stay, plus two more. Drag to reorder. Tap “More” to move one off.
          </ThemedText>

          {barFullNote ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
              The bar is full — move something off first.
            </ThemedText>
          ) : null}

          {filteredDraftMain.length === 0 ? (
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
                setDraftMain((prev) => [...next, ...prev.filter((id) => lockedSet.has(id))]);
              }}>
              {filteredDraftMain.map((id) => (
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

          {filteredDraftMore.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              More is empty.
            </ThemedText>
          ) : (
            <View style={styles.moreList}>
              {filteredDraftMore.map((id) => (
                <View key={id} style={[styles.sortRow, { borderColor: controlBorderColor(theme) }]}>
                  <MaterialCommunityIcons name={NAV_TABS[id].icon as never} size={22} color={theme.text} />
                  <ThemedText type="small" style={styles.rowLabel}>
                    {NAV_TABS[id].label}
                  </ThemedText>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Move ${NAV_TABS[id].label} to bar`}
                    onPress={() => moveToBar(id)}
                    disabled={filteredDraftMain.length >= MAIN_BAR_CAP}
                    hitSlop={8}
                    style={({ pressed }) => [pressed && styles.pressed, filteredDraftMain.length >= MAIN_BAR_CAP && styles.disabled]}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Bar
                    </ThemedText>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {lockedTabs.length > 0 ? (
            <>
              <ThemedText type="smallBold">Not unlocked yet</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                These stay off the bar until they&apos;re unlocked. No Bar or More toggle.
              </ThemedText>
              {lockedTabs.map((id) => (
                <View key={id} style={[styles.lockedRow, { borderColor: controlBorderColor(theme) }]}>
                  <MaterialCommunityIcons name="lock-outline" size={18} color={theme.textSecondary} />
                  <View style={styles.lockedCopy}>
                    <ThemedText type="small" style={styles.lockedLabel}>
                      {NAV_TABS[id].label}
                    </ThemedText>
                    {NAV_TABS[id].unlockReason ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        {NAV_TABS[id].unlockReason}
                      </ThemedText>
                    ) : null}
                  </View>
                </View>
              ))}
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
      </SafeAreaProvider>
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
  provider: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.four,
  },
  headerSide: {
    flex: 1,
  },
  headerSideEnd: {
    alignItems: 'flex-end',
  },
  headerTitle: {
    flex: 2,
    textAlign: 'center',
  },
  body: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
  },
  note: {
    color: '#E5484D',
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
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    opacity: 0.7,
  },
  lockedCopy: {
    flex: 1,
    gap: Spacing.half,
  },
  lockedLabel: {
    flex: 0,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.4,
  },
});
