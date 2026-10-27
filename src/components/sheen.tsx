import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useBreath } from '@/hooks/use-breath';
import { useMotionActive } from '@/hooks/use-motion-active';
import { SHEEN } from '@/lib/motion-tokens';

/**
 * SHEEN (§1.3): a diagonal band of light sweeping across its children every
 * 2.6 s. Wrap the host (a button, a card). Reduce Motion: no band, and the host
 * breathes instead. The band never takes touches and is hidden from VoiceOver.
 */
export function Sheen({
  children,
  style,
  borderRadius = 0,
  forceReduceMotion = false,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  borderRadius?: number;
  forceReduceMotion?: boolean;
}) {
  const { rm, style: breath } = useBreath(forceReduceMotion);
  const active = useMotionActive();
  const [width, setWidth] = useState(0);
  const sweep = useSharedValue(0);
  const run = !rm && active && width > 0;
  useEffect(() => {
    if (!run) {
      cancelAnimation(sweep);
      sweep.value = 0;
      return;
    }
    sweep.value = withRepeat(withTiming(1, { duration: SHEEN.durationMs, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(sweep);
  }, [run, sweep]);
  const bandWidth = width * 0.45;
  const band = useAnimatedStyle(() => ({
    transform: [{ translateX: -bandWidth + sweep.value * (width + bandWidth) }],
  }));
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  return (
    <Animated.View style={[style, breath]} onLayout={onLayout}>
      {children}
      {rm ? null : (
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[StyleSheet.absoluteFill, { borderRadius, overflow: 'hidden' }]}>
          <Animated.View style={[styles.band, { width: bandWidth }, band]}>
            <Svg width="100%" height="100%" preserveAspectRatio="none">
              <Defs>
                <LinearGradient id="sheenBand" x1="0" y1="0" x2="1" y2="0.35">
                  <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
                  <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={SHEEN.opacity} />
                  <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#sheenBand)" />
            </Svg>
          </Animated.View>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  band: { position: 'absolute', top: 0, bottom: 0, left: 0 },
});
