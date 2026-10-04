/**
 * Aura paint (save v31). Frames come from the pet frame's alpha, cached.
 * The body sits behind the sprite. Blaze sparks sit in front, off the sprite.
 * Reduce Motion and Effects that are not Full hold frame 0.
 */
import { useEffect, useRef, useState } from 'react';
import { Image, PixelRatio, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { decodePng, type Rgba } from '@/play/aura-png';
import {
  auraFps,
  auraFramesFromAlpha,
  type AuraFrame,
  type AuraStyle,
  type Rgb,
} from '@/play/auras';
import { useOsReduceMotion } from '@/play/finish-foil';
import { useFxQuality } from '@/play/fx-quality';
import { PLAY_SHEETS } from '@/play/generated-play-sheets';
import { playSheetArt, sheetFrame } from '@/play/sheet-sprite';
import type { ClipDrawable } from '@/play/skin';

const sheets = new Map<string, Promise<Rgba>>();
const frames = new Map<string, { w: number; h: number; frames: AuraFrame[] }>();

/** Walk cycles share one mask: the facing's first frame. The aura does not rebuild every step. */
function stillFrame(sheetKey: string, frameKey: string): { frameKey: string; cacheKey: string } {
  const slash = frameKey.lastIndexOf('/');
  const dir = slash >= 0 ? frameKey.slice(0, slash + 1) : '';
  const still = `${dir}frame_000`;
  const use = PLAY_SHEETS[sheetKey]?.frames[still] ? still : frameKey;
  return { frameKey: use, cacheKey: `${sheetKey}|${dir}` };
}

function sheetUri(source: unknown): string | undefined {
  if (typeof Image.resolveAssetSource === 'function') {
    const uri = Image.resolveAssetSource(source as number)?.uri;
    if (uri) return uri;
  }
  if (typeof source === 'string') return source;
  if (source && typeof source === 'object' && 'uri' in source && typeof (source as { uri?: unknown }).uri === 'string') {
    return (source as { uri: string }).uri;
  }
  if (typeof source !== 'number') return undefined;
  // Web's Image has no resolveAssetSource. The sheet was registered on this packager registry.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const registry = require('react-native/Libraries/Image/AssetRegistry') as {
    getAssetByID?: (id: number) => {
      httpServerLocation: string;
      name: string;
      type: string;
      scales: number[];
    };
  };
  const asset = registry.getAssetByID?.(source);
  if (!asset?.scales?.length) return undefined;
  const preferred = PixelRatio.get();
  const scale = asset.scales.reduce((prev, curr) =>
    Math.abs(curr - preferred) < Math.abs(prev - preferred) ? curr : prev,
  );
  const suffix = scale !== 1 ? `@${scale}x` : '';
  return `${asset.httpServerLocation}/${asset.name}${suffix}.${asset.type}`;
}

async function sheetRgba(sheetKey: string): Promise<Rgba> {
  const hit = sheets.get(sheetKey);
  if (hit) return hit;
  const job = (async () => {
    const source = playSheetArt(sheetKey);
    const uri = sheetUri(source);
    if (!uri) throw new Error('sheet');
    const res = await fetch(uri);
    if (!res.ok) throw new Error(`sheet ${res.status}`);
    return decodePng(new Uint8Array(await res.arrayBuffer()));
  })();
  sheets.set(sheetKey, job);
  try {
    return await job;
  } catch (err) {
    sheets.delete(sheetKey);
    throw err;
  }
}

function cropAlpha(rgba: Rgba, x: number, y: number, w: number, h: number): Uint8Array {
  const alpha = new Uint8Array(w * h);
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const sx = x + col;
      const sy = y + row;
      if (sx < 0 || sy < 0 || sx >= rgba.w || sy >= rgba.h) continue;
      alpha[row * w + col] = rgba.data[(sy * rgba.w + sx) * 4 + 3];
    }
  }
  return alpha;
}

