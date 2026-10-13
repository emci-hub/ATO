/**
 * Hideout room art (option A, 256×576) from PixelLab parts — called by gen-hideout-td.ts.
 *
 * Sources (raw PixelLab output + gen.json, never bundled):
 *   art-src/pixellab/room.hideout.streetwear/<gen>/raw/
 *     kit/            building kit (square_topdown, 32 px, walls 3 tiles): t0 floor, t1 back wall, t4 side cap
 *     floor-variants/ 16 plank tiles (create_tiles_pro styled on the kit floor)
 *     props/          one transparent sprite per prop (create_map_object, low top-down)
 *     states/         lamp-off / arcade-off (create_object_state) — library only for now
 *
 * Layers match the greybox contract (hideout-art.ts / street-room.tsx): back (ceiling, wall,
 * window, rims), floor (tiles + flat things: rug, manhole, bowl, cushion), props (standing props
 * + contact shadows, behind the pet), occluders (the same sprites for props marked occluder, drawn
 * over the pet when it walks behind them), neon A/B (light pools, pulsed by the stage).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { PNG } from 'pngjs';

export const HIDEOUT_ART_SRC = join(__dirname, '..', 'art-src', 'pixellab', 'room.hideout.streetwear');

type Img = { w: number; h: number; px: Buffer };

function load(file: string): Img {
  const png = PNG.sync.read(readFileSync(file));
  return { w: png.width, h: png.height, px: png.data };
}

/** Crop to the opaque bounding box. */
function trim(img: Img): Img {
  let x0 = img.w;
  let y0 = img.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < img.h; y += 1) {
    for (let x = 0; x < img.w; x += 1) {
      if (img.px[(y * img.w + x) * 4 + 3]! > 0) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    }
  }
  return crop(img, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
}

function crop(img: Img, x: number, y: number, w: number, h: number): Img {
  const px = Buffer.alloc(w * h * 4);
  for (let r = 0; r < h; r += 1) img.px.copy(px, r * w * 4, ((y + r) * img.w + x) * 4, ((y + r) * img.w + x + w) * 4);
  return { w, h, px };
}

class Canvas {
  readonly px: Buffer;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.px = Buffer.alloc(w * h * 4);
  }
  /** Source-over blend of one pixel. */
  blend(x: number, y: number, r: number, g: number, b: number, a: number) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || a <= 0) return;
    const i = (y * this.w + x) * 4;
    const sa = a / 255;
    const da = this.px[i + 3]! / 255;
    const oa = sa + da * (1 - sa);
    if (oa <= 0) return;
    for (const [k, c] of [r, g, b].entries()) {
      this.px[i + k] = Math.round((c * sa + this.px[i + k]! * da * (1 - sa)) / oa);
    }
    this.px[i + 3] = Math.round(oa * 255);
  }
  draw(img: Img, x: number, y: number) {
    for (let r = 0; r < img.h; r += 1) {
      for (let c = 0; c < img.w; c += 1) {
        const i = (r * img.w + c) * 4;
        this.blend(x + c, y + r, img.px[i]!, img.px[i + 1]!, img.px[i + 2]!, img.px[i + 3]!);
      }
    }
  }
  rect(x0: number, y0: number, x1: number, y1: number, rgba: readonly [number, number, number, number]) {
    for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) this.blend(x, y, ...rgba);
  }
  /** Soft ellipse (alpha falls off towards the rim). */
  glow(cx: number, cy: number, rx: number, ry: number, rgb: readonly [number, number, number], alpha: number) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y += 1) {
      for (let x = Math.floor(cx - rx); x <= cx + rx; x += 1) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (d < 1) this.blend(x, y, rgb[0], rgb[1], rgb[2], Math.round(alpha * (1 - d) * (1 - d)));
      }
    }
  }
  png(): Buffer {
    const out = new PNG({ width: this.w, height: this.h });
    this.px.copy(out.data);
    return PNG.sync.write(out);
  }
}

/** A placed sprite: bottom-centre on the footprint (art px), the box the map JSON crops. */
export type PlacedSprite = { id: string; rect: [number, number, number, number] };

export type HideoutArtInput = {
  W: number;
  H: number;
  wallBottom: number;
  floorBottom: number;
  cap: number;
  door: readonly [number, number];
  window: { pos: readonly [number, number] } | null;
  /** Standing props: sprite file, footprint px box, occluder? */
  props: readonly { id: string; file: string; foot: { x: number; w: number; bottom: number }; occluder: boolean }[];
  /** Flat floor things: sprite file centred on (cx, cy). */
  flats: readonly { file: string; cx: number; cy: number }[];
  lamp: readonly [number, number] | null;
  screen: readonly [number, number] | null;
};

export type HideoutArtOut = {
  back: Buffer;
  floor: Buffer;
  props: Buffer;
  occluder: Buffer;
  neonA: Buffer;
  neonB: Buffer;
  sprites: PlacedSprite[];
};

function latestGen(): string | null {
  if (!existsSync(HIDEOUT_ART_SRC)) return null;
  const gens = readdirSync(HIDEOUT_ART_SRC).filter((g) => existsSync(join(HIDEOUT_ART_SRC, g, 'raw', 'kit', 't0.png')));
  return gens.length ? join(HIDEOUT_ART_SRC, gens.sort().at(-1)!, 'raw') : null;
}

export function hideoutArtAvailable(): boolean {
  return latestGen() !== null;
}

