/**
 * Art engine check (offline). Pins the engine the animation track builds on:
 *   - every rig in art-src/rigs validates, and a broken rig is refused;
 *   - the breathing-idle recipe passes all seven gates on every rig direction and is byte-identical on a rerun;
 *   - each gate FAILS on a clip built to break it (pass/fail pairs), so a gate can never silently go soft;
 *   - the engine stays in build tooling: nothing under src/ or app.json touches it, and the ONE PixelLab
 *     config file carries every tool fact the pre-flight updates.
 *
 * Run: npm run check:art-engine  (wired into check:ota-gate: ota-gate runs every check:* script).
 */
import fs from 'node:fs';
import path from 'node:path';

import { PNG } from 'pngjs';

import { gateContext, loadAtlas } from './art-engine/engine';
import { countTears, gatesPassed, runGates, type GateContext, type GateResult } from './art-engine/gates';
import { alphaAt, changedPixels, clonePng, inPolygon, newPng } from './art-engine/image';
import { getRecipe, RECIPES } from './art-engine/recipes';
import { listRigs, loadRig, validateRig, type Rig } from './art-engine/rig';
import { walkFiles } from './art-png';

const root = process.cwd();
let failures = 0;

function check(name: string, cond: boolean, detail = ''): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures += 1;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function gate(results: GateResult[], name: GateResult['gate']): GateResult {
  const r = results.find((g) => g.gate === name);
  if (!r) throw new Error(`gate ${name} missing`);
  return r;
}

function shifted(src: PNG, dx: number, dy: number): PNG {
  const out = newPng(src.width, src.height);
  for (let y = 0; y < src.height; y += 1) {
    for (let x = 0; x < src.width; x += 1) {
      if (alphaAt(src, x, y) === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= src.width || ny >= src.height) continue;
      const si = (y * src.width + x) * 4;
      const di = (ny * src.width + nx) * 4;
      src.data.copy(out.data, di, si, si + 4);
    }
  }
  return out;
}

function mirrored(src: PNG): PNG {
  const out = newPng(src.width, src.height);
  for (let y = 0; y < src.height; y += 1) {
    for (let x = 0; x < src.width; x += 1) {
      const si = (y * src.width + x) * 4;
      const di = (y * src.width + (src.width - 1 - x)) * 4;
      src.data.copy(out.data, di, si, si + 4);
    }
  }
  return out;
}

/** A visible pixel whose four neighbours are all visible, so erasing it makes an enclosed 1 px speck. */
function findSolidPixels(png: PNG, count: number): { x: number; y: number }[] {
  const found: { x: number; y: number }[] = [];
  for (let y = 1; y < png.height - 1; y += 1) {
    for (let x = 1; x < png.width - 1; x += 1) {
      const solid = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => alphaAt(png, x + dx, y + dy) > 0);
      // spaced apart so each erased pixel is its own speck
      if (solid && found.every((p) => Math.abs(p.x - x) > 3 || Math.abs(p.y - y) > 3)) found.push({ x, y });
      if (found.length === count) return found;
    }
  }
  throw new Error('not enough solid pixels');
}

function cloneRig(rig: Rig, patch: Record<string, unknown>): unknown {
  return { ...JSON.parse(JSON.stringify(rig)), ...patch };
}

console.log('check:art-engine');

// ── rigs ────────────────────────────────────────────────────────────────────────────────────────
const rigNames = listRigs(root);
check('at least one rig exists (Maldrath pilot)', rigNames.includes('maldrath'), rigNames.join(','));
const rigs: Rig[] = [];
for (const name of rigNames) {
  try {
    rigs.push(loadRig(name, root));
    check(`rig ${name} validates`, true);
  } catch (e) {
    check(`rig ${name} validates`, false, (e as Error).message);
  }
}

