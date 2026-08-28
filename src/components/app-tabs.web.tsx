import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, StyleSheet } from 'react-native';

import { SageTabIcon } from './sage-tab-icon';
import { ThemedTabBar } from './themed-tab-bar';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Spacing } from '@/constants/theme';
import { useCircleContext } from '@/lib/circle-context';

export default function AppTabs() {
  const { hasCircle } = useCircleContext();

  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton>Home</TabButton>
          </TabTrigger>
          <TabTrigger name="sage" href="/sage" asChild>
            <TabButton icon={<SageTabIcon />}>Sage</TabButton>
          </TabTrigger>
          <TabTrigger name="around" href="/around" asChild>
            <TabButton>Around</TabButton>
          </TabTrigger>
          {/* Circle does not exist until a scan — not hidden, not present. */}
          {hasCircle ? (
            <TabTrigger name="circle" href="/circle" asChild>
              <TabButton>Circle</TabButton>
            </TabTrigger>
          ) : null}
          <TabTrigger name="you" href="/you" asChild>
            <TabButton>You</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, icon, ...props }: TabTriggerSlotProps & { icon?: React.ReactNode }) {
  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'background'}
        style={styles.tabButtonView}>
        {icon}
        <ThemedText type="small" themeColor={isFocused ? 'text' : 'textSecondary'}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  return <ThemedTabBar {...props}>{props.children}</ThemedTabBar>;
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
});
