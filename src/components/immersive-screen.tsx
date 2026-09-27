/**
 * `<ImmersiveScreen enabled edges>` — the wrapper form of `useImmersiveMode`
 * for a screen that wants the system bars hidden AND its content kept clear of
 * the notch / Dynamic Island / home indicator / Android cutouts.
 *
 * - `enabled`: hide the bars while true (reference-counted, restored on
 *   unmount / when false).
 * - `edges`: which safe-area edges to pad (default all four). Pass `[]` when the
 *   screen already handles its own safe area (e.g. it renders its own
 *   `SafeAreaView`), so nothing is padded twice.
 *
 * Screens that can't be wrapped (the bars follow a mode inside a bigger screen)
 * call `useImmersiveMode(enabled)` directly instead.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useImmersiveMode, type ImmersiveOptions } from '@/hooks/use-immersive-mode';

const ALL_EDGES: readonly Edge[] = ['top', 'right', 'bottom', 'left'];

export function ImmersiveScreen({
  enabled,
  edges = ALL_EDGES,
  options,
  style,
  children,
}: {
  enabled: boolean;
  edges?: readonly Edge[];
  options?: ImmersiveOptions;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  useImmersiveMode(enabled, options);
  if (edges.length === 0) return <View style={[styles.fill, style]}>{children}</View>;
  return (
    <SafeAreaView edges={edges} style={[styles.fill, style]}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
