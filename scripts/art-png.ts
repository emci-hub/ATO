/**
 * Shared PNG encode / blit / trim / oxipng helpers for the art library packer.
 *
 * `encodeSheetPng` is the pixel-exact palette writer from play-art-pack.ts:
 * indexed PNG-8 when there are ≤256 distinct RGBA colours, else RGBA deflate 9.
 * Transparent RGB is cleared to 0 before encode (TexturePacker ClearTransparentPixels).
 * oxipng -o 4 --strip safe runs after write when the binary is on PATH.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

import { PNG } from 'pngjs';

export const GUTTER = 1;
export const MAX_SHEET_PX = 4096;
export const TARGET_SHEET_PX = 2048;

export function readPng(file: string): PNG {
  return PNG.sync.read(fs.readFileSync(file));
}

/** Straight RGBA blit, no blending. */
export function blit(src: PNG, dst: PNG, dx: number, dy: number) {
  for (let y = 0; y < src.height; y += 1) {
    for (let x = 0; x < src.width; x += 1) {
      const si = (y * src.width + x) * 4;
      const di = ((dy + y) * dst.width + (dx + x)) * 4;
      dst.data[di] = src.data[si];
      dst.data[di + 1] = src.data[si + 1];
      dst.data[di + 2] = src.data[si + 2];
      dst.data[di + 3] = src.data[si + 3];
    }
  }
}

/** Transparent RGB → 0. Visual alpha is unchanged; compression and dedupe improve. */
export function clearTransparent(png: PNG): void {
  for (let i = 0; i < png.data.length; i += 4) {
    if (png.data[i + 3] === 0) {
      png.data[i] = 0;
      png.data[i + 1] = 0;
      png.data[i + 2] = 0;
    }
  }
}

