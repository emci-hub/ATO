/**
 * Streetwear Hideout — isometric room map, integer scale, and 2D floor walk.
 *
 * Spots, walk polygon, prop baselines and bowl/cushion/door targets come from
 * Sprite Smith's hideout-iso.map.json. No hand-tuned spot numbers.
 *
 * The door label is nudged in code so it clears the string lights.
 */
import hideoutMap from '@/assets/play/skins/streetwear/ui/rooms/hideout-iso.map.json';
import {
  PET_FORM_MOTION,
  MOOD_MOTION,
  petPose,
  petPoseMs,
  type PetClip,
  type PetPlanInput,
  type PetPose,
} from '@/play/pet-actor';

export const HIDEOUT_CANVAS: readonly [number, number] = [256, 320];
export const HIDEOUT_NIGHT = '#0C0D23';
/** Visible body the mockup treats as native. The sprite cell may be larger. */
export const HIDEOUT_PET_ART_PX = 64;
/** Blaze cell (84) minus the 64px body, per side, plus a little air. */
export const HIDEOUT_AURA_PAD_PX = 12;
/**
 * Door tag: map anchor sits on the bulbs (`labelAnchors.door` y=84). +28 still
 * overlapped the string lights (y≈76–99). Land on the door panel below them.
 */
export const HIDEOUT_DOOR_LABEL_NUDGE: readonly [number, number] = [0, 52];
export const HIDEOUT_MARGIN_PT = 8;
/**
 * Fit math wins. 4 was an old 3x-phone cap that left ~60% of the stage empty;
 * a 430pt 3x Pro Max can take 5 dpx on the 226×237 content bounds.
 */
export const HIDEOUT_PHONE_CAP_DPX = 8;
export const HIDEOUT_IPAD_CAP_DPX = 10;
/** Apple HIG 44pt + Material 48dp — chips use the stricter floor. */
export const HIDEOUT_SPOT_HIT_PT = 48;
/** Layout widths the feet-on-floor check pins (SE / 14 / 15 Pro Max logical pt). */
export const HIDEOUT_PHONE_WIDTHS_PT: readonly number[] = [375, 393, 430];
/** Constant walk speed in art px / second (iso screen space = this map). */
export const HIDEOUT_WALK_ART_PX_PER_SEC = 22;

type Rect = readonly [number, number, number, number];
type Pt = readonly [number, number];

export type HideoutSpotId = 'door' | 'chair' | 'boombox' | 'manhole';
export type HideoutTargetId = 'bowl' | 'bed' | 'cushion' | 'door' | 'chair' | 'boombox';

export type HideoutSpot = {
  id: HideoutSpotId;
  rect: Rect;
  thing: string;
  action: string;
  coach: 'expedition' | 'den' | 'play' | 'dive';
};

export type HideoutProp = {
  id: string;
  rect: Rect;
  baselineY: number;
  frontCorner: Pt;
  footprint: readonly Pt[];
};

export type HideoutDecal = { id: string; sprite: string; pos: Pt; size: Pt };

type RawMap = {
  spots: Record<string, number[]>;
  labelAnchors: Record<string, number[]>;
  floor: number[][];
  props: {
    id: string;
    rect: number[];
    baselineY: number;
    frontCorner: number[];
    footprint: number[][];
  }[];
  targets: Record<string, number[]>;
  lights: number[][];
  decals: { id: string; sprite: string; pos: number[] }[];
  interior: { polygon: number[][] };
  _meta: { contentBounds: number[] };
};

const raw = hideoutMap as unknown as RawMap;

function rect4(v: number[]): Rect {
  return [v[0] ?? 0, v[1] ?? 0, v[2] ?? 0, v[3] ?? 0];
}
function pt2(v: number[]): Pt {
  return [v[0] ?? 0, v[1] ?? 0];
}
function poly(v: number[][]): Pt[] {
  return v.map(pt2);
}

