/**
 * Holo on the pet (aura/holo rework, SPEC §5). `PetHolo` draws, over the sprite:
 *
 *   holo     prism bands (overlay, masked to the sprite) + shine sweep + glints
 *   reverse  a 1 px foil rim round the sprite (lit top-left, dim shadow
 *            bottom-right) + the same shine sweep + glints; the body is untouched
 *
 * Pixel-true: one art pixel is one SVG viewBox unit and every texture is 1 px
 * per art pixel (pet-holo-textures.ts), slid by whole pixels. One shared 24 fps
 * clock on the UI thread drives every layer (no setState per frame). Reduce
 * Motion / Motion Off play the gentle loop — slower, fade-only glints — and
 * never stop. The maths lives in pet-holo-model.ts and is pinned by
 * `check:pet-holo`.
 */
import { Image as ExpoImage } from 'expo-image';
import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';
import Svg, { ClipPath, Defs, G, Mask, Path, Rect, Image as SvgImage } from 'react-native-svg';

import { pngDataUri } from '@/play/aura-palette';
import {
  finishColor,
  finishConfig,
  finishGlint,
  finishSweep,
  type PetFinish,
} from '@/play/finishes';
import { useFxQuality } from '@/play/fx-quality';
import {
  GLINT_CELL,
  PRISM_BAND,
  RIM_BAND,
  RIM_SHADOW_ALPHA,
  RIM_SHADOW_MIX,
  TICKS_PER_SECOND,
  glintFireTick,
  glintFrameAt,
  hexRgb,
  mixRgb,
  pickGlintSpots,
  prismShift,
  rimPixels,
  sweepPeriod,
  sweepPos,
  type GlintSpot,
  type Rgb,
} from '@/play/pet-holo-model';
import {
  bandTexture,
  glintColours,
  glintSheet,
  sweepTexture,
  type SweepSource,
} from '@/play/pet-holo-textures';
import { useBlendRecolor } from '@/play/pet-looks';
import { pixelRenderStyle } from '@/play/pixel-theme';
import { usePlayMotion } from '@/play/play-motion';
import { drawableFrame, playSheetArt } from '@/play/sheet-sprite';
import { sheetSpritePlacement } from '@/play/sheet-sprite-math';
import type { ClipDrawable } from '@/play/skin';
import { framePixelsOf, remember, type FramePixels } from '@/play/sprite-pixels';

const AnimatedG = Animated.createAnimatedComponent(G);

/* ----------------------------------------------------------- caches ------- */

const TEXTURE_CAP = 24;
const textures = new Map<string, string>();

/** A texture's data URI, built once per key. */
function cachedUri(key: string, build: () => Uint8Array): string {
  const hit = textures.get(key);
  if (hit) {
    remember(textures, key, hit, TEXTURE_CAP);
    return hit;
  }
  const uri = pngDataUri(build());
  remember(textures, key, uri, TEXTURE_CAP);
  return uri;
}

const SPOT_CAP = 16;
const spotCache = new Map<string, GlintSpot[]>();
const RIM_CAP = 24;
type Rim = { lit: string; shade: string };
const rimCache = new Map<string, Rim>();

function runPath(pixels: { x: number; y: number }[]): string {
  // One `M x y h<run> v1 h-<run> z` per horizontal run.
  const rows = new Map<number, number[]>();
  for (const p of pixels) rows.set(p.y, [...(rows.get(p.y) ?? []), p.x]);
  let d = '';
  for (const [y, xs] of rows) {
    xs.sort((a, b) => a - b);
    let start = xs[0];
    let prev = xs[0];
    for (let i = 1; i <= xs.length; i++) {
      const x = xs[i];
      if (x === prev + 1) {
        prev = x;
        continue;
      }
      d += `M${start} ${y}h${prev - start + 1}v1h-${prev - start + 1}z`;
      start = x;
      prev = x;
    }
  }
  return d;
}

function rimPaths(key: string, px: FramePixels): Rim {
  const hit = rimCache.get(key);
  if (hit) return hit;
  const ring = rimPixels(px.alpha, px.w, px.h);
  const built = { lit: runPath(ring.filter((p) => p.lit)), shade: runPath(ring.filter((p) => !p.lit)) };
  remember(rimCache, key, built, RIM_CAP);
  return built;
}

/* ------------------------------------------------------------ hooks -------- */

