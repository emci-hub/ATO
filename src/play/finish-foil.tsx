/**
 * Holo / reverse-holo paint (save v30). JS only: react-native-svg + Reanimated.
 *
 * Holo fills the art window behind the pet (diagonal bands, dark gaps, glitter,
 * a glare spot). Reverse holo fills the rounded card around that window. The
 * pet sprite is never tinted.
 *
 * Motion is the shared drift + tilt in `finish-motion`. Reduce Motion (Play or
 * the OS) and Low effects hold every layer still. Stops never animate.
 */
import { useEffect, useId, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { foilDrift, foilTiltX, foilTiltY, leaseFinishSensor } from '@/play/finish-motion';
import {
  finishColor,
  finishSweepRuns,
  foilAngle,
  foilGap,
  foilSparkles,
  foilStripes,
  glareOpacity,
  reverseOpacity,
  windowOpacity,
  type FinishMotion,
} from '@/play/finishes';
import { useFxQuality } from '@/play/fx-quality';

const AnimatedG = Animated.createAnimatedComponent(G);

export type FoilHole = { x: number; y: number; w: number; h: number; r: number };

export function useOsReduceMotion(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (live) setOn(value);
      })
      .catch(() => {
        // Keep the Play override if the OS query fails.
      });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setOn);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return on;
}

function useFoilMoving(motion: FinishMotion, reduceMotion: boolean): boolean {
  const fxFull = useFxQuality() === 'full';
  const osReduce = useOsReduceMotion();
  return finishSweepRuns({ motion, reduceMotion, osReduceMotion: osReduce, fxFull });
}

/** Lease the gyro while a finished pet is actually on this surface. */
export function useFinishLease(active: boolean) {
  useEffect(() => {
    if (!active) return;
    return leaseFinishSensor();
  }, [active]);
}

function roundRect(x: number, y: number, w: number, h: number, r: number): string {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  if (radius <= 0) return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
  return [
    `M ${x + radius} ${y}`,
    `H ${x + w - radius}`,
    `A ${radius} ${radius} 0 0 1 ${x + w} ${y + radius}`,
    `V ${y + h - radius}`,
    `A ${radius} ${radius} 0 0 1 ${x + w - radius} ${y + h}`,
    `H ${x + radius}`,
    `A ${radius} ${radius} 0 0 1 ${x} ${y + h - radius}`,
    `V ${y + radius}`,
    `A ${radius} ${radius} 0 0 1 ${x + radius} ${y}`,
    'Z',
  ].join(' ');
}

function FoilTexture({
  colorId,
  moving,
  width,
  height,
  hole,
}: {
  colorId: string;
  moving: boolean;
  width: number;
  height: number;
  hole: FoilHole | null;
}) {
  const color = finishColor(colorId);
  const raw = useId().replace(/[^a-zA-Z0-9]/g, '');
  const clipId = `foilc-${raw}`;
  const glareId = `foilg-${raw}`;
  const angle = color ? foilAngle(color) : 112;
  const bandProps = useAnimatedProps(() => {
    const drift = moving ? foilDrift.value : 0.35;
    const tx = moving ? foilTiltX.value : 0;
    const slide = (drift - 0.5) * 18 + tx * 14;
    return { transform: `translate(${slide} 0) rotate(${angle} 50 50)` };
  });
  const sparkleProps = useAnimatedProps(() => {
    const drift = moving ? foilDrift.value : 0.35;
    const tx = moving ? foilTiltX.value : 0;
    const ty = moving ? foilTiltY.value : 0;
    const slide = (drift - 0.5) * 8 + tx * 6;
    return { transform: `translate(${slide} ${ty * 5})` };
  });
  const glareProps = useAnimatedProps(() => {
    const drift = moving ? foilDrift.value : 0.35;
    const tx = moving ? foilTiltX.value : 0;
    const ty = moving ? foilTiltY.value : 0;
    const x = (drift - 0.5) * 8 + tx * 16;
    const y = ty * 12;
    return { transform: `translate(${x} ${y})` };
  });
  if (!color || width <= 0 || height <= 0) return null;
  const gap = foilGap(color.stops);
  const stripes = foilStripes(color);
  const sparkles = foilSparkles(color.id);
  const sx = width / 100;
  const sy = height / 100;
  const holePath = hole ? roundRect(hole.x, hole.y, hole.w, hole.h, hole.r) : '';
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
      <Defs>
        {hole ? (
          <ClipPath id={clipId}>
            <Path fillRule="evenodd" d={`${roundRect(0, 0, width, height, 0)} ${holePath}`} />
          </ClipPath>
        ) : null}
        <RadialGradient id={glareId} cx="50%" cy="42%" r="48%">
          <Stop offset="0" stopColor={color.glare} stopOpacity={0.95} />
          <Stop offset="0.22" stopColor={color.glare} stopOpacity={0.45} />
          <Stop offset="0.55" stopColor={color.glare} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <G clipPath={hole ? `url(#${clipId})` : undefined}>
        <Rect x={0} y={0} width={width} height={height} fill={gap} />
        <G transform={`scale(${sx} ${sy})`}>
          <AnimatedG animatedProps={bandProps}>
            <Rect x={-50} y={-80} width={200} height={260} fill={gap} />
            {stripes.map((stripe, i) => (
              <Rect key={`${stripe.x}-${i}`} x={stripe.x} y={-80} width={stripe.w} height={260} fill={stripe.color} />
            ))}
          </AnimatedG>
          <AnimatedG animatedProps={sparkleProps}>
            {sparkles.map((dot, i) => (
              <Circle key={`${dot.x}-${i}`} cx={dot.x} cy={dot.y} r={dot.r} fill={color.glare} opacity={dot.o} />
            ))}
          </AnimatedG>
          <AnimatedG animatedProps={glareProps}>
            <Rect x={-20} y={-20} width={140} height={140} fill={`url(#${glareId})`} opacity={glareOpacity()} />
          </AnimatedG>
        </G>
      </G>
    </Svg>
  );
}

/** Foil filling this view. `hole` (card pixels) is the art window cut out of a reverse card. */
export function FinishPlate({
  colorId,
  motion,
  reduceMotion,
  opacity,
  hole = null,
  style,
}: {
  colorId: string;
  motion: FinishMotion;
  reduceMotion: boolean;
  opacity: number;
  hole?: FoilHole | null;
  style?: StyleProp<ViewStyle>;
}) {
  const moving = useFoilMoving(motion, reduceMotion);
  const [box, setBox] = useState({ w: 0, h: 0 });
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { opacity }, style]}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        const h = e.nativeEvent.layout.height;
        setBox((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
      }}>
      {box.w > 0 ? (
        <FoilTexture colorId={colorId} moving={moving} width={box.w} height={box.h} hole={hole} />
      ) : null}
    </View>
  );
}

export function windowFoilOpacity(): number {
  return windowOpacity();
}

export function cardFoilOpacity(): number {
  return reverseOpacity();
}
