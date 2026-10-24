/**
 * Art engine CLI (build tooling only; nothing here ships in the app bundle).
 *
 *   npm run art:engine -- --hero maldrath [--recipe breathing-idle] [--dirs east,west]
 *       [--compare "skeleton-v3=art-src/.../pixellab-out/{dir}"] [--debug] [--out <dir>] [--report <dir>]
 *
 * Builds the clip from the rig, runs the seven gates on it and on every comparison clip (the hero's live
 * Idle is always compared), writes the frames outside raw/, and renders a side-by-side GIF + a
 * frame strip for emci to judge. Spends 0 PixelLab generations and installs nothing.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { PNG } from 'pngjs';

import { gateContext, loadAtlas, readClipDir } from './engine';
import { gatesPassed, runGates, type GateResult } from './gates';
import { getRecipe } from './recipes';
import { classifyPixels, type Part } from './recipes/breathing-idle';
import { loadRig } from './rig';

type Args = {
  hero: string;
  recipe: string;
  dirs: string[] | null;
  compare: { label: string; pattern: string }[];
  debug: boolean;
  out: string | null;
  report: string | null;
};

function parseArgs(argv: string[]): Args {
  const a: Args = { hero: '', recipe: 'breathing-idle', dirs: null, compare: [], debug: false, out: null, report: null };
  for (let i = 0; i < argv.length; i += 1) {
    const k = argv[i];
    const v = () => {
      i += 1;
      if (argv[i] === undefined) throw new Error(`${k} needs a value`);
      return argv[i];
    };
    if (k === '--hero') a.hero = v();
    else if (k === '--recipe') a.recipe = v();
    else if (k === '--dirs') a.dirs = v().split(',');
    else if (k === '--compare') {
      const [label, ...rest] = v().split('=');
      a.compare.push({ label, pattern: rest.join('=') });
    } else if (k === '--debug') a.debug = true;
    else if (k === '--out') a.out = v();
    else if (k === '--report') a.report = v();
    else throw new Error(`unknown argument ${k}`);
  }
  if (!a.hero) throw new Error('usage: npm run art:engine -- --hero <name> [--recipe breathing-idle] [--dirs east,west]');
  return a;
}

const PART_COLORS: Record<Part, [number, number, number]> = {
  locked: [120, 120, 130],
  cape: [220, 70, 90],
  body: [70, 130, 230],
  head: [80, 200, 120],
  prop: [240, 200, 60],
};

function writeDebug(file: string, rotation: PNG, owner: (Part | null)[]): void {
  const z = 4;
  const out = new PNG({ width: rotation.width * z, height: rotation.height * z });
  for (let y = 0; y < rotation.height; y += 1) {
    for (let x = 0; x < rotation.width; x += 1) {
      const part = owner[y * rotation.width + x];
      const c = part ? PART_COLORS[part] : ([30, 32, 44] as [number, number, number]);
      for (let dy = 0; dy < z; dy += 1) {
        for (let dx = 0; dx < z; dx += 1) {
          const i = ((y * z + dy) * out.width + (x * z + dx)) * 4;
          out.data[i] = c[0];
          out.data[i + 1] = c[1];
          out.data[i + 2] = c[2];
          out.data[i + 3] = 255;
        }
      }
    }
  }
  fs.writeFileSync(file, PNG.sync.write(out));
}

function fmt(r: GateResult): string {
  return `${r.ok ? 'PASS' : 'FAIL'}  ${r.gate.padEnd(12)} ${r.detail}`;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const root = process.cwd();
  const rig = loadRig(args.hero, root);
  const recipe = getRecipe(args.recipe);
  const dirs = args.dirs ?? Object.keys(rig.directions);
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const outRoot = args.out ?? path.join('art-src', 'pixellab', rig.slug, `engine-${recipe.id}-${stamp}`);
  const reportDir = args.report ?? path.join('docs', 'art', 'animation-tests', `${rig.hero}-engine`);
  fs.mkdirSync(outRoot, { recursive: true });
  fs.mkdirSync(reportDir, { recursive: true });

  const atlas = loadAtlas(rig, root);
  console.log(`art-engine: ${rig.hero} · recipe ${recipe.id} (Tier ${recipe.tier}, 0 generations) · atlas ${atlas.size} colours`);

  const summary: Record<string, unknown> = { hero: rig.hero, recipe: recipe.id, generations: 0, dirs: {} as Record<string, unknown> };
  const gifSpec: { dir: string; columns: { label: string; frames: string[]; ms: number[] }[] }[] = [];
  let allOk = true;

  for (const dir of dirs) {
    const ctx = gateContext(rig, dir, atlas, root);
    const clip = recipe.apply(ctx.rotation, rig, ctx.dir);
    const frameFiles: string[] = [];
    const outDir = path.join(outRoot, dir);
    fs.mkdirSync(outDir, { recursive: true });
    clip.frames.forEach((f, i) => {
      const file = path.join(outDir, `frame_${String(i).padStart(3, '0')}.png`);
      fs.writeFileSync(file, PNG.sync.write(f));
      frameFiles.push(file);
    });

    const results = runGates(ctx, clip.frames);
    allOk = allOk && gatesPassed(results);
    console.log(`\n[${dir}] engine ${recipe.id}  ms ${clip.ms.join('/')}`);
    results.forEach((r) => console.log('  ' + fmt(r)));

    const columns = [{ label: 'engine', frames: frameFiles, ms: clip.ms }];
    const compared: Record<string, GateResult[]> = {};
    const currentDir = path.join(root, rig.rawDir, 'animations', 'Idle', dir);
    const comparisons = [
      { label: 'current', pattern: currentDir },
      ...args.compare.map((c) => ({ label: c.label, pattern: c.pattern.replace('{dir}', dir) })),
    ];
    for (const c of comparisons) {
      const folder = path.isAbsolute(c.pattern) ? c.pattern : path.join(root, c.pattern);
      const frames = readClipDir(folder);
      if (!frames) {
        console.log(`  (no ${c.label} clip for ${dir}, skipped)`);
        continue;
      }
      const r = runGates(ctx, frames);
      compared[c.label] = r;
      console.log(`  ${c.label}:`);
      r.forEach((g) => console.log('    ' + fmt(g)));
      const files = fs
        .readdirSync(folder)
        .filter((f) => /^frame_\d+\.png$/.test(f))
        .sort()
        .map((f) => path.join(folder, f));
      columns.unshift({ label: c.label, frames: files, ms: files.map(() => 120) });
    }
    gifSpec.push({ dir, columns });
    (summary.dirs as Record<string, unknown>)[dir] = { gates: results, compared, ms: clip.ms, offsets: clip.offsets };

    if (args.debug) {
      writeDebug(path.join(reportDir, `parts-${dir}.png`), ctx.rotation, classifyPixels(ctx.rotation, rig, ctx.dir));
    }
  }

  fs.writeFileSync(path.join(outRoot, 'engine.json'), JSON.stringify(summary, null, 2) + '\n');
  const specFile = path.join(outRoot, '_render-spec.json');
  fs.writeFileSync(specFile, JSON.stringify({ reportDir, hero: rig.hero, items: gifSpec }, null, 1));
  try {
    execFileSync('python', ['-I', path.join(__dirname, 'compare.py'), specFile], { stdio: 'inherit' });
  } catch {
    console.error('art-engine: GIF render failed (needs Python + Pillow); frames and gate report are written.');
  } finally {
    fs.rmSync(specFile, { force: true });
  }
  console.log(`\nart-engine: frames -> ${outRoot}\nart-engine: report -> ${reportDir}`);
  console.log(allOk ? 'art-engine: all gates PASS on the engine clip' : 'art-engine: a gate FAILED on the engine clip');
  process.exit(allOk ? 0 : 1);
}

main();
