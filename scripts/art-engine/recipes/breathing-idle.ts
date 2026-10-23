/**
 * breathing-idle (Tier A, procedural, 0 PixelLab generations).
 *
 * The classic one-pixel breath: everything above the hip line sinks 0 / 1 / 2 / 1 px, the legs and feet
 * never move, the held prop moves rigidly with the hand, the cape follows a frame late and shallower. Every output
 * pixel is an original pixel of the rotation, so identity is exact and the clip can be rebuilt any time.
 *
 * Per-hero overrides live in rig.recipes["breathing-idle"]: offsets, capeOffsets, headExtra, ms.
 */
import type { PNG } from 'pngjs';

import { alphaAt, copyPixel, findTears, inPolygon, newPng } from '../image';
import type { DirectionRig, PartRole, Rig } from '../rig';

export type Part = 'locked' | 'cape' | 'body' | 'head' | 'prop';
export const PART_ORDER: Part[] = ['locked', 'cape', 'body', 'head', 'prop'];

export type RecipeClip = {
  frames: PNG[];
  ms: number[];
  /** Vertical offset (px, down is positive) applied to each part in each frame. */
  offsets: Record<Part, number[]>;
};

export type BreathingParams = {
  /** Body (everything above the hip line) and the held prop. */
  offsets: number[];
  /** Cape: a frame late and shallower than the body, so frame 0 stays the hero's own drawing. */
  capeOffsets: number[];
  headExtra: number[];
  ms: number[];
};

export const BREATHING_DEFAULTS: BreathingParams = {
  offsets: [0, 1, 2, 1],
  capeOffsets: [0, 0, 1, 1],
  headExtra: [0, 0, 0, 0],
  ms: [400, 250, 400, 250],
};

export function breathingParams(rig: Rig): BreathingParams {
  const o = (rig.recipes?.['breathing-idle'] ?? {}) as Partial<BreathingParams>;
  const p = { ...BREATHING_DEFAULTS, ...o };
  const n = p.offsets.length;
  if (p.ms.length !== n || p.headExtra.length !== n || p.capeOffsets.length !== n) {
    throw new Error(`breathing-idle: offsets, capeOffsets, headExtra and ms must have the same length (${n})`);
  }
  if (p.offsets[0] !== 0 || p.capeOffsets[0] !== 0 || p.headExtra[0] !== 0) {
    throw new Error('breathing-idle: frame 0 must be the rest pose (offset 0 for every part)');
  }
  return p;
}

/** Which part owns each visible pixel of a rotation (priority: prop > locked > head > cape > body/legs). */
export function classifyPixels(rotation: PNG, rig: Rig, dir: DirectionRig): (Part | null)[] {
  const { width, height } = rotation;
  const out: (Part | null)[] = new Array(width * height).fill(null);
  const poly = (role: PartRole) => dir.parts[role];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (alphaAt(rotation, x, y) === 0) continue;
      let part: Part;
      const prop = poly('prop');
      const locked = poly('locked');
      const head = poly('head');
      const cape = poly('cape');
      if (prop && inPolygon(prop, x, y)) part = 'prop';
      else if (locked && inPolygon(locked, x, y)) part = 'locked';
      else if (head && inPolygon(head, x, y)) part = 'head';
      else if (cape && inPolygon(cape, x, y)) part = 'cape';
      else part = y < rig.lines.hip ? 'body' : 'locked';
      out[y * width + x] = part;
    }
  }
  return out;
}

/**
 * Parts sliding past each other along a diagonal seam can leave 1-3 px see-through specks. Fill each one with
 * the rotation's own pixel at that spot (the part that moved away), else its nearest visible neighbour. Specks
 * the rotation itself has are left alone. Every filled pixel is still an original colour of the hero.
 */
function healTears(frame: PNG, rotation: PNG): void {
  const own = new Set(findTears(rotation).flat());
  for (const tear of findTears(frame)) {
    for (const idx of tear) {
      if (own.has(idx)) continue;
      const x = idx % frame.width;
      const y = Math.floor(idx / frame.width);
      if (alphaAt(rotation, x, y) > 0) {
        copyPixel(rotation, x, y, frame, x, y);
        continue;
      }
      for (const [nx, ny] of [[x, y - 1], [x - 1, y], [x + 1, y], [x, y + 1]]) {
        if (alphaAt(frame, nx, ny) > 0) {
          copyPixel(frame, nx, ny, frame, x, y);
          break;
        }
      }
    }
  }
}

export function applyBreathingIdle(rotation: PNG, rig: Rig, dir: DirectionRig): RecipeClip {
  const p = breathingParams(rig);
  const n = p.offsets.length;
  const owner = classifyPixels(rotation, rig, dir);
  const offsets: Record<Part, number[]> = { locked: [], cape: [], body: [], head: [], prop: [] };
  for (let f = 0; f < n; f += 1) {
    const body = p.offsets[f];
    offsets.locked.push(0);
    offsets.body.push(body);
    offsets.head.push(body + p.headExtra[f]);
    offsets.prop.push(body);
    offsets.cape.push(p.capeOffsets[f]);
  }
  const frames: PNG[] = [];
  for (let f = 0; f < n; f += 1) {
    const out = newPng(rotation.width, rotation.height);
    for (const part of PART_ORDER) {
      const dy = offsets[part][f];
      for (let y = 0; y < rotation.height; y += 1) {
        for (let x = 0; x < rotation.width; x += 1) {
          if (owner[y * rotation.width + x] === part) copyPixel(rotation, x, y, out, x, y + dy);
        }
      }
    }
    healTears(out, rotation);
    frames.push(out);
  }
  return { frames, ms: p.ms.slice(), offsets };
}