export function paintHideoutArt(L: HideoutArtInput): HideoutArtOut {
  const raw = latestGen();
  if (!raw) throw new Error('no Hideout PixelLab art under art-src/pixellab/room.hideout.streetwear');
  const kit = (n: string, x: number, y: number, w: number, h: number) => crop(load(join(raw, 'kit', n)), x, y, w, h);
  const plankBase = kit('t0.png', 10, 79, 32, 24);
  const wall = kit('t1.png', 10, 7, 32, 81);
  const side = kit('t4.png', 10, 7, 12, 24);
  const variants = readdirSync(join(raw, 'floor-variants'))
    .sort()
    .map((f) => load(join(raw, 'floor-variants', f)));
  const sprite = (file: string) => trim(load(join(raw, 'props', file)));

  // ---- back: ceiling, brick wall, window, side + near rims, doorway
  const back = new Canvas(L.W, L.H);
  back.rect(0, 0, L.W, L.wallBottom, [27, 22, 38, 255]);
  for (let x = 0; x < L.W; x += wall.w) back.draw(wall, x, L.wallBottom - wall.h);
  if (L.window) back.draw(sprite('window.png'), L.window.pos[0], L.window.pos[1]);
  for (let y = L.wallBottom - 8; y < L.H; y += side.h) {
    back.draw(side, 2, y);
    back.draw(side, L.W - 14, y);
  }
  back.rect(0, L.wallBottom - 8, 2, L.H, [20, 16, 28, 255]);
  back.rect(L.W - 2, L.wallBottom - 8, L.W, L.H, [20, 16, 28, 255]);
  const rim = (c: Canvas) => {
    c.rect(0, L.floorBottom, L.door[0], L.H, [58, 34, 34, 255]);
    c.rect(L.door[1], L.floorBottom, L.W, L.H, [58, 34, 34, 255]);
    c.rect(0, L.floorBottom, L.door[0], L.floorBottom + 3, [92, 52, 44, 255]);
    c.rect(L.door[1], L.floorBottom, L.W, L.floorBottom + 3, [92, 52, 44, 255]);
  };
  rim(back);
  back.rect(L.door[0], L.floorBottom, L.door[1], L.H, [14, 11, 20, 255]);

  // ---- floor: planks (deterministic variant mix, half-tile row offset), dusk shade, flat things
  const floor = new Canvas(L.W, L.H);
  let seed = 1337;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let r = 0, y = L.wallBottom; y < L.floorBottom; r += 1, y += plankBase.h) {
    for (let x = L.cap - (r % 2 ? 16 : 0); x < L.W - L.cap; x += plankBase.w) {
      const tile = rand() < 0.55 ? plankBase : variants[Math.floor(rand() * variants.length)]!;
      floor.draw(tile, x, y);
    }
  }
  // Keep the planks inside the side caps (row offset spills a half tile).
  for (let y = L.wallBottom; y < L.floorBottom; y += 1) {
    for (let x = 0; x < L.cap; x += 1) {
      floor.px.fill(0, (y * L.W + x) * 4, (y * L.W + x) * 4 + 4);
      floor.px.fill(0, (y * L.W + L.W - 1 - x) * 4, (y * L.W + L.W - 1 - x) * 4 + 4);
    }
  }
  // Night tint (drab indigo base; colour comes from the lights), heavier under the back wall.
  for (let y = L.wallBottom; y < L.floorBottom; y += 1) {
    const near = Math.max(0, 1 - (y - L.wallBottom) / 48);
    floor.rect(L.cap, y, L.W - L.cap, y + 1, [22, 14, 40, Math.round(70 + 90 * near)]);
  }
  for (const f of L.flats) {
    const img = sprite(f.file);
    floor.draw(img, Math.round(f.cx - img.w / 2), Math.round(f.cy - img.h / 2));
  }

  // ---- props (behind the pet) + occluders (same sprites, over the pet)
  const props = new Canvas(L.W, L.H);
  const occluder = new Canvas(L.W, L.H);
  const sprites: PlacedSprite[] = [];
  for (const p of [...L.props].sort((a, b) => a.foot.bottom - b.foot.bottom)) {
    const img = sprite(p.file);
    const x = Math.round(p.foot.x + p.foot.w / 2 - img.w / 2);
    const y = p.foot.bottom - img.h;
    props.glow(x + img.w / 2 + 2, p.foot.bottom - 1, img.w / 2 + 2, 4, [8, 4, 16], 150); // contact shadow, down-right
    props.draw(img, x, y);
    if (p.occluder) occluder.draw(img, x, y);
    sprites.push({ id: p.id, rect: [x, y, img.w, img.h] });
  }
  rim(occluder); // the near rim always covers the pet's feet at the bottom wall

  // ---- light pools (neon A/B pulse): warm lamp, cyan screen spill, window sill
  const neon = (k: number) => {
    const c = new Canvas(L.W, L.H);
    if (L.lamp) c.glow(L.lamp[0], L.lamp[1], 70, 44, [255, 180, 90], 70 * k);
    if (L.screen) c.glow(L.screen[0], L.screen[1], 46, 26, [80, 220, 255], 50 * k);
    if (L.window) c.glow(L.window.pos[0] + 26, L.wallBottom + 14, 40, 14, [190, 150, 255], 36 * k);
    return c.png();
  };

  return {
    back: back.png(),
    floor: floor.png(),
    props: props.png(),
    occluder: occluder.png(),
    neonA: neon(1),
    neonB: neon(0.75),
    sprites,
  };
}
