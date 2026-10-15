/**
 * Streetwear Hideout — 3/4 top-down enclosed room (layout A).
 *
 * Canvas 352×576 (option A tiles, widened 2026-10-13; 32px art tiles, hero 1:1), 16px walk grid, A* roam, depth sort by footprint
 * bottom Y. Greybox art from the map until Sprite Smith lands.
 */
import hideoutMap from '@/assets/art/rooms/hideout/hideout-td.map.json';
import type { PetStage } from '@/play/pet';
import {
  PET_FORM_MOTION,
  MOOD_MOTION,
  petPose,
  petPoseMs,
  type PetClip,
  type PetPlanInput,
  type PetPose,
} from '@/play/pet-actor';
import {
  astar,
  clampToGrid,
  isWalkableArt,
  pathClear,
  randomWalkable,
  route,
  tileCenter,
  withClearance,
  type CollisionGrid,
  type Pt,
} from '@/play/hideout-path';

export type { CollisionGrid, Pt } from '@/play/hideout-path';
export { astar, clampToGrid, isWalkableArt, lineOfSight, pathClear, route, stringPull, withClearance } from '@/play/hideout-path';

/**
 * Option A (emci 2026-10-12, docs/art/PIXELLAB_GUIDE.md §2): PixelLab-native
 * 32 px art tiles, room 352×576 (11×18 art tiles; was 256 wide), grown hero drawn 1:1.
 */
export const HIDEOUT_CANVAS: readonly [number, number] = [352, 576];
export const HIDEOUT_NIGHT = '#0C0D23';
/** PixelLab Streetwear hero cell. Room/prop art is authored against this. */
export const HIDEOUT_HERO_SRC_PX = 192;
/**
 * Hero-in-room render scale for the FINAL fully grown hero (god): 1:1, never
 * rescaled (pixels stay crisp). Room and props are sized to this and never
 * change. Stages interpolate below it (`HIDEOUT_STAGE_SCALE`).
 */
export const HIDEOUT_HERO_RENDER_SCALE = 1;
/** Drawn cell for the fully grown hero, in art px (192 × 1 = 192). */
export const HIDEOUT_PET_ART_PX = Math.round(HIDEOUT_HERO_SRC_PX * HIDEOUT_HERO_RENDER_SCALE);
/** Visible body in that cell at the god scale (kael ≈ 106 art px tall) — the scale reference. */
export const HIDEOUT_HERO_FIGURE_PX = 106;
/**
 * Per-stage fraction of the 192px source cell (art-px). Map and props stay
 * put; only the pet sprite (and its floor-contact clearance) grows.
 * egg/baby = 2/3 (128px cell); child 0.74; teen 0.84; adult 0.92; god 1.
 */
export const HIDEOUT_STAGE_SCALE: Record<PetStage, number> = {
  egg: 2 / 3,
  baby: 2 / 3,
  child: 0.74,
  teen: 0.84,
  adult: 0.92,
  god: 1,
};

export function hideoutHeroArtPx(stage: PetStage): number {
  return Math.max(8, Math.round(HIDEOUT_HERO_SRC_PX * HIDEOUT_STAGE_SCALE[stage]));
}

/** Floor-contact radius in art px from the current stage's visible body. */
export function hideoutClearancePx(stage: PetStage): number {
  const figure = HIDEOUT_HERO_FIGURE_PX * (HIDEOUT_STAGE_SCALE[stage] / HIDEOUT_HERO_RENDER_SCALE);
  // Feet radius (~0.15 of the figure): god ≈ 16 art px = one walk cell, so
  // the pet hugs props without its feet ever entering a blocked cell.
  return Math.max(2, Math.round(figure * 0.15));
}
export const HIDEOUT_AURA_PAD_PX = 12;
export const HIDEOUT_MARGIN_PT = 0;
export const HIDEOUT_PHONE_CAP_DPX = 8;
export const HIDEOUT_IPAD_CAP_DPX = 10;
/** Apple HIG 44pt + Material 48dp — chips use the stricter floor. */
export const HIDEOUT_SPOT_HIT_PT = 48;
/** Layout widths the fit-to-screen check pins. */
export const HIDEOUT_PHONE_WIDTHS_PT: readonly number[] = [430, 440];
/** Constant walk speed in art px / second (doubled with the 1:1 hero so the stride feels the same). */
export const HIDEOUT_WALK_ART_PX_PER_SEC = 44;
/** Art tile (PixelLab tilesets / building kit): 32 px, room = 8×18 art tiles. */
export const HIDEOUT_ART_TILE = 32;
/**
 * Walk / collision cell: half an art tile (16 px) so A* paths stay smooth in
 * an 8-tile-wide room. Map footprints, hotspots and the walkable grid use it.
 * Grid 16×36: ceiling 2, back wall 6, floor 26 (14 wide), near rim 2, caps 1, door 4.
 */