const base = rigs.find((r) => r.hero === 'maldrath');
if (base) {
  const bad = (patch: Record<string, unknown>): boolean => {
    try {
      validateRig(cloneRig(base, patch), 'test');
      return false;
    } catch {
      return true;
    }
  };
  check('a rig with the hip line below the feet is refused', bad({ lines: { hip: base.footRow + 5 } }));
  check('a rig with an unknown part role is refused', bad({ directions: { east: { parts: { wing: [[1, 1], [2, 2], [3, 1]] } } } }));
  check('a rig with a polygon outside the canvas is refused', bad({ directions: { east: { parts: { prop: [[1, 1], [999, 2], [3, 1]] } } } }));
  check('a rig with a backwards height band is refused', bad({ heightBand: [120, 100] }));
  check('a rig with version 2 is refused', bad({ version: 2 }));
  check('a per-direction foot row outside the canvas is refused', bad({ directions: { east: { footRow: 999, parts: {} } } }));
  check('a per-direction backwards height band is refused', bad({ directions: { east: { heightBand: [120, 100], parts: {} } } }));
  // a per-direction foot row is honoured by the foot-row gate (and a wrong one fails it)
  const footAtlas = loadAtlas(base, root);
  const footCtx = gateContext(base, 'east', footAtlas, root);
  const footFrames = getRecipe('breathing-idle').apply(footCtx.rotation, base, base.directions.east).frames;
  const goodDir = { ...base.directions.east, footRow: base.footRow };
  const badDir = { ...base.directions.east, footRow: base.footRow - 3 };
  check('foot-row gate passes with a matching per-direction foot row', gate(runGates({ ...footCtx, dir: goodDir }, footFrames), 'foot-row').ok);
  check('foot-row gate FAILS with a wrong per-direction foot row', !gate(runGates({ ...footCtx, dir: badDir }, footFrames), 'foot-row').ok);
  const split = rigs.filter((r) => Object.values(r.directions).some((d) => d.footRow !== undefined));
  check('rigs with different east/west foot rows use the per-direction override (corvus, cyber-shinobi, kitsune)', ['corvus', 'cyber-shinobi', 'kitsune'].every((h) => split.some((r) => r.hero === h)), split.map((r) => r.hero).join(','));
  // a prop mask that claims no pixels must fail the gate, not pass as "no prop"
  const emptyCtx = gateContext(
    { ...base, directions: { east: { parts: { prop: [[1, 1], [3, 1], [2, 3]] } } } } as Rig,
    'east',
    new Set<number>(),
    root,
  );
  const emptyFrames = getRecipe('breathing-idle').apply(emptyCtx.rotation, base, base.directions.east).frames;
  check('a prop mask covering no visible pixels FAILS prop-pixels', !gate(runGates(emptyCtx, emptyFrames), 'prop-pixels').ok);
}

