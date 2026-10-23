/**
 * The seven gates every clip must pass before emci sees it (build tooling only).
 * They run on ANY clip (procedural, template, skeleton-v3, the live Idle), so the same numbers compare them.
 *
 *   foot-row     every frame's lowest visible pixel is the rig's footRow
 *   height-band  every frame is inside the rig's height band
 *   silhouette   alpha overlap (IoU) with the hero's rotation stays >= silhouetteMin
 *   palette      every colour is already in the hero's own frames (atlas)
 *   prop-pixels  the held prop is the original pixels, found rigidly within +-propRadius px
 *   no-tears     no 1-3 px see-through specks the rotation itself lacks (parts slid past each other)
 *   loop-seam    last -> first changes no more pixels than the busiest step inside the clip
 */
import type { PNG } from 'pngjs';

import { alphaAt, changedPixels, colorAt, findTears, inPolygon, visibleBounds, visibleColors } from './image';
import { dirFootRow, dirHeightBand, type DirectionRig, type Rig } from './rig';

export const GATE_LIMITS = {
  silhouetteMin: 0.9,
  propMatchMin: 0.95,
  propRadius: 3,
  seamRatioMax: 1.25,
} as const;

export type GateResult = {
  gate: 'foot-row' | 'height-band' | 'silhouette' | 'palette' | 'prop-pixels' | 'loop-seam' | 'no-tears';
  ok: boolean;
  detail: string;
  /** Per-frame numbers (or one number for the clip) for the comparison table. */
  values: number[];
};

export type GateContext = {
  rig: Rig;
  dir: DirectionRig;
  rotation: PNG;
  atlas: Set<number>;
};

type PropPixel = { x: number; y: number; color: number };

function propReference(ctx: GateContext): PropPixel[] {
  const poly = ctx.dir.parts.prop;
  if (!poly) return [];
  const out: PropPixel[] = [];
  for (let y = 0; y < ctx.rotation.height; y += 1) {
    for (let x = 0; x < ctx.rotation.width; x += 1) {
      if (alphaAt(ctx.rotation, x, y) > 0 && inPolygon(poly, x, y)) {
        out.push({ x, y, color: colorAt(ctx.rotation, x, y) });
      }
    }
  }
  return out;
}

/** Best rigid match of the prop's original pixels inside +-radius px: ratio and the offset found. */
export function bestPropMatch(
  frame: PNG,
  ref: PropPixel[],
  radius: number,
): { ratio: number; dx: number; dy: number } {
  if (ref.length === 0) return { ratio: 1, dx: 0, dy: 0 };
  let best = { ratio: -1, dx: 0, dy: 0 };
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      let hit = 0;
      for (const p of ref) {
        const x = p.x + dx;
        const y = p.y + dy;
        if (x >= 0 && y >= 0 && x < frame.width && y < frame.height && alphaAt(frame, x, y) > 0 && colorAt(frame, x, y) === p.color) {
          hit += 1;
        }
      }
      const ratio = hit / ref.length;
      if (ratio > best.ratio) best = { ratio, dx, dy };
    }
  }
  return best;
}

function iou(a: PNG, b: PNG): number {
  let inter = 0;
  let union = 0;
  for (let y = 0; y < a.height; y += 1) {
    for (let x = 0; x < a.width; x += 1) {
      const av = alphaAt(a, x, y) > 0;
      const bv = alphaAt(b, x, y) > 0;
      if (av || bv) union += 1;
      if (av && bv) inter += 1;
    }
  }
  return union === 0 ? 1 : inter / union;
}

export function countTears(png: PNG): number {
  return findTears(png).length;
}

export function atlasColors(frames: PNG[]): Set<number> {
  const set = new Set<number>();
  for (const f of frames) visibleColors(f, set);
  return set;
}

