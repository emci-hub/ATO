/**
 * 3/4 top-down room art + maps (layout A, 352×576 since 2026-10-13; Hideout = PixelLab art).
 * Run: npx tsx scripts/gen-hideout-td.ts   then   npm run art:sync
 *
 * Placeholders until real PixelLab room art lands. Option A (emci
 * 2026-10-12, docs/art/PIXELLAB_GUIDE.md §2): 256×576 canvas, 32px art tiles
 * (8×18), grown hero drawn 1:1 (kael ≈ 106 px). Footprints / collision use a
 * 16px walk cell (16×36): ceiling 2, back wall 6, floor 26, near rim 2,
 * side caps 1, door gap 4. Props are sized from the guide's scale table.
 * Occluders are ONE combined layer per time/neon state; map JSON carries
 * per-prop crop rects + sortY.
 */
import { deflateSync, inflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { hideoutArtAvailable, paintHideoutArt } from './hideout-room-art';

/** Room art lives in the art library: assets/art/rooms/<room>/. */
const ROOT = join(__dirname, '..', 'assets', 'art', 'rooms');
// 352 wide (emci 2026-10-13, layout C+: "expand the room horizontally"); was 256.
export const TD_CANVAS = [352, 576] as const;
/** PixelLab art tile (floor checker / tilesets). */
export const TD_ART_TILE = 32;
/** Walk / collision cell (footprints, hotspots, walkable grid). */
export const TD_TILE = 16;
export const TD_COLS = 22;
export const TD_ROWS = 36;
export const TD_FLOOR_COLS = 20;
export const TD_FLOOR_ROWS = 26;
export const TD_DOOR_TILES = 4;
export const TD_CAP_TILES = 1;
export const TD_CEIL_TILES = 2;
export const TD_WALL_TILES = 6;

type Foot = readonly [number, number, number, number];
type Pt = readonly [number, number];
type Facing = 'back-wall' | 'side-wall' | 'down' | 'away';

type PropSpec = {
  id: string;
  facing: Facing;
  rotated: boolean;
  footprint: Foot;
  occluder: boolean;
  /** Sprite extra height above the footprint, in art px (front of the prop). */
  rise: number;
};

type HotSpec = {
  id: string;
  kind: string;
  ellipse: readonly [number, number, number, number];
  footprint: Foot;
  labelAnchor: Pt;
  walk: Pt;
  thing: string;
  action: string;
  coach: string;
};

type Layout = {
  id: string;
  sleepOnBed: boolean;
  window: { pos: Pt; size: Pt } | null;
  props: PropSpec[];
  hotspots: HotSpec[];
  spawns: Record<string, Pt>;
  targets: Record<string, Pt>;
  lights: Pt[];
  /** Floor ellipse rugs (walkable). */
  rugs: readonly (readonly [number, number, number, number])[];
};

function crc32(buf: Buffer): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i]!;
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
  ihdr.writeUInt32BE(h, 4); // height (was written over the width → 576×0 headers)
  ihdr[8] = 8;
  ihdr[9] = 6;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function footPx(f: Foot): { x: number; y: number; w: number; h: number; bottom: number } {
  return {
    x: f[0] * TD_TILE,
    y: f[1] * TD_TILE,
    w: f[2] * TD_TILE,
    h: f[3] * TD_TILE,
    bottom: (f[1] + f[3]) * TD_TILE,
  };
}

function inFoot(x: number, y: number, f: Foot): boolean {
  const p = footPx(f);
  return x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h;
}

function inEllipse(x: number, y: number, cx: number, cy: number, rx: number, ry: number): boolean {
  const dx = (x - cx) / Math.max(1, rx);
  const dy = (y - cy) / Math.max(1, ry);
  return dx * dx + dy * dy <= 1;
}

/** Shell (walk cells): 2 ceiling, 6 back wall, 26 floor, 2 near rim, 1 side cap. */
const CEIL = TD_CEIL_TILES * TD_TILE;
const WALL_BOTTOM = (TD_CEIL_TILES + TD_WALL_TILES) * TD_TILE;
const FLOOR_BOTTOM = WALL_BOTTOM + TD_FLOOR_ROWS * TD_TILE;
const CAP = TD_CAP_TILES * TD_TILE;
const DOOR_COL0 = Math.floor((TD_COLS - TD_DOOR_TILES) / 2);
const DOOR_COL1 = DOOR_COL0 + TD_DOOR_TILES;

