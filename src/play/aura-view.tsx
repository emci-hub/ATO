/**
 * Aura paint (save v32). Each worn style is generated from the alpha of the
 * sprite frame on screen, then cached. Styles and colours share one distance
 * field per frame. The body sits behind the sprite. Blaze sparks sit in front,
 * off the sprite. Reduce Motion and Effects that are not Full hold frame 0.
 */
import { useEffect, useRef, useState } from 'react';
import { Image, PixelRatio, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { decodePng, type Rgba } from '@/play/aura-png';
import {
  auraFps,
  auraMaskFromAlpha,
  paintAuraMask,
  type AuraFrame,
  type AuraMask,
  type AuraStyle,
  type Rgb,
} from '@/play/auras';
import { useOsReduceMotion } from '@/play/finish-foil';
import { useFxQuality } from '@/play/fx-quality';
import { PLAY_SHEETS } from '@/play/generated-play-sheets';
import { playSheetArt, sheetFrame } from '@/play/sheet-sprite';
import type { ClipDrawable } from '@/play/skin';

const sheets = new Map<string, Promise<Rgba>>();
/** One distance field per sprite frame. A few poses stay; older ones drop. */
const MASK_CAP = 12;
const masks = new Map<string, Promise<AuraMask>>();
/** Painted pixels per frame, style and colour. Cheap next to the field. */
const PAINT_CAP = 64;
type AuraPack = { key: string; w: number; h: number; pad: number; frames: AuraFrame[] };
const painted = new Map<string, AuraPack>();

function remember<V>(map: Map<string, V>, key: string, value: V, cap: number) {
  map.delete(key);
  map.set(key, value);
  while (map.size > cap) {
    const oldest = map.keys().next().value;
    if (oldest === undefined || oldest === key) break;
    map.delete(oldest);
  }
}

function packKey(drawable: { sheetKey: string; frameKey: string }, style: AuraStyle, element: string): string {
  return `${drawable.sheetKey}|${drawable.frameKey}|${style}|${element}`;
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

/** The heavy field for this sprite frame. In-flight builds are shared. */
function maskFor(sheetKey: string, frameKey: string, rect: { x: number; y: number; w: number; h: number }): Promise<AuraMask> {
  const key = `${sheetKey}|${frameKey}`;
  const hit = masks.get(key);
  if (hit) {
    remember(masks, key, hit, MASK_CAP);
    return hit;
  }
  const job = (async () => {
    const rgba = await sheetRgba(sheetKey);
    // Let the sprite frame paint before the distance field runs.
    await Promise.resolve();
    const alpha = cropAlpha(rgba, rect.x, rect.y, rect.w, rect.h);
    return auraMaskFromAlpha(alpha, rect.w, rect.h);
  })();
  remember(masks, key, job, MASK_CAP);
  job.catch(() => {
    if (masks.get(key) === job) masks.delete(key);
  });
  return job;
}

export async function loadAuraFrames(
  drawable: ClipDrawable | undefined,
  style: AuraStyle,
  element: string,
): Promise<AuraPack | null> {
  if (!drawable || drawable.kind !== 'sheet') return null;
  const key = packKey(drawable, style, element);
  const hit = painted.get(key);
  if (hit) {
    remember(painted, key, hit, PAINT_CAP);
    return hit;
  }
  const frame = sheetFrame(drawable.sheetKey, drawable.frameKey);
  const rect = frame?.rect ?? PLAY_SHEETS[drawable.sheetKey]?.frames[drawable.frameKey];
  if (!rect) return null;
  const mask = await maskFor(drawable.sheetKey, drawable.frameKey, rect);
  const again = painted.get(key);
  if (again) {
    remember(painted, key, again, PAINT_CAP);
    return again;
  }
  const built = paintAuraMask(mask, style, element);
  const packed = { key, w: rect.w, h: rect.h, pad: built.pad, frames: built.frames };
  remember(painted, key, packed, PAINT_CAP);
  return packed;
}

function peekPack(drawable: { sheetKey: string; frameKey: string }, style: AuraStyle, element: string): AuraPack | null {
  const key = packKey(drawable, style, element);
  const hit = painted.get(key);
  if (!hit) return null;
  remember(painted, key, hit, PAINT_CAP);
  return hit;
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
  const [pack, setPack] = useState<AuraPack | null>(null);
  const [tick, setTick] = useState(0);
  const frameKey =
    drawable?.kind === 'sheet' ? `${drawable.sheetKey}|${drawable.frameKey}|${styleId}|${element}` : '';
  const drawableRef = useRef(drawable);
  drawableRef.current = drawable;
  useEffect(() => {
    const current = drawableRef.current;
    const want =
      current?.kind === 'sheet' ? `${current.sheetKey}|${current.frameKey}|${styleId}|${element}` : '';
    if (!want) return;
    let live = true;
    // The build always finishes into the cache. A pose change only skips the
    // setState, so a frame we already started is ready when we come back.
    void loadAuraFrames(current, styleId, element)
      .then((next) => {
        if (live && next?.key === want) setPack(next);
      })
      .catch(() => {
        if (live) setPack(null);
      });
    return () => {
      live = false;
    };
  }, [frameKey, styleId, element]);
  useEffect(() => {
    if (frozen) return;
    const id = setInterval(() => setTick((n) => n + 1), Math.round(1000 / auraFps()));
    return () => clearInterval(id);
  }, [frozen, styleId]);
  const peeked = drawable?.kind === 'sheet' ? peekPack(drawable, styleId, element) : null;
  const shown = peeked ?? (pack && pack.key === frameKey ? pack : null);
  if (!shown) return null;
  const frame = shown.frames[frozen ? 0 : tick % shown.frames.length];
  if (!frame) return null;
  const scale = box / shown.w;
  const pad = shown.pad;
  const left = -pad * scale;
  const top = -pad * scale;
  const width = (shown.w + pad * 2) * scale;
  const height = (shown.h + pad * 2) * scale;
  const paths =
    layer === 'back'
      ? pathsOf(frame.pixels, (p) => rgb(p.col ?? [255, 255, 255]))
      : frame.sparks.length
        ? [{ color: '#FFFFFF', d: frame.sparks.map((p) => `M${p.x} ${p.y}h1v1h-1`).join('') }]
        : [];
  if (!paths.length) return null;
  return (
    <View pointerEvents="none" style={[styles.layer, { left, top, width, height }]}>
      <Svg width={width} height={height} viewBox={`${-pad} ${-pad} ${shown.w + pad * 2} ${shown.h + pad * 2}`}>
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
