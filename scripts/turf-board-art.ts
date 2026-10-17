/**
 * Turf War board art (step T3, emci picked option D 2026-10-17) from PixelLab parts — called by
 * art-pack.ts `packSwBoards` for the default `ato` board. Same 16×16 grid, path and pads as
 * board-data.ts; only the paint changes.
 *
 * Sources (raw PixelLab output + gen.json, never bundled):
 *   art-src/pixellab/board.streetwear/<gen>/raw/
 *     tileset/        alley asphalt → old concrete slabs, Wang 32 px, pro, rounded wobbly kerb (create_topdown_tileset)
 *     road-variants/  16 asphalt tiles styled on the tileset's road tile (create_tiles_pro)
 *     walk-variants/  16 slab tiles styled on the tileset's sidewalk tile (create_tiles_pro)
 *     decals/         flat road marks (create_map_object, high top-down)
 *     props/          low street props at board scale (create_map_object, low top-down)
 *   Pads reuse the library's pad-manhole-ring (streetwear-pack).
 *   Everything is palette-locked to docs/art/palette-streetwear-night.png (reduce_colors).
 *
 * Layers:
 *   board — ground (dual grid, variant mix) · faint worn centre dashes · road marks · neon light pools ·
 *           pads + contact shadows · props + contact shadows · edge vignette
 *   glow  — the neon light pools alone on transparent (T4 flickers them as crops on the ambient layer)
 *   fire  — the barrel firelight alone on transparent (T4: a fast irregular flicker)
 * T4 (2026-10-17): the barrel prop is now FLAMELESS (open drum, embers) — the flame, smoke, cone lamp, vent steam and
 * pigeons are animated on the ambient layer (src/play/turf-ambient.tsx). A vent grate is baked into the sidewalk.
 * `ambient` returns where every loop sits (art px) — art-pack.ts writes it to meta.boards.ato.ambient.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { PNG } from 'pngjs';

import { TILE, type BoardMap } from '../src/play/board-data';
import { padTapRadiusUnits } from '../src/play/turf-layout';
import { SMOKE_CLIP, SMOKE_LIFT } from '../src/play/turf-ambient-layout';

export const TURF_BOARD_ART_SRC = join(__dirname, '..', 'art-src', 'pixellab', 'board.streetwear');
const PAD_ART = join(__dirname, '..', 'art-src', 'pixellab', 'streetwear-pack', 'migrated', 'raw', 'props', 'pad-manhole-ring.png');

const N = 16;
const CELL = 32;
const SIZE = N * CELL;
const UNIT = SIZE / 100; // board units → art px
/** Board phones (pt) the props must keep clear of the pad hit circle on (turf-layout: 414 on 430, 359 on SE). */
const BOARD_PT = [414, 359] as const;
/** Grown hero as the board draws it (unit.avatar 21.01 units of a 192 canvas, figure 109 px) — the scale reference. */
export const BOARD_HERO_PX = 62;
/** Props taller than this would hide a creep standing behind them; none may be placed. */
const PROP_MAX_H = Math.round(BOARD_HERO_PX * 0.8);
/** Props are drawn at their native PixelLab size (made at the real-size box, guide §2: real m ÷ 1.75 × hero). */
const PROP_ORDER = ['barrel', 'tire-stack', 'traffic-cone'];
/** At most this many props, ≥ 4 cells apart, and this many px beyond a pad hit circle (none reads as a tower spot). */
const PROP_MAX = 8;
const PAD_GAP = 6;
/** Pigeons: at most this many, at least this far apart (art px). */
const PIGEON_MAX = 4;
const PIGEON_APART = 120;
/** Row of the barrel's open top (ellipse centre) inside the trimmed barrel sprite: the flame base. */
const BARREL_OPENING_Y = 7;
/** Variant mix: share of plain base tiles; variants further than this luma gap from the base are skipped. */
const BASE_SHARE = 0.55;
const MAX_LUMA_GAP = 0.22;
/** Road variants left out: the palette lock turned the damp stains into flat teal blocks (r03, r08, r11) and the
 * lighter tiles brown-pink (r05, r13). */
