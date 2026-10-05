import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppearance } from '@/lib/theme/context';

/**
 * The polish pass's shared motion (emci, 2026-10-05). Every new animation goes
 * through here so Reduce Motion is honoured in one place: with it on, things
 * simply appear — no fade, no slide, no pulse.
 */

/** Gap between list items easing in, in ms. */
export const APPEAR_STAGGER_MS = 60;

/** A block that eases up into place on mount. `index` staggers siblings. */
export function Appear({
  children,
  index = 0,
  style,
}: {
  children: ReactNode;
  index?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const { reduceMotion } = useAppearance();
  if (reduceMotion) return <View style={style}>{children}</View>;
  const entering = FadeInDown.delay(index * APPEAR_STAGGER_MS).duration(
    Math.min(Math.max(theme.motionMs, 200), 450),
  );
  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}

/** One grey placeholder bar. Pulses gently unless Reduce Motion is on. */
export function SkeletonBar({ width = '100%', height = 12 }: { width?: `${number}%` | number; height?: number }) {
  const theme = useTheme();
  const { reduceMotion } = useAppearance();
  const pulse = useSharedValue(0.55);
  useEffect(() => {
    if (reduceMotion) return;
    pulse.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [pulse, reduceMotion]);
  const animated = useAnimatedStyle(() => ({ opacity: reduceMotion ? 0.7 : pulse.value }));
  return (
    <Animated.View
      style={[
        styles.bar,
        { width, height, backgroundColor: theme.backgroundSelected, borderRadius: Math.min(theme.radius, 6) },
        animated,
      ]}
    />
  );
}

/** A card-shaped placeholder: stands in for "Loading…" while data lands. */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <ThemedView
      type="backgroundElement"
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
      style={styles.card}>
      <SkeletonBar width="40%" height={10} />
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonBar key={i} width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  bar: {},
  card: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
});
