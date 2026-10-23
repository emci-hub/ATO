/** Shared loading for the art engine CLI and its check. Build tooling only. */
import fs from 'node:fs';
import path from 'node:path';

import type { PNG } from 'pngjs';

import { walkFiles } from '../art-png';
import { atlasColors, type GateContext } from './gates';
import { readPng } from './image';
import type { Rig } from './rig';

export function rotationPath(rig: Rig, dir: string, root = process.cwd()): string {
  return path.join(root, rig.rawDir, 'rotations', `${dir}.png`);
}

export function loadRotation(rig: Rig, dir: string, root = process.cwd()): PNG {
  const file = rotationPath(rig, dir, root);
  if (!fs.existsSync(file)) throw new Error(`missing rotation ${path.relative(root, file)}`);
  const png = readPng(file);
  if (png.width !== rig.canvas[0] || png.height !== rig.canvas[1]) {
    throw new Error(`rotation ${dir} is ${png.width}x${png.height}, rig says ${rig.canvas.join('x')}`);
  }
  return png;
}

/** Every colour the hero already owns: its rotations plus all of its raw clips. */
export function loadAtlas(rig: Rig, root = process.cwd()): Set<number> {
  const raw = path.join(root, rig.rawDir);
  const frames = walkFiles(raw)
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .map((f) => readPng(f));
  return atlasColors(frames);
}

/** Frames of one clip folder (frame_000.png ...), in order; null when the folder is missing. */
export function readClipDir(dir: string): PNG[] | null {
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^frame_\d+\.png$/.test(f))
    .sort();
  return files.length === 0 ? null : files.map((f) => readPng(path.join(dir, f)));
}

export function gateContext(rig: Rig, dir: string, atlas: Set<number>, root = process.cwd()): GateContext {
  const d = rig.directions[dir];
  if (!d) throw new Error(`rig ${rig.hero} has no direction "${dir}"`);
  return { rig, dir: d, rotation: loadRotation(rig, dir, root), atlas };
}