/** One frame's pixels, keeping the last until the next is decoded. */
function useFramePixels(drawable: ClipDrawable | undefined): { key: string; px: FramePixels } | null {
  const key = drawable?.kind === 'sheet' ? `${drawable.sheetKey}|${drawable.frameKey}` : '';
  const [state, setState] = useState<{ key: string; px: FramePixels } | null>(null);
  useEffect(() => {
    if (!key) return;
    let live = true;
    void framePixelsOf(drawable)
      .then((px) => {
        if (live && px) setState({ key, px });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

function useGentle(): boolean {
  const flags = usePlayMotion();
  const fx = useFxQuality();
  return flags.vestibularSafe || flags.cosmeticsStill || fx !== 'full';
}

/** The one shared clock: integer ticks at 24 per second, on the UI thread. */
function useHoloClock() {
  const tick = useSharedValue(0);
  const step = useCallback(
    (info: { timeSinceFirstFrame: number }) => {
      'worklet';
      tick.value = Math.floor((info.timeSinceFirstFrame * TICKS_PER_SECOND) / 1000);
    },
    [tick],
  );
  useFrameCallback(step);
  return tick;
}

type MaskArt = {
  vbW: number;
  vbH: number;
  node: ReactNode;
  clip: { x: number; y: number; width: number; height: number } | null;
};

/** The sprite frame as an SVG mask source (its own alpha). */
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
  // The viewBox is the source CELL (one unit = one art pixel); the trimmed crop sits at its offset.
  const cell =
    frame.sourceW && frame.sourceH
      ? { sourceW: frame.sourceW, sourceH: frame.sourceH, offsetX: frame.offsetX ?? 0, offsetY: frame.offsetY ?? 0 }
      : undefined;
  const place = sheetSpritePlacement(frame.rect, 0, 0, cell?.sourceW ?? frame.rect.w, cell);
  return {
    vbW: cell?.sourceW ?? frame.rect.w,
    vbH: cell?.sourceH ?? frame.rect.h,
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

/* --------------------------------------------------------- the layers ------ */

function SpriteMasked({ art, raw, children }: { art: MaskArt; raw: string; children: ReactNode }) {
  const maskId = `holo-${raw}`;
  const clipId = `holoclip-${raw}`;
  return (
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
      </Defs>
      <G mask={`url(#${maskId})`}>{children}</G>
    </Svg>
  );
}

function PrismLayer({
  art,
  raw,
  uri,
  w,
  h,
  period,
  gentle,
  tick,
  blend,
}: {
  art: MaskArt;
  raw: string;
  uri: string;
  w: number;
  h: number;
  period: number;
  gentle: boolean;
  tick: ReturnType<typeof useHoloClock>;
  blend: boolean;
}) {
  const paint = finishConfig().paint;
  const props = useAnimatedProps(() => ({
    transform: `translate(${-(prismShift(tick.value, gentle) % period)} 0)`,
  }));
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, blend ? styles.overlay : null, { opacity: blend ? paint.prism_overlay_opacity : paint.wash_opacity }]}>
      <SpriteMasked art={art} raw={raw}>
        <AnimatedG animatedProps={props}>
          <SvgImage href={{ uri }} x={0} y={0} width={w} height={h} preserveAspectRatio="none" />
        </AnimatedG>
      </SpriteMasked>
    </View>
  );
}

function SweepLayer({
  art,
  raw,
  uri,
  w,
  h,
  core,
  frameW,
  frameH,
  gentle,
  tick,
}: {
  art: MaskArt;
  raw: string;
  uri: string;
  w: number;
  h: number;
  core: number;
  frameW: number;
  frameH: number;
  gentle: boolean;
  tick: ReturnType<typeof useHoloClock>;
}) {
  const props = useAnimatedProps(() => {
    const pos = sweepPos(tick.value, gentle, frameW, frameH);
    if (pos == null) return { opacity: 0, transform: 'translate(0 0)' };
    return { opacity: 1, transform: `translate(${Math.round(pos) - core} 0)` };
  });
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <SpriteMasked art={art} raw={raw}>
        <AnimatedG animatedProps={props}>
          <SvgImage href={{ uri }} x={0} y={0} width={w} height={h} preserveAspectRatio="none" />
        </AnimatedG>
      </SpriteMasked>
    </View>
  );
}

function RimLayer({
  rim,
  raw,
  vbW,
  vbH,
  litUri,
  shadeUri,
  w,
  h,
  period,
  gentle,
  tick,
}: {
  rim: Rim;
  raw: string;
  vbW: number;
  vbH: number;
  litUri: string;
  shadeUri: string;
  w: number;
  h: number;
  period: number;
  gentle: boolean;
  tick: ReturnType<typeof useHoloClock>;
}) {
  const props = useAnimatedProps(() => ({
    transform: `translate(${-(prismShift(tick.value, gentle) % period)} 0)`,
  }));
  const litId = `rimlit-${raw}`;
  const shadeId = `rimshade-${raw}`;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${vbW} ${vbH}`}>
        <Defs>
          <Mask id={litId} maskUnits="userSpaceOnUse" x={0} y={0} width={vbW} height={vbH}>
            <Path d={rim.lit} fill="#FFFFFF" />
          </Mask>
          <Mask id={shadeId} maskUnits="userSpaceOnUse" x={0} y={0} width={vbW} height={vbH}>
            <Path d={rim.shade} fill="#FFFFFF" />
          </Mask>
        </Defs>
        <G mask={`url(#${shadeId})`} opacity={RIM_SHADOW_ALPHA / 255}>
          <AnimatedG animatedProps={props}>
            <SvgImage href={{ uri: shadeUri }} x={0} y={0} width={w} height={h} preserveAspectRatio="none" />
          </AnimatedG>
        </G>
        <G mask={`url(#${litId})`}>
          <AnimatedG animatedProps={props}>
            <SvgImage href={{ uri: litUri }} x={0} y={0} width={w} height={h} preserveAspectRatio="none" />
          </AnimatedG>
        </G>
      </Svg>
    </View>
  );
}

function GlintView({
  spot,
  fire,
  uri,
  frames,
  unit,
  gentle,
  tick,
}: {
  spot: GlintSpot;
  fire: number;
  uri: string;
  frames: number;
  unit: number;
  gentle: boolean;
  tick: ReturnType<typeof useHoloClock>;
}) {
  const cell = GLINT_CELL * unit;
  const period = sweepPeriod(gentle);
  const outer = useAnimatedStyle(() => {
    const idx = glintFrameAt((tick.value % period) - fire, gentle);
    return { opacity: idx < 0 ? 0 : 1 };
  });
  const slide = useAnimatedStyle(() => {
    const idx = glintFrameAt((tick.value % period) - fire, gentle);
    return { transform: [{ translateX: -Math.max(0, Math.min(frames - 1, idx)) * cell }] };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.glint,
        { left: (spot.x - (GLINT_CELL - 1) / 2) * unit, top: (spot.y - (GLINT_CELL - 1) / 2) * unit, width: cell, height: cell },
        outer,
      ]}>
      <Animated.View style={[{ width: frames * cell, height: cell }, slide]}>
        <ExpoImage source={{ uri }} contentFit="fill" transition={0} cachePolicy="memory" style={{ ...styles.fill, ...pixelRenderStyle }} />
      </Animated.View>
    </Animated.View>
  );
}

/* -------------------------------------------------------------- the pet ---- */

function rampOf(id: string): Rgb[] | null {
  const color = finishColor(id);
  return color ? color.stops.map(hexRgb) : null;
}

/**
 * Holo or reverse holo on one pet. Sits over the sprite, inside the box; glints
 * may reach `HALO` px past the silhouette. `still` is the pet's still pose, so
 * the glint spots stay put while the animation frames change.
 */
export function PetHolo({
  finish,
  drawable,
  still,
  box,
}: {
  finish: PetFinish;
  drawable?: ClipDrawable;
  still?: ClipDrawable;
  box: number;
}) {
  const raw = useId().replace(/[^a-zA-Z0-9]/g, '');
  const gentle = useGentle();
  const blend = useBlendRecolor();
  const tick = useHoloClock();
  const frame = useFramePixels(drawable);
  const stillFrame = useFramePixels(still ?? drawable);
  const art = useMemo(() => maskArt(drawable), [drawable]);
  const prism = rampOf(finish.color);
  const sweepDef = finishSweep(finish.sweep);
  const glintDef = finishGlint(finish.glint);
  const paint = finishConfig().paint;
  const isHolo = finish.kind === 'holo';

  const sprite = frame?.px;
  const w = sprite?.w ?? 0;
  const h = sprite?.h ?? 0;

  const prismTex = useMemo(() => {
    if (!prism || !isHolo || !w) return null;
    const tex = bandTexture(prism, PRISM_BAND, w, h);
    return { ...tex, uri: cachedUri(`prism|${finish.color}|${w}x${h}`, () => tex.png) };
  }, [prism, isHolo, w, h, finish.color]);

  const rimTex = useMemo(() => {
    if (!prism || isHolo || !w) return null;
    const lit = bandTexture(prism, RIM_BAND, w, h);
    const shaded = bandTexture(prism.map((c) => mixRgb(c, RIM_SHADOW_MIX, 0.5)), RIM_BAND, w, h);
    return {
      w: lit.w,
      h: lit.h,
      period: lit.period,
      lit: cachedUri(`rim|${finish.color}|${w}x${h}`, () => lit.png),
      shade: cachedUri(`rimshade|${finish.color}|${w}x${h}`, () => shaded.png),
    };
  }, [prism, isHolo, w, h, finish.color]);

  const sweepTex = useMemo(() => {
    if (!prism || !sweepDef || !h) return null;
    let source: SweepSource;
    if (sweepDef.id === 'match') source = { kind: 'match', prism };
    else if (sweepDef.id === 'iris') {
      const spectrum = rampOf('spectrum') ?? prism;
      source = { kind: 'iris', spectrum };
    } else if (sweepDef.core && sweepDef.mid && sweepDef.outer) {
      source = { kind: 'fixed', colours: { core: hexRgb(sweepDef.core), mid: hexRgb(sweepDef.mid), outer: hexRgb(sweepDef.outer) } };
    } else return null;
    const tex = sweepTexture(source, h, { core: paint.sweep_core, mid: paint.sweep_mid, outer: paint.sweep_outer });
    return { ...tex, uri: cachedUri(`sweep|${sweepDef.id}|${sweepDef.id === 'match' ? finish.color : ''}|${h}`, () => tex.png) };
  }, [prism, sweepDef, h, finish.color, paint.sweep_core, paint.sweep_mid, paint.sweep_outer]);

  const glintTex = useMemo(() => {
    if (!prism || !glintDef) return null;
    const tex = glintSheet(glintColours(glintDef, prism, hexRgb), gentle);
    return {
      ...tex,
      uri: cachedUri(`glint|${glintDef.id}|${glintDef.id === 'match' ? finish.color : ''}|${gentle ? 'g' : 'f'}`, () => tex.png),
    };
  }, [prism, glintDef, gentle, finish.color]);

  const spots = useMemo(() => {
    const px = stillFrame?.px;
    if (!px) return [];
    const key = `${stillFrame.key}`;
    const hit = spotCache.get(key);
    if (hit) return hit;
    const picked = pickGlintSpots(px.alpha, px.luma, px.w, px.h);
    remember(spotCache, key, picked, SPOT_CAP);
    return picked;
  }, [stillFrame]);

  const fires = useMemo(
    () =>
      spots
        .map((spot) => ({ spot, fire: sprite ? glintFireTick(spot, gentle, sprite.w, sprite.h) : null }))
        .filter((s): s is { spot: GlintSpot; fire: number } => s.fire != null),
    [spots, gentle, sprite],
  );

  const rim = useMemo(() => (frame && !isHolo ? rimPaths(frame.key, frame.px) : null), [frame, isHolo]);

  if (!art || !sprite || !prism) return null;
  const unit = box / sprite.w;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {isHolo && prismTex ? (
        <PrismLayer
          art={art}
          raw={`p${raw}`}
          uri={prismTex.uri}
          w={prismTex.w}
          h={prismTex.h}
          period={prismTex.period}
          gentle={gentle}
          tick={tick}
          blend={blend}
        />
      ) : null}
      {!isHolo && rim && rimTex ? (
        <RimLayer
          rim={rim}
          raw={`r${raw}`}
          vbW={sprite.w}
          vbH={sprite.h}
          litUri={rimTex.lit}
          shadeUri={rimTex.shade}
          w={rimTex.w}
          h={rimTex.h}
          period={rimTex.period}
          gentle={gentle}
          tick={tick}
        />
      ) : null}
      {sweepTex ? (
        <SweepLayer
          art={art}
          raw={`s${raw}`}
          uri={sweepTex.uri}
          w={sweepTex.w}
          h={sweepTex.h}
          core={sweepTex.core}
          frameW={sprite.w}
          frameH={sprite.h}
          gentle={gentle}
          tick={tick}
        />
      ) : null}
      {glintTex
        ? fires.map(({ spot, fire }, i) => (
            <GlintView
              key={`${spot.x},${spot.y},${i}`}
              spot={spot}
              fire={fire}
              uri={glintTex.uri}
              frames={glintTex.frames}
              unit={unit}
              gentle={gentle}
              tick={tick}
            />
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { mixBlendMode: 'overlay' },
  glint: { position: 'absolute', overflow: 'hidden' },
  fill: { width: '100%', height: '100%' },
});
