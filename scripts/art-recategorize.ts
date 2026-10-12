/**
 * One-shot (idempotent) recategorize: move assets/art files into
 * assets/art/<category>/… and rewrite registry + sheet require paths.
 *
 * Run: npx tsx scripts/art-recategorize.ts
 */
import fs from 'node:fs';
import path from 'node:path';

import type { ArtRegistry } from '../src/art/registry.types';
import { ART_CATEGORIES } from '../src/art/registry.types';
import { classifyArt, placeWithUsage, usageFolderOf } from './art-categories';
import { walkFiles } from './art-png';

const repo = path.resolve(__dirname, '..');
const artRoot = path.join(repo, 'assets/art');

function relArt(file: string): string {
  return path.relative(artRoot, file).split(path.sep).join('/');
}

function skip(rel: string): boolean {
  return (
    rel.startsWith('_contact/') ||
    rel.startsWith('shared/') ||
    /(^|\/)(registry|migration-map|legacy-play-sheets|ART_LIBRARY|art-decisions|library|library-portable)\.(json|md|html)$/.test(
      rel,
    ) ||
    rel.endsWith('.md') ||
    rel.endsWith('.gpl')
  );
}

function rmEmpty(dir: string) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return;
  for (const name of fs.readdirSync(dir)) rmEmpty(path.join(dir, name));
  if (fs.readdirSync(dir).length === 0 && path.relative(artRoot, dir) !== '') {
    fs.rmdirSync(dir);
  }
}

function rewriteSheetPaths(text: string): string {
  return text.replace(/art\/characters\/heroes\/([^/]+)\/([^/]+)\//g, 'art/heroes/$2/$1/');
}

function main() {
  const moves: { from: string; to: string; category: string }[] = [];
  const files = walkFiles(artRoot).filter((f) => {
    const rel = relArt(f);
    return !skip(rel);
  });

  for (const file of files) {
    const rel = relArt(file);
    const { dest, category } = classifyArt(rel);
    const usage = usageFolderOf(rel);
    const placed =
      usage != null
        ? placeWithUsage(dest, usage === 'in-use')
        : dest.startsWith('rooms/') && !dest.startsWith('rooms/unused/')
          ? dest
          : dest;
    if (placed === rel) continue;
    moves.push({ from: rel, to: placed, category });
  }

  const byFrom = new Map(moves.map((m) => [m.from, m]));
  for (const m of moves) {
    const from = path.join(artRoot, m.from);
    const to = path.join(artRoot, m.to);
    if (!fs.existsSync(from)) continue;
    if (from === to) continue;
    fs.mkdirSync(path.dirname(to), { recursive: true });
    if (fs.existsSync(to)) {
      const same =
        fs.statSync(from).isFile() &&
        fs.statSync(to).isFile() &&
        fs.readFileSync(from).equals(fs.readFileSync(to));
      if (same) {
        fs.rmSync(from);
        continue;
      }
      throw new Error(`dest exists and differs: ${m.to}`);
    }
    fs.renameSync(from, to);
  }

  rmEmpty(artRoot);

  const registryPath = path.join(artRoot, 'registry.json');
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as ArtRegistry;
  for (const asset of registry.assets) {
    const rel = asset.path.replace(/^assets\/art\//, '');
    const mapped = byFrom.get(rel);
    const nextRel = mapped?.to ?? rel;
    const classified = classifyArt(nextRel);
    const usage = usageFolderOf(nextRel);
    const placed =
      usage != null ? placeWithUsage(classified.dest, usage === 'in-use') : nextRel;
    asset.path = `assets/art/${placed}`;
    asset.category = classified.category;
    if (asset.type === 'ui' && classified.type !== 'ui') asset.type = classified.type;
    if (asset.type === 'brand' && classified.category === 'branding') asset.type = 'brand';
    if (classified.type === 'prop' && (asset.type === 'ui' || asset.type === 'room-layer' || asset.type === 'tile')) {
      asset.type = 'prop';
    }
    if (classified.type === 'fx' && asset.type !== 'fx') asset.type = 'fx';
    if (classified.type === 'room-layer' && asset.type === 'ui' && classified.category === 'rooms') {
      asset.type = 'room-layer';
    }
    if (classified.type === 'icon' && classified.category === 'icons') asset.type = 'icon';
    if (classified.type === 'brand' && classified.category === 'branding') asset.type = 'brand';
  }
  fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);

  const counts = Object.fromEntries(ART_CATEGORIES.map((c) => [c, 0]));
  for (const a of registry.assets) {
    if (a.status === 'archived') continue;
    counts[a.category] = (counts[a.category] ?? 0) + 1;
  }

  const sheetsRoot = path.join(repo, 'assets/play/sheets');
  if (fs.existsSync(sheetsRoot)) {
    for (const file of walkFiles(sheetsRoot).filter((f) => f.endsWith('sheets.json'))) {
      const next = rewriteSheetPaths(fs.readFileSync(file, 'utf8'));
      fs.writeFileSync(file, next);
    }
  }
  const legacy = path.join(artRoot, 'legacy-play-sheets.json');
  if (fs.existsSync(legacy)) {
    fs.writeFileSync(legacy, rewriteSheetPaths(fs.readFileSync(legacy, 'utf8')));
  }
  const genSheets = path.join(repo, 'src/play/generated-play-sheets.ts');
  if (fs.existsSync(genSheets)) {
    fs.writeFileSync(genSheets, rewriteSheetPaths(fs.readFileSync(genSheets, 'utf8')));
  }

  console.log(`moved ${moves.length} files`);
  for (const [cat, n] of Object.entries(counts)) {
    if (n) console.log(`  ${cat.padEnd(16)} ${n}`);
  }
}

main();
