/**
 * Aura paint (save v34). Each style is one packed, indexed atlas (a behind
 * strip and a front strip). A colourway rewrites only the PNG's palette
 * (`aura-palette.ts`), so one drawing serves every colourway. The strip is
 * shown by expo-image at a whole number of device pixels per art pixel and
 * the frame index runs on the UI thread (Reanimated), so no frame ever
 * re-renders React.
 *
 * Placement: the art's anchor is the GROUND point (src/play/ground-point.ts),
 * not the toe edge, and the art's scale follows the figure's height against
 * the figure the art was drawn around (`refBodyPx`).
 *
 * Motion Off and Effects that are not Full keep a gentle two-frame breathe
 * instead of freezing: an aura is never fully still.
 */
import { Image as ExpoImage } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PixelRatio, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { SHEET } from '@/art/art';
import { pngDataUri, recolourPng, type PaletteRamps } from '@/play/aura-palette';
import { auraFps, auraStyleFps, type AuraStyle } from '@/play/auras';
import { PLAY_SHEETS } from '@/play/generated-play-sheets';
import { useFxQuality } from '@/play/fx-quality';
import { pixelRenderStyle } from '@/play/pixel-theme';
import { usePlayMotion } from '@/play/play-motion';
import { ClipImage } from '@/play/sheet-sprite';
import { STREETWEAR_META, type ClipDrawable } from '@/play/skin';
import { bodyBoxOf, framePixelsOf, remember, sheetBytes, type BodyBox } from '@/play/sprite-pixels';

/** One recoloured atlas per style + colourway. A handful stay. */
const URI_CAP = 12;
const uris = new Map<string, Promise<string>>();
const atlases = new Map<string, Promise<Uint8Array>>();
/** Body boxes by sprite frame, so a pose change keeps the last box until the next is known. */
const BODY_CAP = 48;
const bodies = new Map<string, BodyBox | null>();

/** Seconds a gentle (Motion Off) breathe holds each of its two frames. */
const GENTLE_HOLD_MS = 700;

function rampKey(ramps: PaletteRamps): string {
  return `${ramps.main.join(',')}|${ramps.second.join(',')}`;
}

function atlasKeyOf(style: AuraStyle): string {
  return SHEET.aura[style].behind;
}

/** The recoloured atlas data URI for one style + colourway. In-flight builds are shared. */
export function auraAtlasUri(style: AuraStyle, ramps: PaletteRamps): Promise<string> {
  const key = `${style}|${rampKey(ramps)}`;
  const hit = uris.get(key);
  if (hit) {
    remember(uris, key, hit, URI_CAP);
    return hit;
  }
  const sheetKey = atlasKeyOf(style);
  const file = PLAY_SHEETS[sheetKey]?.sheet ?? sheetKey;
  let bytes = atlases.get(file);
  if (!bytes) {
    bytes = sheetBytes(sheetKey);
    atlases.set(file, bytes);
    bytes.catch(() => atlases.delete(file));
  }
  const job = bytes.then((raw) => pngDataUri(recolourPng(raw, ramps)));
  remember(uris, key, job, URI_CAP);
  job.catch(() => {
    if (uris.get(key) === job) uris.delete(key);
  });
  return job;
}

