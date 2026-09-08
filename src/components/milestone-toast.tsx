import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Generic milestone toast. Forked from FullProfileUnlockAck's fade shape
 * (src/components/check-milestone-badge.tsx) — but with a guaranteed hold:
 * `withDelay(HOLD_MS, withTiming(0))` starts from full opacity, so the fade
 * never begins early (a `withSequence` whose first step animates to the
 * *current* value is treated as instant and skips straight to the fade).
 * Play uses this for Claim / Dive results, where item names need a readable
 * ~2.5–3s on screen. Calls `onDone` once the fade finishes so a caller can
 * advance a queue. Renders in-flow; this repo has no overlay/portal system
 * to reuse.
 */
const HOLD_MS = 2600;
const FADE_MS = 700;

export function MilestoneToast({
  title,
  body,
  reduceMotion,
  onDone,
}: {
  title: string;
  body: string;
  reduceMotion: boolean;
  onDone?: () => void;
}) {
  const theme = useTheme();
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = 1;
    if (reduceMotion) {
      const hide = setTimeout(() => {
        opacity.value = 0;
      }, HOLD_MS);
      const done = setTimeout(() => onDone?.(), HOLD_MS);
      return () => {
        clearTimeout(hide);
        clearTimeout(done);
      };
    }
    opacity.value = withDelay(HOLD_MS, withTiming(0, { duration: FADE_MS }));
    const done = setTimeout(() => onDone?.(), HOLD_MS + FADE_MS);
    return () => clearTimeout(done);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion, opacity]);

  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.toast, { backgroundColor: theme.accent }, fade]}>
      <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
        {title}
      </ThemedText>
      <ThemedText type="small" style={{ color: theme.onAccent }}>
        {body}
      </ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    alignSelf: 'stretch',
    alignItems: 'center',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    gap: Spacing.one,
  },
});
