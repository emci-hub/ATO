/**
 * Holo on the pet — the pure model (aura/holo rework, SPEC §5). Ramps, band
 * sequences, the sweep curve, glint frames and spots, the foil rim. No React,
 * no react-native: `PetHolo` (pet-holo.tsx) draws what this decides and
 * `check:pet-holo` pins it in plain Node.
 *
 * Every number mirrors docs/art/aura-holo/holo-mockup.html (the visual target).
 * Everything is whole art pixels: no blur, no soft gradients.
 *
 * Functions marked 'worklet' run on the UI thread inside Reanimated.
 */

export type Rgb = [number, number, number];

/** One shared clock: 24 ticks per second. */
export const TICKS_PER_SECOND = 24;
/** How far outside the silhouette a glint may sit. */
export const HALO = 5;
/** Glint spots per pet: 4 on bright pixels, 4 in the halo. */
export const SPOT_ON = 4;
export const SPOT_HALO = 4;
/** Minimum Manhattan distance between two spots, art px. */
export const SPOT_APART = 12;
/** Near-black outline (luma below this) is never painted by prism or sweep. */
export const OUTLINE_LUMA = 0.07;
/** Pixels brighter than this can carry an "on the pet" glint. */
export const BRIGHT_LUMA = 0.42;

export function hexRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mixRgb(a: Rgb, b: Rgb, k: number): Rgb {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

/* ------------------------------------------------------------- band ramps -- */

/** Single-colour ramps play dark → light → dark so a band never jumps from its lightest to its darkest step. */
export const PING: readonly number[] = [0, 1, 2, 3, 3, 2, 1, 0];

/** Step order for a ramp of `len` colours: ping-pong for four, each colour twice in order then back for mixes. */
export function seqFor(len: number): number[] {
  if (len === 4) return [...PING];
  const seq: number[] = [];
  for (let i = 0; i < len; i++) seq.push(i, i);
  for (let i = len - 2; i > 0; i--) seq.push(i, i);
  return seq;
}

/** Colour of band `band` (any integer, negative included). */
export function rampAt(ramp: readonly Rgb[], band: number): Rgb {
  const seq = seqFor(ramp.length);
  return ramp[seq[((band % seq.length) + seq.length) % seq.length]];
}

/** Band number of pixel (x, y) after `shift` whole-pixel steps. Bands run down-right: constant x + y. */
export function bandIndex(x: number, y: number, shift: number, bandWidth: number): number {
  return Math.floor((x + y + shift) / bandWidth);
}

/** Length (art px) after which a ramp's band pattern repeats exactly. */
export function bandPeriod(ramp: readonly Rgb[], bandWidth: number): number {
  return seqFor(ramp.length).length * bandWidth;
}

/** Prism band width and rim band width, art px. */
export const PRISM_BAND = 3;
export const RIM_BAND = 4;

/* ---------------------------------------------------------------- timing --- */

export type HoloTiming = {
  /** Ticks per one-pixel step of the band drift. */
  driftTicks: number;
  /** Sweep pass length and rest, ticks. */
  travel: number;
  rest: number;
  /** Ticks each glint frame is held. */
  glintHold: number;
};

/** Full motion, or the gentle loop for Reduce Motion / Motion Off: slower, never still. */
export function holoTiming(gentle: boolean): HoloTiming {
  'worklet';
  return gentle
    ? { driftTicks: 16, travel: 48, rest: 144, glintHold: 3 }
    : { driftTicks: 4, travel: 24, rest: 48, glintHold: 2 };
}

/** Whole-pixel band drift after `tick` ticks. */
export function prismShift(tick: number, gentle: boolean): number {
  'worklet';
  return Math.floor(tick / holoTiming(gentle).driftTicks);
}

export function easeInOut(u: number): number {
  'worklet';
  return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
}

/** Sweep length of one pass in x + 0.7y units for a w × h frame. */
export function sweepSpan(w: number, h: number): number {
  'worklet';
  return w + h * 0.7 + 16;
}

/** Sweep line position (x + 0.7y units) at `tick`, or null while it rests. */
export function sweepPos(tick: number, gentle: boolean, w: number, h: number): number | null {
  'worklet';
  const t = holoTiming(gentle);
  const p = ((tick % (t.travel + t.rest)) + t.travel + t.rest) % (t.travel + t.rest);
  if (p >= t.travel) return null;
  return easeInOut(p / t.travel) * sweepSpan(w, h) - 8;
}

/** Ticks in one sweep pass + rest. */
export function sweepPeriod(gentle: boolean): number {
  'worklet';
  const t = holoTiming(gentle);
  return t.travel + t.rest;
}

/* --------------------------------------------------------------- glints ---- */

/** [dx, dy, role] per pixel; role 0 core, 1 arm, 2 tip. */
export type GlintShape = readonly (readonly [number, number, number])[];

function plus(r: number, diag: number): GlintShape {
  const out: [number, number, number][] = [[0, 0, 0]];
  for (let s = 1; s <= r; s++) {
    const role = s === r && r > 1 ? 2 : 1;
    out.push([s, 0, role], [-s, 0, role], [0, s, role], [0, -s, role]);
  }
  for (let s = 1; s <= diag; s++) {
    const role = s === diag ? 2 : 1;
    out.push([s, s, role], [-s, -s, role], [s, -s, role], [-s, s, role]);
  }
  return out;
}

/** f1 dot(arm) · f2 plus r1 · f3 plus r2 · f4–f5 plus r3 + diagonals r1 (peak) · f6 plus r2 · f7 plus r1 · f8 dot(tip). */
export const GLINT_FULL: readonly GlintShape[] = [[[0, 0, 1]], plus(1, 0), plus(2, 0), plus(3, 1), plus(3, 1), plus(2, 0), plus(1, 0), [[0, 0, 2]]];
/** Reduce Motion: a fade only — dot → plus(1) → dot, no pop. */
export const GLINT_GENTLE: readonly GlintShape[] = [[[0, 0, 2]], [[0, 0, 1]], plus(1, 0), plus(1, 0), [[0, 0, 1]], [[0, 0, 2]]];

export function glintShapes(gentle: boolean): readonly GlintShape[] {
  return gentle ? GLINT_GENTLE : GLINT_FULL;
}

/** Glint cell size: 4 px each side of the centre. */
export const GLINT_CELL = 9;

/** Which glint frame shows `age` ticks after the sweep crossed the spot, or -1. */
export function glintFrameAt(age: number, gentle: boolean): number {
  'worklet';
  const t = holoTiming(gentle);
  if (age < 0) return -1;
  const f = Math.floor(age / t.glintHold);
  return f >= (gentle ? 6 : 8) ? -1 : f;
}

/** Ticks one glint lives. */
export function glintLife(gentle: boolean): number {
  const t = holoTiming(gentle);
  return (gentle ? GLINT_GENTLE.length : GLINT_FULL.length) * t.glintHold;
}

export type GlintSpot = { x: number; y: number; kind: 'on' | 'halo' };

function lcg(seed: number): () => number {
  let s = seed;
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/** Chebyshev distance (≤ HALO) from each empty pixel to the silhouette; 99 when farther. */
function haloDistance(alpha: Uint8Array, w: number, h: number): Uint8Array {
  const dist = new Uint8Array(w * h).fill(99);
  const opaque = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && alpha[y * w + x] > 8;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (opaque(x, y)) {
        dist[y * w + x] = 0;
        continue;
      }
      let best = 99;
      for (let dy = -HALO; dy <= HALO && best > 1; dy++) {
        for (let dx = -HALO; dx <= HALO; dx++) {
          if (opaque(x + dx, y + dy)) {
            const d = Math.max(Math.abs(dx), Math.abs(dy));
            if (d < best) best = d;
          }
        }
      }
      dist[y * w + x] = best;
    }
  }
  return dist;
}