export const HIDEOUT_CONTENT: Rect = rect4(raw._meta.contentBounds);
export const HIDEOUT_FLOOR: readonly Pt[] = poly(raw.floor);
export const HIDEOUT_INTERIOR: readonly Pt[] = poly(raw.interior.polygon);
export const HIDEOUT_LIGHTS: readonly Pt[] = raw.lights.map(pt2);
export const HIDEOUT_PROPS: readonly HideoutProp[] = raw.props.map((p) => ({
  id: p.id,
  rect: rect4(p.rect),
  baselineY: p.baselineY,
  frontCorner: pt2(p.frontCorner),
  footprint: poly(p.footprint),
}));
export const HIDEOUT_DECALS: readonly HideoutDecal[] = raw.decals.map((d) => {
  const spot = raw.spots[d.id];
  return {
    id: d.id,
    sprite: d.sprite,
    pos: pt2(d.pos),
    size: spot && spot.length >= 4 ? ([spot[2], spot[3]] as Pt) : ([0, 0] as Pt),
  };
});

export const HIDEOUT_TARGETS: Record<HideoutTargetId, Pt> = {
  bowl: pt2(raw.targets.bowl),
  bed: pt2(raw.targets.bed),
  cushion: pt2(raw.targets.cushion ?? raw.targets.bed),
  door: pt2(raw.targets.door),
  // A step in front of the chair, on the floor (nap on the chair is bonus idle).
  chair: [148, 214],
  // A step in front of the boombox, on the walk floor (footprint ends ~x=82).
  boombox: [96, 228],
};

export const HIDEOUT_SPOTS: readonly HideoutSpot[] = [
  { id: 'door', rect: rect4(raw.spots.door), thing: 'Door', action: 'Explore', coach: 'expedition' },
  { id: 'chair', rect: rect4(raw.spots.chair), thing: 'Chair', action: 'Stash', coach: 'den' },
  { id: 'boombox', rect: rect4(raw.spots.boombox), thing: 'Boombox', action: 'Play', coach: 'play' },
  { id: 'manhole', rect: rect4(raw.spots.manhole), thing: 'Manhole', action: 'Underground', coach: 'dive' },
];

export function hideoutLabelAnchor(id: HideoutSpotId): Pt {
  const a = raw.labelAnchors[id];
  const base = a ? pt2(a) : ([0, 0] as Pt);
  if (id !== 'door') return base;
  return [base[0] + HIDEOUT_DOOR_LABEL_NUDGE[0], base[1] + HIDEOUT_DOOR_LABEL_NUDGE[1]];
}

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

function dist2(a: Pt, b: Pt): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

/** Shrink a convex polygon toward its centroid by `pad` art px. */
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

export const HIDEOUT_WALK: readonly Pt[] = insetPoly(HIDEOUT_FLOOR, HIDEOUT_AURA_PAD_PX);

export function inFootprint(x: number, y: number): boolean {
  return HIDEOUT_PROPS.some((p) => pointInPoly(x, y, p.footprint));
}

export function onWalkFloor(x: number, y: number): boolean {
  return pointInPoly(x, y, HIDEOUT_WALK) && !inFootprint(x, y);
}

/** Project a point onto the walkable floor (inside inset polygon, off props). */
export function clampToWalk(x: number, y: number): Pt {
  if (onWalkFloor(x, y)) return [x, y];
  const c: Pt = [
    HIDEOUT_WALK.reduce((s, p) => s + p[0], 0) / HIDEOUT_WALK.length,
    HIDEOUT_WALK.reduce((s, p) => s + p[1], 0) / HIDEOUT_WALK.length,
  ];
  let best: Pt = c;
  let bestD = Infinity;
  for (let i = 0; i <= 24; i += 1) {
    const t = i / 24;
    const px = x + (c[0] - x) * t;
    const py = y + (c[1] - y) * t;
    if (!onWalkFloor(px, py)) continue;
    const d = (px - x) * (px - x) + (py - y) * (py - y);
    if (d < bestD) {
      best = [px, py];
      bestD = d;
    }
  }
  if (bestD < Infinity) return best;
  // Last resort: the nearest walk-vertex.
  let v = HIDEOUT_WALK[0];
  let vd = dist2([x, y], v);
  for (const p of HIDEOUT_WALK) {
    const d = dist2([x, y], p);
    if (d < vd) {
      v = p;
      vd = d;
    }
  }
  return v;
}

