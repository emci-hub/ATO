/**
 * Sprite pixels for the aura and holo views: the packed sheet a pet already
 * draws is decoded once, then one frame's alpha + luma are cropped and cached.
 * Everything the aura needs to stand on the ground point (body box) and the
 * holo needs to stay pixel-true (silhouette, rim, glint spots) comes from here.
 */
import { Image, PixelRatio } from 'react-native';

import { decodePng, type Rgba } from '@/play/aura-png';
import { groundRow } from '@/play/ground-point';
import { PLAY_SHEETS } from '@/play/generated-play-sheets';
import { playSheetArt, sheetFrame } from '@/play/sheet-sprite';
import type { ClipDrawable } from '@/play/skin';

const sheets = new Map<string, Promise<Rgba>>();
/** A few poses stay; older ones drop. */
const FRAME_CAP = 24;
const frames = new Map<string, Promise<FramePixels | null>>();

export type FramePixels = {
  w: number;
  h: number;
  /** 0–255 per pixel. */
  alpha: Uint8Array;
  /** 0–255 per pixel (0.3 R + 0.59 G + 0.11 B). */
  luma: Uint8Array;
};

export type BodyBox = {
  /** Horizontal centre of the opaque pixels, frame px. */
  cx: number;
  /** Feet line: lowest opaque row + 1, frame px. */
  feet: number;
  /** Ground point row (feet line minus the footprint inset), frame px. */
  ground: number;
  /** Visible figure height, frame px. */
  h: number;
  fw: number;
  fh: number;
};

export function remember<V>(map: Map<string, V>, key: string, value: V, cap: number) {
  map.delete(key);
  map.set(key, value);
  while (map.size > cap) {
    const oldest = map.keys().next().value;
    if (oldest === undefined || oldest === key) break;
    map.delete(oldest);
  }
}

/** The bundled asset's URI, on native and on web. */
export function assetUri(source: unknown): string | undefined {
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

/** The raw bytes of a bundled sheet file. */
export async function sheetBytes(sheetKey: string): Promise<Uint8Array> {
  const uri = assetUri(playSheetArt(sheetKey));
  if (!uri) throw new Error('sheet');
  const res = await fetch(uri);
  if (!res.ok) throw new Error(`sheet ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** One decoded sheet file (Streetwear clips share one atlas per character). */
export async function sheetRgba(sheetKey: string): Promise<Rgba> {
  const id = PLAY_SHEETS[sheetKey]?.sheet ?? sheetKey;
  const hit = sheets.get(id);
  if (hit) return hit;
  const job = sheetBytes(sheetKey).then(decodePng);
  sheets.set(id, job);
  try {
    return await job;
  } catch (err) {
    sheets.delete(id);
    throw err;
  }
}

/** Alpha + luma of one sprite frame, cached. Null when the frame is not packed. */
export function framePixels(sheetKey: string, frameKey: string): Promise<FramePixels | null> {
  const key = `${sheetKey}|${frameKey}`;
  const hit = frames.get(key);
  if (hit) {
    remember(frames, key, hit, FRAME_CAP);
    return hit;
  }
  const frame = sheetFrame(sheetKey, frameKey);
  const rect = frame?.rect ?? PLAY_SHEETS[sheetKey]?.frames[frameKey];
  if (!rect) return Promise.resolve(null);
  // Packed frames are trimmed crops of a bigger source cell. Everything downstream (body
  // box, glint spots, rim) works in CELL pixels, so the crop is placed back at its offset.
  const cellW = frame?.sourceW ?? rect.w;
  const cellH = frame?.sourceH ?? rect.h;
  const ox = frame?.offsetX ?? 0;
  const oy = frame?.offsetY ?? 0;
  const job = (async (): Promise<FramePixels> => {
    const rgba = await sheetRgba(sheetKey);
    const alpha = new Uint8Array(cellW * cellH);
    const luma = new Uint8Array(cellW * cellH);
    for (let row = 0; row < rect.h; row++) {
      for (let col = 0; col < rect.w; col++) {
        const sx = rect.x + col;
        const sy = rect.y + row;
        const dx = ox + col;
        const dy = oy + row;
        if (sx < 0 || sy < 0 || sx >= rgba.w || sy >= rgba.h || dx >= cellW || dy >= cellH) continue;
        const o = (sy * rgba.w + sx) * 4;
        const i = dy * cellW + dx;
        alpha[i] = rgba.data[o + 3];
        luma[i] = Math.round(0.3 * rgba.data[o] + 0.59 * rgba.data[o + 1] + 0.11 * rgba.data[o + 2]);
      }
    }
    return { w: cellW, h: cellH, alpha, luma };
  })();
  remember(frames, key, job, FRAME_CAP);
  job.catch(() => {
    if (frames.get(key) === job) frames.delete(key);
  });
  return job;
}

export function framePixelsOf(drawable: ClipDrawable | undefined): Promise<FramePixels | null> {
  if (!drawable || drawable.kind !== 'sheet') return Promise.resolve(null);
  return framePixels(drawable.sheetKey, drawable.frameKey);
}

/** Where the figure stands inside its frame: centre, feet line, ground point, height. */
export function bodyBoxOf(px: FramePixels): BodyBox | null {
  let x0 = px.w;
  let x1 = -1;
  let y0 = px.h;
  let y1 = -1;
  for (let y = 0; y < px.h; y++) {
    for (let x = 0; x < px.w; x++) {
      if (px.alpha[y * px.w + x] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  const h = y1 - y0 + 1;
  const feet = y1 + 1;
  return { cx: (x0 + x1 + 1) / 2, feet, ground: groundRow(feet, h), h, fw: px.w, fh: px.h };
}
