/**
 * Holo / reverse-holo paint (save v30). JS only: react-native-svg + Reanimated.
 *
 * Holo is masked to the sprite's alpha (the same sheet crop as ClipImage).
 * Reverse holo is an unmasked plate behind the pet. The sweep translates the
 * gradient; the stops never animate. Reduce Motion (Play or the OS) and Low
 * effects hold the band still.
 *
 * Layer order for holo, applied by the caller: base sprite, shiny hue, this
 * foil, then this glare. On a shiny the foil opacity drops; the glare does not.
 */
import { useEffect, useId, useState, type ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { ClipPath, Defs, G, LinearGradient, Mask, Rect, Stop, Image as SvgImage } from 'react-native-svg';

import {
  finishColor,
  finishConfig,
  finishSweepRuns,
  glareOpacity,
  holoFoilOpacity,
  reverseOpacity,
  stopsFor,
  type FinishMotion,
} from '@/play/finishes';
import { useFxQuality } from '@/play/fx-quality';
import { useBlendRecolor } from '@/play/pet-looks';
import { drawableFrame, playSheetArt } from '@/play/sheet-sprite';
import { sheetSpritePlacement } from '@/play/sheet-sprite-math';
import type { ClipDrawable } from '@/play/skin';

const AnimatedG = Animated.createAnimatedComponent(G);

function useOsReduceMotion(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (live) setOn(value);
      })
      .catch(() => {
        // Keep moving if the OS query fails; the Play override still applies.
      });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setOn);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return on;
}

type MaskArt = {
  vbW: number;
  vbH: number;
  node: ReactNode;
  clip: { x: number; y: number; width: number; height: number } | null;
};

/** The cropped sheet frame that fills the mask, via the shared placement maths. */
function maskArt(drawable: ClipDrawable | undefined): MaskArt | null {
  if (!drawable) return null;
  if (drawable.kind === 'legacy') {
    return {
      vbW: 100,
      vbH: 100,
      clip: null,
      node: (
        <SvgImage href={drawable.source} x={0} y={0} width={100} height={100} preserveAspectRatio="none" />
      ),
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

function BandSvg({
  art,
  mask,
  stops,
  glare,
  shift,
  travel,
}: {
  art: MaskArt;
  /** Holo masks to the sprite. Reverse holo does not. */
  mask: boolean;
  stops: readonly { offset: number; color: string }[] | null;
  glare: string | null;
  shift: SharedValue<number>;
  travel: SharedValue<number>;
}) {
  const raw = useId().replace(/[^a-zA-Z0-9]/g, '');
  const maskId = `foilmask-${raw}`;
  const clipId = `foilclip-${raw}`;
  const fillId = `foilfill-${raw}`;
  const animatedProps = useAnimatedProps(() => {
    const w = travel.value;
    const x = -w + shift.value * w;
    return { transform: `translate(${x}, 0)` };
  });
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${art.vbW} ${art.vbH}`}>
      <Defs>
        {art.clip ? (
          <ClipPath id={clipId}>
            <Rect x={art.clip.x} y={art.clip.y} width={art.clip.width} height={art.clip.height} />
          </ClipPath>
        ) : null}
        {mask ? (
          <Mask id={maskId} maskType="alpha" maskUnits="userSpaceOnUse" x={0} y={0} width={art.vbW} height={art.vbH}>
            {art.clip ? <G clipPath={`url(#${clipId})`}>{art.node}</G> : art.node}
          </Mask>
        ) : null}
        {stops ? (
          <LinearGradient id={fillId} x1="0" y1="0" x2="1" y2="0">
            {stops.map((stop, i) => (
              <Stop key={`${stop.offset}-${i}`} offset={String(stop.offset)} stopColor={stop.color} />
            ))}
          </LinearGradient>
        ) : null}
        {glare ? (
          <LinearGradient id={fillId} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={glare} stopOpacity={0} />
            <Stop offset="0.42" stopColor={glare} stopOpacity={0} />
            <Stop offset="0.5" stopColor={glare} stopOpacity={1} />
            <Stop offset="0.58" stopColor={glare} stopOpacity={0} />
            <Stop offset="1" stopColor={glare} stopOpacity={0} />
          </LinearGradient>
        ) : null}
      </Defs>
      <G mask={mask ? `url(#${maskId})` : undefined}>
        <AnimatedG animatedProps={animatedProps}>
          <Rect x={0} y={0} width={art.vbW * 2} height={art.vbH} fill={`url(#${fillId})`} />
        </AnimatedG>
      </G>
    </Svg>
  );
}

export function FinishPaint({
  kind,
  colorId,
  drawable,
  onShiny,
  motion,
  reduceMotion,
}: {
  kind: 'holo' | 'reverse';
  colorId: string;
  /** The sprite frame. Holo masks to it. Reverse ignores it. */
  drawable?: ClipDrawable;
  onShiny: boolean;
  motion: FinishMotion;
  reduceMotion: boolean;
}) {
  const color = finishColor(colorId);
  const art = kind === 'holo' ? maskArt(drawable) : { vbW: 100, vbH: 100, node: null, clip: null };
  const fxFull = useFxQuality() === 'full';
  const osReduce = useOsReduceMotion();
  const blendOn = useBlendRecolor();
  const sweep = finishSweepRuns({ motion, reduceMotion, osReduceMotion: osReduce, fxFull });
  const shift = useSharedValue(0.5);
  const travel = useSharedValue(art?.vbW ?? 100);
  const sweepMs = finishConfig().sweep_ms;

  useEffect(() => {
    travel.value = art?.vbW ?? 100;
  }, [art?.vbW, travel]);

  useEffect(() => {
    if (!sweep) {
      cancelAnimation(shift);
      shift.value = 0.5;
      return;
    }
    shift.value = 0;
    shift.value = withRepeat(withTiming(1, { duration: sweepMs, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(shift);
  }, [sweep, shift, sweepMs]);

  if (!color || !art || motion === 'off') return null;
  const paint = finishConfig().paint;
  const foilBlend = !blendOn
    ? kind === 'holo'
      ? paint.holo_blend_fallback
      : null
    : kind === 'reverse'
      ? paint.reverse_blend
      : paint.holo_blend;
  const foilOpacity = kind === 'reverse' ? reverseOpacity() : holoFoilOpacity(onShiny, blendOn);
  const glareBlend = blendOn ? paint.reverse_blend : null;
  const blendOf = (name: string | null): ViewStyle | null =>
    name ? { mixBlendMode: name as 'color-dodge' | 'overlay' | 'screen' } : null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, blendOf(foilBlend), { opacity: foilOpacity }]}>
        <BandSvg art={art} mask={kind === 'holo'} stops={stopsFor(color)} glare={null} shift={shift} travel={travel} />
      </View>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, blendOf(glareBlend), { opacity: glareOpacity() }]}>
        <BandSvg art={art} mask={kind === 'holo'} stops={null} glare={color.glare} shift={shift} travel={travel} />
      </View>
    </View>
  );
}
