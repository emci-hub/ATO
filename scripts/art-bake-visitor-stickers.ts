/**
 * npm run art:bake-stickers — the daily visitors' stickers (roadmap step 4, emci 2026-10-15).
 *
 * One die-cut sticker per visitor hero, cut from that hero's own front-facing frame
 * (`rotations` → south) in its packed cast atlas: the opaque figure 1:1 (no rescale),
 * a 3 px cream border and a 1 px ink edge, centred on a 128×128 canvas (the 32 px ladder).
 * No PixelLab call and no new drawing: the hero art is the source of truth, so a
 * re-pack of a hero re-bakes its sticker. Output goes to the art library
 * (`assets/art/icons/in-use/stickers/streetwear/<hero>.png`); run `npm run art:sync` after.
 */
import fs from 'node:fs';
import path from 'node:path';

import { PNG } from 'pngjs';

import { VISITOR_STICKER_HEROES } from '../src/play/daily-visitors-roster';

const REPO = path.resolve(__dirname, '..');
const CAST = path.join(REPO, 'assets/play/sheets/cast/heroes');
const OUT = path.join(REPO, 'assets/art/icons/in-use/stickers/streetwear');
const CANVAS = 128;
const BORDER = 3;
const EDGE = 1;
const ALPHA_MIN = 40;
const CREAM: readonly [number, number, number] = [250, 246, 236];
const INK: readonly [number, number, number] = [20, 16, 28];

type Rect = { x: number; y: number; w: number; h: number };

function frontFrame(hero: string): Rect {
  const catalog = JSON.parse(fs.readFileSync(path.join(CAST, hero, 'catalog.json'), 'utf8'));
  const sheets = JSON.parse(fs.readFileSync(path.join(CAST, hero, 'sheets.json'), 'utf8'));
  const rot = catalog.actions?.rotations;
  const frames = rot ? sheets[rot.sheetKey]?.frames : undefined;
  const rect: Rect | undefined = frames?.['south/frame_000'] ?? frames?.south;
  if (!rect) throw new Error(`${hero}: no rotations/south frame in its cast atlas`);
  return rect;
}

function bake(hero: string): { w: number; h: number } {
  const atlas = PNG.sync.read(fs.readFileSync(path.join(CAST, hero, 'atlas.png')));
  const f = frontFrame(hero);
  const alphaAt = (x: number, y: number) => atlas.data[((f.y + y) * atlas.width + f.x + x) * 4 + 3];
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < f.h; y += 1) {
    for (let x = 0; x < f.w; x += 1) {
      if (alphaAt(x, y) > ALPHA_MIN) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    }
  }
  if (x1 < 0) throw new Error(`${hero}: empty front frame`);
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const pad = BORDER + EDGE;
  if (w + 2 * pad > CANVAS || h + 2 * pad > CANVAS) throw new Error(`${hero}: figure ${w}×${h} does not fit ${CANVAS}`);
  const ox = Math.floor((CANVAS - w) / 2);
  const oy = Math.floor((CANVAS - h) / 2);
  const solid = (cx: number, cy: number) => {
    const sx = cx - ox;
    const sy = cy - oy;
    return sx >= 0 && sy >= 0 && sx < w && sy < h && alphaAt(x0 + sx, y0 + sy) > ALPHA_MIN;
  };
  const near = (cx: number, cy: number, r: number) => {
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (dx * dx + dy * dy <= r * r + 1 && solid(cx + dx, cy + dy)) return true;
      }
    }
    return false;
  };
  const out = new PNG({ width: CANVAS, height: CANVAS });
  for (let y = 0; y < CANVAS; y += 1) {
    for (let x = 0; x < CANVAS; x += 1) {
      const j = (y * CANVAS + x) * 4;
      if (solid(x, y)) {
        const i = ((f.y + y0 + y - oy) * atlas.width + f.x + x0 + x - ox) * 4;
        out.data[j] = atlas.data[i];
        out.data[j + 1] = atlas.data[i + 1];
        out.data[j + 2] = atlas.data[i + 2];
        out.data[j + 3] = 255;
        continue;
      }
      const c = near(x, y, BORDER) ? CREAM : near(x, y, BORDER + EDGE) ? INK : null;
      if (!c) continue;
      out.data[j] = c[0];
      out.data[j + 1] = c[1];
      out.data[j + 2] = c[2];
      out.data[j + 3] = 255;
    }
  }
  fs.writeFileSync(path.join(OUT, `${hero}.png`), PNG.sync.write(out));
  return { w, h };
}

fs.mkdirSync(OUT, { recursive: true });
for (const hero of VISITOR_STICKER_HEROES) {
  const { w, h } = bake(hero);
  console.log(`baked ${hero} (${w}×${h} figure)`);
}