export const HIDEOUT_TILE = 16;
export const HIDEOUT_GRID_COLS = 22;
export const HIDEOUT_GRID_ROWS = 36;
export const HIDEOUT_FLOOR_COLS = 20;
export const HIDEOUT_FLOOR_ROWS = 26;
export const HIDEOUT_DOOR_TILES = 4;
export const HIDEOUT_CAP_TILES = 1;
export const HIDEOUT_CEIL_TILES = 2;
export const HIDEOUT_WALL_TILES = 6;

type Rect = readonly [number, number, number, number];

export type HideoutSpotId = 'door' | 'chair' | 'boombox' | 'manhole' | 'bed' | 'lamp';
export type HideoutTargetId = 'bowl' | 'bed' | 'cushion' | 'door' | 'chair' | 'boombox';

export const HIDEOUT_IDLE_FACES = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const;
export type HideoutIdleFace = (typeof HIDEOUT_IDLE_FACES)[number];
export type HideoutWalkFace = 'n' | 'e' | 's' | 'w';

export type HideoutSpot = {
  id: HideoutSpotId;
  kind: string;
  rect: Rect;
  thing: string;
  action: string;
  coach: 'expedition' | 'den' | 'play' | 'dive';
  ellipse: Rect;
  footprint: Rect;
  walk: Pt;
};

export type HideoutProp = {
  id: string;
  rect: Rect;
  /** Source rect in the combined occluder layer (art px). */
  crop: Rect;
  /** Depth key — footprint bottom Y. Pet with feetY < sortY is behind. */
  sortY: number;
  baselineY: number;
  frontCorner: Pt;
  footprint: readonly Pt[];
  footprintCells: Rect;
  occluder: boolean;
  rotated: boolean;
  facing: string;
};

export type HideoutDecal = { id: string; sprite: string; pos: Pt; size: Pt };

type RawHotspot = {
  id: string;
  kind: string;
  ellipse: number[];
  footprint: number[];
  labelAnchor: number[];
  walk: number[];
  thing: string;
  action: string;
  coach: string;
};

type RawProp = {
  id: string;
  facing: string;
  rotated: boolean;
  footprint: number[];
  sprite: number[];
  crop?: number[];
  sortY?: number;
  baselineY: number;
  occluder: boolean;
};

export type TdRawMap = {
  _meta: {
    canvas: number[];
    tile: number;
    contentBounds: number[];
    sleepOnBed?: boolean;
    placeholder?: boolean;
    heroCellPx?: number;
    heroFigurePx?: number | number[];
  };
  layers: Record<string, string | Record<string, string>>;
  collision: { tile: number; cols: number; rows: number; walkable: string[] };
  props: RawProp[];
  hotspots: RawHotspot[];
  spawns: Record<string, number[]>;
  targets: Record<string, number[]>;
  window?: { pos: number[]; size: number[] };
  lights: number[][];
  rugs?: number[][];
};

/** Per-room top-down geometry. */
export type IsoRoomGeom = {
  canvas: readonly [number, number];
  content: Rect;
  tile: number;
  grid: CollisionGrid;
  floor: readonly Pt[];
  walk: readonly Pt[];
  interior: readonly Pt[];
  lights: readonly Pt[];
  props: readonly HideoutProp[];
  decals: readonly HideoutDecal[];
  targets: Record<string, Pt>;
  spawns: Record<string, Pt>;
  hotspots: readonly HideoutSpot[];
  window: { pos: Pt; size: Pt } | null;
  sleepOnBed: boolean;
  layers: Record<string, string | Record<string, string>>;
};

function rect4(v: number[]): Rect {
  return [v[0] ?? 0, v[1] ?? 0, v[2] ?? 0, v[3] ?? 0];
}
function pt2(v: number[]): Pt {
  return [v[0] ?? 0, v[1] ?? 0];
}

function cellsToPoly(foot: Rect, tile: number): Pt[] {
  const [c, r, w, h] = foot;
  const x = c * tile;
  const y = r * tile;
  const bw = w * tile;
  const bh = h * tile;
  return [
    [x, y],
    [x + bw, y],
    [x + bw, y + bh],
    [x, y + bh],
  ];
}

function floorPoly(content: Rect, tile: number): Pt[] {
  const cap = HIDEOUT_CAP_TILES * tile;
  const wallBottom = (HIDEOUT_CEIL_TILES + HIDEOUT_WALL_TILES) * tile;
  const floorBottom = wallBottom + HIDEOUT_FLOOR_ROWS * tile;
  const door0 = Math.floor((content[2] / tile - HIDEOUT_DOOR_TILES) / 2) * tile;
  const door1 = door0 + HIDEOUT_DOOR_TILES * tile;
  return [
    [cap, wallBottom],
    [content[2] - cap, wallBottom],
    [content[2] - cap, floorBottom],
    [door1, floorBottom],
    [door1, content[3]],
    [door0, content[3]],
    [door0, floorBottom],
    [cap, floorBottom],
  ];
}

