/**
 * Holo / reverse-holo paint (save v30). JS only: react-native-svg + Reanimated.
 *
 * Holo fills the art window behind the pet (diagonal bands, dark gaps, glitter,
 * a glare spot) and lays a light overlay sheen on the sprite, masked to its
 * alpha. Reverse holo fills the rounded card around that window; the pet is
 * left alone. The sheen uses overlay, which keeps dark armour.
 *
 * Motion is the shared drift + tilt in `finish-motion`. Reduce Motion (Play or
 * the OS) and Low effects hold every layer still. Stops never animate.
 */
import { useEffect, useId, useState, type ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Mask,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Image as SvgImage,
} from 'react-native-svg';

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
  sheenOpacity,
  windowOpacity,
  type FinishMotion,
} from '@/play/finishes';
import { useFxQuality } from '@/play/fx-quality';
import { useBlendRecolor } from '@/play/pet-looks';
import { drawableFrame, playSheetArt } from '@/play/sheet-sprite';
import { sheetSpritePlacement } from '@/play/sheet-sprite-math';
import type { ClipDrawable } from '@/play/skin';

const AnimatedG = Animated.createAnimatedComponent(G);

export type FoilHole = { x: number; y: number; w: number; h: number; r: number };

function useOsReduceMotion(): boolean {
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

type MaskArt = {
  vbW: number;
  vbH: number;
  node: ReactNode;
  clip: { x: number; y: number; width: number; height: number } | null;
};

function maskArt(drawable: ClipDrawable | undefined): MaskArt | null {
  if (!drawable) return null;
  if (drawable.kind === 'legacy') {
    return {
      vbW: 100,
      vbH: 100,
      clip: null,
      node: <SvgImage href={drawable.source} x={0} y={0} width={100} height={100} preserveAspectRatio="none" />,
    };
  }
  const frame = drawableFrame(drawable);
  const source = frame ? playSheetArt(frame.sheetKey) : undefined;
  if (!frame || !source) return null;
  const place = sheetSpritePlacement(frame.rect, 0, 0, frame.rect.w);
  return {
    vbW: frame.rect.w,
    vbH: frame.rect.h,
    clip: place.clip,
    node: (
      <SvgImage
        href={source}
        x={place.imageX}
        y={place.imageY}
        width={frame.sheetW}
        height={frame.sheetH}
        preserveAspectRatio="none"
      />
    ),
  };
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

/**
 * A light highlight masked to the sprite. Overlay keeps the dark pixels.
 * When blend modes are off, this is a thin wash and still not a dodge.
 */
export function FinishSheen({
  colorId,
  drawable,
  onShiny,
  motion,
  reduceMotion,
}: {
  colorId: string;
  drawable?: ClipDrawable;
  onShiny: boolean;
  motion: FinishMotion;
  reduceMotion: boolean;
}) {
  const color = finishColor(colorId);
  const art = maskArt(drawable);
  const moving = useFoilMoving(motion, reduceMotion);
  const blendOn = useBlendRecolor();
  const raw = useId().replace(/[^a-zA-Z0-9]/g, '');
  const maskId = `sheen-${raw}`;
  const clipId = `sheenclip-${raw}`;
  const fillId = `sheenfill-${raw}`;
  const slide = useAnimatedProps(() => {
    const drift = moving ? foilDrift.value : 0.35;
    const tx = moving ? foilTiltX.value : 0;
    const x = (drift - 0.5) * (art?.vbW ?? 100) * 0.18 + tx * (art?.vbW ?? 100) * 0.12;
    return { transform: `translate(${x} 0)` };
  });
  if (!color || !art) return null;
  const light = color.stops[0] ?? color.glare;
  const opacity = sheenOpacity(onShiny, blendOn);
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, blendOn ? styles.overlay : null, { opacity }]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${art.vbW} ${art.vbH}`}>
        <Defs>
          {art.clip ? (
            <ClipPath id={clipId}>
              <Rect x={art.clip.x} y={art.clip.y} width={art.clip.width} height={art.clip.height} />
            </ClipPath>
          ) : null}
          <Mask id={maskId} maskType="alpha" maskUnits="userSpaceOnUse" x={0} y={0} width={art.vbW} height={art.vbH}>
            {art.clip ? <G clipPath={`url(#${clipId})`}>{art.node}</G> : art.node}
          </Mask>
          <RadialGradient id={fillId} cx="30%" cy="20%" rx="55%" ry="55%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.95} />
            <Stop offset="0.35" stopColor={light} stopOpacity={0.35} />
            <Stop offset="0.7" stopColor={light} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <G mask={`url(#${maskId})`}>
          <AnimatedG animatedProps={slide}>
            <Rect x={-art.vbW} y={0} width={art.vbW * 3} height={art.vbH} fill={`url(#${fillId})`} />
          </AnimatedG>
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { mixBlendMode: 'overlay' },
});
