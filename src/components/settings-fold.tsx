import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Collapsed-by-default settings section. Header stays one row so the rest
 * of the page does not jump until the person opens it.
 */
export function SettingsFold({
  title,
  children,
  defaultOpen = false,
  onOpen,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  onOpen?: () => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(defaultOpen);

  /**
   * `defaultOpen` has to drive the fold on every rising edge, not just the
   * first mount, and it has to move BOTH `open` and `onOpen`:
   *
   * - `useState(defaultOpen)` seeds once, so a tab that is already mounted
   *   (the normal case — every deep link into this fold comes from another
   *   tab) would keep the stale `false` and stay visually collapsed.
   * - `onOpen` is the only hook callers load their content in, and `toggle`
   *   is the only other thing that fires it, so a fold that opens this way
   *   would otherwise sit on its loading state forever.
   *
   * Edge-triggered via a ref rather than level-triggered, so a re-render or a
   * new `onOpen` identity cannot re-fire it, while a genuine false→true flip
   * (a second deep link naming a different axis) still reloads. Closing again
   * is left to the person; this never force-collapses.
   */
  const defaultOpenRef = useRef(false);
  useEffect(() => {
    if (!defaultOpen) {
      defaultOpenRef.current = false;
      return;
    }
    if (defaultOpenRef.current) return;
    defaultOpenRef.current = true;
    setOpen(true);
    onOpen?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- edge-triggered on defaultOpen
  }, [defaultOpen]);

  function toggle() {
    setOpen((value) => {
      const next = !value;
      if (next) onOpen?.();
      return next;
    });
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedPressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        onPress={toggle}
        style={styles.header}>
        <ThemedText type="smallBold" style={styles.title}>
          {title}
        </ThemedText>
        <MaterialCommunityIcons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={theme.textSecondary}
        />
      </ThemedPressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  title: {
    flex: 1,
  },
  body: {
    paddingBottom: Spacing.one,
  },
});