export function parseIsoGeom(rawMap: unknown, opts?: { sleepOnBed?: boolean }): IsoRoomGeom {
  const m = rawMap as TdRawMap;
  const canvas = (m._meta.canvas && m._meta.canvas.length >= 2
    ? [m._meta.canvas[0], m._meta.canvas[1]]
    : [HIDEOUT_CANVAS[0], HIDEOUT_CANVAS[1]]) as [number, number];
  const content = rect4(m._meta.contentBounds ?? [0, 0, canvas[0], canvas[1]]);
  const tile = m.collision?.tile ?? m._meta.tile ?? HIDEOUT_TILE;
  const grid: CollisionGrid = {
    tile,
    cols: m.collision?.cols ?? Math.floor(canvas[0] / tile),
    rows: m.collision?.rows ?? Math.floor(canvas[1] / tile),
    walkable: m.collision?.walkable ?? [],
  };
  const props: HideoutProp[] = (m.props ?? []).map((p) => {
    const footprintCells = rect4(p.footprint);
    const sprite = rect4(p.sprite);
    const crop = rect4(p.crop ?? p.sprite);
    const poly = cellsToPoly(footprintCells, tile);
    const bottom = footprintCells[1] * tile + footprintCells[3] * tile;
    const sortY = p.sortY ?? bottom;
    return {
      id: p.id,
      rect: sprite,
      crop,
      sortY,
      baselineY: p.baselineY ?? bottom,
      frontCorner: [sprite[0] + sprite[2] / 2, bottom],
      footprint: poly,
      footprintCells,
      occluder: p.occluder === true,
      rotated: p.rotated === true,
      facing: p.facing,
    };
  });
  const targets: Record<string, Pt> = {};
  for (const [k, v] of Object.entries(m.targets ?? {})) targets[k] = pt2(v);
  const spawns: Record<string, Pt> = {};
  for (const [k, v] of Object.entries(m.spawns ?? {})) spawns[k] = pt2(v);
  const hotspots: HideoutSpot[] = (m.hotspots ?? []).map((h) => {
    const fp = rect4(h.footprint);
    const px = cellsToPoly(fp, tile);
    const xs = px.map((p) => p[0]);
    const ys = px.map((p) => p[1]);
    const x0 = Math.min(...xs);
    const y0 = Math.min(...ys);
    return {
      id: (h.id as HideoutSpotId) ?? 'door',
      kind: h.kind ?? h.id,
      rect: [x0, y0, Math.max(...xs) - x0, Math.max(...ys) - y0],
      thing: h.thing,
      action: h.action,
      coach: (h.coach as HideoutSpot['coach']) ?? 'play',
      ellipse: rect4(h.ellipse),
      footprint: fp,
      walk: pt2(h.walk),
    };
  });
  const floor = floorPoly(content, tile);
  const window = m.window?.pos && m.window.size
    ? { pos: pt2(m.window.pos), size: pt2(m.window.size) }
    : null;
  return {
    canvas,
    content,
    tile,
    grid,
    floor,
    walk: floor,
    interior: floor,
    lights: (m.lights ?? []).map(pt2),
    props,
    decals: hotspots
      .filter((h) => h.id === 'manhole' || h.coach === 'dive')
      .map((h) => ({
        id: h.id,
        sprite: 'hatch',
        pos: [h.ellipse[0] - h.ellipse[2], h.ellipse[1] - h.ellipse[3]] as Pt,
        size: [h.ellipse[2] * 2, h.ellipse[3] * 2] as Pt,
      })),
    targets,
    spawns,
    hotspots,
    window,
    sleepOnBed: opts?.sleepOnBed === true || m._meta.sleepOnBed === true,
    layers: m.layers ?? {},
  };
}

const raw = hideoutMap as unknown as TdRawMap;
const HOME = parseIsoGeom(raw, { sleepOnBed: false });

export const HIDEOUT_CONTENT: Rect = HOME.content;
export const HIDEOUT_FLOOR: readonly Pt[] = HOME.floor;
export const HIDEOUT_INTERIOR: readonly Pt[] = HOME.interior;
export const HIDEOUT_LIGHTS: readonly Pt[] = HOME.lights;
export const HIDEOUT_PROPS: readonly HideoutProp[] = HOME.props;
export const HIDEOUT_DECALS: readonly HideoutDecal[] = HOME.decals;
export const HIDEOUT_GRID: CollisionGrid = HOME.grid;
export const HIDEOUT_GEOM: IsoRoomGeom = HOME;

export const HIDEOUT_TARGETS: Record<HideoutTargetId, Pt> = {
  bowl: HOME.targets.bowl ?? [80, 470],
  bed: HOME.targets.bed ?? HOME.targets.cushion ?? [176, 400],
  cushion: HOME.targets.cushion ?? HOME.targets.bed ?? [176, 400],
  door: HOME.targets.door ?? [128, 520],
  chair: HOME.targets.chair ?? [148, 336],
  boombox: HOME.targets.boombox ?? [80, 264],
};

export const HIDEOUT_SPOTS: readonly HideoutSpot[] = HOME.hotspots.filter((h) =>
  (['door', 'chair', 'boombox', 'manhole'] as string[]).includes(h.id),
) as HideoutSpot[];

/* ------------------------------------------------------- geometry --- */

