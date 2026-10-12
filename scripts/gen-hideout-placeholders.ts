/**
 * One-shot placeholder PNGs for Hideout Phase 2 (Loft art not ready).
 * Run: npx tsx scripts/gen-hideout-placeholders.ts
 *
 * Real art drops in by replacing files under assets/play/rooms/ and the
 * catalog in src/play/hideout-art.ts — same map.json schema as hideout-iso.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT = join(__dirname, '..', 'assets', 'play', 'rooms');

function crc32(buf: Buffer): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

function png(w: number, h: number, px: (x: number, y: number) => [number, number, number, number]): Buffer {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y += 1) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x += 1) {
      const [r, g, b, a] = px(x, y);
      const i = y * (w * 4 + 1) + 1 + x * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function fill(c: [number, number, number, number]) {
  return () => c;
}

function inDiamond(x: number, y: number, cx: number, cy: number, hw: number, hh: number): boolean {
  return Math.abs(x - cx) / hw + Math.abs(y - cy) / hh <= 1;
}

function loftShell(night: boolean): Buffer {
  return png(256, 320, (x, y) => {
    // Transparent pad; visible body ~ contentBounds of hideout (15,42,226,237).
    if (x < 12 || x > 244 || y < 36 || y > 286) return [0, 0, 0, 0];
    const wall = night ? [62, 42, 78, 255] : [118, 86, 122, 255];
    const floor = night ? [48, 34, 52, 255] : [92, 64, 78, 255];
    const wood = night ? [92, 58, 48, 255] : [156, 102, 72, 255];
    if (inDiamond(x, y, 128, 228, 92, 46)) {
      const stripe = Math.floor((x + y) / 6) % 2 === 0;
      return stripe ? (floor as [number, number, number, number]) : ([floor[0] + 10, floor[1] + 6, floor[2] + 8, 255] as [number, number, number, number]);
    }
    // Back walls (iso).
    const leftWall = y > 70 + (128 - x) * 0.45 && y < 228 - (128 - x) * 0.42 && x < 128;
    const rightWall = y > 70 + (x - 128) * 0.45 && y < 228 - (x - 128) * 0.42 && x >= 128;
    if (leftWall || rightWall) {
      if (y < 92) return [28, 22, 48, 255]; // ceiling band
      return wall as [number, number, number, number];
    }
    // Watermark dots so it's obviously a placeholder.
    if ((x + y * 3) % 47 === 0 && y > 50 && y < 250) return [255, 80, 180, 180];
    return [0, 0, 0, 0];
    void wood;
  });
}

function loftFront(): Buffer {
  return png(256, 320, (x, y) => {
    // Bed front + lamp table front (depth overlay).
    if (x >= 132 && x <= 196 && y >= 198 && y <= 236 && y > 198 + Math.abs(x - 164) / 3) {
      return [110, 72, 58, 255];
    }
    if (x >= 188 && x <= 228 && y >= 200 && y <= 230) return [70, 52, 44, 220];
    return [0, 0, 0, 0];
  });
}

function rectSprite(w: number, h: number, color: [number, number, number, number], mark: boolean): Buffer {
  return png(w, h, (x, y) => {
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) return [255, 70, 170, 255];
    if (mark && (x + y) % 9 === 0) return [255, 70, 170, 160];
    return color;
  });
}

function windowSprite(night: boolean): Buffer {
  return png(48, 40, (x, y) => {
    if (x < 2 || y < 2 || x > 45 || y > 37) return [48, 32, 40, 255];
    const glow: [number, number, number, number] = night ? [40, 56, 120, 255] : [210, 186, 120, 255];
    const pane: [number, number, number, number] = night ? [24, 32, 72, 255] : [186, 214, 230, 255];
    if (x === 24 || y === 20) return [48, 32, 40, 255];
    return x % 2 === 0 ? glow : pane;
  });
}

function glowOverlay(): Buffer {
  // Baked warm glow — no code spotlight. Soft ellipse, premultiplied-looking.
  return png(256, 320, (x, y) => {
    const dx = (x - 168) / 70;
    const dy = (y - 168) / 58;
    const d = dx * dx + dy * dy;
    if (d > 1) return [0, 0, 0, 0];
    const a = Math.round((1 - d) * (1 - d) * 110);
    return [255, 176, 72, a];
  });
}

function boarded(): Buffer {
  return png(38, 88, (x, y) => {
    if (x < 2 || x > 35) return [42, 32, 28, 255];
    const plank = Math.floor(y / 10) % 2 === 0;
    const col: [number, number, number, number] = plank ? [118, 84, 52, 255] : [96, 68, 44, 255];
    if ((x + y) % 7 === 0) return [64, 44, 32, 255];
    return col;
  });
}

function tarp(): Buffer {
  return png(52, 40, (x, y) => {
    const wave = y + Math.sin(x / 6) * 2;
    if (wave < 4 || wave > 36) return [0, 0, 0, 0];
    return (x + Math.floor(y / 4)) % 5 === 0 ? [36, 92, 64, 255] : [28, 78, 54, 255];
  });
}

function scaffold(): Buffer {
  return png(28, 100, (x, y) => {
    const post = x < 4 || x > 23 || Math.abs(x - (y * 0.12 + 6)) < 2;
    const rung = y % 14 < 3 && x > 2 && x < 25;
    if (!post && !rung) return [0, 0, 0, 0];
    return [168, 132, 72, 255];
  });
}

function sign(): Buffer {
  return png(48, 36, (x, y) => {
    if (x < 1 || y < 1 || x > 46 || y > 34) return [40, 28, 20, 255];
    if (y > 22) return [52, 40, 28, 255]; // progress slot
    return [212, 186, 96, 255];
  });
}

function barIcon(fill: [number, number, number, number]): Buffer {
  return png(28, 28, (x, y) => {
    const d = Math.abs(x - 14) + Math.abs(y - 14);
    if (d > 13) return [0, 0, 0, 0];
    if (d > 11) return [255, 70, 170, 255];
    return fill;
  });
}

function zzzFrame(n: number): Buffer {
  // 3 frames, 24×32. Glyphs rise across frames (drawn higher as n grows).
  return png(24, 32, (x, y) => {
    const glyphs = n + 1;
    for (let i = 0; i < glyphs; i += 1) {
      const gx = 4 + i * 6;
      const gy = 22 - n * 5 - i * 4;
      if (x >= gx && x <= gx + 4 && (y === gy || y === gy + 4 || y === gy + Math.round(((x - gx) * 4) / 4))) {
        return [255, 230, 140, 230];
      }
    }
    return [0, 0, 0, 0];
  });
}

function write(name: string, buf: Buffer) {
  const path = join(ROOT, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buf);
  console.log(`  ${name} ${buf.length}b`);
}

write('loft-iso.png', loftShell(false));
write('loft-iso-front.png', loftFront());
write('loft-window-day.png', windowSprite(false));
write('loft-window-night.png', windowSprite(true));
write('loft-glow.png', glowOverlay());
write('loft-bed.png', rectSprite(64, 28, [128, 82, 64, 255], true));
write('loft-lamp.png', rectSprite(18, 36, [214, 186, 96, 255], false));
write('boarded.png', boarded());
write('tarp.png', tarp());
write('scaffold.png', scaffold());
write('build-sign.png', sign());
write('bar-hideout.png', barIcon([48, 96, 140, 255]));
write('bar-loft.png', barIcon([140, 72, 120, 255]));
write('bar-garage.png', barIcon([96, 88, 64, 255]));
write('bar-rooftop.png', barIcon([72, 64, 120, 255]));
write('bar-marker.png', barIcon([255, 210, 80, 255]));
write('zzz-0.png', zzzFrame(0));
write('zzz-1.png', zzzFrame(1));
write('zzz-2.png', zzzFrame(2));
write('neighbor-boarded.png', loftShell(true));
console.log('hideout placeholders written');
