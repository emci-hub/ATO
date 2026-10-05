/**
 * Framed-scene juice. All of it is drawn in code (no new bitmaps).
 *
 * Colour cycling is Mark Ferrari's trick: a cell holds a palette index, and
 * the palette steps 7 times a second. Nothing interpolates RGB. Dither pools
 * are a 4×4 Bayer grid of rects with a slow opacity breath. An SVG Pattern
 * fill is not used: on iOS, react-native-svg ignores patternUnits and
 * stretches the tile across the ellipse, which paints a huge white/grey
 * striped oval over the pet. The room↔Dive change is a grid of diamonds,
 * staggered by ring. Feed and a landed find flash the pet white for 80ms,
 * shake it 2pt, and (on a find) pop the haul icon in steps.
 *
 * Reduce Motion and Effects Low hold every one of these still or skip it.
 * Animated SVG nodes stay in the tens, on the UI thread.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path, Polygon, Rect } from 'react-native-svg';

import { ART_PT, PIXEL } from '@/play/pixel-theme';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

/** ~7 fps. A palette index steps; colours do not blend. */
const FRAME_MS = 143;
const CYCLE_STEPS = 8;

const WATER = ['#0B3E48', '#0B5E65', '#0B8A8F', '#14919B', '#8FF8E2'] as const;
const LAMP = ['#7A3045', '#C45C12', '#F79617', '#F9C22B', '#FBFF86'] as const;

/** 4×4 Bayer. Cells under 8 are the lit half of the pattern. */
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
] as const;

let wipeTarget: 'room' | 'dive' | null = null;

/** The screen we are about to open should play the reveal half of the wipe. */
export function armWipe(next: 'room' | 'dive'): void {
  wipeTarget = next;
}

/** True once, for the screen that should reveal. */
export function takeWipe(which: 'room' | 'dive'): boolean {
  if (wipeTarget !== which) return false;
  wipeTarget = null;
  return true;
}

function snap2(pt: number): number {
  'worklet';
  return Math.round(pt / 2) * 2;
}

export function useStepClock(alive: boolean): SharedValue<number> {
  const clock = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(clock);
    clock.value = 0;
    if (!alive) return;
    clock.value = withRepeat(
      withTiming(CYCLE_STEPS, { duration: CYCLE_STEPS * FRAME_MS, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(clock);
  }, [alive, clock]);
  return clock;
}

function CycleRect({
  clock,
  base,
  palette,
  x,
  y,
  w,
  h,
  opacity,
}: {
  clock: SharedValue<number>;
  base: number;
  palette: readonly string[];
  x: number;
  y: number;
  w: number;
  h: number;
  opacity: number;
}) {
  const props = useAnimatedProps(() => {
    const i = (base + Math.floor(clock.value)) % palette.length;
    return { fill: palette[i] ?? palette[0] };
  });
  return <AnimatedRect animatedProps={props} x={x} y={y} width={w} height={h} fillOpacity={opacity} />;
}

/**
 * Water caustics: a few wave cells whose fill index cycles.
 * `alive` false draws the first palette step and holds it.
 */
export function CausticWash({
  alive,
  width,
  height,
}: {
  alive: boolean;
  width: number;
  height: number;
}) {
  const clock = useStepClock(alive);
  if (width < 8 || height < 8) return null;
  const cells: { x: number; y: number; base: number }[] = [];
  const cols = 4;
  const rows = 2;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = snap2((col + 0.15) * (width / cols));
      const wave = Math.round(Math.sin(col * 0.9 + row * 1.4) * 6);
      const y = snap2(row * (height / rows) + wave);
      cells.push({ x, y, base: (col + row * 2) % WATER.length });
    }
  }
  const cw = snap2(width / cols) - ART_PT * 2;
  const ch = ART_PT * 4;
  return (
    <Svg width={width} height={height} pointerEvents="none">
      {cells.map((cell, i) => (
        <CycleRect
          key={i}
          clock={clock}
          base={cell.base}
          palette={WATER}
          x={cell.x}
          y={Math.max(0, cell.y)}
          w={Math.max(ART_PT * 2, cw)}
          h={ch}
          opacity={0.55}
        />
      ))}
    </Svg>
  );
}

