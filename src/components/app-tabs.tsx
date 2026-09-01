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
import { NAV_TABS, type ReorderableTabId } from '@/lib/nav/nav-order';
import { controlBorderColor } from '@/lib/theme/chrome';

/**
 * Custom JS bottom tab bar, driven by the persisted NavOrder.
 *
 * Home + Sage are pinned (swappable, never into More); More is the fixed
 * rightmost slot; Explore / Around / You / Circle are reorderable and can move
 * between the bar and More. Long-press any tab to enter edit mode.
 *
 * Replaces NativeTabs (native) and the web pill bar with one headless
 * expo-router/ui navigator so order/visibility are fully JS-controlled and
 * ship via OTA. Trade-off: native tab behaviors (freeze, minimize, blur,
 * scroll-to-top on re-tap) are not preserved.
 */
export default function AppTabs() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { hasCircle } = useCircleContext();
  const { order, editing, startEditing } = useNavOrder();
  const [moreOpen, setMoreOpen] = useState(false);

  const visible = (id: ReorderableTabId) => id !== 'circle' || hasCircle;
  const mainIds = order.main.filter(visible);
  const moreIds = order.more.filter(visible);

  const sageTrigger = (
    <TabTrigger name="sage" href="/sage" asChild>
      <NavTabButton label="Sage" iconNode={<SageTabIcon />} onLongPress={startEditing} />
    </TabTrigger>
  );
  const homeTrigger = (
    <TabTrigger name="home" href="/" asChild>
      <NavTabButton label="Home" icon="home" onLongPress={startEditing} />
    </TabTrigger>
  );

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
          {order.homeFirst ? (
            <>
              {homeTrigger}
              {sageTrigger}
            </>
          ) : (
            <>
              {sageTrigger}
              {homeTrigger}
            </>
          )}

          {mainIds.map((id) => (
            <TabTrigger key={id} name={id} href={NAV_TABS[id].href} asChild>
              <NavTabButton label={NAV_TABS[id].label} icon={NAV_TABS[id].icon} onLongPress={startEditing} />
            </TabTrigger>
          ))}

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
        </TabList>
      </Tabs>

      <NavMoreSheet open={moreOpen} moreIds={moreIds} onClose={() => setMoreOpen(false)} />
      {editing ? <NavEditOverlay /> : null}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: Spacing.two,
    paddingTop: Spacing.one,
    borderTopWidth: StyleSheet.hairlineWidth,
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
});