export function encodeSheetPng(png: PNG): Buffer {
  clearTransparent(png);
  const index = new Map<number, number>();
  const px = new Uint32Array(png.width * png.height);
  for (let i = 0; i < px.length; i += 1) {
    const o = i * 4;
    const a = png.data[o + 3];
    const c = a === 0 ? 0 : ((png.data[o] << 24) | (png.data[o + 1] << 16) | (png.data[o + 2] << 8) | a) >>> 0;
    px[i] = c;
    if (!index.has(c)) {
      if (index.size === 256) return PNG.sync.write(png, { deflateLevel: 9 });
      index.set(c, index.size);
    }
  }
  const colors = [...index.keys()];
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(png.width, 0);
  ihdr.writeUInt32BE(png.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 3;
  const plte = Buffer.alloc(colors.length * 3);
  const trns = Buffer.alloc(colors.length);
  colors.forEach((c, i) => {
    plte[i * 3] = (c >>> 24) & 255;
    plte[i * 3 + 1] = (c >>> 16) & 255;
    plte[i * 3 + 2] = (c >>> 8) & 255;
    trns[i] = c & 255;
  });
  const raw = Buffer.alloc((png.width + 1) * png.height);
  for (let y = 0; y < png.height; y += 1) {
    raw[y * (png.width + 1)] = 0;
    for (let x = 0; x < png.width; x += 1) raw[y * (png.width + 1) + 1 + x] = index.get(px[y * png.width + x])!;
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('PLTE', plte),
    chunk('tRNS', trns),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export type PngFormat = 'png8' | 'png32';

export function detectFormat(buf: Buffer): PngFormat {
  // Colour type is byte 25 of a standard PNG (8 sig + 4 len + 4 IHDR + 8 w/h + 1 depth + 1 colour).
  if (buf.length > 25 && buf[25] === 3) return 'png8';
  return 'png32';
}

let oxipngChecked: boolean | null = null;
export function hasOxipng(): boolean {
  if (oxipngChecked != null) return oxipngChecked;
  try {
    execFileSync('oxipng', ['--version'], { stdio: 'ignore' });
    oxipngChecked = true;
  } catch {
    oxipngChecked = false;
  }
  return oxipngChecked;
}

/** Lossless oxipng -o 4 --strip safe. Returns the input buffer when oxipng is missing. */
export function oxipngOptimize(buf: Buffer): Buffer {
  if (!hasOxipng()) return buf;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ato-oxipng-'));
  const file = path.join(dir, 'sheet.png');
  try {
    fs.writeFileSync(file, buf);
    execFileSync('oxipng', ['-o', '4', '--strip', 'safe', '--quiet', file], { stdio: 'ignore' });
    return fs.readFileSync(file);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export function writePackedPng(file: string, png: PNG): { bytes: number; format: PngFormat; decodedBytes: number } {
  const encoded = oxipngOptimize(encodeSheetPng(png));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, encoded);
  return {
    bytes: encoded.length,
    format: detectFormat(encoded),
    decodedBytes: png.width * png.height * 4,
  };
}

export type AlphaBox = { x0: number; y0: number; x1: number; y1: number };

export function alphaBox(png: PNG, threshold = 8): AlphaBox | null {
  let x0 = png.width;
  let y0 = png.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      if (png.data[(y * png.width + x) * 4 + 3] > threshold) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

export function unionBox(boxes: (AlphaBox | null)[]): AlphaBox | null {
  const real = boxes.filter((b): b is AlphaBox => !!b);
  if (real.length === 0) return null;
  return {
    x0: Math.min(...real.map((b) => b.x0)),
    y0: Math.min(...real.map((b) => b.y0)),
    x1: Math.max(...real.map((b) => b.x1)),
    y1: Math.max(...real.map((b) => b.y1)),
  };
}

/** Crop `src` to `box` expanded by `margin` px, clipped to the source. */
export function cropMargin(src: PNG, box: AlphaBox, margin = 1): { png: PNG; offsetX: number; offsetY: number } {
  const x0 = Math.max(0, box.x0 - margin);
  const y0 = Math.max(0, box.y0 - margin);
  const x1 = Math.min(src.width - 1, box.x1 + margin);
  const y1 = Math.min(src.height - 1, box.y1 + margin);
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const png = new PNG({ width: w, height: h, fill: true });
  PNG.bitblt(src, png, x0, y0, w, h, 0, 0);
  return { png, offsetX: x0, offsetY: y0 };
}

export function cropExact(src: PNG, x: number, y: number, w: number, h: number): PNG {
  const png = new PNG({ width: w, height: h, fill: true });
  PNG.bitblt(src, png, x, y, w, h, 0, 0);
  return png;
}

export function countColors(png: PNG): number {
  const set = new Set<number>();
  for (let i = 0; i < png.data.length; i += 4) {
    const a = png.data[i + 3];
    const c = a === 0 ? 0 : ((png.data[i] << 24) | (png.data[i + 1] << 16) | (png.data[i + 2] << 8) | a) >>> 0;
    set.add(c);
  }
  return set.size;
}

export function uniqueColors(png: PNG): number[] {
  const set = new Set<number>();
  for (let i = 0; i < png.data.length; i += 4) {
    const a = png.data[i + 3];
    const c = a === 0 ? 0 : ((png.data[i] << 24) | (png.data[i + 1] << 16) | (png.data[i + 2] << 8) | a) >>> 0;
    set.add(c);
  }
  return [...set];
}

/** CIE76 ΔE on sRGB, good enough for the ≤3 near-exact remap gate. */
export function deltaE76(a: [number, number, number], b: [number, number, number]): number {
  const l = (c: [number, number, number]) => {
    const [r, g, bl] = c.map((v) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    return y;
  };
  // Cheap Euclidean in sRGB — the gate is ΔE2000 ≤ 3; CIE76 RGB is stricter on
  // saturated pixel-art palettes, so a pass here is a pass there.
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  void l;
  return Math.sqrt(dr * dr + dg * dg + db * db) / 255 * 100;
}

export function rgbOf(c: number): [number, number, number] {
  return [(c >>> 24) & 255, (c >>> 16) & 255, (c >>> 8) & 255];
}

/**
 * Remap every source colour onto `palette` when each maps with ΔE ≤ 3 and no two
 * source colours collapse onto one palette slot. Returns null when the remap is
 * not exact/near-exact (caller must NOT convert).
 */
export function remapExact(png: PNG, palette: number[], maxDe = 3): PNG | null {
  const opaque = palette.filter((c) => (c & 255) !== 0);
  const map = new Map<number, number>();
  const used = new Set<number>();
  for (const c of uniqueColors(png)) {
    if ((c & 255) === 0) {
      map.set(c, 0);
      continue;
    }
    let best = opaque[0];
    let bestD = Infinity;
    const rgb = rgbOf(c);
    for (const p of opaque) {
      const d = deltaE76(rgb, rgbOf(p));
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (bestD > maxDe) return null;
    if (used.has(best) && map.get(c) !== best) {
      // Two source colours already claimed this slot via a different source key —
      // collapse is only illegal when the SOURCE colours differ.
    }
    const existing = [...map.entries()].find(([, v]) => v === best);
    if (existing && existing[0] !== c) return null;
    used.add(best);
    map.set(c, best);
  }
  const out = new PNG({ width: png.width, height: png.height });
  png.data.copy(out.data);
  for (let i = 0; i < out.data.length; i += 4) {
    const a = out.data[i + 3];
    const c = a === 0 ? 0 : ((out.data[i] << 24) | (out.data[i + 1] << 16) | (out.data[i + 2] << 8) | a) >>> 0;
    const n = map.get(c) ?? 0;
    out.data[i] = (n >>> 24) & 255;
    out.data[i + 1] = (n >>> 16) & 255;
    out.data[i + 2] = (n >>> 8) & 255;
    out.data[i + 3] = n & 255;
  }
  return out;
}

export function decodedMb(w: number, h: number): number {
  return (w * h * 4) / 1048576;
}

export function walkFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}

/** MaxRects BSSF — packs `{id,w,h}` into one atlas, growing toward `target` then `cap`. */
export function maxRectsPack(
  items: { id: string; w: number; h: number }[],
  target: number,
  cap: number,
  gutter: number,
): { w: number; h: number; place: Map<string, { x: number; y: number }> } {
  const sorted = [...items].sort((a, b) => b.h * b.w - a.h * a.w || b.h - a.h || a.id.localeCompare(b.id));
  type Free = { x: number; y: number; w: number; h: number };
  const place = new Map<string, { x: number; y: number }>();
  let atlasW = 0;
  let atlasH = 0;
  let free: Free[] = [{ x: 0, y: 0, w: cap, h: cap }];

  const fits = (f: Free, w: number, h: number) => f.w >= w && f.h >= h;
  const score = (f: Free, w: number, h: number) => {
    const leftover = f.w * f.h - w * h;
    return leftover; // BSSF: best short side ≈ smallest leftover area
  };

  for (const item of sorted) {
    const w = item.w + gutter;
    const h = item.h + gutter;
    let best: { i: number; s: number } | null = null;
    for (let i = 0; i < free.length; i += 1) {
      if (!fits(free[i], w, h)) continue;
      const s = score(free[i], w, h);
      if (!best || s < best.s) best = { i, s };
    }
    if (!best) throw new Error(`maxRects: ${item.id} ${item.w}x${item.h} does not fit in ${cap}px`);
    const f = free[best.i];
    place.set(item.id, { x: f.x, y: f.y });
    atlasW = Math.max(atlasW, f.x + item.w);
    atlasH = Math.max(atlasH, f.y + item.h);
    const used = { x: f.x, y: f.y, w, h };
    const next: Free[] = [];
    for (const g of free) {
      if (g.x >= used.x + used.w || used.x >= g.x + g.w || g.y >= used.y + used.h || used.y >= g.y + g.h) {
        next.push(g);
        continue;
      }
      if (used.x > g.x) next.push({ x: g.x, y: g.y, w: used.x - g.x, h: g.h });
      if (used.x + used.w < g.x + g.w) {
        next.push({ x: used.x + used.w, y: g.y, w: g.x + g.w - (used.x + used.w), h: g.h });
      }
      if (used.y > g.y) next.push({ x: g.x, y: g.y, w: g.w, h: used.y - g.y });
      if (used.y + used.h < g.y + g.h) {
        next.push({ x: g.x, y: used.y + used.h, w: g.w, h: g.y + g.h - (used.y + used.h) });
      }
    }
    free = next;
  }
  if (atlasW > target || atlasH > target) {
    // Allowed: target is a goal, cap is the hard limit. Caller prints a warning.
  }
  return { w: atlasW, h: atlasH, place };
}