function blockedByWall(c: number, r: number): boolean {
  const y0 = r * TD_TILE;
  const x0 = c * TD_TILE;
  if (y0 < WALL_BOTTOM) return true; // back wall + ceiling
  if (x0 < CAP || x0 >= TD_CANVAS[0] - CAP) return true; // side caps
  if (y0 >= FLOOR_BOTTOM) {
    const door = c >= DOOR_COL0 && c < DOOR_COL1;
    return !door;
  }
  return false;
}

function buildWalkable(layout: Layout): string[] {
  const block = layout.props.filter((p) => p.id !== 'hatch');
  const rows: string[] = [];
  for (let r = 0; r < TD_ROWS; r += 1) {
    let s = '';
    for (let c = 0; c < TD_COLS; c += 1) {
      if (blockedByWall(c, r)) {
        s += '0';
        continue;
      }
      const blocked = block.some((p) => {
        if (p.id.startsWith('near-rim')) return false;
        const [fc, fr, fw, fh] = p.footprint;
        return c >= fc && c < fc + fw && r >= fr && r < fr + fh;
      });
      s += blocked ? '0' : '1';
    }
    rows.push(s);
  }
  return rows;
}

function spriteRect(p: PropSpec): [number, number, number, number] {
  const f = footPx(p.footprint);
  const top = Math.max(0, f.y - p.rise);
  return [f.x, top, f.w, f.bottom - top];
}

function mapJson(layout: Layout, walkable: string[], art?: Map<string, [number, number, number, number]>) {
  return {
    _meta: {
      canvas: [...TD_CANVAS],
      tile: TD_TILE,
      cols: TD_COLS,
      rows: TD_ROWS,
      floor: [TD_FLOOR_COLS, TD_FLOOR_ROWS],
      doorTiles: TD_DOOR_TILES,
      projection: 'three-quarter-topdown',
      artTile: TD_ART_TILE,
      heroCellPx: 192,
      heroFigurePx: 106,
      heroRenderScale: 1,
      contentBounds: [0, 0, TD_CANVAS[0], TD_CANVAS[1]],
      placeholder: !art,
      sleepOnBed: layout.sleepOnBed,
      source: art
        ? 'scripts/gen-hideout-td.ts + hideout-room-art.ts — PixelLab art (art-src/pixellab/room.hideout.streetwear)'
        : 'scripts/gen-hideout-td.ts — option A greybox until PixelLab room art lands',
    },
    layers: {
      back: `${layout.id}-td-back.png`,
      floor: `${layout.id}-td-floor.png`,
      props: `${layout.id}-td-props.png`,
      neonA: `${layout.id}-td-neon-a.png`,
      neonB: `${layout.id}-td-neon-b.png`,
      occluder: {
        'day-a': `${layout.id}-td-occlude-day-a.png`,
        'day-b': `${layout.id}-td-occlude-day-b.png`,
        'night-a': `${layout.id}-td-occlude-night-a.png`,
        'night-b': `${layout.id}-td-occlude-night-b.png`,
      },
    },
    collision: { tile: TD_TILE, cols: TD_COLS, rows: TD_ROWS, walkable },
    props: layout.props.map((p) => {
      const sprite = art?.get(p.id) ?? spriteRect(p);
      const bottom = footPx(p.footprint).bottom;
      return {
        id: p.id,
        facing: p.facing,
        rotated: p.rotated,
        footprint: [...p.footprint],
        sprite,
        crop: sprite,
        sortY: bottom,
        baselineY: bottom,
        occluder: p.occluder,
      };
    }),
    hotspots: layout.hotspots.map((h) => ({
      id: h.id,
      kind: h.kind,
      ellipse: [...h.ellipse],
      footprint: [...h.footprint],
      labelAnchor: [...h.labelAnchor],
      walk: [...h.walk],
      thing: h.thing,
      action: h.action,
      coach: h.coach,
    })),
    spawns: layout.spawns,
    targets: layout.targets,
    window: layout.window,
    lights: layout.lights,
    rugs: layout.rugs,
  };
}

/* ---------------------------------------------- rooms --- */
// Footprints are walk cells [col, row, w, h] (16 px). Points are art px.
// Sizes from the guide §2 scale table vs the grown hero (H ≈ 106 px):
// sprite box = footprint width × (rise + footprint depth). Floor y 128–544.

