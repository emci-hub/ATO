/**
 * check:art-registry — art library gate (wired into check:ota-gate).
 *
 * --release  placeholder assets fail
 * --budget N decoded-MB cap per atlas (default 48)
 * --fresh    fail if registry/catalog would change (`npm run art:sync`)
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import type { ArtRegistry } from '../src/art/registry.types';
import { ART_CATEGORIES } from '../src/art/registry.types';
import { classifyArt, placeWithUsage, usageFolderOf } from './art-categories';
import { walkFiles } from './art-png';
import { ART_GENERATED_PATHS, runArtSync } from './art-sync';

const repo = path.resolve(__dirname, '..');
const release = process.argv.includes('--release');
const fresh = process.argv.includes('--fresh');
const budgetArg = process.argv.indexOf('--budget');
const BUDGET_MB = budgetArg === -1 ? 48 : Number(process.argv[budgetArg + 1]);

const NAME_RE = /^[a-z0-9-]+(_[a-z0-9-]+)*(\.(sheet|core|combat|ui|atlas-?\d*))?\.(png|json)$/;

function ok(n: number, msg: string) {
  console.log(`  ✓ ${msg}`);
  return n + 1;
}

function hashGenerated(): string {
  const h = crypto.createHash('sha256');
  for (const rel of ART_GENERATED_PATHS) {
    const abs = path.join(repo, rel);
    if (!fs.existsSync(abs)) {
      h.update(`${rel}\0missing\0`);
      continue;
    }
    const files = fs.statSync(abs).isDirectory() ? walkFiles(abs) : [abs];
    for (const file of files) {
      h.update(path.relative(repo, file).split(path.sep).join('/'));
      h.update('\0');
      h.update(fs.readFileSync(file));
    }
  }
  return h.digest('hex');
}

function main() {
  let passed = 0;
  let stale = false;
  if (fresh) {
    const before = hashGenerated();
    runArtSync();
    stale = hashGenerated() !== before;
  }
  const registry = JSON.parse(fs.readFileSync(path.join(repo, 'assets/art/registry.json'), 'utf8')) as ArtRegistry;
  const artRoot = path.join(repo, 'assets/art');
  const skip = (rel: string) =>
    rel.startsWith('_contact/') ||
    rel.startsWith('shared/') ||
    /(^|\/)(registry|migration-map|legacy-play-sheets|ART_LIBRARY|art-decisions|library|library-portable)\.(json|md|html)$/.test(rel) ||
    rel.endsWith('.md') ||
    rel.endsWith('.gpl') ||
    rel.endsWith('.map.json');

  const files = walkFiles(artRoot).filter((f) => {
    const rel = path.relative(artRoot, f).split(path.sep).join('/');
    return !skip(rel) && /\.(png|json)$/i.test(f);
  });

  const byPath = new Map(registry.assets.map((a) => [a.path, a]));
  const missing: string[] = [];
  for (const f of files) {
    const rel = `assets/art/${path.relative(artRoot, f).split(path.sep).join('/')}`;
    if (rel.endsWith('.json') && !rel.endsWith('.sheet.json') && !/\.(core|combat|ui)\.json$/.test(rel)) continue;
    const png = rel.endsWith('.png');
    if (png && !byPath.has(rel)) missing.push(rel);
  }
  assert.deepEqual(missing.slice(0, 20), [], `orphans under assets/art (showing ≤20): ${missing.slice(0, 20).join(', ')}`);
  passed = ok(passed, `no orphan PNGs under assets/art (${files.length} files scanned)`);

  const ids = new Set<string>();
  const dupes: string[] = [];
  for (const a of registry.assets) {
    if (ids.has(a.id)) dupes.push(a.id);
    ids.add(a.id);
    if (a.status === 'archived') continue;
    if (a.path.endsWith('.png')) assert.ok(fs.existsSync(path.join(repo, a.path)), `missing ${a.path}`);
    const base = path.basename(a.path);
    if (a.path.endsWith('.png') || /\.(core|combat|ui|sheet)\.(png|json)$/.test(base)) {
      assert.match(base, NAME_RE, `name ${base}`);
    }
    if (release && a.status === 'placeholder') assert.fail(`placeholder ${a.id} in --release`);
    if (a.type === 'character' && a.theme === 'streetwear' && a.id.includes('.core')) {
      // walk n/e/s/w is enforced via check:streetwear-walk on the packed sheets
    }
    const mb = (a.decodedBytes ?? 0) / 1048576;
    assert.ok(mb <= BUDGET_MB, `${a.id} decoded ${mb.toFixed(1)} MB over ${BUDGET_MB} MB budget`);
  }
  assert.deepEqual(dupes, [], `duplicate ids: ${dupes.join(', ')}`);
  const cats = new Set<string>(ART_CATEGORIES);
  const misc: string[] = [];
  const mismatch: string[] = [];
  for (const a of registry.assets) {
    if (a.status === 'archived') continue;
    assert.ok(a.category, `missing category ${a.id}`);
    assert.ok(cats.has(a.category), `unknown category ${a.category} on ${a.id}`);
    const rel = a.path.replace(/^assets\/art\//, '');
    const top = rel.split('/')[0];
    if (top !== a.category) mismatch.push(`${a.id}: path ${top} vs category ${a.category}`);
    const classified = classifyArt(rel);
    const expected = placeWithUsage(classified.dest, a.inUse);
    if (expected !== rel) mismatch.push(`${a.id}: should live at ${expected} (have ${rel})`);
    if (a.category === 'misc') misc.push(a.id);
  }
  assert.deepEqual(mismatch.slice(0, 20), [], `category/path mismatch (≤20): ${mismatch.slice(0, 20).join('; ')}`);
  assert.deepEqual(misc, [], `misc should be empty, found ${misc.join(', ')}`);
  passed = ok(passed, `ids unique, paths exist, names match, decoded ≤ ${BUDGET_MB} MB, categories match folders`);

  const unusedRefs: string[] = [];
  const inUseFlag: string[] = [];
  for (const a of registry.assets) {
    if (a.status === 'archived') continue;
    const rel = a.path.replace(/^assets\/art\//, '');
    const folder = usageFolderOf(rel);
    const referenced = (a.usedBy ?? []).length > 0;
    if (folder === 'unused' && referenced) unusedRefs.push(`${a.id} usedBy=${(a.usedBy ?? []).join(',')}`);
    if (a.inUse !== referenced) inUseFlag.push(a.id);
    if (!a.set || !a.variant) inUseFlag.push(`${a.id} missing set/variant`);
  }
  assert.deepEqual(unusedRefs.slice(0, 20), [], `unused/ items that are referenced (≤20): ${unusedRefs.slice(0, 20).join('; ')}`);
  assert.deepEqual(inUseFlag.slice(0, 20), [], `inUse flag mismatch (≤20): ${inUseFlag.slice(0, 20).join('; ')}`);
  passed = ok(passed, 'inUse matches usedBy; unused/ has no referenced items');

  // No raw PixelLab frames bundled.
  const generated = fs.readFileSync(path.join(repo, 'src/art/generated-art.ts'), 'utf8');
  assert.doesNotMatch(generated, /frame_\d+/, 'generated-art must not require loose frame_NNN files');
  assert.doesNotMatch(generated, /art-src\//, 'generated-art must not require art-src');
  passed = ok(passed, 'generated-art has no raw PixelLab frames or art-src paths');

  const srcPlay = walkFiles(path.join(repo, 'src/play')).concat(walkFiles(path.join(repo, 'src/art')));
  const banned: string[] = [];
  for (const file of srcPlay) {
    if (!/\.(ts|tsx)$/.test(file)) continue;
    const rel = path.relative(repo, file).split(path.sep).join('/');
    if (
      rel === 'src/art/generated-art.ts' ||
      rel === 'src/play/generated-play-assets.ts' ||
      rel === 'src/play/generated-play-sheets.ts'
    ) {
      continue;
    }
    const src = fs.readFileSync(file, 'utf8');
    if (/require\(['"]@\/assets\/art\//.test(src) || /require\(['"]@\/assets\/play\/[^'"]+\.(png|jpg|webp)/.test(src)) {
      if (rel.endsWith('pixel-ui.tsx') || rel.endsWith('street-ui.tsx')) continue; // fonts
      if (rel.endsWith('pixel-atlas.tsx')) continue; // one-release shim for dive/room atlases
      banned.push(rel);
    }
  }
  assert.deepEqual(banned, [], `direct art requires outside generated-art: ${banned.join(', ')}`);
  passed = ok(passed, 'src/play uses getArt / generated shims, not raw requires');

  const metro = fs.readFileSync(path.join(repo, 'metro.config.js'), 'utf8');
  assert.match(metro, /art-src/, 'metro blockList includes art-src');
  const app = fs.readFileSync(path.join(repo, 'app.json'), 'utf8');
  assert.match(app, /assetPatternsToBeBundled/, 'app.json lists OTA asset patterns');
  passed = ok(passed, 'Metro blockList + OTA assetPatternsToBeBundled are set');

  // Hero pixel-identity: Walk/Idle east frame_000 of kael + archangel reconstructs the source cell.
  const gold = pixelGold(['kael', 'archangel']);
  passed = ok(passed, gold);

  if (stale) {
    console.error('\ncheck:art-registry --fresh: registry/catalog are stale versus the code and art.');
    console.error('  Run:  npm run art:sync');
    console.error('  Then commit the generated files. Never hand-edit them.');
    process.exit(1);
  }
  if (fresh) passed = ok(passed, 'registry + catalog match art:sync (fresh)');
  console.log(`\ncheck:art-registry — ${passed} groups passed.`);
}

function pixelGold(slugs: string[]): string {
  const { PNG } = require('pngjs') as typeof import('pngjs');
  const checked: string[] = [];
  for (const slug of slugs) {
    const rawDir = [
      path.join(repo, `art-src/pixellab/hero.${slug}.streetwear/migrated/raw`),
      path.join(repo, `art-src/pixellab/hero.${slug}.streetwear/picked/raw`),
      path.join(repo, `assets/play/skins/streetwear/heroes/${slug}`),
    ].find((d) => fs.existsSync(d));
    const sheetsPath = path.join(repo, `assets/play/sheets/streetwear/heroes/${slug}/sheets.json`);
    if (!rawDir || !fs.existsSync(sheetsPath)) {
      checked.push(`${slug}: skip (not packed yet)`);
      continue;
    }
    const sheets = JSON.parse(fs.readFileSync(sheetsPath, 'utf8')) as Record<
      string,
      {
        sheet: string;
        frames: Record<string, { x: number; y: number; w: number; h: number }>;
        sourceW?: number;
        sourceH?: number;
        offsetX?: number;
        offsetY?: number;
      }
    >;
    const walk = sheets[`sheets/streetwear/heroes/${slug}/Walk`];
    const idle = sheets[`sheets/streetwear/heroes/${slug}/Idle`];
    for (const [clip, entry] of [
      ['Walk', walk],
      ['Idle', idle],
    ] as const) {
      if (!entry) continue;
      const frame = entry.frames['east/frame_000'];
      const srcFile = path.join(rawDir, 'animations', clip, 'east', 'frame_000.png');
      if (!frame || !fs.existsSync(srcFile)) continue;
      const src = PNG.sync.read(fs.readFileSync(srcFile));
      const atlasPath = entry.sheet.startsWith('art/')
        ? path.join(repo, 'assets', entry.sheet)
        : path.join(repo, 'assets/play', entry.sheet);
      const atlas = PNG.sync.read(fs.readFileSync(atlasPath));
      const ox = entry.offsetX ?? 0;
      const oy = entry.offsetY ?? 0;
      const srcW = entry.sourceW ?? src.width;
      const srcH = entry.sourceH ?? src.height;
      const recon = new PNG({ width: srcW, height: srcH, fill: true });
      for (let y = 0; y < frame.h; y += 1) {
        for (let x = 0; x < frame.w; x += 1) {
          const si = ((frame.y + y) * atlas.width + (frame.x + x)) * 4;
          const di = ((oy + y) * recon.width + (ox + x)) * 4;
          recon.data[di] = atlas.data[si];
          recon.data[di + 1] = atlas.data[si + 1];
          recon.data[di + 2] = atlas.data[si + 2];
          recon.data[di + 3] = atlas.data[si + 3];
        }
      }
      let mismatches = 0;
      for (let i = 0; i < src.data.length; i += 4) {
        const aSrc = src.data[i + 3];
        const aRec = recon.data[i + 3];
        if (aSrc < 8 && aRec < 8) continue; // both transparent (RGB may be cleared)
        if (src.data[i] !== recon.data[i] || src.data[i + 1] !== recon.data[i + 1] || src.data[i + 2] !== recon.data[i + 2] || aSrc !== aRec) {
          mismatches += 1;
        }
      }
      assert.equal(mismatches, 0, `${slug} ${clip} east/frame_000 is not pixel-identical (${mismatches} px)`);
      checked.push(`${slug}/${clip}`);
    }
  }
  return `hero frame gold: ${checked.join(', ') || 'none packed yet'}`;
}

main();