export function pointInPoly(x: number, y: number, polyPts: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = polyPts.length - 1; i < polyPts.length; j = i, i += 1) {
    const xi = polyPts[i][0];
    const yi = polyPts[i][1];
    const xj = polyPts[j][0];
    const yj = polyPts[j][1];
    const hit = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + (yj === yi ? 1e-6 : 0)) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

export function insetPoly(polyPts: readonly Pt[], pad: number): Pt[] {
  if (polyPts.length < 3 || pad <= 0) return polyPts.map((p) => [p[0], p[1]] as Pt);
  let cx = 0;
  let cy = 0;
  for (const p of polyPts) {
    cx += p[0];
    cy += p[1];
  }
  cx /= polyPts.length;
  cy /= polyPts.length;
  return polyPts.map((p) => {
    const dx = p[0] - cx;
    const dy = p[1] - cy;
    const len = Math.hypot(dx, dy) || 1;
    const t = Math.max(0, 1 - pad / len);
    return [cx + dx * t, cy + dy * t] as Pt;
  });
}

export const HIDEOUT_WALK: readonly Pt[] = HOME.walk;

// Keyed on the room's own grid object (rooms can share any single row, so a
// row is not an id), then on the clearance radius (+ rail bounds).
const gridCache = new WeakMap<CollisionGrid, Map<string, CollisionGrid>>();

/** Feet may only stand between these x values (art px): keeps the pet clear of the Hideout rails. */
export type WalkBounds = { minX: number; maxX: number };

/** Block every column whose centre is outside the bounds. Pure. */
export function withWalkBounds(grid: CollisionGrid, bounds: WalkBounds): CollisionGrid {
  const rows = grid.walkable.map((row) => {
    let s = '';
    for (let col = 0; col < grid.cols; col += 1) {
      const cx = (col + 0.5) * grid.tile;
      s += cx < bounds.minX || cx > bounds.maxX ? '0' : (row[col] ?? '0');
    }
    return s;
  });
  return { tile: grid.tile, cols: grid.cols, rows: grid.rows, walkable: rows };
}

export function hideoutGridFor(stage: PetStage, geom?: IsoRoomGeom, bounds?: WalkBounds): CollisionGrid {
  const base = geom?.grid ?? HIDEOUT_GRID;
  const pad = hideoutClearancePx(stage);
  let byPad = gridCache.get(base);
  if (!byPad) {
    byPad = new Map();
    gridCache.set(base, byPad);
  }
  const key = `${pad}|${bounds ? `${Math.round(bounds.minX)}:${Math.round(bounds.maxX)}` : ''}`;
  const hit = byPad.get(key);
  if (hit) return hit;
  const padded = withClearance(base, pad);
  const next = bounds ? withWalkBounds(padded, bounds) : padded;
  byPad.set(key, next);
  return next;
}

export function inFootprint(x: number, y: number): boolean {
  return HIDEOUT_PROPS.some((p) => p.id !== 'hatch' && pointInPoly(x, y, p.footprint));
}

export function onWalkFloor(x: number, y: number, stage: PetStage = 'adult'): boolean {
  return isWalkableArt(hideoutGridFor(stage), x, y);
}

export function clampToWalk(x: number, y: number, stage: PetStage = 'adult'): Pt {
  return clampToGrid(hideoutGridFor(stage), x, y);
}

export function isoRandomWalkPoint(geom: IsoRoomGeom, rng: () => number, stage: PetStage = 'adult', bounds?: WalkBounds): Pt {
  return randomWalkable(hideoutGridFor(stage, geom, bounds), rng) ?? isoClampToWalk(geom.canvas[0] / 2, geom.canvas[1] / 2, geom, stage, bounds);
}

export function randomWalkPoint(rng: () => number, stage: PetStage = 'adult'): Pt {
  return randomWalkable(hideoutGridFor(stage), rng) ?? clampToWalk(HIDEOUT_CANVAS[0] / 2, 360, stage);
}

/**
 * Depth: pet is behind the prop when feet Y is above the footprint bottom
 * (guide rule 9) and the sprite overlaps in X.
 */
export function petBehindProp(feetX: number, feetY: number, prop: HideoutProp, tile = HIDEOUT_TILE): boolean {
  const [c, r, w, h] = prop.footprintCells;
  const x0 = c * tile;
  const y0 = r * tile;
  const x1 = x0 + w * tile;
  const y1 = prop.sortY || y0 + h * tile;
  const overlapX = feetX > x0 - tile && feetX < x1 + tile;
  return overlapX && feetY < y1 && feetY > y0 - (prop.rect[3] || tile * 3);
}

export function petBehindAny(feetX: number, feetY: number): boolean {
  return HIDEOUT_PROPS.some((p) => p.occluder && petBehindProp(feetX, feetY, p));
}

export function isoInFootprint(x: number, y: number, geom: IsoRoomGeom): boolean {
  return geom.props.some((p) => p.id !== 'hatch' && pointInPoly(x, y, p.footprint));
}

export function isoOnWalkFloor(x: number, y: number, geom: IsoRoomGeom, stage: PetStage = 'adult'): boolean {
  return isWalkableArt(hideoutGridFor(stage, geom), x, y);
}

