/**
 * Dive world (v25, 2026-09-30) — the sunken ruin the Dive scene sinks through.
 * Existing art only: Scribble Dungeons walls/props (tinted — the pack is white
 * line art), craftpix plants/stones, the Shark Tide Knight's east/west stills.
 *
 *   - ShaftWalls: a vertical shaft of wall tiles down both sides, bluer and
 *     darker per band; the scene moves this layer faster than the water
 *     (parallax). Only the bands around the camera are mounted.
 *   - ZoneProps / AbyssDragon: scenery per zone, in world space.
 *   - SharkGlide: the knight drifts past, faint, in the Reef and the Trench.
 *   - SurfaceSky: sky, sun and the waterline above the Shallows before a dive.
 *   - FindBox: the crate / chest a find bursts out of.
 *
 * LOOKS ONLY: every choice here is by band index — no rolls, no odds.
 */
import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { DIVE_PROPS, DRAGON_DEPTH, SHAFT_OPACITY, SHAFT_TINT } from '@/play/dive-fx-model';
import { PLAY_ART } from '@/play/generated-play-assets';

export const WALL_W = 34;
const WALL_ART = ['tiles/scribble-dungeons/wall', 'tiles/scribble-dungeons/wall_damaged', 'tiles/scribble-dungeons/wall_half'];

/** Where the surface waterline sits, as a share of the scene height. */
export const WATERLINE = 0.24;

/** The shaft's wall tiles for the bands around `depth`, in a layer that is
 * `speed` × the band height per depth (the scene moves it). */
export function ShaftWalls({
  width,
  band,
  depth,
  speed,
}: {
  width: number;
  band: number;
  depth: number;
  speed: number;
}) {
  const bandH = band * speed;
  const rows = Math.ceil(bandH / WALL_W);
  const bands = [depth - 1, depth, depth + 1, depth + 2].filter((i) => i >= 0 && i < SHAFT_TINT.length);
  return (
    <>
      {bands.map((i) =>
        Array.from({ length: rows }, (_, r) =>
          [0, 1].map((side) => {
            const pick = WALL_ART[(i * 7 + r * 3 + side) % 5 === 0 ? 1 : (i + r + side) % 7 === 0 ? 2 : 0];
            return (
              <Image
                key={`${i}-${r}-${side}`}
                source={PLAY_ART[pick]}
                style={[
                  styles.abs,
                  {
                    left: side === 0 ? 0 : width - WALL_W,
                    top: i * bandH + r * WALL_W,
                    width: WALL_W,
                    height: WALL_W,
                    tintColor: SHAFT_TINT[i],
                    opacity: SHAFT_OPACITY[i],
                  },
                ]}
              />
            );
          }),
        ),
      )}
    </>
  );
}

/** Props per zone, in world space (band `i` starts at `i * band`). */
export function ZoneProps({ width, band, depth }: { width: number; band: number; depth: number }) {
  const bands = [depth - 1, depth, depth + 1].filter((i) => i >= 0 && i < DIVE_PROPS.length);
  return (
    <>
      {bands.map((i) => (
        <View key={i} pointerEvents="none" style={StyleSheet.absoluteFill}>
          {i === 0
            ? [0, 1].map((side) => (
                <View
                  key={`sand-${side}`}
                  style={[
                    styles.abs,
                    styles.sand,
                    { top: band * 0.8, left: side === 0 ? WALL_W - 6 : width - WALL_W - 70, width: 76 },
                  ]}
                />
              ))
            : null}
          {DIVE_PROPS[i].map((p) => {
            const src = PLAY_ART[p.art];
            if (!src) return null;
            return (
              <Image
                key={p.art}
                source={src}
                style={[
                  styles.abs,
                  {
                    left: p.x === 0 ? WALL_W + 2 : width - WALL_W - p.size - 2,
                    top: i * band + p.y * band - p.size,
                    width: p.size,
                    height: p.size,
                    opacity: p.opacity,
                  },
                  p.tint ? { tintColor: p.tint } : null,
                ]}
              />
            );
          })}
        </View>
      ))}
    </>
  );
}

/** The Abyss: a huge, faint dragon in the dark. */
export function AbyssDragon({ width, band }: { width: number; band: number }) {
  const size = width * 0.9;
  return (
    <Image
      source={PLAY_ART['tiles/scribble-dungeons/dragon']}
      style={[
        styles.abs,
        { left: (width - size) / 2, top: DRAGON_DEPTH * band + band * 0.1, width: size, height: size, tintColor: '#6F86C8', opacity: 0.09 },
      ]}
    />
  );
}

