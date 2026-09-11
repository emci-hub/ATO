/**
 * PlayFrame — the Divecore card surface.
 *
 * Neon Viper chrome only: an ink panel with a thin cyan border and a cyan
 * glow (the same treatment `ThemedView type="backgroundElement"` gives the
 * Defend coach card). The old Kenney Fantasy UI 9-slice border art is gone —
 * its white brackets clashed with the neon palette.
 *
 * `style` still carries the caller's layout/padding/radius, so every existing
 * call site is unchanged; `position: relative` is kept so absolute children
 * still anchor to the card.
 */
import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedView } from '@/components/themed-view';

export function PlayFrame({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <ThemedView type="backgroundElement" style={[styles.frame, style]}>
      {children}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  frame: {
    position: 'relative',
  },
});
