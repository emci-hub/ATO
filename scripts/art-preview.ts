/**
 * Catalog-time preview bake for the art library viewer.
 *
 * Sheets → per-clip+dir horizontal strips (trimmed cells, per-frame ms).
 * Stills → the image, alpha-cropped when it's a sprite on empty canvas.
 * Multi-icon atlases → each sprite cut out (grid shows a mosaic).
 */
import fs from 'node:fs';
import path from 'node:path';

import { PNG } from 'pngjs';

import type { ArtAsset } from '../src/art/registry.types';
import { alphaBox, cropExact, encodeSheetPng, readPng } from './art-png';
import { loadPlaySheets, type LegacySheet } from './art-sheets';

export type PreviewKind = 'clip' | 'still' | 'icons';

export type PreviewFrame = {
  x: number;
  y: number;
  w: number;
  h: number;
  ms: number;
  clip: string;
  dir: string;
};

export type ClipStrip = {
  clip: string;
  dir: string;
  w: number;
  h: number;
  n: number;
  ms: number[];
  strip: string;
};

export type IconSprite = {
  w: number;
  h: number;
  src: string;
};

export type ItemPreview = {
  kind: PreviewKind;
  /** Grid representative (main clip strip, still, or icon mosaic). */
  preview: string;
  pw: number;
  ph: number;
  pn: number;
  pms: number[];
  mainClip: string;
  mainDir: string;
  clips: ClipStrip[];
  icons: IconSprite[];
  /** Small whole-sheet thumb for the raw-sheet toggle. */
  sheet: string;
  bg: 'checker' | 'room';
};

export type BakeOpts = {
  /** Max cell edge for clip strips (nearest-neighbour). */
  cell: number;
  /** Max edge for stills / mosaic / sheet thumb. */
  still: number;
  /** Include every clip+dir strip (portable detail). Local can omit extras. */
  allClips: boolean;
};

const DIR_ALIAS: Record<string, string> = {
  n: 'north',
  ne: 'north-east',
  e: 'east',
  se: 'south-east',
  s: 'south',
  sw: 'south-west',
  w: 'west',
  nw: 'north-west',
};

const DIR_PREF = ['south', 's', 'front', 'south-east', 'se', 'east', 'e', 'west', 'w', 'north', 'n'];

export function titleClip(name: string): string {
  return name
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bEmp\b/i, 'EMP')
    .trim();
}

export function shortDir(dir: string): string {
  const d = dir.toLowerCase();
  const map: Record<string, string> = {
    north: 'N',
    'north-east': 'NE',
    east: 'E',
    'south-east': 'SE',
    south: 'S',
    'south-west': 'SW',
    west: 'W',
    'north-west': 'NW',
    front: 'S',
    none: '',
  };
  return map[d] ?? dir.slice(0, 2).toUpperCase();
}

function canonDir(raw: string): string {
  const k = raw.toLowerCase().replace(/_/g, '-');
  return DIR_ALIAS[k] ?? k;
}

function inferClip(key: string, fallback = 'Idle'): string {
  const head = key.split('/')[0] ?? fallback;
  if (/^idle$/i.test(head)) return 'Idle';
  if (/^walk$/i.test(head)) return 'Walk';
  if (/^attack$/i.test(head)) return 'Attack';
  if (/^skill$/i.test(head)) return 'Skill';
  if (/^hurt$/i.test(head)) return 'Hurt';
  if (/^dash$/i.test(head)) return 'Dash';
  if (/^rotations?$/i.test(head)) return 'rotations';
  return head;
}

function inferDir(key: string, raw?: string): string {
  if (raw) return canonDir(raw);
  const parts = key.split('/');
  if (parts.length >= 2) return canonDir(parts[1]);
  return 'none';
}

function pngUri(png: PNG): string {
  const buf = encodeSheetPng(png);
  return `data:image/png;base64,${buf.toString('base64')}`;
}

