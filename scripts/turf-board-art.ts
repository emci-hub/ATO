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
 * T8 (2026-10-17): theme-driven. A theme = one `TurfThemeSpec` block (art source, variant skips, pad, props + their
 * ambient roles, centre dashes, light pools, vent, pigeons) painted onto the SAME grid / path / pads. `alley` is the
 * T3/T4 board, byte for byte.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { PNG } from 'pngjs';

import { TILE, type BoardMap } from '../src/play/board-data';
import { padTapRadiusUnits } from '../src/play/turf-layout';
import { SMOKE_CLIP, SMOKE_LIFT } from '../src/play/turf-ambient-layout';
import { TURF_THEME_IDS, type TurfThemeId } from '../src/play/turf-theme';

const PIXELLAB = join(__dirname, '..', 'art-src', 'pixellab');
export const TURF_BOARD_ART_SRC = join(PIXELLAB, 'board.streetwear');
/** Library pads (streetwear-pack), drawn at native size. */
const LIBRARY_PADS = join(PIXELLAB, 'streetwear-pack', 'migrated', 'raw', 'props');

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
/** Props stay this many px beyond a pad hit circle (none reads as a tower spot). */
const PAD_GAP = 6;
/** Pigeons: at most this many, at least this far apart (art px). */
const PIGEON_MAX = 4;
const PIGEON_APART = 120;
/** A neon sign's tubes on the board when the glow layer is dark (its lit copy lives on the glow layer). */
const SIGN_UNLIT = 0.45;
/** A sign the edge vignette darkens bakes its unlit tubes brighter (T14, emci picked B 2026-10-18: the bolt). */
export const SIGN_UNLIT_EDGE = 0.8;
/** A sign sits within this many pool radii of its pool's centre (the alley's magenta corner is road + pad + barrel). */
const SIGN_REACH = 1.75;
/** Variant mix: share of plain base tiles; variants further than this luma gap from the base are skipped. */
const BASE_SHARE = 0.55;
const MAX_LUMA_GAP = 0.22;

type Rgb = readonly [number, number, number];
/** Neon light pool [cx, cy, r, rgb, alpha] in art px. */
type Pool = readonly [number, number, number, Rgb, number];

/** A prop the painter places on the sidewalk, by file name in the theme's raw/props/. */
type ThemeProp = {
  id: string;
  /** `fire` = flame + smoke + firelight on the ambient layer, `opening` = the flame base row in the trimmed sprite;
   * `lamp` = the blinking lamp at its top. */
  role?: { kind: 'fire'; opening: number } | { kind: 'lamp' };
};

export { TURF_THEME_IDS, type TurfThemeId };

export type TurfThemeSpec = {
  id: TurfThemeId;
  /** Raw PixelLab folder under art-src/pixellab/ (its latest gen with raw/tileset/tileset.png is painted). */
  src: string;
  /** Pins the gen folder (samples paint a candidate); default = the latest. */
  gen?: string;
  /** Tileset folder inside raw/ (default `tileset`; samples paint a `tileset-b` candidate). */
  tileset?: string;
  /** Seed of the board's random layout (variant mix, decal spots, pigeon spots). */
  seed: number;
  /** Variant tiles left out (lock artefacts). */
  roadSkip: readonly string[];
  walkSkip: readonly string[];
  /** Pad sprite: a library pad name (streetwear-pack) or `theme:<file>` in the theme's raw/props/. */
  pad: string;
  /** Placed round-robin, low only, ≥ 4 cells apart, at most `propMax`. */
  props: readonly ThemeProp[];
  propMax: number;
  /** When the next prop does not fit a spot, try the others there (off for the alley, which keeps its T3 layout). */
  propFallback?: boolean;
  /** Faint centre dashes along the walk line (null = none). */
  dashes: { rgb: Rgb; alpha: number } | null;
  /** Flat road marks per decal file (raw/decals/). */
  decalsEach: number;
  pools: readonly Pool[];
  /** Flat grate in raw/props/ the steam rises from (null = no steam). */
  vent: string | null;
  pigeons: boolean;
  /** Wall neon signs (art loose ends, emci 2026-10-18): a file in the alley's raw/ambient/, lit by pool `pool`. Placed
   * on the free sidewalk spot nearest that pool; unlit on the board, lit on the glow layer, so it flickers with the pool. */
  signs?: readonly { file: string; pool: number; unlit?: number }[];
};