// Hideout = real PixelLab art (emci approved 2026-10-12): scripts/hideout-room-art.ts paints the
// layers from art-src/pixellab/room.hideout.streetwear; `file` names the prop sprite there.
// Sprite boxes passed the guide §2 scale sheet (couch 118×71, arcade 39×123, lamp 22×110 …).
const HIDEOUT_FILES: Record<string, string> = {
  arcade: 'arcade.png',
  stereo: 'stereo.png',
  speaker: 'speaker.png',
  couch: 'couch.png',
  lamp: 'lamp.png',
  table: 'table.png',
  beanbag: 'beanbag.png',
  plant: 'plant.png',
};

const HIDEOUT: Layout = {
  id: 'hideout',
  sleepOnBed: false,
  window: { pos: [86, 58], size: [52, 65] },
  props: [
    // Back wall, left to right: arcade, (window), stereo + speaker tower. Against the wall the pet
    // can never stand behind them, so they are not occluders (keeps every occluder crop clean —
    // crops are cut from one combined layer, so two occluders must never overlap).
    { id: 'arcade', facing: 'down', rotated: false, footprint: [1, 9, 3, 2], occluder: false, rise: 91 },
    { id: 'stereo', facing: 'down', rotated: false, footprint: [11, 9, 2, 2], occluder: false, rise: 33 },
    { id: 'speaker', facing: 'down', rotated: false, footprint: [13, 9, 2, 2], occluder: false, rise: 42 },
    // Couch under the window, lamp on its left, coffee table in front (3 free rows between, so the
    // pet's clearance still leaves a lane to the couch spot).
    { id: 'couch', facing: 'down', rotated: false, footprint: [3, 12, 8, 2], occluder: true, rise: 39 },
    { id: 'lamp', facing: 'down', rotated: false, footprint: [1, 13, 2, 1], occluder: true, rise: 94 },
    { id: 'table', facing: 'down', rotated: false, footprint: [5, 17, 4, 2], occluder: true, rise: 12 },
    { id: 'beanbag', facing: 'down', rotated: false, footprint: [12, 20, 3, 2], occluder: true, rise: 22 },
    { id: 'plant', facing: 'down', rotated: false, footprint: [1, 21, 2, 2], occluder: true, rise: 40 },
    { id: 'hatch', facing: 'down', rotated: false, footprint: [6, 30, 4, 2], occluder: false, rise: 0 },
    { id: 'near-rim-l', facing: 'down', rotated: false, footprint: [1, 34, 5, 2], occluder: true, rise: 0 },
    { id: 'near-rim-r', facing: 'down', rotated: false, footprint: [10, 34, 5, 2], occluder: true, rise: 0 },
  ],
  hotspots: [
    {
      id: 'door',
      kind: 'door',
      ellipse: [128, 560, 30, 10],
      footprint: [6, 34, 4, 2],
      labelAnchor: [128, 546],
      walk: [128, 520],
      thing: 'Door',
      action: 'Explore',
      coach: 'expedition',
    },
    {
      id: 'chair',
      kind: 'chair',
      ellipse: [112, 214, 44, 10],
      footprint: [3, 12, 8, 2],
      labelAnchor: [112, 150],
      walk: [120, 248],
      thing: 'Couch',
      action: 'Stash',
      coach: 'den',
    },
    {
      id: 'boombox',
      kind: 'boombox',
      ellipse: [192, 172, 16, 6],
      footprint: [11, 9, 2, 2],
      labelAnchor: [192, 100],
      walk: [216, 216],
      thing: 'Stereo',
      action: 'Play',
      coach: 'play',
    },
    {
      id: 'manhole',
      kind: 'hatch',
      ellipse: [128, 496, 30, 15],
      footprint: [6, 30, 4, 2],
      labelAnchor: [128, 476],
      walk: [128, 456],
      thing: 'Hatch',
      action: 'Underground',
      coach: 'dive',
    },
  ],
  spawns: { default: [128, 360], door: [128, 520], hatch: [128, 456] },
  targets: { bowl: [64, 470], bed: [184, 404], cushion: [184, 404], door: [128, 520], chair: [120, 248], boombox: [216, 216] },
  lights: [
    [32, 120],
    [40, 70],
    [128, 90],
  ],
  rugs: [[128, 376, 60, 26]],
};

/** Flat floor art (walkable): rug, manhole, food bowl, pet cushion — centred on these points. */
const HIDEOUT_FLATS = [
  { file: 'rug.png', cx: 128, cy: 376 },
  { file: 'manhole.png', cx: 128, cy: 496 },
  { file: 'bowl.png', cx: 64, cy: 466 },
  { file: 'cushion.png', cx: 184, cy: 410 },
] as const;