const ROAD_SKIP = ['r03.png', 'r05.png', 'r08.png', 'r11.png', 'r13.png'];

type Img = PNG;

function load(file: string): Img {
  return PNG.sync.read(readFileSync(file));
}

function crop(img: Img, x: number, y: number, w: number, h: number): Img {
  const out = new PNG({ width: w, height: h });
  PNG.bitblt(img, out, x, y, w, h, 0, 0);
  return out;
}

/** Crop to the opaque bounding box. */
function trim(img: Img): Img {
  let x0 = img.width;
  let y0 = img.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < img.height; y += 1) {
    for (let x = 0; x < img.width; x += 1) {
      if (img.data[(y * img.width + x) * 4 + 3]! > 8) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    }
  }
  return crop(img, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
}

function luma(img: Img): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3]! === 0) continue;
    sum += 0.299 * img.data[i]! + 0.587 * img.data[i + 1]! + 0.114 * img.data[i + 2]!;
    n += 1;
  }
  return n ? sum / n : 0;
}

class Canvas {
  readonly png: PNG;
  constructor(opaque: boolean) {
    this.png = new PNG({ width: SIZE, height: SIZE });
    if (opaque) for (let i = 3; i < this.png.data.length; i += 4) this.png.data[i] = 255;
  }
  blend(x: number, y: number, r: number, g: number, b: number, a: number) {
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE || a <= 0) return;
    const d = this.png.data;
    const i = (y * SIZE + x) * 4;
    const sa = a / 255;
    const da = d[i + 3]! / 255;
    const oa = sa + da * (1 - sa);
    for (const [k, c] of [r, g, b].entries()) d[i + k] = Math.round((c * sa + d[i + k]! * da * (1 - sa)) / oa);
    d[i + 3] = Math.round(oa * 255);
  }
  draw(img: Img, x: number, y: number, alpha = 1) {
    for (let r = 0; r < img.height; r += 1) {
      for (let c = 0; c < img.width; c += 1) {
        const i = (r * img.width + c) * 4;
        this.blend(x + c, y + r, img.data[i]!, img.data[i + 1]!, img.data[i + 2]!, img.data[i + 3]! * alpha);
      }
    }
  }
  /** Soft ellipse (alpha falls off towards the rim). */
  glow(cx: number, cy: number, rx: number, ry: number, rgb: readonly [number, number, number], alpha: number) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y += 1) {
      for (let x = Math.floor(cx - rx); x <= cx + rx; x += 1) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (d < 1) this.blend(x, y, rgb[0], rgb[1], rgb[2], Math.round(alpha * (1 - d)));
      }
    }
  }
}

function latestGen(): string | null {
  if (!existsSync(TURF_BOARD_ART_SRC)) return null;
  const gens = readdirSync(TURF_BOARD_ART_SRC).filter((g) => existsSync(join(TURF_BOARD_ART_SRC, g, 'raw', 'tileset', 'tileset.png')));
  return gens.length ? join(TURF_BOARD_ART_SRC, gens.sort().at(-1)!, 'raw') : null;
}

export function turfBoardArtAvailable(): boolean {
  return latestGen() !== null;
}

/** Raw ambient clips (PixelLab vfx exports + the pigeon still), palette-locked: flame / smoke / steam .png + .json, pigeon.png. */
export function turfAmbientSrc(): string | null {
  const raw = latestGen();
  return raw && existsSync(join(raw, 'ambient')) ? join(raw, 'ambient') : null;
}

/** Neon light pools [cx, cy, r, rgb, alpha] in art px. On the board they sit under the pads; the glow layer is cleared over pads. */
const POOLS: readonly (readonly [number, number, number, readonly [number, number, number], number])[] = [
  [40, 470, 60, [255, 60, 200], 40],
  [470, 40, 60, [40, 220, 255], 40],
  [250, 250, 70, [255, 170, 80], 26],
  [480, 300, 50, [40, 220, 255], 30],
  [130, 130, 50, [255, 60, 200], 30],
];

