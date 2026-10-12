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
  swordRamp,
  type AuraFrame,
  type AuraMask,
  type AuraStyle,
  type Rgb,
} from '@/play/auras';
import { usePlayMotion } from '@/play/play-motion';
import { useFxQuality } from '@/play/fx-quality';
import { PLAY_SHEETS } from '@/play/generated-play-sheets';
import { ClipImage, playSheetArt, sheetFrame } from '@/play/sheet-sprite';
import { STREETWEAR_META, type ClipDrawable } from '@/play/skin';

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
  // Cache by image file: Streetwear clips share one atlas per character.
  const id = PLAY_SHEETS[sheetKey]?.sheet ?? sheetKey;
  const hit = sheets.get(id);
  if (hit) return hit;
  const job = (async () => {
    const source = playSheetArt(sheetKey);
    const uri = sheetUri(source);
    if (!uri) throw new Error('sheet');
    const res = await fetch(uri);
    if (!res.ok) throw new Error(`sheet ${res.status}`);
    return decodePng(new Uint8Array(await res.arrayBuffer()));
  })();
  sheets.set(id, job);
  try {
    return await job;
  } catch (err) {
    sheets.delete(id);
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
  const motionFlags = usePlayMotion();
  const fxQuality = useFxQuality();
  const frozen = motionFlags.cosmeticsStill || fxQuality !== 'full';
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

/* ------------------------------------------------ Streetwear sprite aura ---- */
/* With the Streetwear art style on, a worn aura is the packed PixelLab aura
 * (behind the pet + a few particles in front), drawn in greyscale and
 * palette-mapped here to the wearer's colour — so every tint (sword, named,
 * custom #hex) still works. It is scaled to the pet's visible body and stood on
 * its feet. Same fps, same Reduce Motion / Effects rules as the painted aura. */

type SpritePack = { cell: number; frames: { color: string; d: string }[][] };
const spritePacks = new Map<string, Promise<SpritePack>>();
const SPRITE_PACK_CAP = 24;
type BodyBox = { cx: number; feet: number; h: number; fw: number; fh: number };
const bodies = new Map<string, Promise<BodyBox | null>>();

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** 5 stops dark → light from the wearer's colour (same source as the painted aura). */
function auraRamp(element: string): string[] {
  const r = swordRamp(element);
  return [mix(r.tip, [0, 0, 0], 0.4), r.tip, r.mid, r.core, [255, 255, 255] as Rgb].map(rgb);
}

/** Recoloured pixel paths for every frame of one aura layer. */
function spritePack(style: AuraStyle, layer: 'behind' | 'front', element: string): Promise<SpritePack> {
  const key = `${style}|${layer}|${element}`;
  const hit = spritePacks.get(key);
  if (hit) {
    remember(spritePacks, key, hit, SPRITE_PACK_CAP);
    return hit;
  }
  const job = (async () => {
    const sheetKey = `sheets/streetwear/auras/${style}/${layer}`;
    const sheet = PLAY_SHEETS[sheetKey];
    if (!sheet) throw new Error('aura sheet');
    const rgba = await sheetRgba(sheetKey);
    const ramp = auraRamp(element);
    const frames: { color: string; d: string }[][] = [];
    for (const rect of Object.values(sheet.frames)) {
      const groups = new Map<string, string>();
      for (let y = 0; y < rect.h; y++) {
        for (let x = 0; x < rect.w; x++) {
          const o = ((rect.y + y) * rgba.w + rect.x + x) * 4;
          if (rgba.data[o + 3] < 128) continue;
          const L = 0.299 * rgba.data[o] + 0.587 * rgba.data[o + 1] + 0.114 * rgba.data[o + 2];
          const color = L < 28 ? 'rgb(12,10,14)' : ramp[Math.min(4, Math.round(((L - 28) / 227) * 4))];
          groups.set(color, `${groups.get(color) ?? ''}M${x} ${y}h1v1h-1`);
        }
      }
      frames.push([...groups.entries()].map(([color, d]) => ({ color, d })));
    }
    // The frame cell, not the sheet: auras share one atlas.
    return { cell: Object.values(sheet.frames)[0]?.h ?? sheet.sheetH, frames };
  })();
  remember(spritePacks, key, job, SPRITE_PACK_CAP);
  job.catch(() => {
    if (spritePacks.get(key) === job) spritePacks.delete(key);
  });
  return job;
}

/** Where the pet's body sits inside its frame (feet line, centre, height). */
function bodyBox(drawable: { sheetKey: string; frameKey: string }): Promise<BodyBox | null> {
  const key = `${drawable.sheetKey}|${drawable.frameKey}`;
  const hit = bodies.get(key);
  if (hit) return hit;
  const job = (async () => {
    const rect = PLAY_SHEETS[drawable.sheetKey]?.frames[drawable.frameKey];
    if (!rect) return null;
    const alpha = cropAlpha(await sheetRgba(drawable.sheetKey), rect.x, rect.y, rect.w, rect.h);
    let x0 = rect.w, x1 = -1, y0 = rect.h, y1 = -1;
    for (let y = 0; y < rect.h; y++) {
      for (let x = 0; x < rect.w; x++) {
        if (alpha[y * rect.w + x] > 8) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return null;
    return { cx: (x0 + x1 + 1) / 2, feet: y1 + 1, h: y1 - y0 + 1, fw: rect.w, fh: rect.h };
  })();
  remember(bodies, key, job, MASK_CAP * 4);
  return job;
}

export function PetAuraSprite({
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
  layer: 'back' | 'front';
}) {
  const motionFlags = usePlayMotion();
  const fxQuality = useFxQuality();
  const frozen = motionFlags.cosmeticsStill || fxQuality !== 'full';
  const meta = STREETWEAR_META.auras[styleId];
  const which = layer === 'back' ? 'behind' : 'front';
  const [pack, setPack] = useState<SpritePack | null>(null);
  const [body, setBody] = useState<BodyBox | null>(null);
  const [tick, setTick] = useState(0);
  const sheetKey = drawable?.kind === 'sheet' ? drawable.sheetKey : '';
  const frameKey = drawable?.kind === 'sheet' ? drawable.frameKey : '';
  useEffect(() => {
    if (!meta) return;
    let live = true;
    void spritePack(styleId, which, element)
      .then((next) => live && setPack(next))
      .catch(() => live && setPack(null));
    return () => {
      live = false;
    };
  }, [meta, styleId, which, element]);
  useEffect(() => {
    if (!sheetKey) return;
    let live = true;
    void bodyBox({ sheetKey, frameKey })
      .then((next) => live && setBody(next))
      .catch(() => live && setBody(null));
    return () => {
      live = false;
    };
  }, [sheetKey, frameKey]);
  useEffect(() => {
    if (frozen) return;
    const id = setInterval(() => setTick((n) => n + 1), Math.round(1000 / auraFps()));
    return () => clearInterval(id);
  }, [frozen, styleId]);
  if (!meta || !pack || !body || pack.frames.length === 0) return null;
  const paths = pack.frames[frozen ? 0 : tick % pack.frames.length];
  if (!paths?.length) return null;
  const px = box / body.fw; // screen px per pet frame px
  const scale = (body.h * px) / meta.refBodyPx; // aura art px → screen px
  const size = pack.cell * scale;
  const left = body.cx * px - meta.anchorX * size;
  const top = body.feet * (box / body.fh) - meta.anchorY * size;
  return (
    <View pointerEvents="none" style={[styles.layer, { left, top, width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${pack.cell} ${pack.cell}`}>
        {paths.map((path) => (
          <Path key={path.color} d={path.d} fill={path.color} />
        ))}
      </Svg>
    </View>
  );
}

/** 84px blaze / outlined bubbles on the iso Hideout and Underground. */
export function HideoutAuraStrip({
  styleId,
  layer,
  box,
}: {
  styleId: 'blaze' | 'bubbles';
  layer: 'back' | 'front';
  box: number;
}) {
  const motionFlags = usePlayMotion();
  const fxQuality = useFxQuality();
  const frozen = motionFlags.cosmeticsStill || fxQuality !== 'full';
  const which = layer === 'back' ? 'behind' : 'front';
  const name = styleId === 'blaze' ? `blaze-84-${which}` : `bubbles-outlined-${which}`;
  const sheetKey = `sheets/streetwear/hideout-fx/${name}`;
  const frames = Object.keys(PLAY_SHEETS[sheetKey]?.frames ?? {})
    .filter((k) => k.startsWith('frame_'))
    .sort();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (frozen || frames.length === 0) return;
    const id = setInterval(() => setTick((n) => n + 1), Math.round(1000 / auraFps()));
    return () => clearInterval(id);
  }, [frozen, frames.length]);
  if (frames.length === 0) return null;
  const frameKey = frames[frozen ? 0 : tick % frames.length] ?? frames[0];
  const size = Math.round(box * (styleId === 'blaze' ? 84 / 64 : 61 / 64));
  return (
    <View
      pointerEvents="none"
      style={[styles.layer, { left: (box - size) / 2, top: (box - size) / 2, width: size, height: size }]}>
      <ClipImage drawable={{ kind: 'sheet', sheetKey, frameKey }} />
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute' },
});
