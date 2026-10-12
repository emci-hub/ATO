/**
 * Greybox 3/4 top-down room art + maps from the locked layout A.
 * Run: npx tsx scripts/gen-hideout-td.ts
 *
 * Placeholders until Sprite Smith art lands at sprite-smith-out. Schema:
 * 264×576 canvas, 12px tiles (22×48), floor 20×36, door gap 4 tiles.
 * Occluders are ONE combined layer per time/neon state; map JSON carries
 * per-prop crop rects + sortY. Room/props sized to the god hero at 1/2
 * of the 192px cell (96px); stages render smaller in the same room.
 */
import { deflateSync, inflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT = join(__dirname, '..', 'assets', 'play', 'rooms');
export const TD_CANVAS = [264, 576] as const;
export const TD_TILE = 12;
export const TD_COLS = 22;
export const TD_ROWS = 48;
export const TD_FLOOR_COLS = 20;
export const TD_FLOOR_ROWS = 36;
export const TD_DOOR_TILES = 4;
export const TD_CAP_TILES = 1;
export const TD_CEIL_TILES = 1;
export const TD_WALL_TILES = 9;

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
  ihdr.writeUInt32BE(h, 0);
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

/** Shell: 1-tile ceiling, 9-tile back wall, 36-tile floor, 2-tile near rim, 1-tile caps. */
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

function mapJson(layout: Layout, walkable: string[]) {
  return {
    _meta: {
      canvas: [...TD_CANVAS],
      tile: TD_TILE,
      cols: TD_COLS,
      rows: TD_ROWS,
      floor: [TD_FLOOR_COLS, TD_FLOOR_ROWS],
      doorTiles: TD_DOOR_TILES,
      projection: 'three-quarter-topdown',
      heroCellPx: 96,
      heroFigurePx: 53,
      heroRenderScale: 0.5,
      contentBounds: [0, 0, TD_CANVAS[0], TD_CANVAS[1]],
      placeholder: true,
      sleepOnBed: layout.sleepOnBed,
      source: 'scripts/gen-hideout-td.ts — greybox until Sprite Smith art lands at sprite-smith-out',
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
      const sprite = spriteRect(p);
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

const HIDEOUT: Layout = {
  id: 'hideout',
  sleepOnBed: false,
  window: { pos: [72, 24], size: [120, 84] },
  props: [
    { id: 'boombox', facing: 'down', rotated: false, footprint: [2, 22, 2, 1], occluder: false, rise: 18 },
    { id: 'chair', facing: 'down', rotated: false, footprint: [16, 26, 2, 2], occluder: true, rise: 24 },
    { id: 'lamp', facing: 'back-wall', rotated: false, footprint: [19, 10, 1, 2], occluder: true, rise: 36 },
    { id: 'hatch', facing: 'down', rotated: false, footprint: [10, 43, 2, 2], occluder: false, rise: 0 },
    { id: 'near-rim-l', facing: 'down', rotated: false, footprint: [1, 46, 8, 2], occluder: true, rise: 0 },
    { id: 'near-rim-r', facing: 'down', rotated: false, footprint: [13, 46, 8, 2], occluder: true, rise: 0 },
  ],
  hotspots: [
    {
      id: 'door',
      kind: 'door',
      ellipse: [132, 564, 24, 10],
      footprint: [9, 46, 4, 2],
      labelAnchor: [132, 552],
      walk: [132, 534],
      thing: 'Door',
      action: 'Explore',
      coach: 'expedition',
    },
    {
      id: 'chair',
      kind: 'chair',
      ellipse: [204, 324, 12, 8],
      footprint: [16, 26, 2, 2],
      labelAnchor: [204, 300],
      walk: [174, 330],
      thing: 'Chair',
      action: 'Stash',
      coach: 'den',
    },
    {
      id: 'boombox',
      kind: 'boombox',
      ellipse: [36, 270, 12, 6],
      footprint: [2, 22, 2, 1],
      labelAnchor: [36, 252],
      walk: [66, 270],
      thing: 'Boombox',
      action: 'Play',
      coach: 'play',
    },
    {
      id: 'manhole',
      kind: 'hatch',
      ellipse: [132, 528, 16, 10],
      footprint: [10, 43, 2, 2],
      labelAnchor: [132, 516],
      walk: [132, 498],
      thing: 'Hatch',
      action: 'Underground',
      coach: 'dive',
    },
  ],
  spawns: { default: [132, 336], door: [132, 534], hatch: [132, 498] },
  targets: { bowl: [78, 486], bed: [174, 390], cushion: [174, 390], door: [132, 534], chair: [174, 330], boombox: [66, 270] },
  lights: [
    [88, 36],
    [132, 32],
    [176, 36],
    [72, 72],
    [192, 72],
  ],
  rugs: [[132, 336, 40, 16]],
};

const LOFT: Layout = {
  id: 'loft',
  sleepOnBed: true,
  window: { pos: [72, 24], size: [120, 84] },
  props: [
    // Side-wall bed: long axis vertical, head at the top (guide rule 10).
    { id: 'bed', facing: 'side-wall', rotated: true, footprint: [1, 18, 3, 6], occluder: false, rise: 18 },
    { id: 'nightstand', facing: 'down', rotated: false, footprint: [4, 17, 1, 1], occluder: false, rise: 12 },
    { id: 'lamp', facing: 'back-wall', rotated: false, footprint: [19, 10, 1, 2], occluder: true, rise: 36 },
    { id: 'near-rim-l', facing: 'down', rotated: false, footprint: [1, 46, 8, 2], occluder: true, rise: 0 },
    { id: 'near-rim-r', facing: 'down', rotated: false, footprint: [13, 46, 8, 2], occluder: true, rise: 0 },
  ],
  hotspots: [
    {
      id: 'bed',
      kind: 'bed',
      ellipse: [30, 252, 18, 12],
      footprint: [1, 18, 3, 6],
      labelAnchor: [30, 204],
      walk: [66, 258],
      thing: 'Bed',
      action: 'Sleep',
      coach: 'den',
    },
    {
      id: 'lamp',
      kind: 'lamp',
      ellipse: [234, 132, 8, 6],
      footprint: [19, 10, 1, 2],
      labelAnchor: [234, 108],
      walk: [210, 174],
      thing: 'Lamp',
      action: 'Light',
      coach: 'play',
    },
    {
      id: 'door',
      kind: 'door',
      ellipse: [132, 564, 24, 10],
      footprint: [9, 46, 4, 2],
      labelAnchor: [132, 552],
      walk: [132, 534],
      thing: 'Door',
      action: 'Hideout',
      coach: 'expedition',
    },
  ],
  spawns: { default: [160, 336], door: [132, 534] },
  targets: { bowl: [160, 420], bed: [30, 240], cushion: [30, 240], door: [132, 534], chair: [160, 336], boombox: [160, 390], lamp: [210, 174] },
  lights: [
    [88, 36],
    [132, 32],
    [176, 36],
  ],
  rugs: [[160, 390, 36, 14]],
};

const UNDERGROUND: Layout = {
  id: 'underground',
  sleepOnBed: false,
  window: null,
  props: [
    { id: 'speakerL', facing: 'down', rotated: false, footprint: [1, 20, 2, 3], occluder: true, rise: 36 },
    { id: 'speakerR', facing: 'down', rotated: false, footprint: [19, 20, 2, 3], occluder: true, rise: 36 },
    { id: 'hatch', facing: 'down', rotated: false, footprint: [10, 43, 2, 2], occluder: false, rise: 0 },
    { id: 'near-rim-l', facing: 'down', rotated: false, footprint: [1, 46, 8, 2], occluder: true, rise: 0 },
    { id: 'near-rim-r', facing: 'down', rotated: false, footprint: [13, 46, 8, 2], occluder: true, rise: 0 },
  ],
  hotspots: [
    {
      id: 'manhole',
      kind: 'hatch',
      ellipse: [132, 528, 16, 10],
      footprint: [10, 43, 2, 2],
      labelAnchor: [132, 516],
      walk: [132, 498],
      thing: 'Hatch',
      action: 'Hideout',
      coach: 'dive',
    },
    {
      id: 'door',
      kind: 'door',
      ellipse: [132, 564, 24, 10],
      footprint: [9, 46, 4, 2],
      labelAnchor: [132, 552],
      walk: [132, 534],
      thing: 'Door',
      action: 'Up',
      coach: 'expedition',
    },
  ],
  spawns: { default: [132, 336], hatch: [132, 498], door: [132, 534] },
  targets: { bowl: [132, 390], bed: [132, 336], cushion: [132, 336], door: [132, 534], chair: [132, 360], boombox: [132, 390] },
  lights: [
    [80, 48],
    [132, 40],
    [184, 48],
  ],
  rugs: [],
};

const TEASE = {
  placeholder: true,
  _comment: 'PLACEHOLDER — Hideout right-wall tease (Loft side), on the side cap / back-right wall, not the floor.',
  boarded: { pos: [240, 24], size: [24, 96] },
  tarp: { pos: [232, 16], size: [32, 40] },
  scaffold: { pos: [252, 36], size: [12, 100] },
  sign: { pos: [228, 100], size: [36, 32] },
};

/* ---------------------------------------------- paint --- */

type RGBA = [number, number, number, number];
const T = TD_TILE;
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
        const tile = (Math.floor(x / T) + Math.floor(y / T)) % 2 === 0;
        return tile ? a : b;
      }
      return rim;
    }
    for (const [cx, cy, rx, ry] of layout.rugs) {
      if (inEllipse(x, y, cx, cy, rx, ry)) return night ? [96, 72, 78, 255] : [168, 128, 132, 255];
    }
    const hatch = layout.props.find((p) => p.id === 'hatch');
    if (hatch) {
      const [cx, cy, rx, ry] = layout.hotspots.find((h) => h.kind === 'hatch')?.ellipse ?? [132, 520, 16, 8];
      if (inEllipse(x, y, cx, cy, rx, ry)) {
        const inner = inEllipse(x, y, cx, cy, rx - 3, ry - 2);
        return inner ? [28, 26, 30, 255] : [48, 46, 52, 255];
      }
    }
    const tile = (Math.floor(x / T) + Math.floor(y / T)) % 2 === 0;
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
      if (inEllipse(x, y, 132, 360, 48, 18)) {
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
  return png(120, 84, (x, y) => {
    if (x < 3 || y < 3 || x > 116 || y > 80) return [48, 44, 50, 255];
    if (x === 60 || y === 42) return [48, 44, 50, 255];
    const glow: RGBA = night ? [36, 48, 110, 255] : [210, 190, 130, 255];
    const pane: RGBA = night ? [20, 28, 64, 255] : [176, 204, 220, 255];
    return (x + y) % 5 === 0 ? glow : pane;
  });
}

function glowOverlay(): Buffer {
  return png(W, H, (x, y) => {
    const dx = (x - 234) / 40;
    const dy = (y - 132) / 36;
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

function emit(layout: Layout, night: boolean) {
  const walkable = buildWalkable(layout);
  writeJson(`${layout.id}-td.map.json`, mapJson(layout, walkable));
  const back = paintBack(layout, night);
  const floor = paintFloor(layout, night);
  const props = paintProps(layout, night, false);
  const occludeDayA = paintProps(layout, false, true, 0);
  const occludeDayB = paintProps(layout, false, true, 18);
  const occludeNightA = paintProps(layout, true, true, 0);
  const occludeNightB = paintProps(layout, true, true, 22);
  const neonA = paintNeon(layout, 'a');
  const neonB = paintNeon(layout, 'b');
  write(`${layout.id}-td-back.png`, back);
  write(`${layout.id}-td-floor.png`, floor);
  write(`${layout.id}-td-props.png`, props);
  write(`${layout.id}-td-occlude-day-a.png`, occludeDayA);
  write(`${layout.id}-td-occlude-day-b.png`, occludeDayB);
  write(`${layout.id}-td-occlude-night-a.png`, occludeNightA);
  write(`${layout.id}-td-occlude-night-b.png`, occludeNightB);
  write(`${layout.id}-td-neon-a.png`, neonA);
  write(`${layout.id}-td-neon-b.png`, neonB);
  write(`${layout.id}-td-snapshot.png`, composite([back, floor, neonA, props, occludeDayA]));
}

emit(HIDEOUT, false);
emit(LOFT, false);
emit(UNDERGROUND, true);
write('loft-td-window-day.png', windowSprite(false));
write('loft-td-window-night.png', windowSprite(true));
write('loft-td-glow.png', glowOverlay());
writeJson('hideout-tease.json', TEASE);
write('neighbor-boarded-td.png', paintBack({ ...UNDERGROUND, window: null }, true));
console.log('hideout 3/4 top-down greybox written');