const LOFT: Layout = {
  id: 'loft',
  sleepOnBed: true,
  window: { pos: [64, 40], size: [128, 72] },
  props: [
    // Side-wall bed 1.0 × 2.0 m: long axis vertical, head at the top (guide rule 10) → 64 × 146 px box.
    { id: 'bed', facing: 'side-wall', rotated: true, footprint: [1, 14, 4, 8], occluder: false, rise: 18 },
    // Nightstand 0.5 m → 32 × 32 px box.
    { id: 'nightstand', facing: 'down', rotated: false, footprint: [5, 13, 2, 1], occluder: false, rise: 16 },
    { id: 'lamp', facing: 'back-wall', rotated: false, footprint: [13, 8, 2, 1], occluder: true, rise: 97 },
    { id: 'near-rim-l', facing: 'down', rotated: false, footprint: [1, 34, 5, 2], occluder: true, rise: 0 },
    { id: 'near-rim-r', facing: 'down', rotated: false, footprint: [10, 34, 5, 2], occluder: true, rise: 0 },
  ],
  hotspots: [
    {
      id: 'bed',
      kind: 'bed',
      ellipse: [48, 288, 28, 16],
      footprint: [1, 14, 4, 8],
      labelAnchor: [48, 214],
      walk: [104, 296],
      thing: 'Bed',
      action: 'Sleep',
      coach: 'den',
    },
    {
      id: 'lamp',
      kind: 'lamp',
      ellipse: [224, 136, 12, 6],
      footprint: [13, 8, 2, 1],
      labelAnchor: [224, 24],
      walk: [200, 176],
      thing: 'Lamp',
      action: 'Light',
      coach: 'play',
    },
    {
      id: 'door',
      kind: 'door',
      ellipse: [128, 560, 30, 10],
      footprint: [6, 34, 4, 2],
      labelAnchor: [128, 546],
      walk: [128, 520],
      thing: 'Door',
      action: 'Hideout',
      coach: 'expedition',
    },
  ],
  spawns: { default: [160, 336], door: [128, 520] },
  targets: { bowl: [160, 430], bed: [48, 272], cushion: [48, 272], door: [128, 520], chair: [160, 336], boombox: [160, 390], lamp: [200, 176] },
  lights: [
    [80, 48],
    [128, 40],
    [176, 48],
  ],
  rugs: [[160, 400, 48, 18]],
};

const UNDERGROUND: Layout = {
  id: 'underground',
  sleepOnBed: false,
  window: null,
  props: [
    // Floor speakers 1.0 m → 32 × 71 px box.
    { id: 'speakerL', facing: 'down', rotated: false, footprint: [1, 15, 2, 2], occluder: true, rise: 39 },
    { id: 'speakerR', facing: 'down', rotated: false, footprint: [13, 15, 2, 2], occluder: true, rise: 39 },
    { id: 'hatch', facing: 'down', rotated: false, footprint: [6, 30, 4, 2], occluder: false, rise: 0 },
    { id: 'near-rim-l', facing: 'down', rotated: false, footprint: [1, 34, 5, 2], occluder: true, rise: 0 },
    { id: 'near-rim-r', facing: 'down', rotated: false, footprint: [10, 34, 5, 2], occluder: true, rise: 0 },
  ],
  hotspots: [
    {
      id: 'manhole',
      kind: 'hatch',
      ellipse: [128, 496, 30, 15],
      footprint: [6, 30, 4, 2],
      labelAnchor: [128, 476],
      walk: [128, 456],
      thing: 'Hatch',
      action: 'Hideout',
      coach: 'dive',
    },
    {
      id: 'door',
      kind: 'door',
      ellipse: [128, 560, 30, 10],
      footprint: [6, 34, 4, 2],
      labelAnchor: [128, 546],
      walk: [128, 520],
      thing: 'Door',
      action: 'Up',
      coach: 'expedition',
    },
  ],
  spawns: { default: [128, 360], hatch: [128, 456], door: [128, 520] },
  targets: { bowl: [128, 400], bed: [128, 336], cushion: [128, 336], door: [128, 520], chair: [128, 360], boombox: [128, 400] },
  lights: [
    [80, 56],
    [128, 48],
    [176, 56],
  ],
  rugs: [],
};

const TEASE = {
  placeholder: true,
  _comment: 'PLACEHOLDER — Hideout right-wall tease (Loft side), on the side cap / back-right wall, not the floor.',
  boarded: { pos: [232, 32], size: [24, 96] },
  tarp: { pos: [224, 24], size: [32, 40] },
  scaffold: { pos: [244, 40], size: [12, 100] },
  sign: { pos: [220, 92], size: [36, 32] }, // bottom 124: stays on the wall (floor starts at 128)
};

