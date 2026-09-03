import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { TabList, TabSlot, Tabs, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NavEditOverlay } from '@/components/nav-edit-overlay';
import { NavMoreSheet } from '@/components/nav-more-sheet';
import { SageTabIcon } from '@/components/sage-tab-icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCircleContext } from '@/lib/circle-context';
import { useNavOrder } from '@/lib/nav/nav-context';
import {
  isTabUnlocked,
  lockedTabIds,
  NAV_TABS,
  NAV_TAB_IDS,
  type BarSlotId,
  type ReorderableTabId,
} from '@/lib/nav/nav-order';
import { controlBorderColor } from '@/lib/theme/chrome';

/**
 * Custom JS bottom tab bar: 5 slots. Slot 5 is always "More" (fixed, not
 * draggable). Slots 1–4 render Home + Sage (each once) interleaved with the
 * two pool tabs chosen in edit mode, in the user's saved order. Locked pool
 * tabs (e.g. Circle until a friend is scanned) are skipped visually but stay
 * registered as routes via hidden triggers inside TabList.
 *
 * Replaces NativeTabs with one headless expo-router/ui navigator so order and
 * visibility are fully JS-controlled and ship via OTA. Trade-off: native tab
 * behaviors (freeze, minimize, blur, scroll-to-top on re-tap) are not kept.
 */
export default function AppTabs() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { hasCircle } = useCircleContext();
  const { layout, editing, startEditing } = useNavOrder();
  const [moreOpen, setMoreOpen] = useState(false);

  const unlockCtx = { hasCircle };
  const lockedTabs = lockedTabIds(unlockCtx);
  const lockedSet = new Set<string>(lockedTabs);

  // Slots 1–4, minus locked pool tabs (they render as empty until unlocked).
  const visibleSlots = layout.slots.filter(
    (id) => id === 'home' || id === 'sage' || !lockedSet.has(id),
  );

  // Every unlocked pool tab not currently shown in a slot → More + hidden trigger.
  const shownPool = visibleSlots.filter(
    (id): id is ReorderableTabId => id !== 'home' && id !== 'sage',
  );
  const moreIds = NAV_TAB_IDS.filter(
    (id) => !shownPool.includes(id) && isTabUnlocked(id, unlockCtx),
  );

  function renderSlot(id: BarSlotId) {
    if (id === 'home') {
      return (
        <TabTrigger key="home" name="home" href="/" asChild>
          <NavTabButton label="Home" icon="home" onLongPress={startEditing} />
        </TabTrigger>
      );
    }
    if (id === 'sage') {
      return (
        <TabTrigger key="sage" name="sage" href="/sage" asChild>
          <NavTabButton label="Sage" iconNode={<SageTabIcon />} onLongPress={startEditing} />
        </TabTrigger>
      );
    }
    return (
      <TabTrigger key={id} name={id} href={NAV_TABS[id].href} asChild>
        <NavTabButton
          label={NAV_TABS[id].label}
          icon={NAV_TABS[id].icon}
          onLongPress={startEditing}
        />
      </TabTrigger>
    );
  }

  return (
    <>
      <Tabs>
        <TabSlot style={styles.slot} />
        <TabList
          style={[
            styles.bar,
            {
              backgroundColor: theme.background,
              borderColor: controlBorderColor(theme),
              paddingBottom: Math.max(insets.bottom, Spacing.two),
            },
          ]}>
          {visibleSlots.map(renderSlot)}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="More"
            onPress={() => setMoreOpen(true)}
            style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}>
            <MaterialCommunityIcons name="dots-horizontal" size={22} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary">
              More
            </ThemedText>
          </Pressable>

          {moreIds.map((id) => (
            <TabTrigger
              key={`hidden-${id}`}
              name={id}
              href={NAV_TABS[id].href}
              style={styles.hidden}
              accessible={false}
            />
          ))}
        </TabList>
      </Tabs>

      <NavMoreSheet open={moreOpen} moreIds={moreIds} onClose={() => setMoreOpen(false)} />
      {editing ? <NavEditOverlay lockedTabs={lockedTabs} /> : null}
    </>
  );
}

function NavTabButton({
  label,
  icon,
  iconNode,
  isFocused,
  onLongPress,
  ...props
}: TabTriggerSlotProps & {
  label: string;
  icon?: string;
  iconNode?: React.ReactNode;
  onLongPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      {...props}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : undefined}
      style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}>
      {iconNode ?? (
        <MaterialCommunityIcons
          name={icon as never}
          size={22}
          color={isFocused ? theme.text : theme.textSecondary}
        />
      )}
      <ThemedText type="small" themeColor={isFocused ? undefined : 'textSecondary'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  slot: {
    flex: 1,
  },
  bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: Spacing.two,
    paddingTop: Spacing.one,
    borderTopWidth: StyleSheet.hairlineWidth,
    zIndex: 20,
    elevation: 20,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.one,
  },
  pressed: {
    opacity: 0.7,
  },
  hidden: {
    width: 0,
    height: 0,
    overflow: 'hidden',
  },
});