// ── recipe + gates on every rig direction ───────────────────────────────────────────────────────
for (const rig of rigs) {
  const atlas = loadAtlas(rig, root);
  const recipe = getRecipe('breathing-idle');
  for (const dir of Object.keys(rig.directions)) {
    const ctx = gateContext(rig, dir, atlas, root);
    const a = recipe.apply(ctx.rotation, rig, ctx.dir);
    const b = recipe.apply(ctx.rotation, rig, ctx.dir);
    const results = runGates(ctx, a.frames);
    check(`${rig.hero}/${dir}: breathing-idle passes all seven gates`, gatesPassed(results), results.filter((r) => !r.ok).map((r) => r.detail).join(' | '));
    check(
      `${rig.hero}/${dir}: rebuilding gives byte-identical frames`,
      a.frames.every((f, i) => f.data.equals(b.frames[i].data)),
    );
    check(`${rig.hero}/${dir}: clip has a hold time for every frame`, a.ms.length === a.frames.length && a.ms.every((m) => m >= 100));
    check(
      `${rig.hero}/${dir}: the legs and feet never move`,
      a.offsets.locked.every((o) => o === 0),
    );
    check(
      `${rig.hero}/${dir}: frame 0 is the rotation exactly`,
      changedPixels(a.frames[0], ctx.rotation) === 0,
    );

    // pass/fail pairs: each gate must fail a clip built to break it
    const f = a.frames;
    const feetBad = runGates(ctx, [shifted(f[0], 0, 1), ...f.slice(1)]);
    check(`${rig.hero}/${dir}: foot-row FAILS when a frame sinks one row`, !gate(feetBad, 'foot-row').ok);

    // measured figure extent, so the negative tests scale to hero (~125 px) and creep/tower (~41-125 px) alike
    let figTop = f[0].height;
    let figBottom = -1;
    for (let y = 0; y < f[0].height; y += 1) {
      for (let x = 0; x < f[0].width; x += 1) {
        if (alphaAt(f[0], x, y) > 0) {
          if (y < figTop) figTop = y;
          if (y > figBottom) figBottom = y;
        }
      }
    }
    const figHeight = figBottom - figTop + 1;
    const cropFrom = figTop + Math.round(0.6 * figHeight);

    const tall = newPng(f[0].width, f[0].height);
    for (let y = 0; y < f[0].height; y += 1) {
      for (let x = 0; x < f[0].width; x += 1) {
        if (y >= cropFrom && alphaAt(f[0], x, y) > 0) f[0].data.copy(tall.data, (y * f[0].width + x) * 4, (y * f[0].width + x) * 4, (y * f[0].width + x) * 4 + 4);
      }
    }
    check(`${rig.hero}/${dir}: height-band FAILS on a cropped-down figure`, !gate(runGates(ctx, [tall, ...f.slice(1)]), 'height-band').ok);

    const stray = clonePng(f[1]);
    const strayKey = ((251 << 24) | (3 << 16) | (247 << 8) | 255) >>> 0;
    for (let i = 0; i < stray.data.length; i += 4) {
      if (stray.data[i + 3] === 255) {
        stray.data[i] = 251;
        stray.data[i + 1] = 3;
        stray.data[i + 2] = 247;
        break;
      }
    }
    check(`${rig.hero}/${dir}: the test colour is really outside the hero's frames`, !atlas.has(strayKey));
    check(`${rig.hero}/${dir}: palette FAILS on a colour the hero never had`, !gate(runGates(ctx, [f[0], stray, f[2], f[3]]), 'palette').ok);

    check(`${rig.hero}/${dir}: silhouette FAILS on a mirrored frame`, !gate(runGates(ctx, [f[0], mirrored(f[1]), f[2], f[3]]), 'silhouette').ok);

    if (ctx.dir.parts.prop) {
      const prop = ctx.dir.parts.prop;
      const noProp = clonePng(f[2]);
      for (let y = 0; y < noProp.height; y += 1) {
        for (let x = 0; x < noProp.width; x += 1) {
          if (inPolygon(prop, x, y + 2)) noProp.data[(y * noProp.width + x) * 4 + 3] = 0;
        }
      }
      check(`${rig.hero}/${dir}: prop-pixels FAILS when the prop is erased`, !gate(runGates(ctx, [f[0], f[1], noProp, f[3]]), 'prop-pixels').ok);
      const far = shifted(f[1], 0, 0);
      const moved = newPng(far.width, far.height);
      const owner = f[1];
      // slide the whole figure 6 px sideways: the prop leaves its +-3 px search window
      for (let y = 0; y < owner.height; y += 1) {
        for (let x = 0; x < owner.width; x += 1) {
          if (alphaAt(owner, x, y) > 0 && x + 6 < owner.width) {
            owner.data.copy(moved.data, (y * owner.width + x + 6) * 4, (y * owner.width + x) * 4, (y * owner.width + x) * 4 + 4);
          }
        }
      }
      check(`${rig.hero}/${dir}: prop-pixels FAILS when the prop jumps 6 px`, !gate(runGates(ctx, [f[0], moved, f[2], f[3]]), 'prop-pixels').ok);
    }

    // a figure that keeps changing in one direction (rows wiped from the top, 30% of the figure more each frame) never loops back
    const drift = [0, 1, 2, 3].map((k) => {
      const d = clonePng(f[0]);
      for (let y = 0; y < figTop + Math.round(0.3 * figHeight * (k + 1)); y += 1) {
        for (let x = 0; x < d.width; x += 1) d.data[(y * d.width + x) * 4 + 3] = 0;
      }
      return d;
    });
    check(`${rig.hero}/${dir}: loop-seam FAILS on a clip that never returns to frame 0`, !gate(runGates(ctx, drift), 'loop-seam').ok);
    check(`${rig.hero}/${dir}: loop-seam FAILS on a one-frame "loop"`, !gate(runGates(ctx, [f[0]]), 'loop-seam').ok);
    check(`${rig.hero}/${dir}: loop-seam FAILS on a clip that never moves`, !gate(runGates(ctx, [f[0], f[0], f[0], f[0]]), 'loop-seam').ok);

    const punched = clonePng(f[1]);
    // erase one more speck than the rotation itself already has (some drawings have 1-3 of their own)
    for (const solid of findSolidPixels(punched, countTears(ctx.rotation) + 1)) {
      punched.data[(solid.y * punched.width + solid.x) * 4 + 3] = 0;
    }
    check(`${rig.hero}/${dir}: no-tears FAILS on a 1 px see-through speck`, !gate(runGates(ctx, [f[0], punched, f[2], f[3]]), 'no-tears').ok);
    check(`${rig.hero}/${dir}: the engine clip has no tears the rotation lacks`, gate(results, 'no-tears').ok);
    check(
      `${rig.hero}/${dir}: gates refuse a frame of another size instead of guessing`,
      (() => {
        try {
          runGates(ctx, [newPng(8, 8), ...f.slice(1)]);
          return false;
        } catch {
          return true;
        }
      })(),
    );
  }
}