/* ---------------------------------------------- widen --- */
// Layouts are authored on the 256-wide grid; the room is now 352 (3 more walk columns each
// side). Things by the left wall stay, the middle moves 48 px, things by the right wall 96 px.
const WIDEN_PX = (TD_CANVAS[0] - 256) / 2;
const WIDEN_COLS = WIDEN_PX / TD_TILE;
function wx(x: number): number {
  return x < 48 ? x : x >= 176 ? x + WIDEN_PX * 2 : x + WIDEN_PX;
}
function wc(c: number): number {
  return c < 3 ? c : c >= 11 ? c + WIDEN_COLS * 2 : c + WIDEN_COLS;
}
const wpt = (p: Pt): Pt => [wx(p[0]), p[1]];
const wfoot = (f: Foot): Foot => [wc(f[0]), f[1], f[2], f[3]];
function widen(layout: Layout): Layout {
  return {
    ...layout,
    window: layout.window ? { pos: wpt(layout.window.pos), size: layout.window.size } : null,
    props: layout.props.map((p) =>
      p.id === 'near-rim-l'
        ? { ...p, footprint: [1, 34, DOOR_COL0 - 1, 2] as Foot }
        : p.id === 'near-rim-r'
          ? { ...p, footprint: [DOOR_COL1, 34, TD_COLS - 1 - DOOR_COL1, 2] as Foot }
          : { ...p, footprint: wfoot(p.footprint) },
    ),
    hotspots: layout.hotspots.map((h) => ({
      ...h,
      ellipse: [wx(h.ellipse[0]), h.ellipse[1], h.ellipse[2], h.ellipse[3]] as const,
      footprint: wfoot(h.footprint),
      labelAnchor: wpt(h.labelAnchor),
      walk: wpt(h.walk),
    })),
    spawns: Object.fromEntries(Object.entries(layout.spawns).map(([k, v]) => [k, wpt(v)])),
    targets: Object.fromEntries(Object.entries(layout.targets).map(([k, v]) => [k, wpt(v)])),
    lights: layout.lights.map(wpt),
    rugs: layout.rugs.map(([cx, cy, rx, ry]) => [wx(cx), cy, rx, ry] as const),
  };
}
/** Hideout after widening: the lamp goes back beside the couch (the widen split moved the couch 3 cols). */
function tweakHideout(layout: Layout): Layout {
  return { ...layout, props: layout.props.map((p) => (p.id === 'lamp' ? { ...p, footprint: [4, 13, 2, 1] as Foot } : p)) };
}
/** Warm lamp pool centred on the Hideout lamp. */
function lampGlow(layout: Layout): Pt {
  const lamp = layout.props.find((p) => p.id === 'lamp');
  return lamp ? [(lamp.footprint[0] + lamp.footprint[2] / 2) * TD_TILE, 150] : [32, 150];
}
function widenTease(t: typeof TEASE): typeof TEASE {
  const r = (v: { pos: number[]; size: number[] }) => ({ pos: [wx(v.pos[0]!), v.pos[1]!], size: v.size });
  return { ...t, boarded: r(t.boarded), tarp: r(t.tarp), scaffold: r(t.scaffold), sign: r(t.sign) };
}

/* ---------------------------------------------- paint --- */

type RGBA = [number, number, number, number];
const T = TD_TILE;
/** Floor checker follows the 32px art tile (what PixelLab tilesets will fill). */
const AT = TD_ART_TILE;
const W = TD_CANVAS[0];
const H = TD_CANVAS[1];

function paintBack(layout: Layout, night: boolean): Buffer {
  const wall: RGBA = night ? [58, 54, 62, 255] : [92, 88, 96, 255];
  const beam: RGBA = night ? [28, 26, 32, 255] : [42, 40, 46, 255];
  const cap: RGBA = night ? [118, 114, 120, 255] : [168, 164, 170, 255];
  const seam: RGBA = [32, 30, 36, 255];
  return png(W, H, (x, y) => {
    if ((x + y * 3) % 61 === 0 && y < WALL_BOTTOM) return [255, 80, 180, 140];
    if (y < CEIL) return beam;
    if (y < WALL_BOTTOM) {
      if (layout.window) {
        const [wx, wy] = layout.window.pos;
        const [ww, wh] = layout.window.size;
        if (x >= wx && x < wx + ww && y >= wy && y < wy + wh) return [0, 0, 0, 0];
      }
      if (y >= WALL_BOTTOM - 4) return seam;
      return wall;
    }
    // Side-wall caps (top surface, light) running the floor height.
    if (x < CAP || x >= W - CAP) {
      if (y >= FLOOR_BOTTOM) return [72, 70, 76, 255];
      return cap;
    }
    return [0, 0, 0, 0];
  });
}

