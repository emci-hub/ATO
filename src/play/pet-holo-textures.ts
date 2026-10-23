/**
 * Textures the holo draws, built from the model's numbers and encoded as tiny
 * PNGs (png-encode.ts). One art pixel is one texture pixel; the view scales
 * them by whole device pixels. Pure — `check:pet-holo` decodes and inspects them.
 *
 *   band texture  — diagonal bands, constant x + y; slides one pixel at a time
 *   sweep texture — the 3-step shine band on x + 0.7y; slides across
 *   glint sheet   — the 8 (or 6, gentle) glint frames, one 9 × 9 cell each
 */
import {
  GLINT_CELL,
  bandIndex,
  bandPeriod,
  glintShapes,
  irisColours,
  matchColours,
  matchGlint,
  mixRgb,
  rampAt,
  sweepStep,
  type Rgb,
  type SweepColours,
} from '@/play/pet-holo-model';
import { encodeIndexedPng } from '@/play/png-encode';

export type Texture = { png: Uint8Array; w: number; h: number };

/** An indexed image built pixel by pixel; entry 0 is clear. */
class Canvas {
  private palette: [number, number, number, number][] = [[0, 0, 0, 0]];
  private lookup = new Map<number, number>();
  readonly indices: Uint8Array;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.indices = new Uint8Array(w * h);
  }
  set(x: number, y: number, c: readonly number[], a: number) {
    const r = Math.round(c[0]);
    const g = Math.round(c[1]);
    const b = Math.round(c[2]);
    const key = ((r << 24) | (g << 16) | (b << 8) | (a & 255)) >>> 0;
    let index = this.lookup.get(key);
    if (index === undefined) {
      index = this.palette.length;
      if (index > 255) throw new Error('texture palette');
      this.palette.push([r, g, b, a & 255]);
      this.lookup.set(key, index);
    }
    this.indices[y * this.w + x] = index;
  }
  png(): Uint8Array {
    return encodeIndexedPng(this.w, this.h, this.indices, this.palette);
  }
}

/** Diagonal band texture wide enough that sliding by less than one period never shows an edge. */
export function bandTexture(ramp: readonly Rgb[], bandWidth: number, w: number, h: number): Texture & { period: number } {
  const period = bandPeriod(ramp, bandWidth);
  const tw = w + period;
  const canvas = new Canvas(tw, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < tw; x++) canvas.set(x, y, rampAt(ramp, bandIndex(x, y, 0, bandWidth)), 255);
  }
  return { png: canvas.png(), w: tw, h, period };
}

export type SweepSource =
  | { kind: 'fixed'; colours: SweepColours }
  | { kind: 'match'; prism: readonly Rgb[] }
  | { kind: 'iris'; spectrum: readonly Rgb[] };

/**
 * The sweep band as a texture: the core column sits at `core`, one pixel either
 * side is the mid step, two the outer. Sliding the texture by `pos − core`
 * puts the core on x + 0.7y = pos. Pixel alpha carries the step's mix.
 */
export function sweepTexture(
  source: SweepSource,
  h: number,
  mix: { core: number; mid: number; outer: number },
): Texture & { core: number } {
  const core = Math.round((h - 1) * 0.7) + 3;
  const w = core + 4;
  const canvas = new Canvas(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dd = Math.round(x + y * 0.7) - core;
      const step = sweepStep(dd);
      if (!step) continue;
      const cols: SweepColours =
        source.kind === 'fixed'
          ? source.colours
          : source.kind === 'match'
            ? matchColours(source.prism)
            : irisColours(source.spectrum, x, y);
      const c = step === 'core' ? cols.core : step === 'mid' ? cols.mid : cols.outer;
      const a = step === 'core' ? mix.core : step === 'mid' ? mix.mid : mix.outer;
      canvas.set(x, y, c, Math.round(a * 255));
    }
  }
  return { png: canvas.png(), w, h, core };
}

/** Every glint frame side by side, one 9 × 9 cell each. Tips sit at alpha 190 so they read over any ground. */
export function glintSheet(colours: readonly [Rgb, Rgb, Rgb], gentle: boolean): Texture & { frames: number } {
  const shapes = glintShapes(gentle);
  const w = shapes.length * GLINT_CELL;
  const h = GLINT_CELL;
  const canvas = new Canvas(w, h);
  const mid = (GLINT_CELL - 1) / 2;
  shapes.forEach((shape, f) => {
    for (const [dx, dy, role] of shape) {
      const x = f * GLINT_CELL + mid + dx;
      const y = mid + dy;
      canvas.set(x, y, colours[role], role === 2 ? 190 : 255);
    }
  });
  return { png: canvas.png(), w, h, frames: shapes.length };
}

/** A glint's colours: fixed, or matched to the prism band. */
export function glintColours(
  glint: { core?: string; arm?: string; tip?: string; id: string },
  prism: readonly Rgb[],
  hexRgb: (hex: string) => Rgb,
): [Rgb, Rgb, Rgb] {
  if (glint.id === 'match' || !glint.core || !glint.arm || !glint.tip) return matchGlint(prism);
  return [hexRgb(glint.core), hexRgb(glint.arm), hexRgb(glint.tip)];
}

export { mixRgb };