// the gates must tell a drifted AI clip from the engine clip (Maldrath skeleton-v3 east test, kept in art-src)
const maldrath = rigs.find((r) => r.hero === 'maldrath');
const skelDir = path.join(root, 'art-src/pixellab/hero.maldrath.streetwear/breathing-idle-skeleton-v3-20261022/pixellab-out/east');
if (maldrath && fs.existsSync(skelDir)) {
  const atlas = loadAtlas(maldrath, root);
  const ctx: GateContext = gateContext(maldrath, 'east', atlas, root);
  const frames = fs
    .readdirSync(skelDir)
    .filter((n) => /^frame_\d+\.png$/.test(n))
    .sort()
    .map((n) => PNG.sync.read(fs.readFileSync(path.join(skelDir, n))));
  const r = runGates(ctx, frames);
  check('the recorded skeleton-v3 Maldrath east clip FAILS prop-pixels (sword drift is caught)', !gate(r, 'prop-pixels').ok);
  check('the recorded skeleton-v3 Maldrath east clip FAILS foot-row (feet one row low)', !gate(r, 'foot-row').ok);
}

// ── stays in build tooling ──────────────────────────────────────────────────────────────────────
check('only the Tier A recipe is registered (0 PixelLab generations)', Object.values(RECIPES).every((r) => r.tier === 'A'));

const appFiles = [...walkFiles(path.join(root, 'src')), path.join(root, 'app.json')].filter((f) => /\.(tsx?|jsx?|json)$/.test(f));
const leaks = appFiles.filter((f) => /art-engine|art-src\/rigs/.test(fs.readFileSync(f, 'utf8')));
check('nothing under src/ or app.json references the art engine or the rigs', leaks.length === 0, leaks.join(', '));

const cfgFile = path.join(root, 'scripts/art-engine/pixellab.config.json');
const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8')) as Record<string, any>;
check('the PixelLab config has a verification date', /^\d{4}-\d{2}-\d{2}$/.test(String(cfg.lastVerified)));
for (const tool of ['importCharacter', 'templateAnimation', 'skeletonAnimation', 'anchoredSkeleton', 'pixelWorkbench', 'vfxWorkbench']) {
  check(`the PixelLab config names the "${tool}" tool`, typeof cfg.tools?.[tool]?.name === 'string');
}
check('the PixelLab config records the canvas and frame limits', Number.isInteger(cfg.limits?.heroCanvas) && Number.isInteger(cfg.limits?.canvasMax));

const engineSources = walkFiles(path.join(root, 'scripts/art-engine')).filter((f) => f.endsWith('.ts'));
const hardcoded = engineSources.filter((f) => /animate_character|animate_with_skeleton_v3|create_character/.test(fs.readFileSync(f, 'utf8')));
check('engine code never hardcodes a PixelLab tool name (they live only in the config)', hardcoded.length === 0, hardcoded.join(', '));

const animDoc = fs.readFileSync(path.join(root, 'docs/art/PIXELLAB_ANIMATION.md'), 'utf8');
check('the pre-flight (PIXELLAB_ANIMATION.md) points at the one config file', animDoc.includes('scripts/art-engine/pixellab.config.json'));

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
check('package.json wires art:engine and check:art-engine', Boolean(pkg.scripts['art:engine'] && pkg.scripts['check:art-engine']));

if (failures > 0) {
  console.error(`\ncheck:art-engine — ${failures} failure(s)`);
  process.exit(1);
}
console.log('\ncheck:art-engine — all passed');
