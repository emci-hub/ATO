/**
 * Play bottom sheet (room + dive overhaul, 2026-09-29) — slides up over the
 * screen it lives in (absolute, not a native Modal, so the Play shell's back
 * rules and toasts keep working). Closes on the backdrop, the ✕, a drag down
 * on the handle, or back (the owning screen registers that with the shell).
 * Reduced motion: a plain fade, no slide.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { PanResponder, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Fonts } from '@/constants/theme';
import { NEON } from '@/play/neon-viper';

const OPEN_MS = 240;
const CLOSE_DRAG = 70;

export function PlaySheet({
  open,
  title,
  onClose,
  reduceMotion,
  children,
  header,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  reduceMotion: boolean;
  children: ReactNode;
  /** Optional row under the title (tabs). */
  header?: ReactNode;
}) {
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = useState(open);
  const shown = useSharedValue(0);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    const done = (finished?: boolean) => {
      'worklet';
      if (finished && !open) scheduleOnRN(setMounted, false);
    };
    shown.value = withTiming(open ? 1 : 0, { duration: OPEN_MS, easing: Easing.out(Easing.cubic) }, done);
  }, [mounted, open, shown]);

  const drag = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, g) => g.dy > 6,
        onPanResponderRelease: (_e, g) => {
          if (g.dy > CLOSE_DRAG || g.vy > 0.8) onClose();
        },
      }),
    [onClose],
  );

  const backdropStyle = useAnimatedStyle(() => ({ opacity: shown.value * 0.6 }));
  const panelStyle = useAnimatedStyle(() =>
    reduceMotion
      ? { opacity: shown.value }
      : { transform: [{ translateY: (1 - shown.value) * height * 0.8 }] },
  );

  if (!mounted) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'auto' : 'none'}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
      </Animated.View>
      <Animated.View style={[styles.panel, { maxHeight: height * 0.8 }, panelStyle]} accessibilityViewIsModal>
        <View {...drag.panHandlers} style={styles.handleZone}>
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={`Close ${title}`}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
        </View>
        {header}
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

/** A row of tabs for a sheet header. */
export function SheetTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
      {tabs.map((tab) => {
        const on = tab.id === value;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onChange(tab.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[styles.tab, on && styles.tabOn]}>
            <Text style={[styles.tabText, on && styles.tabTextOn]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: '#000000' },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: NEON.panel,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderColor: NEON.cyanBorder,
    paddingBottom: 12,
  },
  handleZone: { paddingTop: 8, paddingHorizontal: 16 },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: NEON.cyanBorder,
    marginBottom: 8,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8 },
  title: {
    fontFamily: Fonts.displayBold,
    fontSize: 18,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: NEON.textPrimary,
  },
  close: { fontSize: 18, color: NEON.textMuted, paddingHorizontal: 4 },
  body: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  tabs: { paddingHorizontal: 16, gap: 8, paddingBottom: 10 },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: NEON.cyanDim,
    borderRadius: 14,
  },
  tabOn: { borderColor: NEON.cyan, backgroundColor: NEON.cyanSoft },
  tabText: { fontFamily: Fonts.mono, fontSize: 12, color: NEON.textMuted },
  tabTextOn: { color: NEON.cyan, fontFamily: Fonts.monoBold },
});