function nnFit(src: PNG, max: number): PNG {
  const edge = Math.max(src.width, src.height);
  if (edge <= max) return src;
  const scale = Math.max(1, Math.floor((max * 1000) / edge)) / 1000;
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));
  if (w === src.width && h === src.height) return src;
  const out = new PNG({ width: w, height: h, fill: true });
  for (let y = 0; y < h; y += 1) {
    const sy = Math.min(src.height - 1, Math.floor((y * src.height) / h));
    for (let x = 0; x < w; x += 1) {
      const sx = Math.min(src.width - 1, Math.floor((x * src.width) / w));
      src.data.copy(out.data, (y * w + x) * 4, (sy * src.width + sx) * 4, (sy * src.width + sx) * 4 + 4);
    }
  }
  return out;
}

function nnInteger(src: PNG, scale: number): PNG {
  if (scale <= 1) return src;
  const w = src.width * scale;
  const h = src.height * scale;
  const out = new PNG({ width: w, height: h, fill: true });
  for (let y = 0; y < h; y += 1) {
    const sy = Math.floor(y / scale);
    for (let x = 0; x < w; x += 1) {
      const sx = Math.floor(x / scale);
      src.data.copy(out.data, (y * w + x) * 4, (sy * src.width + sx) * 4, (sy * src.width + sx) * 4 + 4);
    }
  }
  return out;
}

