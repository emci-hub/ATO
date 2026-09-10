import { useEffect } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Generic milestone toast. Forked from FullProfileUnlockAck's fade shape
 * (src/components/check-milestone-badge.tsx) — same held-beat-then-out
 * timing and reduceMotion branch — but takes title/body as props instead
 * of hardcoded copy, so any future milestone type can reuse it, and calls
 * `onDone` once the fade finishes so a caller can advance a queue. Renders
 * in-flow by default (`styles.toast`'s `alignSelf: 'stretch'`) since this
 * repo has no overlay/portal system to reuse — the optional `style` prop
 * lets a caller override that (e.g. intake-sweep.tsx positions it
 * absolutely, pinned near the avatar) without changing the default for
 * every other caller (legends.tsx still renders it in-flow, unchanged).
 */
export function MilestoneToast({
  title,
  body,
  reduceMotion,
  onDone,
  style,
}: {
  title: string;
  body: string;
  reduceMotion: boolean;
  onDone?: () => void;
  /** Overrides/extends the default full-width `styles.toast` shape — e.g. intake-sweep.tsx's sticky avatar-speech placement, which needs a bounded width, not `alignSelf: 'stretch'`. Other callers (legends.tsx) are unaffected, since this is additive on top of the existing style array. */
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = 1;
    if (reduceMotion) {
      const hide = setTimeout(() => {
        opacity.value = 0;
      }, 2400);
      const done = setTimeout(() => onDone?.(), 2400);
      return () => {
        clearTimeout(hide);
        clearTimeout(done);
      };
    }
    opacity.value = withSequence(withTiming(1, { duration: 900 }), withTiming(0, { duration: 1200 }));
    const done = setTimeout(() => onDone?.(), 2100);
    return () => clearTimeout(done);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion, opacity]);

  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.toast, { backgroundColor: theme.accent }, fade, style]}>
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