/** Lamp shade colour cycle. Three cells, warm palette, same clock. */
export function LampCycle({ alive }: { alive: boolean }) {
  const clock = useStepClock(alive);
  const k = ART_PT;
  return (
    <Svg width={18 * k} height={16 * k} pointerEvents="none">
      {[0, 1, 2].map((i) => (
        <CycleRect
          key={i}
          clock={clock}
          base={i}
          palette={LAMP}
          x={(4 + i * 3) * k}
          y={(2 + (i % 2)) * k}
          w={3 * k}
          h={(8 - i) * k}
          opacity={0.85}
        />
      ))}
    </Svg>
  );
}

/**
 * One path of the lit Bayer cells whose centres sit inside the ellipse.
 * Returns the path and the art-pixel bounds it occupies.
 */
function ditherPath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  lit: number,
): { d: string; minX: number; minY: number; w: number; h: number } | null {
  if (rx < 1 || ry < 1) return null;
  const k = ART_PT;
  const parts: string[] = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const x0 = Math.floor(cx - rx);
  const x1 = Math.ceil(cx + rx);
  const y0 = Math.floor(cy - ry);
  const y1 = Math.ceil(cy + ry);
  for (let y = y0; y < y1; y += 1) {
    const row = BAYER[((y % 4) + 4) % 4];
    const ny = (y + 0.5 - cy) / ry;
    if (ny * ny > 1) continue;
    for (let x = x0; x < x1; x += 1) {
      if ((row?.[((x % 4) + 4) % 4] ?? 16) >= lit) continue;
      const nx = (x + 0.5 - cx) / rx;
      if (nx * nx + ny * ny > 1) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      parts.push(`${x},${y}`);
    }
  }
  if (parts.length === 0 || !Number.isFinite(minX)) return null;
  const d = parts
    .map((pair) => {
      const [x, y] = pair.split(',').map(Number);
      const px = (x - minX) * k;
      const py = (y - minY) * k;
      return `M${px} ${py}h${k}v${k}h${-k}z`;
    })
    .join('');
  return { d, minX, minY, w: (maxX - minX + 1) * k, h: (maxY - minY + 1) * k };
}

/**
 * A light pool filled with a 4×4 dither of rects, clipped to the ellipse.
 * Opacity breathes while `alive`; otherwise it holds one value. The view is
 * only as big as the ellipse and sits behind whatever is painted after it.
 */
export function DitherPool({
  alive,
  cx,
  cy,
  rx,
  ry,
  color,
  lit = 4,
  gain = 0.7,
}: {
  alive: boolean;
  /** Centre and radii in art pixels. */
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  color: string;
  /** Bayer cells below this are lit. 2 is a sparse floor pool; 4 is a find glow. */
  lit?: number;
  /** Scales the pool's opacity. The room lamp stays well under a solid wash. */
  gain?: number;
}) {
  const breath = useSharedValue(0.35);
  useEffect(() => {
    cancelAnimation(breath);
    breath.value = 0.35;
    if (!alive) return;
    breath.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(breath);
  }, [alive, breath]);
  const style = useAnimatedStyle(() => ({
    opacity: (alive ? 0.16 + breath.value * 0.1 : 0.2) * gain,
  }));
  const pool = useMemo(() => ditherPath(cx, cy, rx, ry, lit), [cx, cy, rx, ry, lit]);
  if (!pool) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: pool.minX * ART_PT,
          top: pool.minY * ART_PT,
          width: pool.w,
          height: pool.h,
          overflow: 'hidden',
        },
        style,
      ]}>
      <Svg width={pool.w} height={pool.h}>
        <Path d={pool.d} fill={color} />
      </Svg>
    </Animated.View>
  );
}

const WIPE_COLS = 8;
const WIPE_ROWS = 10;

/**
 * Pixel diamond wipe. `cover` grows the diamonds until they hide the screen,
 * then calls `onDone`. `reveal` shrinks them away. `off` draws nothing.
 */
export function DiamondWipe({
  mode,
  onDone,
}: {
  mode: 'off' | 'cover' | 'reveal';
  onDone?: () => void;
}) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
  };
  if (mode === 'off') return null;
  return (
    <View pointerEvents="auto" style={StyleSheet.absoluteFill} onLayout={onLayout}>
      {box.w > 0 ? <DiamondGrid mode={mode} width={box.w} height={box.h} onDone={onDone} /> : null}
    </View>
  );
}