export function isoClampToWalk(x: number, y: number, geom: IsoRoomGeom, stage: PetStage = 'adult', bounds?: WalkBounds): Pt {
  return clampToGrid(hideoutGridFor(stage, geom, bounds), x, y);
}

export function isoPetBehindAny(feetX: number, feetY: number, geom: IsoRoomGeom): boolean {
  return geom.props.some((p) => p.occluder && petBehindProp(feetX, feetY, p, geom.tile));
}

export function isoSleepPoint(geom: IsoRoomGeom): Pt {
  const bed = geom.targets.bed ?? geom.targets.cushion;
  if (!bed) return isoClampToWalk(geom.canvas[0] / 2, 360, geom);
  return geom.sleepOnBed ? bed : isoClampToWalk(bed[0], bed[1], geom);
}

export function occluderProps(geom: IsoRoomGeom, feetX: number, feetY: number): HideoutProp[] {
  return geom.props.filter((p) => p.occluder && petBehindProp(feetX, feetY, p, geom.tile));
}

/* ------------------------------------------------------- integer / fit scale --- */

export type HideoutScale = {
  dpx: number;
  pt: number;
  canvasW: number;
  canvasH: number;
  contentW: number;
  contentH: number;
};

function isRoomCanvas(canvas: readonly [number, number]): boolean {
  return canvas[0] === HIDEOUT_CANVAS[0] && canvas[1] === HIDEOUT_CANVAS[1];
}

/**
 * Room canvases (352×576) fit-to-contain the stage (fills 430pt and 440pt
 * when height allows).
 * Dive 256×320 callers keep the old integer device-px scale.
 */
export function hideoutIntegerScale(input: {
  availW: number;
  availH: number;
  pixelRatio: number;
  content?: Rect;
  canvas?: readonly [number, number];
  phoneCap?: number;
  padCap?: number;
}): HideoutScale {
  const content = input.content ?? HIDEOUT_CONTENT;
  const canvas = input.canvas ?? HIDEOUT_CANVAS;
  const pr = input.pixelRatio > 0 ? input.pixelRatio : 1;
  if (isRoomCanvas(canvas)) {
    const fitPt = Math.min(
      Math.max(0, input.availW) / Math.max(1, content[2]),
      Math.max(0, input.availH) / Math.max(1, content[3]),
    );
    const pt = fitPt > 0 ? fitPt : 1;
    return {
      dpx: pt * pr,
      pt,
      canvasW: canvas[0] * pt,
      canvasH: canvas[1] * pt,
      contentW: content[2] * pt,
      contentH: content[3] * pt,
    };
  }
  const phoneCap = input.phoneCap ?? HIDEOUT_PHONE_CAP_DPX;
  const padCap = input.padCap ?? HIDEOUT_IPAD_CAP_DPX;
  const cap = input.availW >= 600 ? padCap : phoneCap;
  const maxByW = Math.floor((Math.max(0, input.availW) * pr) / Math.max(1, content[2]));
  const maxByH = Math.floor((Math.max(0, input.availH) * pr) / Math.max(1, content[3]));
  const dpx = Math.max(2, Math.min(cap, maxByW, maxByH));
  const pt = dpx / pr;
  return {
    dpx,
    pt,
    canvasW: canvas[0] * pt,
    canvasH: canvas[1] * pt,
    contentW: content[2] * pt,
    contentH: content[3] * pt,
  };
}

export function hideoutPetBox(cellPx: number, scale: HideoutScale, pixelRatio: number): number {
  const cell = Math.max(1, cellPx);
  const ratio = pixelRatio > 0 ? pixelRatio : 1;
  if (!Number.isInteger(scale.dpx) && scale.pt > 0) return cell * scale.pt;
  const k = Math.max(1, Math.round(scale.dpx));
  return (k * cell) / ratio;
}

export type HideoutOrigin = { left: number; top: number };

export function hideoutStageOrigin(
  width: number,
  height: number,
  scale: HideoutScale,
  content: Rect = HIDEOUT_CONTENT,
): HideoutOrigin {
  const pt = scale.pt;
  const [ox, oy] = content;
  return {
    left: Math.round((width - scale.contentW) / 2 - ox * pt),
    top: Math.round((height - scale.contentH) / 2 - oy * pt),
  };
}

export function hideoutArtToScreen(
  artX: number,
  artY: number,
  origin: HideoutOrigin,
  scale: HideoutScale,
): { x: number; y: number } {
  return { x: origin.left + artX * scale.pt, y: origin.top + artY * scale.pt };
}

export function hideoutScreenPoly(
  polyPts: readonly Pt[],
  origin: HideoutOrigin,
  scale: HideoutScale,
): Pt[] {
  return polyPts.map((p) => {
    const s = hideoutArtToScreen(p[0], p[1], origin, scale);
    return [s.x, s.y] as Pt;
  });
}