/**
 * Glint spots for one sprite: 4 on bright pixels (luma > 0.42) and 4 in the
 * halo ring 2–5 px outside the silhouette, at least 12 px apart (Manhattan),
 * from a fixed seed — the same sprite always gets the same spots.
 */
export function pickGlintSpots(alpha: Uint8Array, luma: Uint8Array, w: number, h: number, seed = 7): GlintSpot[] {
  const dist = haloDistance(alpha, w, h);
  const cand: GlintSpot[] = [];
  for (let y = 3; y < h - 3; y++) {
    for (let x = 3; x < w - 3; x++) {
      const d = dist[y * w + x];
      if (d === 0 && luma[y * w + x] / 255 > BRIGHT_LUMA) cand.push({ x, y, kind: 'on' });
      else if (d >= 2 && d <= HALO) cand.push({ x, y, kind: 'halo' });
    }
  }
  const rnd = lcg(seed);
  const spots: GlintSpot[] = [];
  for (let n = 0; n < 600 && spots.length < SPOT_ON + SPOT_HALO; n++) {
    const c = cand[Math.floor(rnd() * cand.length)];
    if (!c) break;
    const halo = spots.filter((s) => s.kind === 'halo').length;
    const on = spots.length - halo;
    const want: 'on' | 'halo' = halo < SPOT_HALO ? 'halo' : 'on';
    if (halo >= SPOT_HALO && on >= SPOT_ON) break;
    if (c.kind !== want) continue;
    if (spots.every((s) => Math.abs(s.x - c.x) + Math.abs(s.y - c.y) > SPOT_APART)) spots.push(c);
  }
  return spots;
}

