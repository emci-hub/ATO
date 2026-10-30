import { useEffect, type ReactNode } from 'react';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { useMotionReduced } from '@/hooks/use-motion-reduced';
import { BAR_FILL, EASE_BACK } from '@/lib/motion-tokens';

/**
 * A tile's icon pops in (scale .6 → 1 with EASE_BACK, 350 ms) after `delayMs`
 * (PHASE-09: Superpower and Conflict tiles). Reduce Motion: no scale, it is just there.
 */
export function IconPop({
  children,
  delayMs = 0,
  forceReduceMotion = false,
}: {
  children: ReactNode;
  delayMs?: number;
  forceReduceMotion?: boolean;
}) {
  const rm = useMotionReduced(forceReduceMotion);
  const pop = useSharedValue(rm ? 1 : 0.6);
  useEffect(() => {
    if (rm) {
      cancelAnimation(pop);
      pop.value = 1;
      return;
    }
    pop.value = 0.6;
    pop.value = withDelay(delayMs, withTiming(1, { duration: BAR_FILL.iconPopMs, easing: EASE_BACK }));
    return () => cancelAnimation(pop);
  }, [rm, delayMs, pop]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  return <Animated.View style={[style, { alignSelf: 'flex-start' }]}>{children}</Animated.View>;
}