export function hideoutPetWrapOrigin(
  artX: number,
  artY: number,
  origin: HideoutOrigin,
  scale: HideoutScale,
  box: number,
  footAt: number,
): { x: number; y: number } {
  const feet = hideoutArtToScreen(artX, artY, origin, scale);
  const foot = footAt > 0 && footAt <= 1 ? footAt : 1;
  return { x: feet.x - box / 2, y: feet.y - foot * box };
}

export function hideoutFeetInFloorScreen(
  artX: number,
  artY: number,
  origin: HideoutOrigin,
  scale: HideoutScale,
  floor: readonly Pt[] = HIDEOUT_FLOOR,
): boolean {
  const feet = hideoutArtToScreen(artX, artY, origin, scale);
  return pointInPoly(feet.x, feet.y, hideoutScreenPoly(floor, origin, scale));
}

/** Layout used by the Hideout stage. Default height matches width-fit canvas. */
export function hideoutPhoneLayout(
  widthPt: number,
  pixelRatio: number,
  stageH?: number,
): { scale: HideoutScale; origin: HideoutOrigin; width: number; height: number } {
  const width = widthPt;
  const height = stageH ?? Math.ceil((HIDEOUT_CANVAS[1] * widthPt) / HIDEOUT_CANVAS[0]);
  const scale = hideoutIntegerScale({
    availW: Math.max(0, width - HIDEOUT_MARGIN_PT * 2),
    availH: height,
    pixelRatio,
  });
  return { scale, origin: hideoutStageOrigin(width, height, scale), width, height };
}

/**
 * Nearest of the 4 walk cycles (E,N,S,W) from velocity — same snap as
 * `skinWalkDirIndex` for 4-dir clips. Idle/tap use the 8 standing poses.
 */
export function hideoutFace(dx: number, dy: number, prev: HideoutIdleFace | 'e' | 'w' | 'front'): HideoutIdleFace {
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
    if (prev === 'front') return 's';
    if (HIDEOUT_IDLE_FACES.includes(prev as HideoutIdleFace)) return prev as HideoutIdleFace;
    return 's';
  }
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const a = ((deg % 360) + 360) % 360;
  if (a < 45 || a >= 315) return 'e';
  if (a < 135) return 's';
  if (a < 225) return 'w';
  return 'n';
}

export function hideoutIdleFace(dx: number, dy: number, prev: HideoutIdleFace): HideoutIdleFace {
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return prev;
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const bearing = deg + 90;
  const i = ((Math.round(bearing / 45) % 8) + 8) % 8;
  return HIDEOUT_IDLE_FACES[i] ?? prev;
}

export function hideoutWalkDirIndex(dx: number, dy: number): number {
  const face = hideoutFace(dx, dy, 's');
  if (face === 'n') return 0;
  if (face === 'e') return 1;
  if (face === 's') return 2;
  return 3;
}

/* ------------------------------------------------------- 2D wander --- */

export type HideoutStep = {
  act: 'wander' | 'idle' | 'sit' | 'sleep' | 'showoff';
  pose: PetPose | null;
  ms: number;
  toX: number;
  toY: number;
  bounce: number;
  squash: boolean;
  loop: boolean;
  path: readonly Pt[];
};

const TARGET_IDS: readonly HideoutTargetId[] = ['bowl', 'cushion', 'chair', 'door', 'boombox'];

export function hideoutWalkMs(dx: number, dy: number, speed: number): number {
  const dist = Math.hypot(dx, dy);
  const v = Math.max(0.2, speed) * HIDEOUT_WALK_ART_PX_PER_SEC;
  return Math.max(480, Math.round((dist / v) * 1000));
}

export function hideoutPathMs(path: readonly Pt[], speed: number): number {
  let dist = 0;
  for (let i = 1; i < path.length; i += 1) {
    dist += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
  }
  const v = Math.max(0.2, speed) * HIDEOUT_WALK_ART_PX_PER_SEC;
  return Math.max(480, Math.round((dist / v) * 1000));
}

export function hideoutTargetPoint(id: HideoutTargetId): Pt {
  return clampToWalk(HIDEOUT_TARGETS[id][0], HIDEOUT_TARGETS[id][1]);
}

function sleepAllow(geom: IsoRoomGeom | undefined): Pt[] | undefined {
  if (!geom?.sleepOnBed) return undefined;
  const bed = geom.props.find((p) => p.id === 'bed');
  if (!bed) {
    const t = geom.targets.bed ?? geom.targets.cushion;
    return t ? [t] : undefined;
  }
  const [c, r, w, h] = bed.footprintCells;
  const seen = new Set<string>();
  const pts: Pt[] = [];
  const add = (cc: number, rr: number) => {
    const k = `${cc}:${rr}`;
    if (seen.has(k)) return;
    seen.add(k);
    pts.push(tileCenter(cc, rr, geom.tile));
  };
  for (let cc = c; cc < c + w; cc += 1) {
    for (let rr = r; rr < r + h; rr += 1) {
      add(cc, rr);
      // One-tile ring of originally-walkable floor so stage clearance
      // does not leave a moat the pet cannot step across onto the bed.
      for (let dc = -1; dc <= 1; dc += 1) {
        for (let dr = -1; dr <= 1; dr += 1) {
          if (dc === 0 && dr === 0) continue;
          const nc = cc + dc;
          const nr = rr + dr;
          if (isWalkableArt(geom.grid, (nc + 0.5) * geom.tile, (nr + 0.5) * geom.tile)) add(nc, nr);
        }
      }
    }
  }
  return pts;
}

