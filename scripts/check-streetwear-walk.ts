/**
 * Streetwear hero Walk is 4-dir (N, E, S, W) for room movement.
 *
 * Every hero under assets/play/skins/streetwear/heroes must have Walk/{north,
 * east, south, west} on disk AND packed into its Walk sheet, with meta.walkOrder
 * wired [north, east, south, west]. Room drawing uses skinWalkClipDirIndex
 * (same snap as skinWalkDirIndex). A 2-dir clip on a vertical heading falls
 * back to the standing pose — never a side walk.
 *
 * Heroes that truly lack N/S on disk fail this check (list them in the PR and
 * keep E/W packed). Cast/legacy packs are out of scope.
 *
 * Run: npm run check:streetwear-walk
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { hideoutWalkDirIndex } from '../src/play/hideout-iso';
import {
  SKIN_WALK_4DIR_ORDER,
  SKIN_WALK_NO_DIR,
  walkClipDirIndex,
} from '../src/play/skin-walk-dir';

const repo = path.resolve(__dirname, '..');
const SHEETS = path.join(repo, 'assets/play/sheets/streetwear/heroes');

function streetwearHeroRaw(slug: string): string {
  for (const gen of ['picked', 'migrated']) {
    const d = path.join(repo, 'art-src/pixellab', `hero.${slug}.streetwear`, gen, 'raw');
    if (fs.existsSync(d)) return d;
  }
  return path.join(repo, 'assets/play/skins/streetwear/heroes', slug);
}

function listStreetwearHeroes(): string[] {
  const rawRoot = path.join(repo, 'art-src/pixellab');
  if (fs.existsSync(rawRoot)) {
    const slugs = fs
      .readdirSync(rawRoot)
      .filter((n) => n.startsWith('hero.') && n.endsWith('.streetwear'))
      .map((n) => n.slice('hero.'.length, n.length - '.streetwear'.length))
      .sort();
    if (slugs.length > 0) return slugs;
  }
  const legacy = path.join(repo, 'assets/play/skins/streetwear/heroes');
  if (!fs.existsSync(legacy)) return [];
  return fs
    .readdirSync(legacy, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

let passed = 0;
const ok = (msg: string) => {
  passed += 1;
  console.log(`  ✓ ${msg}`);
};

const heroes = listStreetwearHeroes();
assert.ok(heroes.length >= 1, 'no streetwear heroes on disk');

const missingSource: string[] = [];
const partialSource: string[] = [];
for (const slug of heroes) {
  const walk = path.join(streetwearHeroRaw(slug), 'animations', 'Walk');
  if (!fs.existsSync(walk)) {
    missingSource.push(slug);
    continue;
  }
  const gaps: string[] = [];
  for (const dir of SKIN_WALK_4DIR_ORDER) {
    const folder = path.join(walk, dir);
    const frames = fs.existsSync(folder)
      ? fs.readdirSync(folder).filter((f) => f.toLowerCase().endsWith('.png')).length
      : 0;
    if (frames < 1) gaps.push(`${dir}=${frames}`);
  }
  if (gaps.length > 0) partialSource.push(`${slug} (${gaps.join(', ')})`);
}
assert.deepEqual(missingSource, [], `streetwear heroes with no Walk folder: ${missingSource.join(', ')}`);
assert.deepEqual(
  partialSource,
  [],
  `streetwear heroes missing N/E/S/W Walk frames (list in the PR, pack E/W only): ${partialSource.join('; ')}`,
);
ok(`${heroes.length} streetwear heroes author Walk N,E,S,W on disk`);

function loadPlaySheets(): Record<string, { frames: Record<string, unknown> }> {
  const legacy = path.join(repo, 'assets/art/legacy-play-sheets.json');
  if (fs.existsSync(legacy)) {
    return JSON.parse(fs.readFileSync(legacy, 'utf8')) as Record<string, { frames: Record<string, unknown> }>;
  }
  const sheetsSrc = fs.readFileSync(path.join(repo, 'src/play/generated-play-sheets.ts'), 'utf8');
  const json = sheetsSrc.slice(
    sheetsSrc.indexOf('{', sheetsSrc.indexOf('PLAY_SHEETS:')),
    sheetsSrc.indexOf(' as const;'),
  );
  return JSON.parse(json) as Record<string, { frames: Record<string, unknown> }>;
}
const sheets = loadPlaySheets();

const meta = JSON.parse(
  fs.readFileSync(path.join(repo, 'assets/play/sheets/streetwear/meta.json'), 'utf8'),
) as { chars: Record<string, { clips: Record<string, number>; walkOrder?: string[] }> };

const missingPacked: string[] = [];
for (const slug of heroes) {
  const key = `sheets/streetwear/heroes/${slug}/Walk`;
  const frames = sheets[key]?.frames ?? {};
  const dirs = SKIN_WALK_4DIR_ORDER.filter((d) => !frames[`${d}/frame_000`]);
  const order = meta.chars[`heroes/${slug}`]?.walkOrder ?? [];
  const orderOk =
    order.length === SKIN_WALK_4DIR_ORDER.length &&
    SKIN_WALK_4DIR_ORDER.every((d, i) => order[i] === d);
  if (dirs.length > 0 || !orderOk) {
    missingPacked.push(
      `${slug} packed=[${Object.keys(frames)
        .map((f) => f.split('/')[0])
        .filter((v, i, a) => a.indexOf(v) === i)
        .join(',')}] walkOrder=[${order.join(',')}] missing=${dirs.join(',') || 'order'}`,
    );
  }
  const onDisk = path.join(SHEETS, slug, 'sheets.json');
  assert.ok(fs.existsSync(onDisk), `${slug}: packed sheets.json missing`);
}
assert.deepEqual(
  missingPacked,
  [],
  `streetwear heroes whose packed Walk is not 4-dir: ${missingPacked.join('; ')}`,
);
ok(`${heroes.length} packed Walk sheets + meta.walkOrder are N,E,S,W`);

const four = { dirs: 4 as const };
const two = { dirs: 2 as const };
assert.equal(walkClipDirIndex(four, 0, -1), 0, '4-dir north');
assert.equal(walkClipDirIndex(four, 1, 0), 1, '4-dir east');
assert.equal(walkClipDirIndex(four, 0, 1), 2, '4-dir south');
assert.equal(walkClipDirIndex(four, -1, 0), 3, '4-dir west');
assert.equal(walkClipDirIndex(four, 1, 0), hideoutWalkDirIndex(1, 0), 'east matches hideoutWalkDirIndex');
assert.equal(walkClipDirIndex(four, 0, 1), hideoutWalkDirIndex(0, 1), 'south matches hideoutWalkDirIndex');
assert.equal(walkClipDirIndex(four, -1, 0), hideoutWalkDirIndex(-1, 0), 'west matches hideoutWalkDirIndex');
assert.equal(walkClipDirIndex(four, 0, -1), hideoutWalkDirIndex(0, -1), 'north matches hideoutWalkDirIndex');
assert.equal(walkClipDirIndex(two, 1, 0), 0, '2-dir east');
assert.equal(walkClipDirIndex(two, -1, 0), 1, '2-dir west');
assert.equal(walkClipDirIndex(two, 0, 1), SKIN_WALK_NO_DIR, '2-dir south is no-dir (not a side walk)');
assert.equal(walkClipDirIndex(two, 0, -1), SKIN_WALK_NO_DIR, '2-dir north is no-dir (not a side walk)');
assert.equal(walkClipDirIndex(undefined, 0, 1), SKIN_WALK_NO_DIR, 'missing clip is no-dir');
ok('skinWalkDirIndex snap: 4-dir N/E/S/W; 2-dir vertical is stills, not side walk');

const poseSrc = fs.readFileSync(path.join(repo, 'src/play/pet-anim-sprite.tsx'), 'utf8');
assert.match(
  poseSrc,
  /skinWalkClipDirIndex\(role\.walk/,
  'poseDrawable walk must use skinWalkClipDirIndex (same snap as skinWalkDirIndex)',
);
assert.match(
  poseSrc,
  /SKIN_WALK_NO_DIR/,
  'poseDrawable walk must fall back to the standing pose when the heading has no row',
);
const walkBranch = /if \(pose\.clip === 'walk'\) \{[\s\S]*?return roleArtDrawable\(role, rotationIndex\(role, face\)\);\n  \}/.exec(
  poseSrc,
)?.[0];
assert.ok(walkBranch, 'poseDrawable has a walk branch');
assert.doesNotMatch(
  walkBranch,
  /order\.indexOf\(folder\)/,
  'poseDrawable walk must not indexOf the walk folder (that would skip skinWalkDirIndex)',
);
const packSrc = fs.readFileSync(path.join(repo, 'scripts/art-pack.ts'), 'utf8');
assert.match(packSrc, /SW_WALK_ORDER = \['north', 'east', 'south', 'west'\]/, 'packer Walk order is NESW');
assert.match(
  packSrc,
  /group === 'heroes' && clip\.name === 'Walk'/,
  'packer 4-dir Walk is heroes only — creeps/boss stay E/W',
);
const clipSrc = fs.readFileSync(path.join(repo, 'src/play/skin.ts'), 'utf8');
assert.match(
  clipSrc,
  /fourDirWalkPacked\(meta\?\.walkOrder/,
  'streetwearClip Walk claims dirs:4 only when walkOrder + sheet have N/E/S/W',
);
ok('room walk is wired through skinWalkClipDirIndex; packer + streetwearClip stay 4-dir for heroes only');

console.log(`\ncheck:streetwear-walk — ${passed} groups passed.`);