export async function loadAuraFrames(
  drawable: ClipDrawable | undefined,
  style: AuraStyle,
  element: string,
): Promise<{ w: number; h: number; frames: AuraFrame[] } | null> {
  if (!drawable || drawable.kind !== 'sheet') return null;
  const still = stillFrame(drawable.sheetKey, drawable.frameKey);
  const frame = sheetFrame(drawable.sheetKey, still.frameKey);
  const rect = frame?.rect ?? PLAY_SHEETS[drawable.sheetKey]?.frames[still.frameKey];
  if (!rect) return null;
  const key = `${still.cacheKey}|${style}|${element}`;
  const hit = frames.get(key);
  if (hit) return hit;
  let rgba: Rgba;
  try {
    rgba = await sheetRgba(drawable.sheetKey);
  } catch (err) {
    throw new Error(`sheet ${drawable.sheetKey}: ${err instanceof Error ? err.message : 'fetch'}`);
  }
  const cached = frames.get(key);
  if (cached) return cached;
  const alpha = cropAlpha(rgba, rect.x, rect.y, rect.w, rect.h);
  const packed = { w: rect.w, h: rect.h, frames: auraFramesFromAlpha(alpha, rect.w, rect.h, style, element) };
  frames.set(key, packed);
  return packed;
}

function rgb(col: Rgb): string {
  return `rgb(${Math.round(col[0])},${Math.round(col[1])},${Math.round(col[2])})`;
}

function pathsOf(pixels: { x: number; y: number; col?: Rgb }[], colorOf: (p: { col?: Rgb }) => string): { color: string; d: string }[] {
  const groups = new Map<string, string>();
  for (const p of pixels) {
    const color = colorOf(p);
    groups.set(color, `${groups.get(color) ?? ''}M${p.x} ${p.y}h1v1h-1`);
  }
  return [...groups.entries()].map(([color, d]) => ({ color, d }));
}

export function PetAura({
  drawable,
  styleId,
  element,
  box,
  layer,
}: {
  drawable?: ClipDrawable;
  styleId: AuraStyle;
  element: string;
  box: number;
  /** `back` is the aura. `front` is the blaze sparks, outside the sprite. */
  layer: 'back' | 'front';
}) {
  const reduceMotion = useOsReduceMotion();
  const fxFull = useFxQuality() === 'full';
  const frozen = reduceMotion || !fxFull;
  const [pack, setPack] = useState<{ w: number; h: number; frames: AuraFrame[] } | null>(null);
  const [tick, setTick] = useState(0);
  const stable =
    drawable?.kind === 'sheet' ? `${stillFrame(drawable.sheetKey, drawable.frameKey).cacheKey}|${styleId}|${element}` : '';
  const drawableRef = useRef(drawable);
  drawableRef.current = drawable;
  useEffect(() => {
    let live = true;
    void loadAuraFrames(drawableRef.current, styleId, element)
      .then((next) => {
        if (live) setPack(next);
      })
      .catch(() => {
        if (live) setPack(null);
      });
    return () => {
      live = false;
    };
  }, [stable, styleId, element]);
  useEffect(() => {
    if (frozen || !pack || pack.frames.length < 2) return;
    const id = setInterval(() => setTick((n) => n + 1), Math.round(1000 / auraFps()));
    return () => clearInterval(id);
  }, [frozen, pack, styleId]);
  if (!pack) return null;
  const frame = pack.frames[frozen ? 0 : tick % pack.frames.length];
  if (!frame) return null;
  const scale = box / pack.w;
  const pad = 16;
  const left = -pad * scale;
  const top = -pad * scale;
  const width = (pack.w + pad * 2) * scale;
  const height = (pack.h + pad * 2) * scale;
  const paths =
    layer === 'back'
      ? pathsOf(frame.pixels, (p) => rgb(p.col ?? [255, 255, 255]))
      : frame.sparks.length
        ? [{ color: '#FFFFFF', d: frame.sparks.map((p) => `M${p.x} ${p.y}h1v1h-1`).join('') }]
        : [];
  if (!paths.length) return null;
  return (
    <View pointerEvents="none" style={[styles.layer, { left, top, width, height }]}>
      <Svg width={width} height={height} viewBox={`${-pad} ${-pad} ${pack.w + pad * 2} ${pack.h + pad * 2}`}>
        {paths.map((path) => (
          <Path key={path.color} d={path.d} fill={path.color} />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute' },
});
