import { useEffect, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useMotionActive } from '@/hooks/use-motion-active';
import { useMotionReduced } from '@/hooks/use-motion-reduced';
import { useTheme } from '@/hooks/use-theme';
import { EASE_IN_OUT } from '@/lib/motion-tokens';

const CYCLE_MS = 2400;

/**
 * The `glowPulse` token (Neon, Anime): a soft accent glow that breathes around a
 * hero card. Other modes render the children untouched. Reduce Motion, or a
 * screen that is unfocused / in the background, holds the glow still at its
 * resting strength (it never disappears, so the mode keeps its look). Reduce
 * Motion keeps a gentle loop: half the amplitude, a quarter of the speed.
 */
export function GlowPulse({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const rm = useMotionReduced();
  const active = useMotionActive();
  const t = useSharedValue(0);
  const run = theme.glowPulse && active;
  // Reduce Motion (§1.4): half the amplitude at a quarter of the speed.
  const amp = rm ? 0.5 : 1;
  const cycle = rm ? CYCLE_MS * 4 : CYCLE_MS;

  useEffect(() => {
    if (!run) {
      cancelAnimation(t);
      t.value = 0;
      return;
    }
    t.value = withRepeat(withTiming(1, { duration: cycle, easing: EASE_IN_OUT }), -1, true);
    return () => cancelAnimation(t);
  }, [run, cycle, t]);

  const glow = useAnimatedStyle(() => ({
    shadowOpacity: 0.25 + 0.35 * amp * t.value,
    shadowRadius: 10 + 8 * amp * t.value,
  }));

  if (!theme.glowPulse) return <>{children}</>;
  return (
    <Animated.View style={[{ shadowColor: theme.accent, shadowOffset: { width: 0, height: 0 } }, glow, style]}>
      {children}
    </Animated.View>
  );
}