function planPath(geom: IsoRoomGeom | undefined, from: Pt, to: Pt, stage: PetStage, allow?: readonly Pt[], bounds?: WalkBounds): Pt[] {
  const grid = hideoutGridFor(stage, geom, bounds);
  const opts = allow && allow.length > 0 ? { allow } : undefined;
  const pulled = route(grid, from, to, opts);
  if (pulled && pulled.length >= 2 && pathClear(grid, pulled, 2, opts)) return pulled;
  const raw = astar(grid, from, to, opts);
  if (raw && raw.length >= 2) return raw;
  return [from, to];
}

export function planHideoutStep(
  input: PetPlanInput & { x: number; y: number; hungry?: boolean; geom?: IsoRoomGeom; bounds?: WalkBounds },
): HideoutStep {
  const { kit, mood, branch, rng, geom, stage, bounds } = input;
  const form = PET_FORM_MOTION[branch];
  const bedPt = geom ? isoSleepPoint(geom) : hideoutTargetPoint('cushion');
  const onBed = geom?.sleepOnBed === true && Math.hypot(input.x - bedPt[0], input.y - bedPt[1]) <= 16;
  const here = onBed
    ? ([input.x, input.y] as Pt)
    : geom
      ? isoClampToWalk(input.x, input.y, geom, stage, bounds)
      : clampToWalk(input.x, input.y, stage);
  const still = { toX: here[0], toY: here[1], bounce: 0, loop: true, path: [here] as Pt[] };
  const target = (id: HideoutTargetId): Pt => {
    if (!geom) return hideoutTargetPoint(id);
    if (id === 'cushion' || id === 'bed') {
      const p = isoSleepPoint(geom);
      // The Loft bed sits clear of the rails; the Hideout cushion is pulled in so the pet never rests under one.
      if (!bounds || geom.sleepOnBed) return p;
      return isoClampToWalk(Math.min(Math.max(p[0], bounds.minX), bounds.maxX), p[1], geom, stage, bounds);
    }
    const t = geom.targets[id] ?? geom.targets.door ?? here;
    return isoClampToWalk(t[0], t[1], geom, stage, bounds);
  };
  const go = (dest: Pt, act: HideoutStep['act'], pose: PetPose | null, squash: boolean, allow?: readonly Pt[]): HideoutStep => {
    const path = planPath(geom, here, dest, stage, allow, bounds);
    const end = path[path.length - 1] ?? dest;
    const speed = Math.max(0.2, form.speed * (mood === 'asleep' ? 1 : MOOD_MOTION[mood].speed));
    return {
      act,
      pose,
      ms: hideoutPathMs(path, speed),
      toX: end[0],
      toY: end[1],
      bounce: 0,
      squash,
      loop: true,
      path,
    };
  };
  if (mood === 'asleep') {
    const bed = target('cushion');
    const far = Math.hypot(here[0] - bed[0], here[1] - bed[1]) > 8;
    if (far) {
      return go(bed, 'wander', petPose(kit, 'walk'), false, sleepAllow(geom));
    }
    if (geom?.sleepOnBed) {
      return { act: 'sleep', pose: petPose(kit, 'idle'), ms: 6000, squash: true, toX: bed[0], toY: bed[1], bounce: 0, loop: true, path: [bed] };
    }
    return { act: 'sleep', pose: petPose(kit, 'idle'), ms: 6000, squash: true, ...still };
  }
  const m = MOOD_MOTION[mood];
  const roll = rng();
  if (input.hungry && roll < 0.55) {
    const bowl = target('bowl');
    if (Math.hypot(here[0] - bowl[0], here[1] - bowl[1]) > 6) {
      return go(bowl, 'wander', petPose(kit, 'walk'), mood === 'sad');
    }
  }
  const showoffChance = Math.min(0.55, form.showoff * m.showoff);
  if (roll < showoffChance) {
    const want: PetClip = rng() < 0.5 ? 'attack' : 'skill';
    const pose = petPose(kit, want);
    if (!pose) {
      return { act: 'idle', pose: petPose(kit, 'idle'), ms: 700, squash: false, ...still };
    }
    return { act: 'showoff', pose, ms: petPoseMs(kit, pose), squash: false, ...still, loop: false };
  }
  if (roll < showoffChance + Math.max(0.42, m.wander)) {
    const visit = rng() < 0.55;
    let dest: Pt = here;
    for (let n = 0; n < 6; n += 1) {
      dest = visit
        ? target(TARGET_IDS[Math.floor(rng() * TARGET_IDS.length)] ?? 'door')
        : geom
          ? isoRandomWalkPoint(geom, rng, stage, bounds)
          : randomWalkPoint(rng, stage);
      if (Math.hypot(dest[0] - here[0], dest[1] - here[1]) >= 24) break;
    }
    if (Math.hypot(dest[0] - here[0], dest[1] - here[1]) < 14) {
      const restMs = Math.round((1600 + rng() * 2000) * form.rest * m.rest);
      return { act: rng() < m.sit ? 'sit' : 'idle', pose: petPose(kit, 'idle'), ms: restMs, squash: true, ...still };
    }
    return go(dest, 'wander', petPose(kit, 'walk'), mood === 'sad');
  }
  const sit = rng() < m.sit;
  const restMs = Math.round((1800 + rng() * 2200) * form.rest * m.rest);
  return { act: sit ? 'sit' : 'idle', pose: petPose(kit, 'idle'), ms: restMs, squash: sit || mood === 'sad', ...still };
}