function paintFloor(layout: Layout, night: boolean): Buffer {
  const a: RGBA = night ? [78, 76, 82, 255] : [142, 140, 146, 255];
  const b: RGBA = night ? [86, 84, 90, 255] : [154, 152, 158, 255];
  const rim: RGBA = night ? [64, 62, 68, 255] : [110, 108, 114, 255];
  return png(W, H, (x, y) => {
    if (y < WALL_BOTTOM) return [0, 0, 0, 0];
    if (x < CAP || x >= W - CAP) return [0, 0, 0, 0];
    if (y >= FLOOR_BOTTOM) {
      const door = x >= DOOR_COL0 * T && x < DOOR_COL1 * T;
      if (door) {
        const tile = (Math.floor(x / AT) + Math.floor(y / AT)) % 2 === 0;
        return tile ? a : b;
      }
      return rim;
    }
    for (const [cx, cy, rx, ry] of layout.rugs) {
      if (inEllipse(x, y, cx, cy, rx, ry)) return night ? [96, 72, 78, 255] : [168, 128, 132, 255];
    }
    const hatch = layout.props.find((p) => p.id === 'hatch');
    if (hatch) {
      const [cx, cy, rx, ry] = layout.hotspots.find((h) => h.kind === 'hatch')?.ellipse ?? [128, 496, 30, 15];
      if (inEllipse(x, y, cx, cy, rx, ry)) {
        const inner = inEllipse(x, y, cx, cy, rx - 3, ry - 2);
        return inner ? [28, 26, 30, 255] : [48, 46, 52, 255];
      }
    }
    const tile = (Math.floor(x / AT) + Math.floor(y / AT)) % 2 === 0;
    return tile ? a : b;
  });
}

function propColor(id: string, top: boolean, night: boolean): RGBA {
  const pal: Record<string, [RGBA, RGBA]> = {
    boombox: [
      [48, 48, 54, 255],
      [72, 72, 80, 255],
    ],
    chair: [
      [42, 44, 52, 255],
      [64, 68, 78, 255],
    ],
    lamp: [
      [90, 78, 52, 255],
      [186, 168, 96, 255],
    ],
    bed: [
      [72, 58, 62, 255],
      [128, 108, 112, 255],
    ],
    nightstand: [
      [62, 50, 46, 255],
      [110, 88, 78, 255],
    ],
    speakerL: [
      [40, 40, 46, 255],
      [70, 70, 78, 255],
    ],
    speakerR: [
      [40, 40, 46, 255],
      [70, 70, 78, 255],
    ],
    hatch: [
      [36, 36, 40, 255],
      [36, 36, 40, 255],
    ],
  };
  const pair = pal[id] ?? [
    [50, 50, 54, 255],
    [80, 80, 86, 255],
  ];
  const c = top ? pair[1] : pair[0];
  if (night) return [Math.max(0, c[0] - 20), Math.max(0, c[1] - 20), Math.max(0, c[2] - 16), 255];
  return c;
}

function paintProps(layout: Layout, night: boolean, front: boolean, neonBoost = 0): Buffer {
  return png(W, H, (x, y) => {
    for (const p of layout.props) {
      if (p.id === 'hatch') continue;
      const f = footPx(p.footprint);
      const [sx, sy, sw, sh] = spriteRect(p);
      if (x < sx || x >= sx + sw || y < sy || y >= sy + sh) continue;
      const topH = Math.max(3, Math.round(p.rise / 3));
      const isTop = y < sy + topH;
      const split = p.occluder;
      const onFront = split && y >= f.y; // lower (front) face sits on the occluder layer
      if (front && !onFront) continue;
      if (!front && onFront) continue;
      // Contact line at footprint bottom.
      if (y === f.bottom - 1 && x >= f.x && x < f.x + f.w) return [24, 22, 26, 255];
      // Shadow down-right 2px.
      if (!front && y >= f.bottom && y < f.bottom + 3 && x >= f.x + 2 && x < f.x + f.w + 3) {
        return [20, 18, 22, 90];
      }
      if (inFoot(x, y, p.footprint) || (y >= sy && y < f.y)) {
        const c = propColor(p.id, isTop, night);
        if (neonBoost > 0 && (p.id === 'lamp' || p.id.startsWith('speaker'))) {
          const g = neonBoost;
          return [
            Math.min(255, c[0] + g),
            Math.min(255, c[1] + Math.round(g * 0.7)),
            Math.min(255, c[2] + Math.round(g * 0.3)),
            c[3],
          ];
        }
        return c;
      }
    }
    // Near-wall rim as a front occluder so the hero is never hidden (guide 15).
    if (front && y >= FLOOR_BOTTOM && (x < DOOR_COL0 * T || x >= DOOR_COL1 * T) && x >= CAP && x < W - CAP) {
      return [72, 70, 76, 220];
    }
    return [0, 0, 0, 0];
  });
}