function DiamondGrid({
  mode,
  width,
  height,
  onDone,
}: {
  mode: 'cover' | 'reveal';
  width: number;
  height: number;
  onDone?: () => void;
}) {
  const midC = (WIPE_COLS - 1) / 2;
  const midR = (WIPE_ROWS - 1) / 2;
  let rings = 1;
  const placed: { ring: number; cx: number; cy: number; r: number }[] = [];
  const cw = width / WIPE_COLS;
  const rh = height / WIPE_ROWS;
  const rad = Math.max(cw, rh) * 0.72;
  for (let row = 0; row < WIPE_ROWS; row += 1) {
    for (let col = 0; col < WIPE_COLS; col += 1) {
      const ring = Math.round(Math.max(Math.abs(col - midC), Math.abs(row - midR)));
      rings = Math.max(rings, ring + 1);
      placed.push({
        ring,
        cx: cw * (col + 0.5),
        cy: rh * (row + 0.5),
        r: rad,
      });
    }
  }
  return (
    <>
      {Array.from({ length: rings }, (_, ring) => (
        <DiamondRing
          key={ring}
          mode={mode}
          ring={ring}
          diamonds={placed.filter((d) => d.ring === ring)}
          onDone={ring === rings - 1 ? onDone : undefined}
        />
      ))}
    </>
  );
}

function DiamondRing({
  mode,
  ring,
  diamonds,
  onDone,
}: {
  mode: 'cover' | 'reveal';
  ring: number;
  diamonds: { cx: number; cy: number; r: number }[];
  onDone?: () => void;
}) {
  const scale = useSharedValue(mode === 'reveal' ? 1 : 0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    cancelAnimation(scale);
    const delay = ring * 32;
    const to = mode === 'cover' ? 1 : 0;
    scale.value = mode === 'reveal' ? 1 : 0;
    scale.value = withDelay(delay, withTiming(to, { duration: 220, easing: Easing.linear }));
    const id = setTimeout(() => doneRef.current?.(), delay + 240);
    return () => {
      clearTimeout(id);
      cancelAnimation(scale);
    };
  }, [mode, ring, scale]);
  return (
    <>
      {diamonds.map((d, i) => (
        <Diamond key={i} scale={scale} cx={d.cx} cy={d.cy} r={d.r} />
      ))}
    </>
  );
}

function Diamond({
  scale,
  cx,
  cy,
  r,
}: {
  scale: SharedValue<number>;
  cx: number;
  cy: number;
  r: number;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const size = r * 2;
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: cx - r, top: cy - r, width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Polygon points={`${r},0 ${size},${r} ${r},${size} 0,${r}`} fill={PIXEL.ink} />
      </Svg>
    </Animated.View>
  );
}

/** 80ms white flash (the caller tints an image copy) and a 2pt stepped shake. */
export function useHitJuice() {
  const flash = useSharedValue(0);
  const shake = useSharedValue(0);
  const play = () => {
    flash.value = withSequence(withTiming(1, { duration: 0 }), withDelay(80, withTiming(0, { duration: 140 })));
    shake.value = withSequence(
      withTiming(ART_PT, { duration: 0 }),
      withDelay(40, withTiming(-ART_PT, { duration: 0 })),
      withDelay(40, withTiming(ART_PT, { duration: 0 })),
      withDelay(40, withTiming(0, { duration: 0 })),
    );
  };
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  return { flash, play, shakeStyle };
}

/** Haul icon: three hard scales, not a curve. */
export function useSteppedPop() {
  const scale = useSharedValue(1);
  const play = () => {
    scale.value = withSequence(
      withTiming(1.45, { duration: 0 }),
      withDelay(50, withTiming(1.15, { duration: 0 })),
      withDelay(50, withTiming(1, { duration: 0 })),
    );
  };
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return { play, style };
}

/** Camera bob in points, snapped to the 2pt grid. `factor` is 0.25 / 0.5 / 1. */
export function useParallaxBob(alive: boolean): SharedValue<number> {
  const bob = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(bob);
    bob.value = 0;
    if (!alive) return;
    bob.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(-1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
    return () => cancelAnimation(bob);
  }, [alive, bob]);
  return bob;
}

/** Gentle bob for one parallax layer. Amplitude 8pt at factor 1, snapped to 2pt. */
export function ParallaxLayer({
  bob,
  factor,
  children,
  style,
}: {
  bob: SharedValue<number>;
  factor: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const motion = useAnimatedStyle(() => ({
    transform: [{ translateY: snap2(bob.value * 8 * factor) }],
  }));
  return <Animated.View style={[style, motion]}>{children}</Animated.View>;
}
