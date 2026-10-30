import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { useMotionReduced } from '@/hooks/use-motion-reduced';
import { PRESS, SPRING_POP, haptic } from '@/lib/motion-tokens';

/**
 * PRESS (§1.3): scale 1 → .94 → 1 with SPRING_POP, plus a Light haptic. Wraps a
 * Pressable and passes every accessibility prop through (role, label, hint,
 * state). 44 pt minimum hit target. Reduce Motion: no scale (the haptic and
 * the press itself stay).
 */
export function PressPop({
  children,
  onPress,
  forceReduceMotion = false,
  style,
  ...rest
}: Omit<PressableProps, 'children' | 'style'> & {
  children: ReactNode;
  forceReduceMotion?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const rm = useMotionReduced(forceReduceMotion);
  const scale = useSharedValue(1);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const handlePress = (event: GestureResponderEvent) => {
    haptic.commit();
    if (!rm) {
      scale.value = withSequence(withTiming(PRESS.scaleDown, { duration: PRESS.downMs }), withSpring(1, SPRING_POP));
    }
    onPress?.(event);
  };
  return (
    <Animated.View style={pop}>
      <Pressable {...rest} onPress={handlePress} style={[styles.target, style]}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  target: { minHeight: 44, minWidth: 44 },
});
