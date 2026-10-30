import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { useMotionReduced } from '@/hooks/use-motion-reduced';
import { useTheme } from '@/hooks/use-theme';
import { EASE_OUT, HALL_RING, HOLO } from '@/lib/motion-tokens';
import { overallPercent, ringFraction } from '@/lib/legend-figures/view-math';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * A progress ring (PHASE-10): the stroke draws to `met / total` over 1.2 s
 * (strokeDasharray / strokeDashoffset), `index` staggers a row of rings by
 * 120 ms. Reduce Motion (§1.4): no draw, the finished ring cross-fades in over
 * 300 ms. 0 met is an empty track, all met is a full ring. The ring is
 * decoration: its owner carries the spoken "N of M met".
 */
export function HallRing({
  met,
  total,
  color,
  size = 34,
  index = 0,
  forceReduceMotion = false,
  children,
}: {
  met: number;
  total: number;
  color: string;
  size?: number;
  /** Position in a row, for the stagger. */
  index?: number;
  forceReduceMotion?: boolean;
  /** Centre content (a percent). */
  children?: ReactNode;
}) {
  const theme = useTheme();
  const rm = useMotionReduced(forceReduceMotion);
  const fraction = ringFraction(met, total);
  const stroke = Math.max(3, Math.round(size / 9));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = useSharedValue(rm ? fraction : 0);
  const fade = useSharedValue(rm ? 0 : 1);

  useEffect(() => {
    if (rm) {
      progress.value = fraction;
      fade.value = 0;
      fade.value = withTiming(1, { duration: HOLO.reducedFadeMs });
    } else {
      fade.value = 1;
      progress.value = withDelay(
        index * HALL_RING.staggerMs,
        withTiming(fraction, { duration: HALL_RING.drawMs, easing: EASE_OUT }),
      );
    }
    return () => {
      cancelAnimation(progress);
      cancelAnimation(fade);
    };
  }, [fraction, rm, index, progress, fade]);

  const arc = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  return (
    <Animated.View
      style={[{ width: size, height: size }, fadeStyle]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={theme.backgroundSelected} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={arc}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children ? (
        <View style={styles.center} pointerEvents="none">
          {children}
        </View>
      ) : null}
    </Animated.View>
  );
}

/** The whole museum: one ring and "N of M legends met · P%". */
export function OverallProgress({ met, total, color }: { met: number; total: number; color: string }) {
  const percent = overallPercent(met, total);
  return (
    <View
      style={styles.overall}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${met} of ${total} legends met, ${percent} percent`}
      accessibilityValue={{ min: 0, max: 100, now: percent }}>
      <HallRing met={met} total={total} color={color} size={56}>
        <ThemedText type="smallBold">{percent}%</ThemedText>
      </HallRing>
      <ThemedText type="small" themeColor="textSecondary" style={styles.overallText}>
        {met} of {total} legends met
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  overall: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  overallText: { flexShrink: 1 },
});
