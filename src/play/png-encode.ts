/**
 * Minimal PNG writer for the small textures the holo draws (band tiles, the
 * sweep band, the glint sheet). Truecolour + alpha, stored (uncompressed)
 * deflate blocks: a few KB each, built once per colour, never shipped as art.
 * Pure and dependency-free (Node checks round-trip it through `decodePng`).
 */
import { crc32 } from '@/play/aura-palette';

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; i++) {
    a = (a + bytes[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function u32(v: number): number[] {
  return [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  out.set(u32(data.length), 0);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  out.set(u32(crc32(out, 4, 8 + data.length)), 8 + data.length);
  return out;
}

/** An 8-bit RGBA image (`rgba.length === w * h * 4`) as PNG bytes. */
export function encodePng(w: number, h: number, rgba: Uint8Array): Uint8Array {
  const stride = w * 4;
  const raw = new Uint8Array(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  const blocks: number[] = [0x78, 0x01];
  const parts: Uint8Array[] = [];
  const MAX = 65535;
  let at = 0;
  const body: number[] = [];
  while (at < raw.length || raw.length === 0) {
    const len = Math.min(MAX, raw.length - at);
    const last = at + len >= raw.length ? 1 : 0;
    body.push(last, len & 255, len >> 8, ~len & 255, (~len >> 8) & 255);
    parts.push(Uint8Array.from(body.splice(0)), raw.subarray(at, at + len));
    at += len;
    if (last) break;
  }
  const idatLen = blocks.length + parts.reduce((sum, p) => sum + p.length, 0) + 4;
  const idat = new Uint8Array(idatLen);
  idat.set(blocks, 0);
  let o = blocks.length;
  for (const p of parts) {
    idat.set(p, o);
    o += p.length;
  }
  idat.set(u32(adler32(raw)), o);
  const ihdr = Uint8Array.from([...u32(w), ...u32(h), 8, 6, 0, 0, 0]);
  const sig = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const pieces = [sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', new Uint8Array(0))];
  const out = new Uint8Array(pieces.reduce((sum, p) => sum + p.length, 0));
  let at2 = 0;
  for (const p of pieces) {
    out.set(p, at2);
    at2 += p.length;
  }
  return out;
}

/**
 * An 8-bit indexed image (`indices.length === w * h`) as PNG bytes. `palette` is
 * [r, g, b, a] per entry; entry alphas become the tRNS chunk. A quarter of the
 * size of the same image as RGBA.
 */
export function encodeIndexedPng(
  w: number,
  h: number,
  indices: Uint8Array,
  palette: readonly (readonly [number, number, number, number])[],
): Uint8Array {
  const raw = new Uint8Array(h * (w + 1));
  for (let y = 0; y < h; y++) raw.set(indices.subarray(y * w, (y + 1) * w), y * (w + 1) + 1);
  const idat = deflateStored(raw);
  const plte = new Uint8Array(palette.length * 3);
  const trns = new Uint8Array(palette.length);
  palette.forEach(([r, g, b, a], i) => {
    plte[i * 3] = r;
    plte[i * 3 + 1] = g;
    plte[i * 3 + 2] = b;
    trns[i] = a;
  });
  const ihdr = Uint8Array.from([...u32(w), ...u32(h), 8, 3, 0, 0, 0]);
  const sig = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const pieces = [sig, chunk('IHDR', ihdr), chunk('PLTE', plte), chunk('tRNS', trns), chunk('IDAT', idat), chunk('IEND', new Uint8Array(0))];
  const out = new Uint8Array(pieces.reduce((sum, p) => sum + p.length, 0));
  let at = 0;
  for (const p of pieces) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** zlib stream of stored (uncompressed) blocks. */
function deflateStored(raw: Uint8Array): Uint8Array {
  const MAX = 65535;
  const blocks = Math.max(1, Math.ceil(raw.length / MAX));
  const out = new Uint8Array(2 + raw.length + blocks * 5 + 4);
  out[0] = 0x78;
  out[1] = 0x01;
  let o = 2;
  for (let b = 0; b < blocks; b++) {
    const from = b * MAX;
    const len = Math.min(MAX, raw.length - from);
    out[o++] = b === blocks - 1 ? 1 : 0;
    out[o++] = len & 255;
    out[o++] = len >> 8;
    out[o++] = ~len & 255;
    out[o++] = (~len >> 8) & 255;
    out.set(raw.subarray(from, from + len), o);
    o += len;
  }
  out.set(u32(adler32(raw)), o);
  return out;
}
