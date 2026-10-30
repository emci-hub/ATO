import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { useMotionReduced } from '@/hooks/use-motion-reduced';
import { EASE_OUT, PLUS_POP } from '@/lib/motion-tokens';

/**
 * PLUS_POP (§1.3): a "+N" that floats up 34 pt and fades over 1 s. Play it by
 * changing `trigger` (any new number > 0). Reduce Motion: it fades in and out
 * in place. Decorative: the caller announces the change itself.
 */
export function PlusPop({
  label,
  trigger,
  color,
  forceReduceMotion = false,
}: {
  label: string;
  trigger: number;
  color?: string;
  forceReduceMotion?: boolean;
}) {
  const rm = useMotionReduced(forceReduceMotion);
  const rise = useSharedValue(0);
  const opacity = useSharedValue(0);
  useEffect(() => {
    if (trigger <= 0) return;
    cancelAnimation(rise);
    cancelAnimation(opacity);
    rise.value = 0;
    if (rm) {
      opacity.value = withSequence(withTiming(1, { duration: 200 }), withTiming(0, { duration: 800 }));
      return;
    }
    opacity.value = withSequence(withTiming(1, { duration: 120 }), withTiming(0, { duration: PLUS_POP.durationMs - 120 }));
    rise.value = withTiming(-PLUS_POP.risePt, { duration: PLUS_POP.durationMs, easing: EASE_OUT });
    return () => {
      cancelAnimation(rise);
      cancelAnimation(opacity);
    };
  }, [trigger, rm, rise, opacity]);
  const animated = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: rise.value }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.host, animated]}>
      <ThemedText type="smallBold" style={color ? { color } : undefined}>
        {label}
      </ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', alignSelf: 'center' },
});
