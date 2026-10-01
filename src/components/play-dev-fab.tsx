/**
 * Floating dev button shell — a draggable DEV bubble that opens a Modal over
 * the current screen. Two users: Play (`src/app/play.tsx`, the Play dev kit)
 * and the app (`app-dev-fab.tsx`, the Dev Tools Hub sections for the screen
 * you are on). Never both at once: the app one hides on /play.
 */
import type { ReactNode } from 'react';
import { useEffect, useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { useTheme } from '@/hooks/use-theme';
import {
  DEV_FAB_SIZE,
  clampFab,
  defaultFabPosition,
  snapFabX,
} from '@/lib/dev-fab-model';

export function PlayDevFab({
  panel,
  open,
  onOpenChange,
  title = 'Play dev kit',
}: {
  /** Heading of the panel (the app kit names the screen). */
  title?: string;
  panel: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const bounds = useMemo(
    () => ({ width, height, top: insets.top, bottom: insets.bottom }),
    [width, height, insets.top, insets.bottom],
  );
  const start = useMemo(() => defaultFabPosition(bounds), [bounds]);
  const x = useSharedValue(start.x);
  const y = useSharedValue(start.y);
  const sx = useSharedValue(0);
  const sy = useSharedValue(0);

  useEffect(() => {
    const c = clampFab({ x: x.value, y: y.value }, bounds);
    x.value = c.x;
    y.value = c.y;
  }, [bounds, x, y]);

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .minDistance(6)
      .onStart(() => {
        sx.value = x.value;
        sy.value = y.value;
      })
      .onUpdate((e) => {
        const c = clampFab({ x: sx.value + e.translationX, y: sy.value + e.translationY }, bounds);
        x.value = c.x;
        y.value = c.y;
      })
      .onEnd(() => {
        x.value = withSpring(snapFabX(x.value, bounds.width), { damping: 18, stiffness: 220 });
      });
    const tap = Gesture.Tap()
      .maxDistance(6)
      .onEnd((_e, success) => {
        if (success) scheduleOnRN(onOpenChange, true);
      });
    return Gesture.Exclusive(pan, tap);
  }, [bounds, sx, sy, x, y]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }] }));

  return (
    <>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <GestureDetector gesture={gesture}>
          <Animated.View
            accessible
            accessibilityRole="button"
            accessibilityLabel={title}
            style={[styles.fab, style]}>
            <Text style={styles.fabText}>DEV</Text>
          </Animated.View>
        </GestureDetector>
      </View>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => onOpenChange(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => onOpenChange(false)} accessibilityLabel="Close dev kit" />
          <View style={[styles.panel, { backgroundColor: theme.background, borderColor: theme.textSecondary }]}>
            <View style={styles.head}>
              <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
              <Pressable onPress={() => onOpenChange(false)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
                <Text style={[styles.close, { color: theme.text }]}>✕</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
              {panel}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: DEV_FAB_SIZE,
    height: DEV_FAB_SIZE,
    borderRadius: DEV_FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0E7490',
    borderWidth: 2,
    borderColor: '#4FFFD2',
    opacity: 0.8,
    elevation: 8,
    zIndex: 1000,
  },
  fabText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  panel: {
    maxHeight: '85%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingBottom: 24,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  title: { fontSize: 18, fontWeight: '700' },
  close: { fontSize: 18 },
  body: { paddingHorizontal: 16, paddingBottom: 16 },
});