export function randomWalkPoint(rng: () => number): Pt {
  const xs = HIDEOUT_WALK.map((p) => p[0]);
  const ys = HIDEOUT_WALK.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  for (let i = 0; i < 40; i += 1) {
    const x = minX + rng() * (maxX - minX);
    const y = minY + rng() * (maxY - minY);
    if (onWalkFloor(x, y)) return [x, y];
  }
  return clampToWalk((minX + maxX) / 2, (minY + maxY) / 2);
}

/** Iso box rule: pet is behind the prop when feet y is above the 2:1 front edge. */
export function petBehindProp(feetX: number, feetY: number, prop: HideoutProp): boolean {
  const [fx, fy] = prop.frontCorner;
  const edgeY = fy - Math.abs(feetX - fx) / 2;
  const [rx, ry, rw, rh] = prop.rect;
  const overlap = feetX > rx - 20 && feetX < rx + rw + 20 && feetY > ry && feetY < ry + rh + 24;
  return overlap && feetY < edgeY;
}

export function petBehindAny(feetX: number, feetY: number): boolean {
  return HIDEOUT_PROPS.some((p) => petBehindProp(feetX, feetY, p));
}

/* ------------------------------------------------------- integer scale --- */

export type HideoutScale = {
  dpx: number;
  pt: number;
  canvasW: number;
  canvasH: number;
  contentW: number;
  contentH: number;
};

/**
 * Largest whole device-px-per-art-px that fits the stage, using the art's
 * trimmed content bounds (transparent canvas margin may bleed). Integer only.
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

/**
 * Drawn square in points at the room's integer device-px scale.
 * Hideout must pass `HIDEOUT_PET_ART_PX` (64), not the animation cell
 * (Sak idle is 192px — that box was the whole wall). Underground still
 * passes `art.cellPx` so the ledge pet stays large.
 */
export function hideoutPetBox(cellPx: number, scale: HideoutScale, pixelRatio: number): number {
  const cell = Math.max(1, cellPx);
  const ratio = pixelRatio > 0 ? pixelRatio : 1;
  const k = Math.max(1, Math.round(scale.dpx));
  return (k * cell) / ratio;
}

export type HideoutOrigin = { left: number; top: number };

/**
 * Place the canvas so the *visible* content bounds are centered in the stage.
 * Transparent padding (15,42 on the 256×320) bleeds; the stage clips it.
 */
export function hideoutStageOrigin(width: number, height: number, scale: HideoutScale): HideoutOrigin {
  const pt = scale.pt;
  const [ox, oy] = HIDEOUT_CONTENT;
  return {
    left: Math.round((width - scale.contentW) / 2 - ox * pt),
    top: Math.round((height - scale.contentH) / 2 - oy * pt),
  };
}

/** Map art-px (canvas top-left origin) → stage points. Feet sit on this point. */
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

/**
 * Sprite wrap top-left so the role's foot line lands on the art-px feet point.
 * `box` is the drawn square in pt (native 64 art px at the room's integer scale).
 */
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

/** Layout used by the Hideout stage on a phone width (margin already applied). */
export function hideoutPhoneLayout(
  widthPt: number,
  pixelRatio: number,
  stageH = 520,
): { scale: HideoutScale; origin: HideoutOrigin; width: number; height: number } {
  const width = widthPt;
  const height = stageH;
  const scale = hideoutIntegerScale({
    availW: Math.max(0, width - HIDEOUT_MARGIN_PT * 2),
    availH: height,
    pixelRatio,
  });
  return { scale, origin: hideoutStageOrigin(width, height, scale), width, height };
}

/** East/west facing from an iso step. Walk clips are 2-dir; dx wins on diagonals. */
export function hideoutFace(dx: number, dy: number, prev: 'e' | 'w'): 'e' | 'w' {
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return prev;
  return dx >= 0 ? 'e' : 'w';
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
};

const TARGET_IDS: readonly HideoutTargetId[] = ['bowl', 'cushion', 'chair', 'door', 'boombox'];

