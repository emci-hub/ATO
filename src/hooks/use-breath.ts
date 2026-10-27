import { useEffect } from 'react';
import {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useMotionActive } from '@/hooks/use-motion-active';
import { useMotionReduced } from '@/hooks/use-motion-reduced';
import { BREATH, EASE_IN_OUT } from '@/lib/motion-tokens';

/**
 * BREATH (§1.3): opacity .85 ↔ 1 over 8 s, the Reduce Motion "alive" fallback.
 * Runs only under Reduce Motion (or `always`) and only while the screen is
 * focused and the app is in front. `rm` is returned so a host can pick its
 * other branch from the same read.
 */
export function useBreath(force = false, always = false) {
  const rm = useMotionReduced(force);
  const active = useMotionActive();
  const opacity = useSharedValue(1);
  const run = (rm || always) && active;
  useEffect(() => {
    if (!run) {
      cancelAnimation(opacity);
      opacity.value = 1;
      return;
    }
    opacity.value = withRepeat(
      withSequence(
        withTiming(BREATH.low, { duration: BREATH.cycleMs / 2, easing: EASE_IN_OUT }),
        withTiming(BREATH.high, { duration: BREATH.cycleMs / 2, easing: EASE_IN_OUT }),
      ),
      -1,
    );
    return () => cancelAnimation(opacity);
  }, [run, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return { rm, style };
}