export function runGates(ctx: GateContext, frames: PNG[]): GateResult[] {
  const bounds = frames.map((f) => visibleBounds(f));
  const results: GateResult[] = [];
  const wrong = frames.findIndex((f) => f.width !== ctx.rotation.width || f.height !== ctx.rotation.height);
  if (wrong >= 0) {
    throw new Error(`frame ${wrong} is not ${ctx.rotation.width}x${ctx.rotation.height} like the rotation; gates compare same-size frames`);
  }

  const feet = bounds.map((b) => (b ? b.y1 : -1));
  const footRow = dirFootRow(ctx.rig, ctx.dir);
  const feetBad = feet.filter((y) => y !== footRow).length;
  results.push({
    gate: 'foot-row',
    ok: feetBad === 0,
    detail: `feet rows ${feet.join('/')} (rig ${footRow})`,
    values: feet,
  });

  const [hMin, hMax] = dirHeightBand(ctx.rig, ctx.dir);
  const heights = bounds.map((b) => (b ? b.y1 - b.y0 + 1 : 0));
  const heightBad = heights.filter((h) => h < hMin || h > hMax).length;
  results.push({
    gate: 'height-band',
    ok: heightBad === 0,
    detail: `heights ${heights.join('/')} (band ${hMin}-${hMax})`,
    values: heights,
  });

  const overlaps = frames.map((f) => iou(f, ctx.rotation));
  const overlapMin = Math.min(...overlaps);
  results.push({
    gate: 'silhouette',
    ok: overlapMin >= GATE_LIMITS.silhouetteMin,
    detail: `overlap ${overlaps.map((v) => v.toFixed(3)).join('/')} (min ${GATE_LIMITS.silhouetteMin})`,
    values: overlaps,
  });

  const stray = frames.map((f) => {
    let n = 0;
    const seen = visibleColors(f);
    for (const c of seen) if (!ctx.atlas.has(c)) n += 1;
    return n;
  });
  results.push({
    gate: 'palette',
    ok: stray.every((n) => n === 0),
    detail: `colours outside the hero's own frames ${stray.join('/')} (need 0)`,
    values: stray,
  });

  const baseTears = countTears(ctx.rotation);
  const tears = frames.map((f) => countTears(f));
  results.push({
    gate: 'no-tears',
    ok: tears.every((n) => n <= baseTears),
    detail: `1-3 px see-through specks ${tears.join('/')} (the rotation has ${baseTears})`,
    values: tears,
  });

  const ref = propReference(ctx);
  if (ctx.dir.parts.prop && ref.length === 0) {
    results.push({ gate: 'prop-pixels', ok: false, detail: 'the rig prop mask covers no visible pixels', values: [] });
  } else if (ref.length === 0) {
    results.push({ gate: 'prop-pixels', ok: true, detail: 'no prop mask in this rig direction', values: [] });
  } else {
    const matches = frames.map((f) => bestPropMatch(f, ref, GATE_LIMITS.propRadius));
    const ratios = matches.map((m) => m.ratio);
    results.push({
      gate: 'prop-pixels',
      ok: Math.min(...ratios) >= GATE_LIMITS.propMatchMin,
      detail: `${ref.length} prop px, match ${ratios.map((v) => v.toFixed(3)).join('/')} (min ${GATE_LIMITS.propMatchMin})`,
      values: ratios,
    });
  }

  if (frames.length < 2) {
    results.push({ gate: 'loop-seam', ok: false, detail: 'a loop needs 2+ frames', values: [] });
  } else {
    const steps: number[] = [];
    for (let i = 0; i + 1 < frames.length; i += 1) steps.push(changedPixels(frames[i], frames[i + 1]));
    const seam = changedPixels(frames[frames.length - 1], frames[0]);
    const busiest = Math.max(...steps);
    results.push({
      gate: 'loop-seam',
      ok: busiest > 0 && seam <= busiest * GATE_LIMITS.seamRatioMax,
      detail: `last->first ${seam} px vs busiest step ${busiest} px (max x${GATE_LIMITS.seamRatioMax})`,
      values: [...steps, seam],
    });
  }
  return results;
}

export function gatesPassed(results: GateResult[]): boolean {
  return results.every((r) => r.ok);
}