/** Duration for a constant-speed iso lerp in art px (this map is already screen-space). */
export function hideoutWalkMs(dx: number, dy: number, speed: number): number {
  const dist = Math.hypot(dx, dy);
  const v = Math.max(0.2, speed) * HIDEOUT_WALK_ART_PX_PER_SEC;
  return Math.max(480, Math.round((dist / v) * 1000));
}

export function hideoutTargetPoint(id: HideoutTargetId): Pt {
  return clampToWalk(HIDEOUT_TARGETS[id][0], HIDEOUT_TARGETS[id][1]);
}

/**
 * Next Hideout step. Works for every kit / stage / skin — poses come from
 * the live `kit`, the path is the iso floor. Walks under Reduce Motion;
 * the caller only freezes when Motion is Off (`cosmeticsStill`).
 */
export function planHideoutStep(
  input: PetPlanInput & { x: number; y: number; hungry?: boolean },
): HideoutStep {
  const { kit, mood, branch, rng } = input;
  const form = PET_FORM_MOTION[branch];
  const here = clampToWalk(input.x, input.y);
  const still = { toX: here[0], toY: here[1], bounce: 0, loop: true };
  if (mood === 'asleep') {
    const bed = hideoutTargetPoint('cushion');
    const far = Math.hypot(here[0] - bed[0], here[1] - bed[1]) > 8;
    if (far) {
      const speed = Math.max(0.2, form.speed);
      return {
        act: 'wander',
        pose: petPose(kit, 'walk'),
        ms: hideoutWalkMs(bed[0] - here[0], bed[1] - here[1], speed),
        toX: bed[0],
        toY: bed[1],
        bounce: 0,
        squash: false,
        loop: true,
      };
    }
    return { act: 'sleep', pose: petPose(kit, 'idle'), ms: 6000, squash: true, ...still };
  }
  const m = MOOD_MOTION[mood];
  const roll = rng();
  if (input.hungry && roll < 0.55) {
    const bowl = hideoutTargetPoint('bowl');
    if (Math.hypot(here[0] - bowl[0], here[1] - bowl[1]) > 6) {
      const speed = Math.max(0.2, form.speed * m.speed);
      return {
        act: 'wander',
        pose: petPose(kit, 'walk'),
        ms: hideoutWalkMs(bowl[0] - here[0], bowl[1] - here[1], speed),
        toX: bowl[0],
        toY: bowl[1],
        bounce: 0,
        squash: mood === 'sad',
        loop: true,
      };
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
        ? hideoutTargetPoint(TARGET_IDS[Math.floor(rng() * TARGET_IDS.length)] ?? 'door')
        : randomWalkPoint(rng);
      if (Math.hypot(dest[0] - here[0], dest[1] - here[1]) >= 18) break;
    }
    if (Math.hypot(dest[0] - here[0], dest[1] - here[1]) < 10) {
      const restMs = Math.round((1600 + rng() * 2000) * form.rest * m.rest);
      return { act: rng() < m.sit ? 'sit' : 'idle', pose: petPose(kit, 'idle'), ms: restMs, squash: true, ...still };
    }
    const speed = Math.max(0.2, form.speed * m.speed);
    return {
      act: 'wander',
      pose: petPose(kit, 'walk'),
      ms: hideoutWalkMs(dest[0] - here[0], dest[1] - here[1], speed),
      toX: dest[0],
      toY: dest[1],
      bounce: 0,
      squash: mood === 'sad',
      loop: true,
    };
  }
  const sit = rng() < m.sit;
  const restMs = Math.round((1800 + rng() * 2200) * form.rest * m.rest);
  return { act: sit ? 'sit' : 'idle', pose: petPose(kit, 'idle'), ms: restMs, squash: sit || mood === 'sad', ...still };
}

/* ------------------------------------------------------- spots / labels --- */

export function hideoutSpotHit(artX: number, artY: number): HideoutSpot | null {
  for (const s of HIDEOUT_SPOTS) {
    const [x, y, w, h] = s.rect;
    if (artX >= x && artX <= x + w && artY >= y && artY <= y + h) return s;
  }
  return null;
}