/** Every theme. `alley` = T3 option D + T4 (the default; unchanged). T8 (emci picked 2026-10-17): rooftop = sample C,
 * underpass = A, court = C, docks = A (samples: docs/divecore/turf-war-t8/samples/). */
export const TURF_THEMES: Record<TurfThemeId, TurfThemeSpec> = {
  alley: {
    id: 'alley',
    src: 'board.streetwear',
    seed: 20261017,
    // Road variants left out: the palette lock turned the damp stains into flat teal blocks (r03, r08, r11) and the
    // lighter tiles brown-pink (r05, r13).
    roadSkip: ['r03.png', 'r05.png', 'r08.png', 'r11.png', 'r13.png'],
    walkSkip: [],
    pad: 'pad-manhole-ring',
    // Barrel's open top (ellipse centre) is row 7 of the trimmed sprite: the flame base.
    props: [{ id: 'barrel', role: { kind: 'fire', opening: 7 } }, { id: 'tire-stack' }, { id: 'traffic-cone', role: { kind: 'lamp' } }],
    propMax: 8,
    dashes: { rgb: [210, 170, 90], alpha: 89 },
    decalsEach: 7,
    pools: [
      [40, 470, 60, [255, 60, 200], 40],
      [470, 40, 60, [40, 220, 255], 40],
      [250, 250, 70, [255, 170, 80], 26],
      [480, 300, 50, [40, 220, 255], 30],
      [130, 130, 50, [255, 60, 200], 30],
    ],
    vent: 'vent-grate',
    pigeons: true,
    // emci picked sign size A (24 px): bolt by the cyan pool, heart by the magenta pool.
    // T14 (emci picked B, 2026-10-18): the bolt sits in the top-edge vignette, so its unlit tubes bake brighter.
    signs: [
      { file: 'sign-bolt', pool: 1, unlit: SIGN_UNLIT_EDGE },
      { file: 'sign-heart', pool: 0 },
    ],
  },
  rooftop: {
    id: 'rooftop',
    src: 'board.streetwear.rooftop',
    propFallback: true,
    seed: 20261018,
    roadSkip: [],
    walkSkip: [],
    pad: 'pad-manhole-ring',
    props: [{ id: 'ac-unit' }, { id: 'roof-vent' }, { id: 'roof-lamp', role: { kind: 'lamp' } }],
    propMax: 7,
    dashes: null,
    decalsEach: 6,
    // Sample C (emci 2026-10-17): manhole pads, warmer lights.
    pools: [
      [60, 60, 70, [255, 170, 80], 36],
      [450, 460, 70, [255, 170, 80], 34],
      [250, 250, 70, [255, 60, 200], 20],
      [470, 140, 50, [255, 170, 80], 30],
    ],
    vent: 'vent-grate',
    pigeons: true,
  },
  underpass: {
    id: 'underpass',
    src: 'board.streetwear.underpass',
    propFallback: true,
    seed: 20261019,
    roadSkip: [],
    walkSkip: [],
    pad: 'pad-manhole-splat',
    // Cone first: the tall bin rarely fits a sidewalk cell, and the boxes would otherwise take every spot.
    props: [{ id: 'traffic-cone', role: { kind: 'lamp' } }, { id: 'bin' }, { id: 'boxes' }],
    propMax: 6,
    dashes: { rgb: [230, 200, 80], alpha: 70 },
    decalsEach: 6,
    pools: [
      [40, 470, 60, [40, 220, 255], 44],
      [470, 40, 60, [40, 220, 255], 44],
      [250, 250, 80, [40, 220, 255], 22],
      [130, 130, 50, [255, 60, 200], 30],
      [480, 300, 50, [255, 60, 200], 30],
    ],
    vent: 'vent-grate',
    pigeons: false,
  },
  court: {
    id: 'court',
    src: 'board.streetwear.court',
    propFallback: true,
    seed: 20261020,
    roadSkip: [],
    walkSkip: [],
    pad: 'pad-manhole-ring',
    props: [{ id: 'bench' }, { id: 'bin' }, { id: 'ball-rack' }],
    propMax: 7,
    dashes: null,
    decalsEach: 5,
    // Sample C (emci 2026-10-17): manhole pads, cooler lights.
    pools: [
      [60, 60, 70, [40, 220, 255], 28],
      [450, 450, 70, [40, 220, 255], 28],
      [250, 250, 70, [255, 60, 200], 22],
      [470, 120, 50, [255, 170, 80], 26],
    ],
    vent: null,
    pigeons: true,
  },
  docks: {
    id: 'docks',
    src: 'board.streetwear.docks',
    propFallback: true,
    seed: 20261021,
    roadSkip: [],
    walkSkip: [],
    pad: 'pad-manhole-ring',
    props: [{ id: 'bollard' }, { id: 'crate' }, { id: 'barrel', role: { kind: 'fire', opening: 7 } }],
    propMax: 8,
    dashes: { rgb: [230, 200, 80], alpha: 60 },
    decalsEach: 6,
    pools: [
      [40, 470, 60, [40, 220, 255], 36],
      [470, 40, 60, [255, 170, 80], 36],
      [250, 250, 70, [40, 220, 255], 22],
      [130, 130, 50, [255, 170, 80], 28],
    ],
    vent: null,
    pigeons: true,
  },
};

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