export function hideoutSpotHit(artX: number, artY: number): HideoutSpot | null {
  const tile = HIDEOUT_GEOM.tile;
  for (const s of HIDEOUT_SPOTS) {
    const [c, r, w, h] = s.footprint;
    const x0 = c * tile;
    const y0 = r * tile;
    if (artX >= x0 && artX <= x0 + w * tile && artY >= y0 && artY <= y0 + h * tile) return s;
  }
  return null;
}

/** Every authored walk target / hotspot is reachable from spawn, path stays on walkable tiles. */
export function assertRoomReachable(geom: IsoRoomGeom, stage: PetStage = 'adult'): { ok: true } | { ok: false; reason: string } {
  const grid = hideoutGridFor(stage, geom);
  const spawn = geom.spawns.default ?? clampToGrid(grid, geom.canvas[0] / 2, 360);
  if (!isWalkableArt(grid, spawn[0], spawn[1])) return { ok: false, reason: 'spawn is not walkable' };
  const bedCells = sleepAllow(geom);
  const points: { id: string; pt: Pt; allow?: readonly Pt[] }[] = [];
  for (const [id, pt] of Object.entries(geom.targets)) {
    const onBed = geom.sleepOnBed && (id === 'bed' || id === 'cushion');
    points.push({ id: `target:${id}`, pt, allow: onBed ? bedCells : undefined });
  }
  for (const h of geom.hotspots) {
    const onBed = geom.sleepOnBed && (h.id === 'bed' || h.kind === 'bed');
    points.push({ id: `hotspot:${h.id}`, pt: h.walk, allow: onBed ? bedCells : undefined });
  }
  for (const s of Object.entries(geom.spawns)) points.push({ id: `spawn:${s[0]}`, pt: s[1] });
  for (const p of points) {
    const goal = p.pt;
    const opts = p.allow && p.allow.length > 0 ? { allow: p.allow } : undefined;
    const startOk = isWalkableArt(grid, spawn[0], spawn[1]);
    const goalOk = opts ? true : isWalkableArt(grid, goal[0], goal[1]);
    if (!startOk || !goalOk) return { ok: false, reason: `${p.id} is not walkable` };
    const path = route(grid, spawn, goal, opts);
    if (!path) return { ok: false, reason: `${p.id} unreachable` };
    if (!pathClear(grid, path, 2, opts)) {
      return { ok: false, reason: `${p.id} path crosses a blocked tile` };
    }
  }
  return { ok: true };
}

/**
 * Stage layout (emci 2026-10-14): the room canvas FILLS the stage (cover, like the Underground
 * picture). On a phone the width decides the scale, so the room is taller than the stage and a
 * camera picks which band shows (`hideoutCameraTop`). Pure; shares HideoutScale with the fit path.
 */
export function hideoutCoverScale(input: { availW: number; availH: number; pixelRatio: number }): HideoutScale {
  const [cw, ch] = HIDEOUT_CANVAS;
  const pr = input.pixelRatio > 0 ? input.pixelRatio : 1;
  const fit = Math.max(Math.max(0, input.availW) / cw, Math.max(0, input.availH) / ch);
  const pt = fit > 0 ? fit : 1;
  return { dpx: pt * pr, pt, canvasW: cw * pt, canvasH: ch * pt, contentW: cw * pt, contentH: ch * pt };
}

/** Where the room's top edge starts for a stage: centred when it fits, else the floor at the bottom. */
export function hideoutCoverRestTop(stageH: number, roomH: number): number {
  'worklet';
  return roomH > stageH ? stageH - roomH : (stageH - roomH) / 2;
}

/**
 * Camera that follows the pet (emci 2026-10-14). `current` is the room's top offset (≤ 0); the
 * result keeps the pet's feet between 40 % and 88 % of the stage height and never shows past the
 * room's edges. Lazy: inside that band it does not move, so a walking pet doesn't shake the room.
 */
export function hideoutCameraTop(stageH: number, roomH: number, feetY: number, current: number): number {
  'worklet';
  if (roomH <= stageH) return (stageH - roomH) / 2;
  const min = stageH - roomH;
  const y = feetY + current;
  const lo = stageH * 0.4;
  const hi = stageH * 0.88;
  let next = current;
  if (y > hi) next = hi - feetY;
  else if (y < lo) next = lo - feetY;
  return Math.min(0, Math.max(min, next));
}
