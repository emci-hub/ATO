/**
 * Street ambience (emci 2026-10-11): small looping life for the Hideout and the
 * Underground — motes, drips, sparks, music notes, a rat or a pigeon crossing.
 *
 * Research notes: slow, subtle, continuous; layered (far drift, mid events,
 * near particles); every loop a different length so nothing beats in sync;
 * rare critters reward lingering; all of it stops under Reduce Motion / Low
 * effects (callers pass `alive`). Fixed timings only — no random rolls — so
 * the Dive odds guard stays clean and every run looks the same.
 */
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { uiDrawable, type UiPiece } from '@/art/art';
import { ClipImage } from '@/play/sheet-sprite';

export function kitDrawable(name: UiPiece) {
  return uiDrawable(name);
}

/**
 * One object travelling from (x0, y0) to (x1, y1) over `ms`, then resting for
 * `rest` ms, forever. Fades in over the first 15% and out over the last 15%.
 * `bob` adds a small vertical hop (critters walking).
 */
export function Drift({
  x0,
  y0,
  x1,
  y1,
  ms,
  rest = 0,
  delay = 0,
  bob = 0,
  alive,
  size,
  children,
}: {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  ms: number;
  rest?: number;
  delay?: number;
  bob?: number;
  alive: boolean;
  size: number;
  children: ReactNode;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(t);
    t.value = 0;
    if (!alive) return;
    t.value = withDelay(
      delay,
      withRepeat(
        withSequence(withTiming(1, { duration: ms, easing: Easing.linear }), withDelay(rest, withTiming(0, { duration: 0 }))),
        -1,
      ),
    );
    return () => cancelAnimation(t);
  }, [alive, delay, ms, rest, t]);
  const style = useAnimatedStyle(() => {
    const v = t.value;
    const fade = v <= 0 || v >= 1 ? 0 : Math.min(1, v / 0.15, (1 - v) / 0.15);
    const hop = bob ? -Math.abs(Math.sin(v * Math.PI * 10)) * bob : 0;
    return {
      opacity: fade,
      transform: [{ translateX: x0 + (x1 - x0) * v }, { translateY: y0 + (y1 - y0) * v + hop }],
    };
  });
  if (!alive) return null;
  return <Animated.View style={[styles.abs, { width: size, height: size }, style]}>{children}</Animated.View>;
}

/** A point of light that pulses (string lights, city windows). */
export function Twinkle({ x, y, size, ms, delay = 0, alive, color }: { x: number; y: number; size: number; ms: number; delay?: number; alive: boolean; color: string }) {
  const t = useSharedValue(1);
  useEffect(() => {
    cancelAnimation(t);
    t.value = 1;
    if (!alive) return;
    t.value = withDelay(delay, withRepeat(withSequence(withTiming(0.35, { duration: ms / 2 }), withTiming(1, { duration: ms / 2 })), -1));
    return () => cancelAnimation(t);
  }, [alive, delay, ms, t]);
  const style = useAnimatedStyle(() => ({ opacity: t.value }));
  return <Animated.View pointerEvents="none" style={[styles.abs, { left: x, top: y, width: size, height: size, backgroundColor: color }, style]} />;
}

/** A packed ambient sprite (rat, pigeon, note …). `flip` mirrors it. */
export function AmbientSprite({ name, size, flip = false }: { name: UiPiece; size: number; flip?: boolean }) {
  return (
    <View style={{ width: size, height: size, transform: flip ? [{ scaleX: -1 }] : undefined }}>
      <ClipImage drawable={kitDrawable(name)} />
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute', left: 0, top: 0 },
});
