import { useState, type ReactNode } from 'react';
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