/**
 * Tick (inside one sweep period) at which the sweep line crosses a spot — the
 * spot's glint starts then. A spot fires when the line passes it between two
 * ticks, never "lands exactly on" it. Null if the pass never reaches it.
 */
export function glintFireTick(spot: { x: number; y: number }, gentle: boolean, w: number, h: number): number | null {
  const t = holoTiming(gentle);
  const v = spot.x + spot.y * 0.7;
  let prev: number | null = null;
  for (let p = 0; p < t.travel; p++) {
    const pos = sweepPos(p, gentle, w, h);
    if (pos == null) continue;
    if (prev != null && v > prev && v <= pos) return p;
    prev = pos;
  }
  return null;
}

/* ------------------------------------------------------------------ rim ---- */

export type RimPixel = { x: number; y: number; lit: boolean };

/**
 * The 1 px foil rim outside the silhouette: lit where the pixel to the right or
 * below is opaque (the lit top-left), shadow where the pixel to the left or
 * above is (the bottom-right). Empty pixels only; nothing inside the sprite.
 */
export function rimPixels(alpha: Uint8Array, w: number, h: number): RimPixel[] {
  const a = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : alpha[y * w + x] > 8 ? 1 : 0);
  const out: RimPixel[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (a(x, y)) continue;
      const lit = a(x + 1, y) || a(x, y + 1);
      const shade = a(x - 1, y) || a(x, y - 1);
      if (lit) out.push({ x, y, lit: true });
      else if (shade) out.push({ x, y, lit: false });
    }
  }
  return out;
}

/** Shadow rim colour: the ramp colour half-mixed with the dark foil gap, at alpha 150. */
export const RIM_SHADOW_MIX: Rgb = [24, 18, 36];
export const RIM_SHADOW_ALPHA = 150;
export const RIM_LIT_ALPHA = 255;

/* ----------------------------------------------------------- prism strength */

/** Per-pixel prism strength: `k × (0.4 + 0.6 × min(1, luma × 2.2))`; zero on the outline. */
export function prismStrength(k: number, luma01: number): number {
  if (luma01 <= OUTLINE_LUMA) return 0;
  return k * (0.4 + 0.6 * Math.min(1, luma01 * 2.2));
}

/* -------------------------------------------------------------- sweep paint */

export type SweepColours = { core: Rgb; mid: Rgb; outer: Rgb };

export type SweepDef =
  | { id: string; kind: 'fixed'; colours: SweepColours }
  | { id: string; kind: 'match' }
  | { id: string; kind: 'iris' };

/** Iridescent sweep: spectrum colour by position `floor((x − 0.4y) / 5)`. */
export function irisColours(spectrum: readonly Rgb[], x: number, y: number): SweepColours {
  const k = Math.floor((x - y * 0.4) / 5);
  const c = spectrum[((k % spectrum.length) + spectrum.length) % spectrum.length];
  return { core: mixRgb(c, [255, 255, 255], 0.7), mid: c, outer: mixRgb(c, [30, 20, 40], 0.2) };
}

/** Match band: white core, the prism's lightest as mid, its 3rd-from-last as outer. */
export function matchColours(prism: readonly Rgb[]): SweepColours {
  return { core: [255, 255, 255], mid: prism[prism.length - 1], outer: prism[Math.max(0, prism.length - 3)] };
}

/** Sweep band step for `dd = round(x + 0.7y − pos)`: 0 core, ±1 mid, ±2 outer, else none. */
export function sweepStep(dd: number): 'core' | 'mid' | 'outer' | null {
  const a = Math.abs(dd);
  if (a === 0) return 'core';
  if (a === 1) return 'mid';
  if (a === 2) return 'outer';
  return null;
}

/** Glint colours (core, arm, tip): fixed, or match the prism's lightest / 3rd-from-last. */
export function matchGlint(prism: readonly Rgb[]): [Rgb, Rgb, Rgb] {
  return [[255, 255, 255], prism[prism.length - 1], prism[Math.max(0, prism.length - 3)]];
}
