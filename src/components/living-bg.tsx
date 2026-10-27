import { useEffect, useState } from 'react';
import { StyleSheet, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { GradientFill } from '@/components/gradient-fill';
import { useBreath } from '@/hooks/use-breath';
import { useMotionActive } from '@/hooks/use-motion-active';
import { LIVING_BG } from '@/lib/motion-tokens';

/**
 * LIVING_BG (§1.3): two soft radial blobs drifting behind a screen (9 s and
 * 11 s, alternating). Fills its parent, takes no touches, hidden from
 * VoiceOver. Reduce Motion: the blobs hold still and the layer breathes.
 */
export function LivingBg({
  colors,
  forceReduceMotion = false,
}: {
  /** Blob colours, soft and low-contrast (e.g. the accent and accent2 at ~25% alpha). */
  colors: readonly [string, string];
  forceReduceMotion?: boolean;
}) {
  const { rm, style: breath } = useBreath(forceReduceMotion);
  const active = useMotionActive();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const a = useSharedValue(0);
  const b = useSharedValue(0);
  const run = !rm && active;
  useEffect(() => {
    if (!run) {
      cancelAnimation(a);
      cancelAnimation(b);
      return;
    }
    a.value = 0; // a full drift after every pause
    b.value = 0;
    a.value = withRepeat(withTiming(1, { duration: LIVING_BG.blobAMs, easing: Easing.inOut(Easing.sin) }), -1, true);
    b.value = withRepeat(withTiming(1, { duration: LIVING_BG.blobBMs, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => {
      cancelAnimation(a);
      cancelAnimation(b);
    };
  }, [run, a, b]);
  const blobA = useAnimatedStyle(() => ({
    transform: [
      { translateX: a.value * LIVING_BG.translateA },
      { translateY: a.value * LIVING_BG.translateB },
      { scale: 1 + a.value * (LIVING_BG.scale - 1) },
    ],
  }));
  const blobB = useAnimatedStyle(() => ({
    transform: [
      { translateX: b.value * LIVING_BG.translateB },
      { translateY: b.value * LIVING_BG.translateA },
      { scale: 1 + b.value * (LIVING_BG.scale - 1) },
    ],
  }));
  const onLayout = (e: LayoutChangeEvent) =>
    setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const d = Math.max(box.w, box.h) * 0.8;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={onLayout}
      style={[StyleSheet.absoluteFill, styles.clip, breath]}>
      {d > 0 ? (
        <>
          <Animated.View style={[styles.blob, { width: d, height: d, left: -d * 0.25, top: -d * 0.2 }, blobA]}>
            <GradientFill type="radial" colors={[colors[0], colors[0]]} opacities={[1, 0]} />
          </Animated.View>
          <Animated.View style={[styles.blob, { width: d, height: d, right: -d * 0.3, bottom: -d * 0.25 }, blobB]}>
            <GradientFill type="radial" colors={[colors[1], colors[1]]} opacities={[1, 0]} />
          </Animated.View>
        </>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  blob: { position: 'absolute' },
});