function paintNeon(layout: Layout, variant: 'a' | 'b'): Buffer {
  const win = layout.window;
  return png(W, H, (x, y) => {
    if (!win) {
      // Underground: cool floor ellipse spotlight.
      if (inEllipse(x, y, TD_CANVAS[0] / 2, 360, 56, 20)) {
        const a = variant === 'a' ? 50 : 70;
        return [80, 160, 200, a];
      }
      return [0, 0, 0, 0];
    }
    const [wx, wy] = win.pos;
    const [ww, wh] = win.size;
    if (x >= wx && x < wx + ww && y >= wy && y < wy + wh) {
      const pulse = variant === 'a' ? 1 : 0.7;
      const city = x % 14 < 6 && y % 10 < 5;
      return city ? [40, 80, Math.round(180 * pulse), 255] : [18, 22, 48, 255];
    }
    // Skewed sill light patch on the floor (guide 19).
    if (y > WALL_BOTTOM && y < WALL_BOTTOM + 36) {
      const cx = wx + ww / 2;
      const dx = Math.abs(x - cx) / (ww / 2 + (y - WALL_BOTTOM) * 0.4);
      if (dx < 1) return [255, 220, 140, Math.round((1 - dx) * (variant === 'a' ? 40 : 28))];
    }
    return [0, 0, 0, 0];
  });
}

function windowSprite(night: boolean): Buffer {
  return png(128, 72, (x, y) => {
    if (x < 3 || y < 3 || x > 124 || y > 68) return [48, 44, 50, 255];
    if (x === 64 || y === 36) return [48, 44, 50, 255];
    const glow: RGBA = night ? [36, 48, 110, 255] : [210, 190, 130, 255];
    const pane: RGBA = night ? [20, 28, 64, 255] : [176, 204, 220, 255];
    return (x + y) % 5 === 0 ? glow : pane;
  });
}

function glowOverlay(): Buffer {
  return png(W, H, (x, y) => {
    const dx = (x - wx(224)) / 56; // Loft lamp (widened)
    const dy = (y - 136) / 48;
    const d = dx * dx + dy * dy;
    if (d > 1) return [0, 0, 0, 0];
    const a = Math.round((1 - d) * (1 - d) * 100);
    return [255, 176, 72, a];
  });
}

function decodePng(buf: Buffer): { w: number; h: number; px: Buffer } {
  // Minimal IHDR + IDAT inflate. Our encoder uses filter 0, RGBA.
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  const chunks: Buffer[] = [];
  let o = 8;
  while (o < buf.length) {
    const len = buf.readUInt32BE(o);
    const type = buf.toString('ascii', o + 4, o + 8);
    if (type === 'IDAT') chunks.push(buf.subarray(o + 8, o + 8 + len));
    o += 12 + len;
    if (type === 'IEND') break;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    const row = y * (w * 4 + 1);
    if (raw[row] !== 0) throw new Error('unexpected png filter');
    raw.copy(out, y * w * 4, row + 1, row + 1 + w * 4);
  }
  return { w, h, px: out };
}

function composite(layers: Buffer[]): Buffer {
  const decoded = layers.map(decodePng);
  const w = decoded[0]!.w;
  const h = decoded[0]!.h;
  return png(w, h, (x, y) => {
    let r = 12,
      g = 12,
      b = 16,
      a = 255;
    for (const d of decoded) {
      const i = (y * d.w + x) * 4;
      const sa = d.px[i + 3]! / 255;
      if (sa === 0) continue;
      r = Math.round(d.px[i]! * sa + r * (1 - sa));
      g = Math.round(d.px[i + 1]! * sa + g * (1 - sa));
      b = Math.round(d.px[i + 2]! * sa + b * (1 - sa));
      a = 255;
    }
    return [r, g, b, a];
  });
}

function write(name: string, buf: Buffer) {
  const path = join(ROOT, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buf);
  console.log(`  ${name} ${buf.length}b`);
}

