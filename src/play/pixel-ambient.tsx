/**
 * Cheap ambient motion for the pixel scenes (phase 3–4).
 *
 * Short loops on the UI thread: a sway, a drift, a hard frame cut.
 * `alive` is false under Reduce Motion and under Low effects — the first
 * frame holds still, and drifting particles are not mounted.
 */
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { AtlasSprite } from '@/play/pixel-atlas';

/** Ping-pong a few degrees. Still at 0 when `alive` is false. */
export function Sway({
  alive,
  children,
  deg = 2.5,
  ms = 1400,
}: {
  alive: boolean;
  children: ReactNode;
  deg?: number;
  ms?: number;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(t);
    t.value = 0;
    if (!alive) return;
    t.value = withRepeat(withTiming(1, { duration: ms, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(t);
  }, [alive, ms, t]);
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${(t.value * 2 - 1) * deg}deg` }],
  }));
  return (
    <Animated.View style={[{ transformOrigin: 'bottom center' }, style]}>{children}</Animated.View>
  );
}

/** Slide back and forth. Holds at the start when `alive` is false. */
export function Drift({
  alive,
  children,
  dx,
  dy = 0,
  ms = 4000,
}: {
  alive: boolean;
  children: ReactNode;
  dx: number;
  dy?: number;
  ms?: number;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(t);
    t.value = 0;
    if (!alive) return;
    t.value = withRepeat(withTiming(1, { duration: ms, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(t);
  }, [alive, ms, t]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: t.value * dx }, { translateY: t.value * dy }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** Rise once per loop. Not mounted when `alive` is false. */
export function Rise({
  alive,
  x,
  distance,
  ms,
  delay,
  children,
}: {
  alive: boolean;
  x: number;
  distance: number;
  ms: number;
  delay: number;
  children: ReactNode;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(t);
    t.value = 0;
    if (!alive) return;
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: ms, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(t);
  }, [alive, delay, ms, t]);
  const style = useAnimatedStyle(() => ({
    opacity: t.value > 0.92 ? 0 : 1,
    transform: [
      { translateY: -t.value * distance },
      { translateX: Math.sin(t.value * 12) * 4 },
    ],
  }));
  if (!alive) return null;
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: x, bottom: 8 }, style]}>
      {children}
    </Animated.View>
  );
}

function SwapLayer({
  atlas,
  frame,
  index,
  count,
  tick,
  alive,
}: {
  atlas: 'room' | 'dive';
  frame: string;
  index: number;
  count: number;
  tick: SharedValue<number>;
  alive: boolean;
}) {
  const style = useAnimatedStyle(() => {
    if (!alive) return { opacity: index === 0 ? 1 : 0 };
    const i = Math.floor(tick.value) % count;
    return { opacity: i === index ? 1 : 0 };
  });
  return (
    <Animated.View style={[{ position: index === 0 ? 'relative' : 'absolute', left: 0, top: 0 }, style]} pointerEvents="none">
      <AtlasSprite atlas={atlas} frame={frame} />
    </Animated.View>
  );
}

/** Hard-cut between frames (no crossfade). The first frame holds when `alive` is false. */
export function SpriteSwap({
  atlas,
  frames,
  alive,
  ms = 180,
}: {
  atlas: 'room' | 'dive';
  frames: readonly string[];
  alive: boolean;
  ms?: number;
}) {
  const tick = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(tick);
    tick.value = 0;
    if (!alive || frames.length < 2) return;
    tick.value = withRepeat(
      withTiming(frames.length, { duration: ms * frames.length, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(tick);
  }, [alive, frames.length, ms, tick]);
  return (
    <View>
      {frames.map((frame, index) => (
        <SwapLayer
          key={frame}
          atlas={atlas}
          frame={frame}
          index={index}
          count={frames.length}
          tick={tick}
          alive={alive}
        />
      ))}
    </View>
  );
}
