/**
 * Rig format (art-src/rigs/<hero>.json): the once-per-hero spec every recipe and gate reads.
 *
 * A rig does NOT contain art. It says where the feet are, where the body may bend, and which pixels
 * belong to a prop / cape / head, per played direction. Recipes move those parts; gates measure the
 * result against the hero's own rotation.
 *
 *   hero, slug, canvas, rawDir   which art-src folder holds the rotations and the hero's own frames
 *   footRow                      the one row every frame's lowest pixel must sit on
 *   heightBand [min, max]        allowed frame height (rows), inclusive
 *   lines.hip                    rows ABOVE this move with the body; rows at or below stay locked
 *   directions.<dir>.parts       polygons (pixel coordinates) claiming pixels for a role:
 *                                  prop   a held item that moves rigidly with the hand
 *                                  cape   cloth that follows the body a frame late and shallower
 *                                  head   optional, for a head that lags or leads the torso
 *                                  locked pixels above the hip line that must not move
 *   recipes.<id>                 optional per-hero parameter overrides for a recipe
 */
import fs from 'node:fs';
import path from 'node:path';

import type { Point } from './image';

export const ROLES = ['prop', 'cape', 'head', 'locked'] as const;
export type PartRole = (typeof ROLES)[number];

export type DirectionRig = {
  parts: Partial<Record<PartRole, Point[]>>;
};

export type Rig = {
  version: 1;
  hero: string;
  slug: string;
  canvas: [number, number];
  rawDir: string;
  footRow: number;
  heightBand: [number, number];
  lines: { hip: number; shoulder?: number };
  directions: Record<string, DirectionRig>;
  recipes?: Record<string, Record<string, unknown>>;
  notes?: string;
};

export const RIGS_DIR = path.join('art-src', 'rigs');

function fail(file: string, msg: string): never {
  throw new Error(`rig ${file}: ${msg}`);
}

function isPoint(p: unknown): p is Point {
  return Array.isArray(p) && p.length === 2 && p.every((n) => Number.isInteger(n));
}

/** Throws with a precise message when a rig file is malformed. */
export function validateRig(raw: unknown, file: string): Rig {
  if (!raw || typeof raw !== 'object') return fail(file, 'not an object');
  const r = raw as Record<string, unknown>;
  if (r.version !== 1) fail(file, 'version must be 1');
  for (const key of ['hero', 'slug', 'rawDir'] as const) {
    if (typeof r[key] !== 'string' || !(r[key] as string)) fail(file, `${key} must be a non-empty string`);
  }
  const canvas = r.canvas;
  if (!Array.isArray(canvas) || canvas.length !== 2 || !canvas.every((n) => Number.isInteger(n) && n > 0)) {
    fail(file, 'canvas must be [width, height]');
  }
  const [cw, ch] = canvas as [number, number];
  if (!Number.isInteger(r.footRow) || (r.footRow as number) < 0 || (r.footRow as number) >= ch) {
    fail(file, 'footRow must be a row inside the canvas');
  }
  const band = r.heightBand;
  if (
    !Array.isArray(band) ||
    band.length !== 2 ||
    !band.every((n) => Number.isInteger(n)) ||
    band[0] > band[1]
  ) {
    fail(file, 'heightBand must be [min, max]');
  }
  const lines = r.lines as Record<string, unknown> | undefined;
  if (!lines || !Number.isInteger(lines.hip) || (lines.hip as number) >= (r.footRow as number)) {
    fail(file, 'lines.hip must be a row above footRow');
  }
  const dirs = r.directions as Record<string, DirectionRig> | undefined;
  if (!dirs || typeof dirs !== 'object' || Object.keys(dirs).length === 0) {
    fail(file, 'directions must list at least one direction');
  }
  for (const [dir, d] of Object.entries(dirs)) {
    if (!d || typeof d !== 'object' || !d.parts || typeof d.parts !== 'object') {
      fail(file, `directions.${dir}.parts missing`);
    }
    for (const [role, poly] of Object.entries(d.parts)) {
      if (!(ROLES as readonly string[]).includes(role)) fail(file, `directions.${dir}.parts.${role}: unknown role`);
      if (!Array.isArray(poly) || poly.length < 3 || !poly.every(isPoint)) {
        fail(file, `directions.${dir}.parts.${role}: polygon needs 3+ integer [x,y] points`);
      }
      for (const [x, y] of poly as Point[]) {
        if (x < 0 || y < 0 || x >= cw || y >= ch) fail(file, `directions.${dir}.parts.${role}: point outside canvas`);
      }
    }
  }
  return r as unknown as Rig;
}

export function loadRig(hero: string, root = process.cwd()): Rig {
  const file = path.join(root, RIGS_DIR, `${hero}.json`);
  if (!fs.existsSync(file)) throw new Error(`no rig for "${hero}" at ${path.relative(root, file)}`);
  return validateRig(JSON.parse(fs.readFileSync(file, 'utf8')), path.relative(root, file));
}

export function listRigs(root = process.cwd()): string[] {
  const dir = path.join(root, RIGS_DIR);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .map((f) => f.slice(0, -'.json'.length))
    .sort();
}