function writeJson(name: string, value: unknown) {
  const path = join(ROOT, name);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  console.log(`  ${name}`);
}

function emitArt(layout: Layout) {
  const walkable = buildWalkable(layout);
  const art = paintHideoutArt({
    W,
    H,
    wallBottom: WALL_BOTTOM,
    floorBottom: FLOOR_BOTTOM,
    cap: CAP,
    door: [DOOR_COL0 * T, DOOR_COL1 * T],
    window: layout.window,
    props: layout.props
      .filter((p) => HIDEOUT_FILES[p.id])
      .map((p) => {
        const f = footPx(p.footprint);
        return { id: p.id, file: HIDEOUT_FILES[p.id]!, foot: { x: f.x, w: f.w, bottom: f.bottom }, occluder: p.occluder };
      }),
    flats: HIDEOUT_FLATS.map((f) => ({ ...f, cx: wx(f.cx) })),
    lamp: lampGlow(layout),
    screen: [40, 110],
  });
  const rects = new Map(art.sprites.map((s) => [s.id, s.rect]));
  // The near rim keeps its greybox crop (the art painter draws the rim into the occluder layer).
  for (const p of layout.props) if (!rects.has(p.id)) rects.set(p.id, spriteRect(p));
  writeJson(`${layout.id}/${layout.id}-td.map.json`, mapJson(layout, walkable, rects));
  const id = layout.id;
  write(`${id}/${id}-td-back.png`, art.back);
  write(`${id}/${id}-td-floor.png`, art.floor);
  write(`${id}/${id}-td-props.png`, art.props);
  // One sprite set for every time/neon state: the lights live in the neon layers.
  for (const k of ['day-a', 'day-b', 'night-a', 'night-b']) write(`${id}/${id}-td-occlude-${k}.png`, art.occluder);
  write(`${id}/${id}-td-neon-a.png`, art.neonA);
  write(`${id}/${id}-td-neon-b.png`, art.neonB);
}

function emit(layout: Layout, night: boolean) {
  if (layout.id === 'hideout' && hideoutArtAvailable()) return emitArt(layout);
  const walkable = buildWalkable(layout);
  writeJson(`${layout.id}/${layout.id}-td.map.json`, mapJson(layout, walkable));
  const back = paintBack(layout, night);
  const floor = paintFloor(layout, night);
  const props = paintProps(layout, night, false);
  const occludeDayA = paintProps(layout, false, true, 0);
  const occludeDayB = paintProps(layout, false, true, 18);
  const occludeNightA = paintProps(layout, true, true, 0);
  const occludeNightB = paintProps(layout, true, true, 22);
  const neonA = paintNeon(layout, 'a');
  const neonB = paintNeon(layout, 'b');
  write(`${layout.id}/${layout.id}-td-back.png`, back);
  write(`${layout.id}/${layout.id}-td-floor.png`, floor);
  write(`${layout.id}/${layout.id}-td-props.png`, props);
  write(`${layout.id}/${layout.id}-td-occlude-day-a.png`, occludeDayA);
  write(`${layout.id}/${layout.id}-td-occlude-day-b.png`, occludeDayB);
  write(`${layout.id}/${layout.id}-td-occlude-night-a.png`, occludeNightA);
  write(`${layout.id}/${layout.id}-td-occlude-night-b.png`, occludeNightB);
  write(`${layout.id}/${layout.id}-td-neon-a.png`, neonA);
  write(`${layout.id}/${layout.id}-td-neon-b.png`, neonB);
  // Preview only (not bundled, not in the library): the room flattened.
  if (process.env.HIDEOUT_SNAPSHOT_DIR) {
    const snap = join(process.env.HIDEOUT_SNAPSHOT_DIR, `${layout.id}-td-snapshot.png`);
    writeFileSync(snap, composite([back, floor, neonA, props, occludeDayA]));
  }
}

emit(tweakHideout(widen(HIDEOUT)), false);
emit(widen(LOFT), false);
emit(widen(UNDERGROUND), true);
write('loft/loft-td-window-day.png', windowSprite(false));
write('loft/loft-td-window-night.png', windowSprite(true));
write('loft/loft-td-glow.png', glowOverlay());
writeJson('hideout/hideout-tease.json', widenTease(TEASE));
write('hideout/neighbor-boarded-td.png', paintBack({ ...widen(UNDERGROUND), window: null }, true));
console.log('hideout 3/4 top-down greybox written (option A) — now run npm run art:sync');