/** Where the figure stands in its frame, kept while a new pose is measured. */
function useBodyBox(drawable: ClipDrawable | undefined): BodyBox | null {
  const key = drawable?.kind === 'sheet' ? `${drawable.sheetKey}|${drawable.frameKey}` : '';
  const [body, setBody] = useState<BodyBox | null>(() => (key ? (bodies.get(key) ?? null) : null));
  const last = useRef<BodyBox | null>(body);
  useEffect(() => {
    if (!key) return;
    const known = bodies.get(key);
    if (known) {
      last.current = known;
      setBody(known);
      return;
    }
    let live = true;
    void framePixelsOf(drawable)
      .then((px) => {
        const box = px ? bodyBoxOf(px) : null;
        remember(bodies, key, box, BODY_CAP);
        if (box) last.current = box;
        if (live) setBody(box ?? last.current);
      })
      .catch(() => {
        if (live) setBody(last.current);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return key ? (bodies.get(key) ?? body ?? last.current) : null;
}

/** Whole device pixels per art pixel (never fractional): 1/PixelRatio steps, at least one. */
export function snapArtScale(scale: number, ratio = PixelRatio.get()): number {
  return Math.max(1, Math.round(scale * ratio)) / ratio;
}

function snapPt(pt: number, ratio = PixelRatio.get()): number {
  return Math.round(pt * ratio) / ratio;
}

/** Frame index on the UI thread: a linear loop, or the gentle two-frame breathe. */
function useAuraClock(frames: number, fps: number, gentle: boolean) {
  const t = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(t);
    t.value = 0;
    if (gentle) {
      t.value = withRepeat(withTiming(2, { duration: GENTLE_HOLD_MS * 2, easing: Easing.linear }), -1, false);
    } else {
      t.value = withRepeat(withTiming(frames, { duration: (frames * 1000) / fps, easing: Easing.linear }), -1, false);
    }
    return () => cancelAnimation(t);
  }, [t, frames, fps, gentle]);
  return t;
}

export function PetAuraSprite({
  drawable,
  styleId,
  ramps,
  box,
  layer,
}: {
  drawable?: ClipDrawable;
  styleId: AuraStyle;
  ramps: PaletteRamps;
  box: number;
  /** `back` is behind the pet, `front` in front of it. */
  layer: 'back' | 'front';
}) {
  const motionFlags = usePlayMotion();
  const fxQuality = useFxQuality();
  const gentle = motionFlags.cosmeticsStill || fxQuality !== 'full';
  const meta = STREETWEAR_META.auras[styleId];
  const which = layer === 'back' ? 'behind' : 'front';
  const sheet = PLAY_SHEETS[SHEET.aura[styleId][which]];
  const body = useBodyBox(drawable);
  const key = `${styleId}|${rampKey(ramps)}`;
  const [uri, setUri] = useState<{ key: string; uri: string } | null>(null);
  useEffect(() => {
    let live = true;
    void auraAtlasUri(styleId, ramps)
      .then((next) => live && setUri({ key, uri: next }))
      .catch(() => live && setUri(null));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const frames = sheet ? Object.keys(sheet.frames).length : 0;
  const clock = useAuraClock(Math.max(1, frames), auraStyleFps(styleId) || auraFps(), gentle);
  const geometry = useMemo(() => {
    if (!meta || !sheet || !body || frames === 0) return null;
    const first = sheet.frames.frame_000;
    const second = sheet.frames.frame_001;
    if (!first) return null;
    const px = box / body.fw;
    const art = snapArtScale(px * (body.h / meta.refBodyPx));
    const stride = second ? second.x - first.x : first.w;
    const left = snapPt(body.cx * px - meta.anchorX * meta.cell * art);
    const top = snapPt(body.ground * (box / body.fh) - meta.anchorY * meta.cell * art);
    return { art, stride, left, top, cell: meta.cell, row: first, sheetW: sheet.sheetW, sheetH: sheet.sheetH };
  }, [meta, sheet, body, box, frames]);
  const step = geometry ? geometry.stride * geometry.art : 0;
  const slide = useAnimatedStyle(() => {
    const index = gentle ? Math.min(1, Math.floor(clock.value)) * Math.floor(frames / 2) : Math.min(frames - 1, Math.floor(clock.value));
    return { transform: [{ translateX: -index * step }] };
  }, [gentle, frames, step]);
  if (!geometry || !uri || uri.key !== key) return null;
  const size = geometry.cell * geometry.art;
  return (
    <View pointerEvents="none" style={[styles.layer, { left: geometry.left, top: geometry.top, width: size, height: size }]}>
      <View style={styles.clip}>
        <Animated.View
          style={[
            styles.strip,
            {
              left: -geometry.row.x * geometry.art,
              top: -geometry.row.y * geometry.art,
              width: geometry.sheetW * geometry.art,
              height: geometry.sheetH * geometry.art,
            },
            slide,
          ]}>
          <ExpoImage
            source={{ uri: uri.uri }}
            contentFit="fill"
            transition={0}
            cachePolicy="memory"
            style={{ ...styles.fill, ...pixelRenderStyle }}
          />
        </Animated.View>
      </View>
    </View>
  );
}

/** 84px blaze / outlined bubbles on the iso Hideout and Underground (their own small strips). */
export function HideoutAuraStrip({
  styleId,
  layer,
  box,
}: {
  styleId: 'fire' | 'water';
  layer: 'back' | 'front';
  box: number;
}) {
  const motionFlags = usePlayMotion();
  const fxQuality = useFxQuality();
  const gentle = motionFlags.cosmeticsStill || fxQuality !== 'full';
  const which = layer === 'back' ? 'behind' : 'front';
  const sheetKey = SHEET.hideoutFx[styleId === 'fire' ? 'blaze-84' : 'bubbles-outlined'][which];
  const names = Object.keys(PLAY_SHEETS[sheetKey]?.frames ?? {})
    .filter((k) => k.startsWith('frame_'))
    .sort();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (names.length === 0) return;
    const ms = gentle ? GENTLE_HOLD_MS : Math.round(1000 / auraFps());
    const id = setInterval(() => setTick((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [gentle, names.length]);
  if (names.length === 0) return null;
  const frameKey = gentle ? names[(tick % 2) * Math.floor(names.length / 2)] : names[tick % names.length];
  const size = Math.round(box * (styleId === 'fire' ? 84 / 64 : 61 / 64));
  return (
    <View
      pointerEvents="none"
      style={[styles.layer, { left: (box - size) / 2, top: (box - size) / 2, width: size, height: size }]}>
      <ClipImage drawable={{ kind: 'sheet', sheetKey, frameKey: frameKey ?? names[0] }} />
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute' },
  clip: { width: '100%', height: '100%', overflow: 'hidden' },
  strip: { position: 'absolute' },
  fill: { width: '100%', height: '100%' },
});
