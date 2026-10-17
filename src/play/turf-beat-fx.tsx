/**
 * Turf War polish beats (step T7, 2026-10-17): the wave-start portal, the wave-clear close at the exit, the win sparks
 * and the leak replay. Drawn by the T5/T6 effects layer (`turf-combat-fx.tsx`), ABOVE the units `<Svg>`, never in it:
 * one-shots on their own Reanimated clocks, `pointerEvents none`. Rules + timings: `turf-beat-fx-rules.ts` (what plays
 * per Effects Quality / Motion is decided by the caller with `beatFxFlags`). No beat flashes, shakes or stops the sim.
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';

import { ClipImage } from '@/play/sheet-sprite';
import { type ClipDrawable } from '@/play/skin';
import {
  BEAT_FX,
  LEAK_REPLAY_MS,
  PORTAL_CLOSE_FROM,
  PORTAL_MS,
  PORTAL_STILL_FRAME,
  SPARK_STILL_FRAME,
  WAVE_CLEAR_MS,
  WIN_SPARK_MS,
} from '@/play/turf-beat-fx-rules';
import { LEAK_PULSE_MS } from '@/play/turf-combat-fx-rules';
import { Strip } from '@/play/turf-fx-strip';

/** A still beat fades out over this (ms) at the end of its life. */
export const BEAT_STILL_FADE_MS = 250;
const LEAK_RED = '#EF4444';

/** Wave start (`close` false) at the path start, or wave clear (`close` true) at the exit. 1:1 on the 512 px board. */
export function PortalBeat({ x, y, unit, close, still }: { x: number; y: number; unit: number; close: boolean; still: boolean }) {
  if (still) {
    return (
      <Strip
        fx={BEAT_FX.portal}
        x={x}
        y={y}
        unit={unit}
        scale={1}
        ms={close ? WAVE_CLEAR_MS : PORTAL_MS}
        fadeMs={BEAT_STILL_FADE_MS}
        still
        stillFrame={close ? 10 : PORTAL_STILL_FRAME}
      />
    );
  }
  return <Strip fx={BEAT_FX.portal} x={x} y={y} unit={unit} scale={1} ms={PORTAL_MS} from={close ? PORTAL_CLOSE_FROM : 0} />;
}

/** One win spark burst over a tower (the caller staggers them). */
export function SparksBeat({ x, y, unit, still }: { x: number; y: number; unit: number; still: boolean }) {
  return still ? (
    <Strip fx={BEAT_FX.sparks} x={x} y={y} unit={unit} scale={1} ms={WIN_SPARK_MS} fadeMs={BEAT_STILL_FADE_MS} still stillFrame={SPARK_STILL_FRAME} />
  ) : (
    <Strip fx={BEAT_FX.sparks} x={x} y={y} unit={unit} scale={1} ms={WIN_SPARK_MS} />
  );
}

function TrailDot({ x, y, unit, delay, still }: { x: number; y: number; unit: number; delay: number; still: boolean }) {
  const o = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    if (!still) o.value = withDelay(delay, withTiming(1, { duration: 80 }));
  }, [o, delay, still]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[styles.abs, styles.dot, { left: x * unit - 3, top: y * unit - 2 }, style]} />;
}

/**
 * The lose beat: a red ghost of the creep that leaked walks its last cells again (≈ half speed), leaving a red trail,
 * then the exit ring (the T5 leak pulse). `still` (Reduce Motion / Motion Off): the trail, the ghost at the exit and a
 * full-size ring, no motion. `size` = the leaker's last drawn box edge (board units); its feet sit on the path.
 */
