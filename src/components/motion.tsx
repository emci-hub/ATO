import { useEffect, type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useBreath } from '@/hooks/use-breath';
import { useTheme } from '@/hooks/use-theme';
import { useAppearance } from '@/lib/theme/context';

/**
 * The polish pass's shared motion (emci, 2026-10-05). Every new animation goes
 * through here so Reduce Motion is honoured in one place. PHASE-03: Reduce
 * Motion is "gentle, never still" — a short cross-fade instead of the slide,
 * and a half-size, quarter-speed pulse on skeletons. (The phone's setting and
 * the app's own read of it both count.)
 */

/** Gap between list items easing in, in ms. */
export const APPEAR_STAGGER_MS = 60;

/** Reduce Motion cross-fade, in ms (never longer than 300). */
const REDUCED_FADE_MS = 300;

/** Reduce Motion stand-in for Appear: a cross-fade, plus the BREATH loop when `breathe`. */
function ReducedAppear({
  children,
  style,
  breathe,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  breathe: boolean;
}) {
  const fade = FadeIn.duration(REDUCED_FADE_MS);
  if (!breathe) {
    return (
      <Animated.View entering={fade} style={style}>
        {children}
      </Animated.View>
    );
  }
  return (
    <BreathingAppear entering={fade} style={style}>
      {children}
    </BreathingAppear>
  );
}

function BreathingAppear({
  children,
  style,
  entering,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  entering: ComponentProps<typeof Animated.View>['entering'];
}) {
  const { style: breath } = useBreath();
  return (
    <Animated.View entering={entering} style={style}>
      {/* The breath sits one level in, so it never fights the fade-in. */}
      <Animated.View style={breath}>{children}</Animated.View>
    </Animated.View>
  );
}

/**
 * A block that eases up into place on mount. `index` staggers siblings. Under
 * Reduce Motion it cross-fades instead; pass `breathe` on a hero element so it
 * keeps the slow BREATH loop (a list of cards should not all breathe).
 */
export function Appear({
  children,
  index = 0,
  style,
  breathe = false,
}: {
  children: ReactNode;
  index?: number;
  style?: StyleProp<ViewStyle>;
  breathe?: boolean;
}) {
  const theme = useTheme();
  const systemReduce = useReducedMotion();
  const { reduceMotion: appReduce } = useAppearance();
  const reduceMotion = systemReduce || appReduce;
  if (reduceMotion) return <ReducedAppear style={style} breathe={breathe}>{children}</ReducedAppear>;
  const entering = FadeInDown.delay(index * APPEAR_STAGGER_MS).duration(
    Math.min(Math.max(theme.motionMs, 200), 450),
  );
  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}

/** One grey placeholder bar. Pulses gently; under Reduce Motion the pulse is half as big and a quarter as fast. */
export function SkeletonBar({ width = '100%', height = 12 }: { width?: `${number}%` | number; height?: number }) {
  const theme = useTheme();
  const systemReduce = useReducedMotion();
  const { reduceMotion: appReduce } = useAppearance();
  const reduceMotion = systemReduce || appReduce;
  const pulse = useSharedValue(0.55);
  useEffect(() => {
    pulse.value = reduceMotion
      ? withRepeat(withTiming(0.775, { duration: 2800 }), -1, true)
      : withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [pulse, reduceMotion]);
  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));
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
