/**
 * Aura recolour by palette swap. The packed aura atlases are indexed PNGs: a
 * transparent entry, a 5-step grey ramp (the main colour), a 5-step green ramp
 * (the second colour) and a dark outline entry. A colourway only rewrites the
 * PLTE chunk — the pixel data is never decoded or re-encoded, so recolouring is
 * a few hundred bytes of work and costs no extra art.
 *
 * Pure and dependency-free (Node checks import it).
 */

export type PaletteRamps = { main: readonly string[]; second: readonly string[] };

const INK: [number, number, number] = [12, 10, 14];
/** Entries darker than this are outline, never recoloured. */
const OUTLINE_LUMA = 28;
/** Max channel spread of a "grey" entry; greens spread far more. */
const GREY_SPREAD = 24;

let crcTable: Uint32Array | null = null;

export function crc32(bytes: Uint8Array, from = 0, to = bytes.length): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = from; i < to; i++) crc = crcTable[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function hexRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export type PaletteEntryRole = 'clear' | 'outline' | 'main' | 'second';

/** What one palette entry is in the greyscale + green code. */
export function paletteEntryRole(r: number, g: number, b: number, alpha: number): { role: PaletteEntryRole; step: number } {
  if (alpha < 128) return { role: 'clear', step: 0 };
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  if (luma < OUTLINE_LUMA) return { role: 'outline', step: 0 };
  const step = Math.max(0, Math.min(4, Math.round(((luma - OUTLINE_LUMA) / 227) * 4)));
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  return { role: spread <= GREY_SPREAD ? 'main' : 'second', step };
}

type Chunk = { type: string; start: number; len: number };

function chunks(bytes: Uint8Array): Chunk[] {
  const out: Chunk[] = [];
  let o = 8;
  while (o + 12 <= bytes.length) {
    const len = ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0;
    const type = String.fromCharCode(bytes[o + 4], bytes[o + 5], bytes[o + 6], bytes[o + 7]);
    out.push({ type, start: o, len });
    o += 12 + len;
    if (type === 'IEND') break;
  }
  return out;
}

/** The palette (RGB) and per-entry alpha of an indexed PNG, or null when it is not one. */
export function readPalette(bytes: Uint8Array): { rgb: [number, number, number][]; alpha: number[] } | null {
  const list = chunks(bytes);
  const ihdr = list.find((c) => c.type === 'IHDR');
  const plte = list.find((c) => c.type === 'PLTE');
  if (!ihdr || !plte || bytes[ihdr.start + 8 + 9] !== 3) return null;
  const count = plte.len / 3;
  const rgb: [number, number, number][] = [];
  for (let i = 0; i < count; i++) {
    const p = plte.start + 8 + i * 3;
    rgb.push([bytes[p], bytes[p + 1], bytes[p + 2]]);
  }
  const alpha = new Array<number>(count).fill(255);
  const trns = list.find((c) => c.type === 'tRNS');
  if (trns) for (let i = 0; i < Math.min(count, trns.len); i++) alpha[i] = bytes[trns.start + 8 + i];
  return { rgb, alpha };
}

/** The palette a colourway paints (the same length as the PNG's own). */
export function recolouredPalette(
  source: { rgb: readonly [number, number, number][]; alpha: readonly number[] },
  ramps: PaletteRamps,
): [number, number, number][] {
  const main = ramps.main.map(hexRgb);
  const second = ramps.second.map(hexRgb);
  return source.rgb.map(([r, g, b], i) => {
    const { role, step } = paletteEntryRole(r, g, b, source.alpha[i] ?? 255);
    if (role === 'outline') return INK;
    if (role === 'main') return main[step] ?? main[main.length - 1];
    if (role === 'second') return second[step] ?? second[second.length - 1];
    return [r, g, b];
  });
}

/** A copy of an indexed PNG with its PLTE chunk rewritten. Pixel data is untouched. */
export function recolourPng(bytes: Uint8Array, ramps: PaletteRamps): Uint8Array {
  const list = chunks(bytes);
  const plte = list.find((c) => c.type === 'PLTE');
  const palette = readPalette(bytes);
  if (!plte || !palette) throw new Error('indexed png');
  const next = recolouredPalette(palette, ramps);
  const out = bytes.slice();
  next.forEach(([r, g, b], i) => {
    const p = plte.start + 8 + i * 3;
    out[p] = r;
    out[p + 1] = g;
    out[p + 2] = b;
  });
  const crc = crc32(out, plte.start + 4, plte.start + 8 + plte.len);
  const c = plte.start + 8 + plte.len;
  out[c] = (crc >>> 24) & 255;
  out[c + 1] = (crc >>> 16) & 255;
  out[c + 2] = (crc >>> 8) & 255;
  out[c + 3] = crc & 255;
  return out;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function base64(bytes: Uint8Array): string {
  const parts: string[] = [];
  const step = 3 * 4096;
  for (let from = 0; from < bytes.length; from += step) {
    let s = '';
    const to = Math.min(bytes.length, from + step);
    for (let i = from; i < to; i += 3) {
      const a = bytes[i];
      const b = i + 1 < to ? bytes[i + 1] : 0;
      const c = i + 2 < to ? bytes[i + 2] : 0;
      s += B64[a >> 2] + B64[((a & 3) << 4) | (b >> 4)];
      s += i + 1 < to ? B64[((b & 15) << 2) | (c >> 6)] : '=';
      s += i + 2 < to ? B64[c & 63] : '=';
    }
    parts.push(s);
  }
  return parts.join('');
}

export function pngDataUri(bytes: Uint8Array): string {
  return `data:image/png;base64,${base64(bytes)}`;
}