/** Where each ambient loop sits, art px (512 board). Sprites are placed by their own anchors in turf-ambient.tsx. */
export type TurfAmbientSites = {
  /** Flame base = the barrel's open top; smoke starts just above it. */
  barrels: { x: number; y: number; smoke: boolean }[];
  /** Cone lamp. */
  cones: { x: number; y: number }[];
  /** Steam base on the vent grate (null when no free sidewalk cell was found). */
  vent: { x: number; y: number } | null;
  /** Pigeon feet. */
  pigeons: { x: number; y: number }[];
  /** Neon pools: crop rects of the glow layer, art px. */
  pools: { x: number; y: number; w: number; h: number }[];
  /** Barrel firelight: crop rects of the fire layer. */
  fires: { x: number; y: number; w: number; h: number }[];
};

export type TurfBoardArt = {
  board: PNG;
  glow: PNG;
  fire: PNG;
  ambient: TurfAmbientSites;
  pads: number;
  /** Placed props, art px boxes (the painter keeps them off road cells and every pad hit circle). */
  props: { id: string; rect: [number, number, number, number] }[];
};

export function paintTurfBoard(map: BoardMap): TurfBoardArt {
  const raw = latestGen();
  if (!raw) throw new Error('no Turf War board art under art-src/pixellab/board.streetwear');
  const isRoad = (cx: number, cy: number) => {
    const v = map.grid[Math.max(0, Math.min(N - 1, cy))]![Math.max(0, Math.min(N - 1, cx))];
    return v === TILE.PATH || v === TILE.START;
  };
  let seed = 20261017;
  const rand = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  // ---- ground: Wang tiles on a dual grid; all-road / all-walk corners take a variant mix
  const sheet = load(join(raw, 'tileset', 'tileset.png'));
  const meta = JSON.parse(readFileSync(join(raw, 'tileset', 'tileset.json'), 'utf8')) as {
    tileset_data: { tiles: { corners: Record<'NE' | 'NW' | 'SE' | 'SW', 'lower' | 'upper'>; bounding_box: { x: number; y: number; width: number; height: number } }[] };
  };
  const tileFor = new Map<string, Img>();
  for (const t of meta.tileset_data.tiles) {
    const key = `${t.corners.NW}${t.corners.NE}${t.corners.SW}${t.corners.SE}`;
    const b = t.bounding_box;
    if (!tileFor.has(key)) tileFor.set(key, crop(sheet, b.x, b.y, b.width, b.height));
  }
  const variants = (dir: string, base: Img, skip: readonly string[] = []) => {
    const baseL = luma(base);
    return readdirSync(join(raw, dir))
      .sort()
      .filter((f) => !skip.includes(f))
      .map((f) => load(join(raw, dir, f)))
      .filter((v) => Math.abs(luma(v) - baseL) / Math.max(1, baseL) <= MAX_LUMA_GAP);
  };
  const roadBase = tileFor.get('lowerlowerlowerlower')!;
  const walkBase = tileFor.get('upperupperupperupper')!;
  const roadVar = variants('road-variants', roadBase, ROAD_SKIP);
  const walkVar = variants('walk-variants', walkBase);
  const pick = (base: Img, vars: Img[]) => (rand() < BASE_SHARE || !vars.length ? base : vars[Math.floor(rand() * vars.length)]!);

  const board = new Canvas(true);
  for (let vy = 0; vy <= N; vy += 1) {
    for (let vx = 0; vx <= N; vx += 1) {
      const lu = (x: number, y: number) => (isRoad(x, y) ? 'lower' : 'upper');
      const key = `${lu(vx - 1, vy - 1)}${lu(vx, vy - 1)}${lu(vx - 1, vy)}${lu(vx, vy)}`;
      const tile = key === 'lowerlowerlowerlower' ? pick(roadBase, roadVar) : key === 'upperupperupperupper' ? pick(walkBase, walkVar) : (tileFor.get(key) ?? walkBase);
      board.draw(tile, vx * CELL - CELL / 2, vy * CELL - CELL / 2);
    }
  }

  // ---- faint worn centre dashes (2 px, 10 on / 16 off, 35 %) along the walk polyline
  const pts = map.path.map((p) => ({ x: p.x * SIZE, y: p.y * SIZE }));
  let run = 0;
  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    for (let d = 0; d < len; d += 1, run += 1) {
      if (run % 26 >= 10) continue;
      const x = Math.round(a.x + ((b.x - a.x) * d) / len);
      const y = Math.round(a.y + ((b.y - a.y) * d) / len);
      for (let oy = -1; oy < 1; oy += 1) for (let ox = -1; ox < 1; ox += 1) board.blend(x + ox, y + oy, 210, 170, 90, 89);
    }
  }

  // ---- road marks: crack-seal lines on road cells, spaced ≥ 4 cells apart (Manhattan)
  const roadCells: [number, number][] = [];
  for (let r = 0; r < N; r += 1) for (let c = 0; c < N; c += 1) if (isRoad(c, r)) roadCells.push([c, r]);
  const used: [number, number][] = [];
  for (const file of readdirSync(join(raw, 'decals')).sort()) {
    const img = trim(load(join(raw, 'decals', file)));
    for (let n = 0, tries = 0; n < 7 && tries < 400; tries += 1) {
      const [c, r] = roadCells[Math.floor(rand() * roadCells.length)]!;
      if (used.some(([uc, ur]) => Math.abs(uc - c) + Math.abs(ur - r) < 4)) continue;
      used.push([c, r]);
      board.draw(img, Math.round(c * CELL + CELL / 2 - img.width / 2), Math.round(r * CELL + CELL / 2 - img.height / 2), 0.8);
      n += 1;
    }
  }

  // ---- neon light pools (also the glow layer, alone, for T4)
  const glow = new Canvas(false);
  const fire = new Canvas(false);
  const pools: TurfAmbientSites['pools'] = [];
  for (const [cx, cy, r, rgb, a] of POOLS) {
    board.glow(cx, cy, r, r * 0.6, rgb, a);
    glow.glow(cx, cy, r, r * 0.6, rgb, a * 2);
    const x0 = Math.max(0, Math.floor(cx - r));
    const y0 = Math.max(0, Math.floor(cy - r * 0.6));
    pools.push({ x: x0, y: y0, w: Math.min(SIZE, Math.ceil(cx + r)) - x0, h: Math.min(SIZE, Math.ceil(cy + r * 0.6)) - y0 });
  }

  // ---- pads: library manhole cover at its native size (54 px) + contact shadow (down-right)
  const pad = trim(load(PAD_ART));
  for (const p of map.pads) {
    board.glow(p.x * UNIT + 3, p.y * UNIT + 4, pad.width / 2 + 2, pad.height / 2.6, [8, 4, 16], 120);
    board.draw(pad, Math.round(p.x * UNIT - pad.width / 2), Math.round(p.y * UNIT - pad.height / 2));
  }

  // ---- props: low only, on sidewalk — the sprite box touches no road cell (kerb margin 2 px) and no pad hit circle
  const padR = Math.max(...BOARD_PT.map((pt) => padTapRadiusUnits(pt))) * UNIT;
  const props: TurfBoardArt['props'] = [];
  const boxClearOfPads = (x: number, y: number, w: number, h: number) =>
    map.pads.every((p) => {
      const nx = Math.max(x, Math.min(p.x * UNIT, x + w));
      const ny = Math.max(y, Math.min(p.y * UNIT, y + h));
      return Math.hypot(p.x * UNIT - nx, p.y * UNIT - ny) > padR + PAD_GAP;
    });
  const barrels: TurfAmbientSites['barrels'] = [];
  const cones: TurfAmbientSites['cones'] = [];
  const fires: TurfAmbientSites['fires'] = [];
  const taken: [number, number][] = [];
  let ventBox: [number, number, number, number] | null = null;
  for (let cy = 0, n = 0; cy < N; cy += 1) {
    for (let cx = 0; cx < N; cx += 1) {
      const id = PROP_ORDER[n % PROP_ORDER.length]!;
      if (isRoad(cx, cy)) continue;
      if (n >= PROP_MAX || taken.some(([tx, ty]) => Math.abs(tx - cx) <= 3 && Math.abs(ty - cy) <= 3)) continue;
      const img = trim(load(join(raw, 'props', `${id}.png`)));
      if (img.height > PROP_MAX_H) throw new Error(`${id} is ${img.height} px tall — over ${PROP_MAX_H} it hides a creep`);
      const x = Math.round(cx * CELL + CELL / 2 - img.width / 2);
      const y = cy * CELL + CELL - 4 - img.height;
      let onRoad = false;
      for (let ry = Math.floor((y - 2) / CELL); ry <= Math.floor((y + img.height + 1) / CELL); ry += 1) {
        for (let rx = Math.floor((x - 2) / CELL); rx <= Math.floor((x + img.width + 1) / CELL); rx += 1) {
          if (rx >= 0 && ry >= 0 && rx < N && ry < N && isRoad(rx, ry)) onRoad = true;
        }
      }
      if (onRoad) continue;
      const clear = map.pads.every((p) => {
        const px = p.x * UNIT;
        const py = p.y * UNIT;
        const nx = Math.max(x, Math.min(px, x + img.width));
        const ny = Math.max(y, Math.min(py, y + img.height));
        return Math.hypot(px - nx, py - ny) > padR + PAD_GAP;
      });
      if (!clear || x < 0 || y < 0 || x + img.width > SIZE || y + img.height > SIZE) continue;
      taken.push([cx, cy]);
      board.glow(x + img.width / 2 + 2, y + img.height - 1, img.width / 2 + 2, 3.5, [8, 4, 16], 150);
      board.draw(img, x, y);
      if (id === 'barrel') {
        fire.glow(x + img.width / 2, y + 8, 30, 22, [255, 170, 70], 110);
        const bx = Math.round(x + img.width / 2);
        const by = y + BARREL_OPENING_Y;
        // The wisp rises ~29 px: leave it off when it would pass over a pad hit circle (or off the top of the board).
        const sx = bx - SMOKE_CLIP.ax;
        const sy = by - SMOKE_LIFT - SMOKE_CLIP.ay;
        const smoke = sy >= -8 && boxClearOfPads(sx, sy, SMOKE_CLIP.w, SMOKE_CLIP.h);
        barrels.push({ x: bx, y: by, smoke });
        const fx0 = Math.max(0, Math.round(x + img.width / 2 - 30));
        const fy0 = Math.max(0, y + 8 - 22);
        fires.push({ x: fx0, y: fy0, w: Math.min(SIZE, fx0 + 60) - fx0, h: Math.min(SIZE, fy0 + 44) - fy0 });
      }
      if (id === 'traffic-cone') cones.push({ x: Math.round(x + img.width / 2), y: y + 2 });
      props.push({ id, rect: [x, y, img.width, img.height] });
      n += 1;
    }
  }

  // ---- vent grate (flat, baked into the sidewalk) + pigeon spots: free sidewalk cells, off pads / props / each other
  /** The cell is sidewalk (a 16 px bird or a 24 px grate centred in it keeps ≥ 4 px off the kerb). */
  const sidewalk3 = (cx: number, cy: number) => !isRoad(cx, cy);
  const boxClear = (x: number, y: number, w: number, h: number, gap: number) =>
    map.pads.every((p) => {
      const px = p.x * UNIT;
      const py = p.y * UNIT;
      const nx = Math.max(x, Math.min(px, x + w));
      const ny = Math.max(y, Math.min(py, y + h));
      return Math.hypot(px - nx, py - ny) > padR + gap;
    }) &&
    props.every((q) => x + w + gap < q.rect[0] || x - gap > q.rect[0] + q.rect[2] || y + h + gap < q.rect[1] || y - gap > q.rect[1] + q.rect[3]);
  const grate = trim(load(join(raw, 'props', 'vent-grate.png')));
  let vent: TurfAmbientSites['vent'] = null;
  let bestClear = -1;
  for (let cy = 2; cy < N; cy += 1) {
    for (let cx = 0; cx < N; cx += 1) {
      if (!sidewalk3(cx, cy)) continue;
      const gx = cx * CELL + CELL / 2 - Math.floor(grate.width / 2);
      const gy = cy * CELL + CELL / 2 - Math.floor(grate.height / 2);
      if (!boxClear(gx, gy, grate.width, grate.height, 12)) continue;
      const clear = Math.min(...map.pads.map((p) => Math.hypot(p.x * UNIT - (gx + grate.width / 2), p.y * UNIT - (gy + grate.height / 2))));
      if (clear > bestClear) {
        bestClear = clear;
        vent = { x: gx + Math.floor(grate.width / 2), y: gy + 8 };
        ventBox = [gx, gy, grate.width, grate.height];
      }
    }
  }
  if (vent && ventBox) {
    board.glow(ventBox[0] + ventBox[2] / 2 + 2, ventBox[1] + ventBox[3] / 2 + 3, ventBox[2] / 2 + 2, ventBox[3] / 2.4, [8, 4, 16], 110);
    board.draw(grate, ventBox[0], ventBox[1]);
  }
  const spots: [number, number][] = [];
  for (let cy = 0; cy < N; cy += 1) for (let cx = 0; cx < N; cx += 1) if (sidewalk3(cx, cy)) spots.push([cx, cy]);
  for (let i = spots.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [spots[i], spots[j]] = [spots[j]!, spots[i]!];
  }
  const pigeons: TurfAmbientSites['pigeons'] = [];
  for (const [cx, cy] of spots) {
    if (pigeons.length >= PIGEON_MAX) break;
    const x = cx * CELL + CELL / 2;
    const y = cy * CELL + CELL - 6;
    if (!boxClear(x - 8, y - 14, 16, 16, 6)) continue;
    if (ventBox && Math.hypot(x - (ventBox[0] + ventBox[2] / 2), y - (ventBox[1] + ventBox[3] / 2)) < 60) continue;
    if (pigeons.some((q) => Math.hypot(q.x - x, q.y - y) < PIGEON_APART)) continue;
    pigeons.push({ x, y });
  }

  // ---- the glow layer never tints a pad: clear it inside every pad hit circle (T4 draws it over the board)
  for (const g of [glow.png.data, fire.png.data]) {
    for (const p of map.pads) {
      const cx = p.x * UNIT;
      const cy = p.y * UNIT;
      for (let y = Math.floor(cy - padR); y <= cy + padR; y += 1) {
        for (let x = Math.floor(cx - padR); x <= cx + padR; x += 1) {
          if (x >= 0 && y >= 0 && x < SIZE && y < SIZE && Math.hypot(x - cx, y - cy) <= padR) g[(y * SIZE + x) * 4 + 3] = 0;
        }
      }
    }
  }

  // ---- soft edge vignette so the board sits in the dark screen
  const d = board.png.data;
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const edge = Math.min(x, y, SIZE - 1 - x, SIZE - 1 - y);
      if (edge >= 24) continue;
      const k = 0.55 + 0.45 * (edge / 24);
      const i = (y * SIZE + x) * 4;
      for (let c = 0; c < 3; c += 1) d[i + c] = Math.round(d[i + c]! * k);
    }
  }

  return { board: board.png, glow: glow.png, fire: fire.png, ambient: { barrels, cones, vent, pigeons, pools, fires }, pads: map.pads.length, props };
}