function latestGen(theme: TurfThemeSpec = TURF_THEMES.alley): string | null {
  const dir = join(PIXELLAB, theme.src);
  if (!existsSync(dir)) return null;
  const gens = readdirSync(dir).filter((g) => existsSync(join(dir, g, 'raw', 'tileset', 'tileset.png')));
  const gen = theme.gen ?? gens.sort().at(-1);
  return gen && gens.includes(gen) ? join(dir, gen, 'raw') : null;
}

export function turfBoardArtAvailable(theme: TurfThemeId = 'alley'): boolean {
  return latestGen(TURF_THEMES[theme]) !== null;
}

/** Raw ambient clips (PixelLab vfx exports + the pigeon still), palette-locked: flame / smoke / steam .png + .json, pigeon.png.
 * Shared by every theme (the alley's). */
export function turfAmbientSrc(): string | null {
  const raw = latestGen();
  return raw && existsSync(join(raw, 'ambient')) ? join(raw, 'ambient') : null;
}

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
  /** Wall neon signs baked into the board + glow layer; `pool` = the pool crop that flickers them (check:turf-war-layout). */
  signs: { x: number; y: number; w: number; h: number; pool: number }[];
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

/** Neon light pools sit under the pads on the board; the glow layer is cleared over pads. */
export function paintTurfBoard(map: BoardMap, themeOrId: TurfThemeId | TurfThemeSpec = 'alley'): TurfBoardArt {
  const theme = typeof themeOrId === 'string' ? TURF_THEMES[themeOrId] : themeOrId;
  const raw = latestGen(theme);
  if (!raw) throw new Error(`no Turf War board art under art-src/pixellab/${theme.src}`);
  const isRoad = (cx: number, cy: number) => {
    const v = map.grid[Math.max(0, Math.min(N - 1, cy))]![Math.max(0, Math.min(N - 1, cx))];
    return v === TILE.PATH || v === TILE.START;
  };
  /** A theme may reuse an alley prop (the cone, the barrel, the grate): its own raw/props/ first, then the alley's. */
  const propFile = (name: string) =>
    [raw, latestGen()]
      .filter((r): r is string => !!r)
      .map((r) => join(r, 'props', `${name}.png`))
      .find((f) => existsSync(f));
  for (const p of theme.props) if (!propFile(p.id)) throw new Error(`theme ${theme.id}: no prop ${p.id}.png`);
  let seed = theme.seed;
  const rand = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  // ---- ground: Wang tiles on a dual grid; all-road / all-walk corners take a variant mix
  const tilesetDir = join(raw, theme.tileset ?? 'tileset');
  const sheet = load(join(tilesetDir, 'tileset.png'));
  const meta = JSON.parse(readFileSync(join(tilesetDir, 'tileset.json'), 'utf8')) as {
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
  const optionalVariants = (dir: string, base: Img, skip: readonly string[]) => (existsSync(join(raw, dir)) ? variants(dir, base, skip) : []);
  const roadVar = optionalVariants('road-variants', roadBase, theme.roadSkip);
  const walkVar = optionalVariants('walk-variants', walkBase, theme.walkSkip);
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
  const dash = theme.dashes;
  for (let i = 1; dash && i < pts.length; i += 1) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    for (let d = 0; d < len; d += 1, run += 1) {
      if (run % 26 >= 10) continue;
      const x = Math.round(a.x + ((b.x - a.x) * d) / len);
      const y = Math.round(a.y + ((b.y - a.y) * d) / len);
      for (let oy = -1; oy < 1; oy += 1) for (let ox = -1; ox < 1; ox += 1) board.blend(x + ox, y + oy, dash.rgb[0], dash.rgb[1], dash.rgb[2], dash.alpha);
    }
  }

  // ---- road marks: crack-seal lines on road cells, spaced ≥ 4 cells apart (Manhattan)
  const roadCells: [number, number][] = [];
  for (let r = 0; r < N; r += 1) for (let c = 0; c < N; c += 1) if (isRoad(c, r)) roadCells.push([c, r]);
  const used: [number, number][] = [];
  for (const file of existsSync(join(raw, 'decals')) ? readdirSync(join(raw, 'decals')).sort() : []) {
    const img = trim(load(join(raw, 'decals', file)));
    for (let n = 0, tries = 0; n < theme.decalsEach && tries < 400; tries += 1) {
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
  for (const [cx, cy, r, rgb, a] of theme.pools) {
    board.glow(cx, cy, r, r * 0.6, rgb, a);
    glow.glow(cx, cy, r, r * 0.6, rgb, a * 2);
    const x0 = Math.max(0, Math.floor(cx - r));
    const y0 = Math.max(0, Math.floor(cy - r * 0.6));
    pools.push({ x: x0, y: y0, w: Math.min(SIZE, Math.ceil(cx + r)) - x0, h: Math.min(SIZE, Math.ceil(cy + r * 0.6)) - y0 });
  }

  // ---- pads: library manhole cover at its native size (54 px) + contact shadow (down-right)
  const pad = trim(load(theme.pad.startsWith('theme:') ? join(raw, 'props', `${theme.pad.slice(6)}.png`) : join(LIBRARY_PADS, `${theme.pad}.png`)));
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
      if (isRoad(cx, cy)) continue;
      if (n >= theme.propMax || taken.some(([tx, ty]) => Math.abs(tx - cx) <= 3 && Math.abs(ty - cy) <= 3)) continue;
      // The next prop in the round-robin; with `propFallback` the others are tried here too when it does not fit.
      const order = theme.propFallback ? theme.props.map((_, k) => theme.props[(n + k) % theme.props.length]!) : [theme.props[n % theme.props.length]!];
      const fit = order
        .map((spec) => {
          const img = trim(load(propFile(spec.id)!));
          if (img.height > PROP_MAX_H) throw new Error(`${spec.id} is ${img.height} px tall — over ${PROP_MAX_H} it hides a creep`);
          const x = Math.round(cx * CELL + CELL / 2 - img.width / 2);
          const y = cy * CELL + CELL - 4 - img.height;
          for (let ry = Math.floor((y - 2) / CELL); ry <= Math.floor((y + img.height + 1) / CELL); ry += 1) {
            for (let rx = Math.floor((x - 2) / CELL); rx <= Math.floor((x + img.width + 1) / CELL); rx += 1) {
              if (rx >= 0 && ry >= 0 && rx < N && ry < N && isRoad(rx, ry)) return null;
            }
          }
          const clear = map.pads.every((p) => {
            const px = p.x * UNIT;
            const py = p.y * UNIT;
            const nx = Math.max(x, Math.min(px, x + img.width));
            const ny = Math.max(y, Math.min(py, y + img.height));
            return Math.hypot(px - nx, py - ny) > padR + PAD_GAP;
          });
          if (!clear || x < 0 || y < 0 || x + img.width > SIZE || y + img.height > SIZE) return null;
          return { spec, img, x, y };
        })
        .find((f) => f !== null);
      if (!fit) continue;
      const { spec, img, x, y } = fit;
      const id = spec.id;
      taken.push([cx, cy]);
      board.glow(x + img.width / 2 + 2, y + img.height - 1, img.width / 2 + 2, 3.5, [8, 4, 16], 150);
      board.draw(img, x, y);
      if (spec.role?.kind === 'fire') {
        fire.glow(x + img.width / 2, y + 8, 30, 22, [255, 170, 70], 110);
        const bx = Math.round(x + img.width / 2);
        const by = y + spec.role.opening;
        // The wisp rises ~29 px: leave it off when it would pass over a pad hit circle (or off the top of the board).
        const sx = bx - SMOKE_CLIP.ax;
        const sy = by - SMOKE_LIFT - SMOKE_CLIP.ay;
        const smoke = sy >= -8 && boxClearOfPads(sx, sy, SMOKE_CLIP.w, SMOKE_CLIP.h);
        barrels.push({ x: bx, y: by, smoke });
        const fx0 = Math.max(0, Math.round(x + img.width / 2 - 30));
        const fy0 = Math.max(0, y + 8 - 22);
        fires.push({ x: fx0, y: fy0, w: Math.min(SIZE, fx0 + 60) - fx0, h: Math.min(SIZE, fy0 + 44) - fy0 });
      }
      if (spec.role?.kind === 'lamp') cones.push({ x: Math.round(x + img.width / 2), y: y + 2 });
      props.push({ id, rect: [x, y, img.width, img.height] });
      n += 1;
    }
  }

  // ---- vent grate (flat, baked into the sidewalk) + pigeon spots: free sidewalk cells, off pads / props / each other
  /** The cell is sidewalk (a 16 px bird or a 24 px grate centred in it keeps ≥ 4 px off the kerb). */
  const sidewalk3 = (cx: number, cy: number) => !isRoad(cx, cy);
  const signBoxes: [number, number, number, number][] = [];
  const signs: TurfAmbientSites['signs'] = [];
  const boxClear = (x: number, y: number, w: number, h: number, gap: number) =>
    map.pads.every((p) => {
      const px = p.x * UNIT;
      const py = p.y * UNIT;
      const nx = Math.max(x, Math.min(px, x + w));
      const ny = Math.max(y, Math.min(py, y + h));
      return Math.hypot(px - nx, py - ny) > padR + gap;
    }) &&
    [...props.map((q) => q.rect), ...signBoxes].every((q) => x + w + gap < q[0] || x - gap > q[0] + q[2] || y + h + gap < q[1] || y - gap > q[1] + q[3]);

  // ---- wall neon signs: the free sidewalk spot nearest the pool (no road cell within 2 px, off pads and props; no rand)
  for (const s of theme.signs ?? []) {
    const ambientDir = turfAmbientSrc();
    if (!ambientDir) throw new Error('no raw/ambient for the neon signs');
    const img = trim(load(join(ambientDir, `${s.file}.png`)));
    const [pcx, pcy, pr] = theme.pools[s.pool]!;
    const touchesRoad = (x: number, y: number) => {
      for (let ry = Math.floor((y - 2) / CELL); ry <= Math.floor((y + img.height + 1) / CELL); ry += 1) {
        for (let rx = Math.floor((x - 2) / CELL); rx <= Math.floor((x + img.width + 1) / CELL); rx += 1) {
          if (rx >= 0 && ry >= 0 && rx < N && ry < N && isRoad(rx, ry)) return true;
        }
      }
      return false;
    };
    let best: { x: number; y: number; d: number } | null = null;
    for (let y = 0; y + img.height <= SIZE; y += 1) {
      for (let x = 0; x + img.width <= SIZE; x += 1) {
        const d = Math.hypot(x + img.width / 2 - pcx, y + img.height / 2 - pcy);
        if (d > pr * SIGN_REACH || (best && d >= best.d)) continue;
        if (touchesRoad(x, y) || !boxClear(x, y, img.width, img.height, 2)) continue;
        best = { x, y, d };
      }
    }
    if (!best) throw new Error(`theme ${theme.id}: no free spot for ${s.file} near pool ${s.pool}`);
    const unlit = new PNG({ width: img.width, height: img.height });
    img.data.copy(unlit.data);
    for (let i = 0; i < unlit.data.length; i += 4) for (let c = 0; c < 3; c += 1) unlit.data[i + c] = Math.round(unlit.data[i + c]! * (s.unlit ?? SIGN_UNLIT));
    board.draw(unlit, best.x, best.y);
    glow.draw(img, best.x, best.y);
    signBoxes.push([best.x, best.y, img.width, img.height]);
    signs.push({ x: best.x, y: best.y, w: img.width, h: img.height, pool: s.pool });
    // the pool's flicker crop covers the sign too
    const p = pools[s.pool]!;
    const x0 = Math.min(p.x, best.x);
    const y0 = Math.min(p.y, best.y);
    pools[s.pool] = { x: x0, y: y0, w: Math.max(p.x + p.w, best.x + img.width) - x0, h: Math.max(p.y + p.h, best.y + img.height) - y0 };
  }
  const grateFile = theme.vent ? propFile(theme.vent) : undefined;
  const grate = grateFile ? trim(load(grateFile)) : null;
  let vent: TurfAmbientSites['vent'] = null;
  let bestClear = -1;
  for (let cy = 2; grate && cy < N; cy += 1) {
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
  if (grate && vent && ventBox) {
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
    if (!theme.pigeons || pigeons.length >= PIGEON_MAX) break;
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

  return { board: board.png, glow: glow.png, fire: fire.png, ambient: { barrels, cones, vent, pigeons, pools, fires, signs }, pads: map.pads.length, props };
}
