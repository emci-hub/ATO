/**
 * Small pixel helpers for the art engine. Build tooling only: nothing under src/ may import this.
 * A pixel is "visible" when alpha > 0 (our art is binary alpha; this keeps every drawn pixel).
 */
import { PNG } from 'pngjs';

import { readPng } from '../art-png';

export { readPng };

export type Point = [number, number];

export function newPng(width: number, height: number): PNG {
  return new PNG({ width, height });
}

export function clonePng(src: PNG): PNG {
  const out = newPng(src.width, src.height);
  src.data.copy(out.data);
  return out;
}

export function alphaAt(png: PNG, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return 0;
  return png.data[(y * png.width + x) * 4 + 3];
}

/** Packed RGBA as an unsigned int, the key for palette and equality checks. */
export function colorAt(png: PNG, x: number, y: number): number {
  const i = (y * png.width + x) * 4;
  return (
    ((png.data[i] << 24) | (png.data[i + 1] << 16) | (png.data[i + 2] << 8) | png.data[i + 3]) >>> 0
  );
}

export function copyPixel(src: PNG, sx: number, sy: number, dst: PNG, dx: number, dy: number): void {
  if (dx < 0 || dy < 0 || dx >= dst.width || dy >= dst.height) return;
  const si = (sy * src.width + sx) * 4;
  const di = (dy * dst.width + dx) * 4;
  dst.data[di] = src.data[si];
  dst.data[di + 1] = src.data[si + 1];
  dst.data[di + 2] = src.data[si + 2];
  dst.data[di + 3] = src.data[si + 3];
}

export type Bounds = { x0: number; y0: number; x1: number; y1: number };

/** Inclusive bounds of visible pixels, or null for an empty frame. */
export function visibleBounds(png: PNG): Bounds | null {
  let x0 = png.width;
  let y0 = png.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      if (alphaAt(png, x, y) > 0) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/** Number of pixels whose RGBA differs between two same-size frames. */
export function changedPixels(a: PNG, b: PNG): number {
  let n = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    const aa = a.data[i + 3];
    const ba = b.data[i + 3];
    if (aa === 0 && ba === 0) continue;
    if (
      aa !== ba ||
      a.data[i] !== b.data[i] ||
      a.data[i + 1] !== b.data[i + 1] ||
      a.data[i + 2] !== b.data[i + 2]
    ) {
      n += 1;
    }
  }
  return n;
}

/** Even-odd point-in-polygon at the pixel centre. */
export function inPolygon(poly: Point[], x: number, y: number): boolean {
  const px = x + 0.5;
  const py = y + 0.5;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Tears: tiny (<= maxSize px, 4-connected) see-through specks fully enclosed by visible pixels.
 * Parts sliding past each other along a diagonal seam leave them. Returns each speck's pixel indices.
 */
export function findTears(png: PNG, maxSize = 3): number[][] {
  const { width, height } = png;
  const seen = new Uint8Array(width * height);
  const tears: number[][] = [];
  for (let start = 0; start < width * height; start += 1) {
    if (seen[start] || alphaAt(png, start % width, Math.floor(start / width)) > 0) continue;
    const stack = [start];
    const comp: number[] = [];
    seen[start] = 1;
    let touchesBorder = false;
    while (stack.length > 0) {
      const p = stack.pop() as number;
      comp.push(p);
      const x = p % width;
      const y = Math.floor(p / width);
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesBorder = true;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const q = ny * width + nx;
        if (!seen[q] && alphaAt(png, nx, ny) === 0) {
          seen[q] = 1;
          stack.push(q);
        }
      }
    }
    if (!touchesBorder && comp.length <= maxSize) tears.push(comp);
  }
  return tears;
}

export function visibleColors(png: PNG, into: Set<number> = new Set()): Set<number> {
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      if (alphaAt(png, x, y) > 0) into.add(colorAt(png, x, y));
    }
  }
  return into;
}
