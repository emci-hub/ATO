/**
 * Tiny pure-JS PNG reader/writer for the Quests atlas tools (ATO-BUILD PHASE-22, R24:
 * no sharp / pngjs). Reads 8-bit RGBA (colour type 6, not interlaced), which is what
 * every Quests source file is; writes 8-bit RGBA with per-row filter selection.
 */
import { deflateSync, inflateSync } from 'node:zlib';

export interface Img {
  w: number;
  h: number;
  /** RGBA, row-major, w * h * 4 bytes. */
  d: Uint8Array;
}

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

let crcTable: Int32Array | null = null;
function crc32(buf: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

export function newImg(w: number, h: number): Img {
  return { w, h, d: new Uint8Array(w * h * 4) };
}

export function decodePng(buf: Buffer, name = 'png'): Img {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error(`${name}: not a PNG`);
  let p = 8;
  let w = 0;
  let h = 0;
  const idat: Buffer[] = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    if (type === 'IHDR') {
      w = buf.readUInt32BE(p + 8);
      h = buf.readUInt32BE(p + 12);
      const depth = buf[p + 16];
      const ct = buf[p + 17];
      const il = buf[p + 20];
      if (depth !== 8 || ct !== 6 || il !== 0) throw new Error(`${name}: need 8-bit RGBA, not interlaced (got depth ${depth}, type ${ct}, interlace ${il})`);
    } else if (type === 'IDAT') idat.push(buf.subarray(p + 8, p + 8 + len));
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * 4;
  const d = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    const row = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const v = raw[row + x];
      const a = x >= 4 ? d[y * stride + x - 4] : 0;
      const u = y ? d[(y - 1) * stride + x] : 0;
      const c = x >= 4 && y ? d[(y - 1) * stride + x - 4] : 0;
      let r: number;
      switch (ft) {
        case 0:
          r = v;
          break;
        case 1:
          r = v + a;
          break;
        case 2:
          r = v + u;
          break;
        case 3:
          r = v + ((a + u) >> 1);
          break;
        case 4: {
          const pp = a + u - c;
          const pa = Math.abs(pp - a);
          const pb = Math.abs(pp - u);
          const pc = Math.abs(pp - c);
          r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? u : c);
          break;
        }
        default:
          throw new Error(`${name}: bad filter ${ft}`);
      }
      d[y * stride + x] = r & 255;
    }
  }
  return { w, h, d };
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

export function encodePng(img: Img): Buffer {
  const { w, h, d } = img;
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  const cand: Uint8Array[] = [0, 1, 2, 3, 4].map(() => new Uint8Array(stride));
  for (let y = 0; y < h; y++) {
    let best = 0;
    let bestScore = Infinity;
    for (let ft = 0; ft < 5; ft++) {
      const out = cand[ft];
      let score = 0;
      for (let x = 0; x < stride; x++) {
        const v = d[y * stride + x];
        const a = x >= 4 ? d[y * stride + x - 4] : 0;
        const u = y ? d[(y - 1) * stride + x] : 0;
        const c = x >= 4 && y ? d[(y - 1) * stride + x - 4] : 0;
        let pred = 0;
        if (ft === 1) pred = a;
        else if (ft === 2) pred = u;
        else if (ft === 3) pred = (a + u) >> 1;
        else if (ft === 4) {
          const pp = a + u - c;
          const pa = Math.abs(pp - a);
          const pb = Math.abs(pp - u);
          const pc = Math.abs(pp - c);
          pred = pa <= pb && pa <= pc ? a : pb <= pc ? u : c;
        }
        const r = (v - pred) & 255;
        out[x] = r;
        score += r < 128 ? r : 256 - r;
      }
      if (score < bestScore) {
        bestScore = score;
        best = ft;
      }
    }
    raw[y * (stride + 1)] = best;
    raw.set(cand[best], y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([SIG, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/** Copy a rect of `src` into `dst` at (dx, dy). */
export function blit(dst: Img, src: Img, dx: number, dy: number, sx = 0, sy = 0, sw = src.w, sh = src.h): void {
  for (let y = 0; y < sh; y++) {
    const from = ((sy + y) * src.w + sx) * 4;
    dst.d.set(src.d.subarray(from, from + sw * 4), ((dy + y) * dst.w + dx) * 4);
  }
}

export function crop(src: Img, x: number, y: number, w: number, h: number): Img {
  const out = newImg(w, h);
  blit(out, src, 0, 0, x, y, w, h);
  return out;
}

/** Nearest-neighbour scale by a whole factor. */
export function scaleNearest(src: Img, k: number): Img {
  const out = newImg(src.w * k, src.h * k);
  for (let y = 0; y < out.h; y++) {
    for (let x = 0; x < out.w; x++) {
      const s = ((Math.floor(y / k)) * src.w + Math.floor(x / k)) * 4;
      out.d.set(src.d.subarray(s, s + 4), (y * out.w + x) * 4);
    }
  }
  return out;
}

/** Bounding box of pixels with alpha > 0, or null when fully transparent. */
export function alphaBox(img: Img): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = img.w;
  let y0 = img.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      if (img.d[(y * img.w + x) * 4 + 3] > 0) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/** Source-over composite of `src` onto `dst` at (dx, dy). */
export function over(dst: Img, src: Img, dx: number, dy: number): void {
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const tx = dx + x;
      const ty = dy + y;
      if (tx < 0 || ty < 0 || tx >= dst.w || ty >= dst.h) continue;
      const s = (y * src.w + x) * 4;
      const t = (ty * dst.w + tx) * 4;
      const sa = src.d[s + 3] / 255;
      if (sa === 0) continue;
      const da = dst.d[t + 3] / 255;
      const oa = sa + da * (1 - sa);
      for (let c = 0; c < 3; c++) dst.d[t + c] = Math.round((src.d[s + c] * sa + dst.d[t + c] * da * (1 - sa)) / oa);
      dst.d[t + 3] = Math.round(oa * 255);
    }
  }
}