/** The Shark Tide Knight gliding past now and then (Reef, Trench). */
export function SharkGlide({ width, height, rightward }: { width: number; height: number; rightward: boolean }) {
  const t = useSharedValue(0);
  const size = 120;
  useEffect(() => {
    t.value = 0;
    t.value = withRepeat(
      withSequence(withDelay(4000, withTiming(1, { duration: 11000, easing: Easing.linear })), withTiming(0, { duration: 0 })),
      -1,
    );
    return () => cancelAnimation(t);
  }, [t]);
  const style = useAnimatedStyle(() => {
    const p = rightward ? t.value : 1 - t.value;
    return {
      opacity: t.value > 0 && t.value < 1 ? 0.16 : 0,
      transform: [{ translateX: -size + p * (width + size * 2) }, { translateY: Math.sin(t.value * 9) * 6 }],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.abs, { left: 0, top: height * 0.26 }, style]}>
      <Image
        source={PLAY_ART[rightward ? 'primal/shark_tide_knight/Idle/rotations/east' : 'primal/shark_tide_knight/Idle/rotations/west']}
        style={{ width: size, height: size, tintColor: '#BFE9FF' }}
      />
    </Animated.View>
  );
}

/** Sky, sun and the waterline, above the Shallows. `sky` 1 = shown, 0 = the
 * camera has gone under (slid up out of view). `splash` 0→1 plays once. */
export function SurfaceSky({
  width,
  height,
  sky,
  splash,
  edgeX,
}: {
  width: number;
  height: number;
  sky: SharedValue<number>;
  splash: SharedValue<number>;
  edgeX: number;
}) {
  const line = height * WATERLINE;
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: -(1 - sky.value) * (line + 40) }] }));
  const splashStyle = useAnimatedStyle(() => ({
    opacity: splash.value > 0 && splash.value < 1 ? 1 - splash.value : 0,
    transform: [{ scale: 0.6 + splash.value * 0.8 }],
  }));
  const wave = Array.from({ length: Math.ceil(width / 24) + 1 }, (_, i) => `Q${i * 24 + 6},${line - 5} ${i * 24 + 12},${line} T${i * 24 + 24},${line}`).join(' ');
  return (
    <Animated.View pointerEvents="none" style={[styles.abs, { left: 0, top: 0, width, height: line + 12 }, style]}>
      <Svg width={width} height={line + 12}>
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#6FC8FF" />
            <Stop offset="1" stopColor="#FFE9C8" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={line} fill="url(#sky)" />
        <Circle cx={width * 0.8} cy={line * 0.35} r={18} fill="#FFF6C8" />
        <Path d={`M0,${line} ${wave} L${width},${line + 12} L0,${line + 12} Z`} fill="#8FDCFF" />
        <Path d={`M0,${line} ${wave}`} fill="none" stroke="#FFFFFF" strokeOpacity={0.8} strokeWidth={2} />
      </Svg>
      {/* The stone rim the pet stands on. */}
      <Image
        source={PLAY_ART['tiles/scribble-dungeons/wall_half']}
        style={[styles.abs, { left: edgeX - 34, top: line - 22, width: 68, height: 34, tintColor: '#E8F6FF' }]}
      />
      <Animated.View style={[styles.abs, { left: width / 2 - 60, top: line - 26, width: 120, height: 40 }, splashStyle]}>
        <Svg width={120} height={40}>
          {[-3, -2, -1, 1, 2, 3].map((k) => (
            <Circle key={k} cx={60 + k * 14} cy={22 - (3 - Math.abs(k)) * 5} r={3} fill="#FFFFFF" fillOpacity={0.9} />
          ))}
          <Path d="M20,32 Q60,18 100,32" fill="none" stroke="#FFFFFF" strokeWidth={2} />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

/** The crate / chest a find bursts out of: shakes, bursts with light (the
 * rarity colour), then the find rises out. `rv` is the scene's reveal clock:
 * 0 → BOX_OPEN shakes, BOX_OPEN → 1 bursts; fades as the find flies. */
export const BOX_OPEN = 0.45;
export function FindBox({
  art,
  x,
  y,
  size,
  tint,
  glow,
  rv,
}: {
  art: string;
  x: number;
  y: number;
  size: number;
  tint: string;
  glow: string;
  rv: SharedValue<number>;
}) {
  const boxStyle = useAnimatedStyle(() => {
    const v = rv.value;
    return {
      opacity: v > 0 && v < 1.6 ? 1 : 0,
      transform: [{ rotate: v < BOX_OPEN ? `${Math.sin(v * 60) * 9}deg` : '0deg' }, { scale: v < BOX_OPEN ? 1 : 1.06 }],
    };
  });
  const burstStyle = useAnimatedStyle(() => {
    const v = rv.value;
    const b = v < BOX_OPEN ? 0 : Math.min(1, (v - BOX_OPEN) / (1 - BOX_OPEN));
    return { opacity: b > 0 && v < 1.4 ? 0.7 * (1 - b * 0.6) : 0, transform: [{ scale: 0.4 + b * 1.6 }] };
  });
  return (
    <View pointerEvents="none" style={[styles.abs, { left: x, top: y, width: size, height: size }]}>
      <Animated.View style={[styles.abs, styles.burst, { left: -size / 2, top: -size / 2, width: size * 2, height: size * 2, borderRadius: size, backgroundColor: glow }, burstStyle]} />
      <Animated.Image source={PLAY_ART[art]} style={[{ width: size, height: size, tintColor: tint }, boxStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  sand: { height: 14, borderRadius: 7, backgroundColor: '#E8D7A8', opacity: 0.5 },
  burst: {},
});
