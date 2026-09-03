import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Sortable from 'react-native-sortables';
import { useState } from 'react';

import { SageTabIcon } from '@/components/sage-tab-icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useNavOrder } from '@/lib/nav/nav-context';
import {
  NAV_TABS,
  NAV_TAB_IDS,
  POOL_SLOTS,
  SLOT_COUNT,
  type BarSlotId,
  type ReorderableTabId,
} from '@/lib/nav/nav-order';
import { controlBorderColor } from '@/lib/theme/chrome';

/**
 * Full-screen "Edit navigation" overlay. Long-press a tab (or More) to enter.
 *
 * Slots 1–4 are one draggable list — Home and Sage can move within it but can
 * never leave. Below, the pool lists every tab: in-bar pool tabs show "On bar"
 * (tap to remove), out-of-bar pool tabs show "Add" (up to POOL_SLOTS). Locked
 * tabs sit under "Not unlocked yet". Done commits the layout atomically.
 */
export function NavEditOverlay({
  lockedTabs = [],
}: {
  lockedTabs?: ReorderableTabId[];
}) {
  const theme = useTheme();
  const { layout, cancelEditing, commitLayout } = useNavOrder();

  const [draftSlots, setDraftSlots] = useState<BarSlotId[]>(layout.slots);
  const [barFullNote, setBarFullNote] = useState(false);

  const lockedSet = new Set(lockedTabs);
  const draftPool = draftSlots.filter(
    (id): id is ReorderableTabId => id !== 'home' && id !== 'sage',
  );

  function addToBar(id: ReorderableTabId) {
    if (draftSlots.includes(id)) return;
    if (draftPool.length >= POOL_SLOTS) {
      setBarFullNote(true);
      return;
    }
    setBarFullNote(false);
    setDraftSlots((slots) => [...slots, id]);
  }

  function removeFromBar(id: ReorderableTabId) {
    setBarFullNote(false);
    setDraftSlots((slots) => slots.filter((item) => item !== id));
  }

  function done() {
    void commitLayout({ slots: draftSlots });
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
              Home and Sage always stay in slots 1–4 — drag to move them. Pick {POOL_SLOTS} more
              from below.
            </ThemedText>

            <ThemedText type="smallBold">Your bar</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {SLOT_COUNT} slots · drag to reorder. Tap a tab to remove it back to the pool (Home
              and Sage stay).
            </ThemedText>

            {barFullNote ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
                The bar is full — remove one of the {POOL_SLOTS} extra tabs first.
              </ThemedText>
            ) : null}

            <Sortable.Flex
              customHandle
              flexDirection="column"
              flexWrap="nowrap"
              onDragEnd={({ indexToKey }) => {
                const next = indexToKey.filter(
                  (key): key is BarSlotId => key === 'home' || key === 'sage' || key in NAV_TABS,
                );
                setDraftSlots(next);
              }}>
              {draftSlots.map((id) => (
                <View key={id} style={[styles.sortRow, { borderColor: controlBorderColor(theme) }]}>
                  <Sortable.Handle mode="draggable">
                    <MaterialCommunityIcons name="drag-vertical" size={22} color={theme.textSecondary} />
                  </Sortable.Handle>
                  {id === 'home' ? (
                    <>
                      <MaterialCommunityIcons name="home" size={22} color={theme.text} />
                      <ThemedText type="small" style={styles.rowLabel}>
                        Home
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        Pinned
                      </ThemedText>
                    </>
                  ) : id === 'sage' ? (
                    <>
                      <SageTabIcon />
                      <ThemedText type="small" style={styles.rowLabel}>
                        Sage
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        Pinned
                      </ThemedText>
                    </>
                  ) : (
                    <>
                      <MaterialCommunityIcons name={NAV_TABS[id].icon as never} size={22} color={theme.text} />
                      <ThemedText type="small" style={styles.rowLabel}>
                        {NAV_TABS[id].label}
                      </ThemedText>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${NAV_TABS[id].label}`}
                        onPress={() => removeFromBar(id)}
                        hitSlop={8}
                        style={({ pressed }) => pressed && styles.pressed}>
                        <ThemedText type="small" themeColor="textSecondary">
                          Remove
                        </ThemedText>
                      </Pressable>
                    </>
                  )}
                </View>
              ))}
            </Sortable.Flex>

            <ThemedText type="smallBold">Add to the bar</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Pick {POOL_SLOTS} tabs total for slots 1–4, alongside Home and Sage.
            </ThemedText>

            <View style={styles.poolList}>
              {NAV_TAB_IDS.filter((id) => !lockedSet.has(id)).map((id) => {
                const inBar = draftPool.includes(id);
                return (
                  <View key={id} style={[styles.sortRow, { borderColor: controlBorderColor(theme) }]}>
                    <MaterialCommunityIcons name={NAV_TABS[id].icon as never} size={22} color={theme.text} />
                    <ThemedText type="small" style={styles.rowLabel}>
                      {NAV_TABS[id].label}
                    </ThemedText>
                    {inBar ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        On bar
                      </ThemedText>
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Add ${NAV_TABS[id].label}`}
                        onPress={() => addToBar(id)}
                        disabled={draftPool.length >= POOL_SLOTS}
                        hitSlop={8}
                        style={({ pressed }) => [
                          pressed && styles.pressed,
                          draftPool.length >= POOL_SLOTS && styles.disabled,
                        ]}>
                        <ThemedText type="small" themeColor="textSecondary">
                          Add
                        </ThemedText>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>

            {lockedTabs.length > 0 ? (
              <>
                <ThemedText type="smallBold">Not unlocked yet</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  These stay off the bar until they&apos;re unlocked.
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
  poolList: {
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
