/**
 * PNG alpha for aura dilation. No new image files: the packed sheet the pet
 * already uses is decoded here, then cached by the aura view.
 *
 * Inflate is in-process (zlib wrapper + raw deflate) so a native build does
 * not need a decoder dependency.
 */

const LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEN_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const CL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

class Bits {
  private i = 0;
  private buf = 0;
  private n = 0;
  constructor(private src: Uint8Array) {}
  get(k: number): number {
    while (this.n < k) {
      if (this.i >= this.src.length) return 0;
      this.buf |= this.src[this.i++] << this.n;
      this.n += 8;
    }
    const v = this.buf & ((1 << k) - 1);
    this.buf >>>= k;
    this.n -= k;
    return v;
  }
  align() {
    this.buf = 0;
    this.n = 0;
  }
}

function tree(lengths: Uint16Array): { count: Uint16Array; symbol: Uint16Array } {
  const count = new Uint16Array(16);
  for (let i = 0; i < lengths.length; i++) if (lengths[i]) count[lengths[i]]++;
  const offs = new Uint16Array(16);
  offs[1] = 0;
  for (let len = 1; len < 15; len++) offs[len + 1] = offs[len] + count[len];
  const symbol = new Uint16Array(lengths.length);
  const cursor = offs.slice();
  for (let i = 0; i < lengths.length; i++) {
    const len = lengths[i];
    if (!len) continue;
    symbol[cursor[len]++] = i;
  }
  return { count, symbol };
}

function decode(bits: Bits, tr: { count: Uint16Array; symbol: Uint16Array }): number {
  let code = 0;
  let first = 0;
  let index = 0;
  for (let len = 1; len <= 15; len++) {
    code |= bits.get(1);
    const count = tr.count[len];
    if (code - count < first) return tr.symbol[index + (code - first)];
    index += count;
    first += count;
    first <<= 1;
    code <<= 1;
  }
  return 0;
}

/** Raw deflate (no zlib header). */
export function inflateRaw(src: Uint8Array): Uint8Array {
  const bits = new Bits(src);
  const out: number[] = [];
  let final = 0;
  while (!final) {
    final = bits.get(1);
    const type = bits.get(2);
    if (type === 0) {
      bits.align();
      const len = bits.get(8) | (bits.get(8) << 8);
      bits.get(8);
      bits.get(8);
      for (let i = 0; i < len; i++) out.push(bits.get(8));
      continue;
    }
    let lit: { count: Uint16Array; symbol: Uint16Array };
    let dist: { count: Uint16Array; symbol: Uint16Array };
    if (type === 1) {
      const ll = new Uint16Array(288);
      for (let i = 0; i <= 143; i++) ll[i] = 8;
      for (let i = 144; i <= 255; i++) ll[i] = 9;
      for (let i = 256; i <= 279; i++) ll[i] = 7;
      for (let i = 280; i <= 287; i++) ll[i] = 8;
      lit = tree(ll);
      dist = tree(new Uint16Array(32).fill(5));
    } else if (type === 2) {
      const nlit = bits.get(5) + 257;
      const ndist = bits.get(5) + 1;
      const nlen = bits.get(4) + 4;
      const clen = new Uint16Array(19);
      for (let i = 0; i < nlen; i++) clen[CL_ORDER[i]] = bits.get(3);
      const cl = tree(clen);
      const lengths = new Uint16Array(nlit + ndist);
      let i = 0;
      while (i < lengths.length) {
        const sym = decode(bits, cl);
        if (sym < 16) lengths[i++] = sym;
        else if (sym === 16) {
          const extra = bits.get(2) + 3;
          const prev = lengths[i - 1];
          for (let k = 0; k < extra; k++) lengths[i++] = prev;
        } else if (sym === 17) {
          const extra = bits.get(3) + 3;
          i += extra;
        } else {
          const extra = bits.get(7) + 11;
          i += extra;
        }
      }
      lit = tree(lengths.subarray(0, nlit));
      dist = tree(lengths.subarray(nlit));
    } else {
      break;
    }
    for (;;) {
      const sym = decode(bits, lit);
      if (sym < 256) out.push(sym);
      else if (sym === 256) break;
      else {
        const len = LEN_BASE[sym - 257] + bits.get(LEN_EXTRA[sym - 257]);
        const ds = decode(bits, dist);
        const distance = DIST_BASE[ds] + bits.get(DIST_EXTRA[ds]);
        for (let k = 0; k < len; k++) out.push(out[out.length - distance]);
      }
    }
  }
  return Uint8Array.from(out);
}

/** Zlib wrapper (PNG IDAT). */
export function inflateZlib(src: Uint8Array): Uint8Array {
  return inflateRaw(src.subarray(2, src.length - 4));
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

export type Rgba = { w: number; h: number; data: Uint8Array };

/** Decode an 8-bit non-interlaced PNG to RGBA. */
export function decodePng(bytes: Uint8Array): Rgba {
  const u32 = (o: number) => (bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3];
  let w = 0;
  let h = 0;
  let depth = 8;
  let color = 6;
  const idat: number[] = [];
  let o = 8;
  while (o + 8 <= bytes.length) {
    const len = u32(o);
    const type = String.fromCharCode(bytes[o + 4], bytes[o + 5], bytes[o + 6], bytes[o + 7]);
    const data = bytes.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') {
      w = u32(o + 8);
      h = u32(o + 12);
      depth = bytes[o + 16];
      color = bytes[o + 17];
    } else if (type === 'IDAT') {
      for (let i = 0; i < data.length; i++) idat.push(data[i]);
    } else if (type === 'IEND') break;
    o += 12 + len;
  }
  if (!w || !h || depth !== 8 || (color !== 6 && color !== 2 && color !== 0 && color !== 4)) {
    throw new Error('png');
  }
  const channels = color === 6 ? 4 : color === 2 ? 3 : color === 4 ? 2 : 1;
  const raw = inflateZlib(Uint8Array.from(idat));
  const stride = w * channels;
  const bpp = channels;
  const data = new Uint8Array(w * h * 4);
  let prev = new Uint8Array(stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[p++];
    const row = raw.subarray(p, p + stride);
    p += stride;
    const cur = new Uint8Array(stride);
    for (let i = 0; i < stride; i++) {
      const left = i >= bpp ? cur[i - bpp] : 0;
      const up = prev[i];
      const ul = i >= bpp ? prev[i - bpp] : 0;
      const x = row[i];
      if (filter === 1) cur[i] = (x + left) & 255;
      else if (filter === 2) cur[i] = (x + up) & 255;
      else if (filter === 3) cur[i] = (x + ((left + up) >> 1)) & 255;
      else if (filter === 4) cur[i] = (x + paeth(left, up, ul)) & 255;
      else cur[i] = x;
    }
    prev = cur;
    for (let x = 0; x < w; x++) {
      const s = x * channels;
      const d = (y * w + x) * 4;
      if (channels === 4) {
        data[d] = cur[s];
        data[d + 1] = cur[s + 1];
        data[d + 2] = cur[s + 2];
        data[d + 3] = cur[s + 3];
      } else if (channels === 3) {
        data[d] = cur[s];
        data[d + 1] = cur[s + 1];
        data[d + 2] = cur[s + 2];
        data[d + 3] = 255;
      } else if (channels === 2) {
        data[d] = data[d + 1] = data[d + 2] = cur[s];
        data[d + 3] = cur[s + 1];
      } else {
        data[d] = data[d + 1] = data[d + 2] = cur[s];
        data[d + 3] = 255;
      }
    }
  }
  return { w, h, data };
}