export function LeakReplay({
  points,
  drawable,
  size,
  unit,
  still,
}: {
  points: readonly { x: number; y: number }[];
  drawable: ClipDrawable | null;
  size: number;
  unit: number;
  still: boolean;
}) {
  const n = points.length;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  // Still: the ghost stands one cell short of the exit (on the exit cell it would sit half off the board).
  const p = useSharedValue(still ? Math.max(0, 1 - 6 / Math.max(1, n - 1)) : 0);
  const fade = useSharedValue(1);
  const ring = useSharedValue(still ? 1 : 0);
  const ringO = useSharedValue(0);
  useEffect(() => {
    if (!still) {
      p.value = withTiming(1, { duration: LEAK_REPLAY_MS, easing: Easing.linear });
      ring.value = withDelay(LEAK_REPLAY_MS, withTiming(1, { duration: LEAK_PULSE_MS, easing: Easing.out(Easing.quad) }));
      ringO.value = withDelay(LEAK_REPLAY_MS, withSequence(withTiming(1, { duration: 1 }), withTiming(0, { duration: LEAK_PULSE_MS, easing: Easing.in(Easing.quad) })));
      fade.value = withDelay(LEAK_REPLAY_MS + LEAK_PULSE_MS - BEAT_STILL_FADE_MS, withTiming(0, { duration: BEAT_STILL_FADE_MS }));
    } else {
      ringO.value = withTiming(1, { duration: 150 });
      fade.value = withDelay(LEAK_REPLAY_MS + LEAK_PULSE_MS - BEAT_STILL_FADE_MS, withTiming(0, { duration: BEAT_STILL_FADE_MS }));
    }
  }, [p, ring, ringO, fade, still]);
  const edge = size * unit;
  const ghost = useAnimatedStyle(() => {
    const f = Math.min(n - 1, Math.max(0, p.value * (n - 1)));
    const i = Math.floor(f);
    const j = Math.min(n - 1, i + 1);
    const t = f - i;
    const gx = (xs[i] ?? 0) + ((xs[j] ?? 0) - (xs[i] ?? 0)) * t;
    const gy = (ys[i] ?? 0) + ((ys[j] ?? 0) - (ys[i] ?? 0)) * t;
    return { transform: [{ translateX: gx * unit - edge / 2 }, { translateY: gy * unit - edge * 0.85 }] };
  });
  const group = useAnimatedStyle(() => ({ opacity: fade.value }));
  const exit = points[n - 1];
  const r = 12 * unit;
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringO.value,
    transform: [{ scaleX: 0.3 + 0.7 * ring.value }, { scaleY: (0.3 + 0.7 * ring.value) * 0.6 }],
  }));
  if (n === 0 || !exit) return null;
  // Exit ring centred in the exit cell (the path ends on the board edge), as the T5 leak pulse.
  const half = 100 / 32;
  const rx = Math.min(100 - half, Math.max(half, exit.x));
  const ry = Math.min(100 - half, Math.max(half, exit.y));
  return (
    <Animated.View pointerEvents="none" style={[styles.fill, group]}>
      {points.map((pt, i) => (i % 2 === 0 ? <TrailDot key={i} x={pt.x} y={pt.y} unit={unit} delay={(i / Math.max(1, n - 1)) * LEAK_REPLAY_MS} still={still} /> : null))}
      {drawable ? (
        <Animated.View style={[styles.abs, { left: 0, top: 0, width: edge, height: edge }, ghost]}>
          <View style={[styles.fill, styles.ghostBody]}>
            <ClipImage drawable={drawable} />
          </View>
          <View style={[styles.fill, styles.ghostTint]}>
            <ClipImage drawable={drawable} tintColor={LEAK_RED} />
          </View>
        </Animated.View>
      ) : null}
      <Animated.View
        style={[
          styles.abs,
          { left: rx * unit - r, top: ry * unit - r, width: 2 * r, height: 2 * r, borderRadius: r, borderWidth: 4, borderColor: LEAK_RED, backgroundColor: 'rgba(239,68,68,0.22)' },
          ringStyle,
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject },
  abs: { position: 'absolute' },
  dot: { width: 6, height: 4, borderRadius: 2, backgroundColor: 'rgba(239,68,68,0.6)' },
  ghostBody: { opacity: 0.55 },
  ghostTint: { opacity: 0.4 },
});