function cropSprite(src: PNG): PNG {
  const box = alphaBox(src, 8);
  if (!box) return src;
  const w = box.x1 - box.x0 + 1;
  const h = box.y1 - box.y0 + 1;
  if (w >= src.width - 1 && h >= src.height - 1) return src;
  const pad = 1;
  const x0 = Math.max(0, box.x0 - pad);
  const y0 = Math.max(0, box.y0 - pad);
  const x1 = Math.min(src.width - 1, box.x1 + pad);
  const y1 = Math.min(src.height - 1, box.y1 + pad);
  return cropExact(src, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
}

function shouldCropStill(src: PNG, cropped: PNG): boolean {
  const area = src.width * src.height;
  const used = cropped.width * cropped.height;
  if (area <= 0) return false;
  // Scene / room: keep the frame. Sprite on empty canvas: crop.
  return used / area < 0.72;
}

type SidecarJson = {
  frames?: Record<
    string,
    {
      frame: { x: number; y: number; w: number; h: number };
      duration?: number;
      dir?: string;
      clip?: string;
    }
  >;
};

function loadSidecar(pngAbs: string): PreviewFrame[] | null {
  const jsonPath = pngAbs.replace(/\.png$/i, '.json');
  if (!fs.existsSync(jsonPath)) return null;
  try {
    const j = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as SidecarJson;
    if (!j.frames || typeof j.frames !== 'object') return null;
    const out: PreviewFrame[] = [];
    for (const [key, f] of Object.entries(j.frames)) {
      if (!f?.frame) continue;
      out.push({
        x: f.frame.x,
        y: f.frame.y,
        w: f.frame.w,
        h: f.frame.h,
        ms: f.duration ?? 100,
        clip: f.clip ?? inferClip(key),
        dir: inferDir(key, f.dir),
      });
    }
    return out.length ? out : null;
  } catch {
    return null;
  }
}

export type LegacyFrameIndex = Map<string, PreviewFrame[]>;

export function buildLegacyIndex(repo: string): LegacyFrameIndex {
  const map: LegacyFrameIndex = new Map();
  const sheets = loadPlaySheets(repo);
  const add = (key: string, frames: PreviewFrame[]) => {
    const prev = map.get(key) ?? [];
    map.set(key, prev.concat(frames));
  };
  for (const [key, entry] of Object.entries(sheets) as [string, LegacySheet][]) {
    const clip = inferClip(key.split('/').pop() ?? key, key.split('/').pop() ?? 'Idle');
    const ms = typeof entry.ms === 'number' ? entry.ms : clip.toLowerCase().includes('idle') ? 150 : 100;
    const frames: PreviewFrame[] = [];
    for (const [fk, r] of Object.entries(entry.frames)) {
      const dirPart = fk.includes('/') ? fk.split('/')[0] : 'none';
      frames.push({
        x: r.x,
        y: r.y,
        w: r.w,
        h: r.h,
        ms,
        clip,
        dir: canonDir(dirPart),
      });
    }
    add(entry.sheet, frames);
    add(entry.sheet.replace(/^art\//, 'assets/art/'), frames);
    if (entry.sheet.startsWith('art/')) add(`assets/${entry.sheet}`, frames);
  }
  return map;
}

function matchLegacy(assetPath: string, index: LegacyFrameIndex): PreviewFrame[] | null {
  const posix = assetPath.split(path.sep).join('/');
  const direct = index.get(posix) ?? index.get(posix.replace(/^assets\//, ''));
  if (direct?.length) return direct;
  const segs = posix.split('/');
  const file = segs[segs.length - 1] ?? '';
  const theme = segs.includes('cast') ? 'cast' : segs.includes('streetwear') ? 'streetwear' : '';
  if (!theme || !file) return null;
  const skip = new Set(['assets', 'art', 'heroes', 'enemies-bosses', 'unused', 'in-use', 'cast', 'streetwear', theme]);
  const slug = [...segs].reverse().find((s) => s !== file && !skip.has(s));
  if (!slug) return null;
  for (const group of ['heroes', 'boss', 'creeps', 'towers']) {
    const hit = index.get(`sheets/${theme}/${group}/${slug}/${file}`);
    if (hit?.length) return hit;
  }
  return null;
}

function groupClips(frames: PreviewFrame[]): Map<string, Map<string, PreviewFrame[]>> {
  const clips = new Map<string, Map<string, PreviewFrame[]>>();
  for (const f of frames) {
    const dirs = clips.get(f.clip) ?? new Map<string, PreviewFrame[]>();
    const list = dirs.get(f.dir) ?? [];
    list.push(f);
    dirs.set(f.dir, list);
    clips.set(f.clip, dirs);
  }
  return clips;
}

function isIdle(name: string): boolean {
  return /idle/i.test(name) && !/death|dead/i.test(name);
}

function isWalk(name: string): boolean {
  return /walk|run/i.test(name);
}

export function pickMain(frames: PreviewFrame[], category: string, type: string): { clip: string; dir: string } | null {
  if (!frames.length) return null;
  const clips = [...new Set(frames.map((f) => f.clip))];
  const hero = category === 'heroes' || type === 'character' || type === 'pet' || type === 'npc';
  const idle = clips.find(isIdle);
  const walk = clips.find(isWalk);
  const clip = idle ?? (hero ? walk : null) ?? clips.find((c) => !/^rotations?$/i.test(c)) ?? clips[0];
  const dirs = [...new Set(frames.filter((f) => f.clip === clip).map((f) => f.dir))];
  const dir = DIR_PREF.map((d) => dirs.find((x) => x === d || x === canonDir(d))).find((x): x is string => !!x) ?? dirs[0];
  return { clip, dir };
}

function blitCell(src: PNG, dst: PNG, dx: number, dy: number) {
  for (let y = 0; y < src.height; y += 1) {
    const di = ((dy + y) * dst.width + dx) * 4;
    const si = y * src.width * 4;
    src.data.copy(dst.data, di, si, si + src.width * 4);
  }
}

function bakeStrip(sheet: PNG, frames: PreviewFrame[], maxCell: number): ClipStrip | null {
  if (!frames.length) return null;
  const cells: PNG[] = [];
  const ms: number[] = [];
  for (const f of frames.slice(0, 16)) {
    const x = Math.max(0, Math.min(sheet.width - 1, f.x));
    const y = Math.max(0, Math.min(sheet.height - 1, f.y));
    const w = Math.max(1, Math.min(sheet.width - x, f.w));
    const h = Math.max(1, Math.min(sheet.height - y, f.h));
    cells.push(cropSprite(cropExact(sheet, x, y, w, h)));
    ms.push(f.ms || 100);
  }
  let fw = Math.max(1, ...cells.map((c) => c.width));
  let fh = Math.max(1, ...cells.map((c) => c.height));
  let scale = 1;
  const edge = Math.max(fw, fh);
  if (edge > maxCell) {
    scale = Math.max(1, Math.floor(maxCell / edge));
    if (scale === 1 && edge > maxCell) {
      const fitted: PNG[] = cells.map((c) => nnFit(c, maxCell));
      cells.length = 0;
      cells.push(...fitted);
      fw = Math.max(1, ...cells.map((c) => c.width));
      fh = Math.max(1, ...cells.map((c) => c.height));
      scale = 1;
    }
  }
  if (scale > 1) {
    fw *= scale;
    fh *= scale;
  }
  const strip = new PNG({ width: fw * cells.length, height: fh, fill: true });
  cells.forEach((cell, i) => {
    const drawn = scale > 1 ? nnInteger(cell, scale) : cell;
    const ox = i * fw + Math.floor((fw - drawn.width) / 2);
    const oy = fh - drawn.height;
    blitCell(drawn, strip, ox, Math.max(0, oy));
  });
  return {
    clip: frames[0].clip,
    dir: frames[0].dir,
    w: fw,
    h: fh,
    n: cells.length,
    ms,
    strip: pngUri(strip),
  };
}

function extractSprites(png: PNG): { x: number; y: number; w: number; h: number }[] {
  const w = png.width;
  const h = png.height;
  const seen = new Uint8Array(w * h);
  const boxes: { x: number; y: number; w: number; h: number }[] = [];
  const stack: number[] = [];
  const alpha = (i: number) => png.data[i * 4 + 3] > 8;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const start = y * w + x;
      if (seen[start] || !alpha(start)) continue;
      let x0 = x;
      let y0 = y;
      let x1 = x;
      let y1 = y;
      let area = 0;
      stack.push(start);
      seen[start] = 1;
      while (stack.length) {
        const i = stack.pop()!;
        area += 1;
        const cx = i % w;
        const cy = (i - cx) / w;
        if (cx < x0) x0 = cx;
        if (cy < y0) y0 = cy;
        if (cx > x1) x1 = cx;
        if (cy > y1) y1 = cy;
        if (cx > 0 && !seen[i - 1] && alpha(i - 1)) {
          seen[i - 1] = 1;
          stack.push(i - 1);
        }
        if (cx + 1 < w && !seen[i + 1] && alpha(i + 1)) {
          seen[i + 1] = 1;
          stack.push(i + 1);
        }
        if (cy > 0 && !seen[i - w] && alpha(i - w)) {
          seen[i - w] = 1;
          stack.push(i - w);
        }
        if (cy + 1 < h && !seen[i + w] && alpha(i + w)) {
          seen[i + w] = 1;
          stack.push(i + w);
        }
      }
      const bw = x1 - x0 + 1;
      const bh = y1 - y0 + 1;
      if (area < 16 || bw < 3 || bh < 3) continue;
      boxes.push({ x: x0, y: y0, w: bw, h: bh });
    }
  }
  return boxes.sort((a, b) => a.y - b.y || a.x - b.x);
}

function looksLikeAtlas(rel: string, type: string, boxes: { w: number; h: number }[], src: PNG): boolean {
  if (boxes.length < 4) return false;
  if (/atlas|pieces/i.test(rel)) return true;
  if (type === 'icon' || type === 'ui') return boxes.length >= 6;
  const cover = boxes.reduce((s, b) => s + b.w * b.h, 0) / Math.max(1, src.width * src.height);
  return boxes.length >= 8 && cover < 0.85;
}

function bakeMosaic(sprites: PNG[], max: number): PNG {
  const n = sprites.length;
  const cols = Math.min(6, Math.max(2, Math.ceil(Math.sqrt(n))));
  const rows = Math.ceil(n / cols);
  const cell = Math.max(8, Math.floor(max / cols));
  const mosaic = new PNG({ width: cols * cell, height: rows * cell, fill: true });
  sprites.forEach((sp, i) => {
    const fitted = nnFit(sp, cell - 2);
    const col = i % cols;
    const row = Math.floor(i / cols);
    const ox = col * cell + Math.floor((cell - fitted.width) / 2);
    const oy = row * cell + Math.floor((cell - fitted.height) / 2);
    blitCell(fitted, mosaic, ox, oy);
  });
  return mosaic;
}

function roomTone(category: string): 'checker' | 'room' {
  return category === 'rooms' || category === 'backgrounds' || category === 'props' || category === 'tiles'
    ? 'room'
    : 'checker';
}

const pngCache = new Map<string, PNG>();

function sheetPng(abs: string): PNG | null {
  const hit = pngCache.get(abs);
  if (hit) return hit;
  if (!fs.existsSync(abs) || !abs.toLowerCase().endsWith('.png')) return null;
  try {
    const png = readPng(abs);
    pngCache.set(abs, png);
    return png;
  } catch {
    return null;
  }
}

export function clearPreviewCache() {
  pngCache.clear();
}

export function bakePreview(
  repo: string,
  asset: ArtAsset,
  legacy: LegacyFrameIndex,
  opts: BakeOpts,
): ItemPreview | null {
  const abs = path.join(repo, asset.path);
  const png = sheetPng(abs);
  if (!png) return null;
  const bg = roomTone(asset.category);
  const sheet = pngUri(nnFit(png, Math.min(96, opts.still)));
  const frames = loadSidecar(abs) ?? matchLegacy(asset.path, legacy);

  if (frames?.length) {
    const grouped = groupClips(frames);
    const main = pickMain(frames, asset.category, asset.type);
    const clips: ClipStrip[] = [];
    for (const [clip, dirs] of grouped) {
      for (const [dir, list] of dirs) {
        const want = opts.allClips || (main && clip === main.clip && dir === main.dir);
        if (!want) continue;
        const baked = bakeStrip(png, list, opts.cell);
        if (baked) clips.push(baked);
      }
    }
    const chosen =
      (main && clips.find((c) => c.clip === main.clip && c.dir === main.dir)) ??
      clips.find((c) => c.n > 1) ??
      clips[0];
    if (!chosen) return null;
    return {
      kind: 'clip',
      preview: chosen.strip,
      pw: chosen.w,
      ph: chosen.h,
      pn: chosen.n,
      pms: chosen.ms,
      mainClip: chosen.clip,
      mainDir: chosen.dir,
      clips,
      icons: [],
      sheet,
      bg,
    };
  }

  const atlasName = /atlas|pieces/i.test(asset.path) || asset.type === 'icon' && (png.width > 180 || png.height > 180);
  if (atlasName || (png.width * png.height > 80_000 && (asset.type === 'ui' || asset.type === 'background'))) {
    const boxes = extractSprites(png);
    if (looksLikeAtlas(asset.path, asset.type, boxes, png)) {
      const sprites = boxes.slice(0, 48).map((b) => cropSprite(cropExact(png, b.x, b.y, b.w, b.h)));
      const icons: IconSprite[] = sprites.map((sp) => {
        const fitted = nnFit(sp, Math.min(64, opts.still));
        return { w: fitted.width, h: fitted.height, src: pngUri(fitted) };
      });
      const mosaic = bakeMosaic(sprites, opts.still);
      return {
        kind: 'icons',
        preview: pngUri(mosaic),
        pw: mosaic.width,
        ph: mosaic.height,
        pn: 1,
        pms: [100],
        mainClip: '',
        mainDir: '',
        clips: [],
        icons,
        sheet,
        bg,
      };
    }
  }

  const cropped = cropSprite(png);
  const still = nnFit(shouldCropStill(png, cropped) ? cropped : png, opts.still);
  return {
    kind: 'still',
    preview: pngUri(still),
    pw: still.width,
    ph: still.height,
    pn: 1,
    pms: [100],
    mainClip: '',
    mainDir: '',
    clips: [],
    icons: [],
    sheet,
    bg,
  };
}
