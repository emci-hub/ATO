/**
 * ATO art packer (`npm run art:pack`).
 *
 * Ports play-art-pack.ts and adds: per-clip trim with TexturePacker crop-keep-
 * position offsets, core vs combat atlases, Aseprite-shaped JSON, per-frame
 * durations, PNG-8 + oxipng, 2048 target / 4096 cap, decoded-MB stats.
 *
 * Usage: npx tsx scripts/art-pack.ts --all
 *        npx tsx scripts/art-pack.ts --id hero.kael.streetwear
 *        npx tsx scripts/art-pack.ts --skin streetwear [--heroes-only]
 *        npx tsx scripts/play-art-pack.ts --hero archangel   (thin wrapper)
 */
import fs from 'node:fs';
import path from 'node:path';

import { PNG } from 'pngjs';

import {
  GUTTER,
  MAX_SHEET_PX,
  TARGET_SHEET_PX,
  alphaBox,
  blit,
  cropExact,
  decodedMb,
  readPng,
  unionBox,
  walkFiles,
  writePackedPng,
} from './art-png';
import { paintTurfBoard, turfAmbientSrc, turfBoardArtAvailable, type TurfBoardArt } from './turf-board-art';
import { TURF_THEME_IDS, turfBoardArtId } from '../src/play/turf-theme';
import {
  HASH_SUFFIX,
  SW_DIRS,
  SW_WALK_ORDER,
  atlasFrameKey,
  byCompassLong,
  clipMs,
  isCoreClip,
  kebab,
  legacyFrameKey,
  stripHash,
  toLongDir,
} from './art-dirs';
import type { AtlasJson, ArtFormat, ArtTrim } from '../src/art/registry.types';
import { charArtRel } from './art-categories';
import { groundInset, groundRow } from '../src/play/ground-point';

/**
 * Word → role guesses, checked in order. These only ever PROPOSE a role: the
 * catalog keeps every action under its authored name, and an action that
 * matches nothing (or matches two roles) is reported for a human decision
 * rather than silently binned. `heroes.json` stays the source of truth.
 */
const ROLE_WORDS: Record<string, string[]> = {
  idle: ['idle', 'hover', 'breathing', 'stand'],
  walk: ['walk', 'run', 'flight', 'move', 'march'],
  dash: ['dash', 'rush', 'charge', 'sprint', 'drift'],
  attack: ['attack', 'strike', 'slash', 'shoot', 'swing', 'punch', 'stab'],
  skill: ['skill', 'ultimate', 'heavy', 'special', 'spell', 'cast', 'judgment'],
  hurt: ['hurt', 'flinch', 'stagger', 'damage', 'death', 'die'],
};

/**
 * Facings in TURNING order, not alphabetical. A rotation strip is read as a
 * sequence — play it start to finish and the character turns on the spot — so
 * `north-west` must sit next to `north`, not next to `north-east`.
 */
const ROTATION_ORDER = [
  'north',
  'north-east',
  'east',
  'south-east',
  'south',
  'south-west',
  'west',
  'north-west',
];

/** Roles an action name suggests (0 = unknown, 2+ = ambiguous). */
function inferRoles(actionName: string): string[] {
  const lower = actionName.toLowerCase();
  return Object.entries(ROLE_WORDS)
    .filter(([, words]) => words.some((w) => lower.includes(w)))
    .map(([role]) => role);
}

type FrameRect = { x: number; y: number; w: number; h: number };

export type SheetEntry = {
  /** Sheet file, relative to `assets/play/` (legacy key) or `assets/art/`. */
  sheet: string;
  sheetW: number;
  sheetH: number;
  frames: Record<string, FrameRect>;
  sourceW?: number;
  sourceH?: number;
  offsetX?: number;
  offsetY?: number;
  ms?: number;
  dirs?: string[];
  tier?: 'core' | 'combat' | 'ui';
};

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

/**
 * Lowest opaque row in the sprite, as a fraction of frame height — the value
 * `footAt` wants. Measured across every frame of the clip so a bobbing idle
 * reports its lowest planted foot, not one mid-air frame. Returns undefined
 * when the clip is fully transparent (a broken export).
 */
function measureFootAt(frames: PNG[]): number | undefined {
  let lowest = -1;
  for (const png of frames) {
    for (let y = png.height - 1; y > lowest; y -= 1) {
      let opaque = false;
      for (let x = 0; x < png.width; x += 1) {
        if (png.data[(y * png.width + x) * 4 + 3] > 8) {
          opaque = true;
          break;
        }
      }
      if (opaque) {
        lowest = y;
        break;
      }
    }
  }
  if (lowest < 0) return undefined;
  return Number((((lowest + 1) / frames[0].height)).toFixed(4));
}

type PackedClip = {
  key: string;
  /** The action's authored name, e.g. `Ultimate_Final_Judgment` / `rotations`. */
  action: string;
  entry: SheetEntry;
  footAt?: number;
  dirs: string[];
  frameCount: number;
  warnings: string[];
  trim: ArtTrim;
  ms: number;
  png: PNG;
};

function applyTrim(pngs: PNG[]): { cells: PNG[]; trim: ArtTrim } {
  const sourceW = pngs[0].width;
  const sourceH = pngs[0].height;
  const box = unionBox(pngs.map((p) => alphaBox(p)));
  if (!box) {
    return {
      cells: pngs.map((p) => cropExact(p, 0, 0, sourceW, sourceH)),
      trim: { offsetX: 0, offsetY: 0, sourceW, sourceH },
    };
  }
  const x0 = Math.max(0, box.x0 - 1);
  const y0 = Math.max(0, box.y0 - 1);
  const x1 = Math.min(sourceW - 1, box.x1 + 1);
  const y1 = Math.min(sourceH - 1, box.y1 + 1);
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  return {
    cells: pngs.map((p) => cropExact(p, x0, y0, w, h)),
    trim: { offsetX: x0, offsetY: y0, sourceW, sourceH },
  };
}

/**
 * Pack the 8 static rotation PNGs (one per facing, no frames) into one strip.
 * Keyed by facing alone (`east`), matching the per-frame registry's key tail.
 */
function packRotations(heroDir: string, outDir: string, keyBase: string): PackedClip | undefined {
  const rotPath = path.join(heroDir, 'rotations');
  if (!fs.existsSync(rotPath)) return undefined;

  const files = fs
    .readdirSync(rotPath)
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .sort((a, b) => byCompassLong(a.replace(/\.png$/i, ''), b.replace(/\.png$/i, '')));
  if (files.length === 0) return undefined;

  const pngs = files.map((f) => readPng(path.join(rotPath, f)));
  const warnings: string[] = [];
  const sizes = new Set(pngs.map((p) => `${p.width}x${p.height}`));
  if (sizes.size > 1) warnings.push(`mixed rotation sizes (${[...sizes].join(', ')})`);
  if (files.length !== 8 && files.length !== 4) {
    warnings.push(`${files.length} rotations (expected 4 or 8) — check the export`);
  }

  const { cells, trim } = applyTrim(pngs);
  const cellW = cells[0].width;
  const cellH = cells[0].height;
  const sheetW = files.length * cellW + (files.length - 1) * GUTTER;
  if (sheetW > MAX_SHEET_PX || cellH > MAX_SHEET_PX) {
    throw new Error(`rotations: strip ${sheetW}x${cellH} exceeds the ${MAX_SHEET_PX}px cap`);
  }
  const sheet = new PNG({ width: sheetW, height: cellH, fill: true });
  const frames: Record<string, FrameRect> = {};

  files.forEach((file, i) => {
    const x = i * (cellW + GUTTER);
    blit(cells[i], sheet, x, 0);
    frames[file.replace(/\.png$/i, '')] = { x, y: 0, w: cellW, h: cellH };
  });

  const outPath = path.join(outDir, 'rotations.png');
  writePackedPng(outPath, sheet);

  return {
    key: `${keyBase}/rotations`,
    action: 'rotations',
    entry: {
      sheet: `${keyBase}/rotations.png`,
      sheetW,
      sheetH: cellH,
      frames,
      ...trim,
      ms: clipMs('rotations'),
      dirs: files.map((f) => f.replace(/\.png$/i, '')),
      tier: 'core',
    },
    footAt: measureFootAt(pngs),
    dirs: files.map((f) => f.replace(/\.png$/i, '')),
    frameCount: 1,
    warnings,
    trim,
    ms: clipMs('rotations'),
    png: sheet,
  };
}

/** Pack one `<clip>/<dir>/frame_NNN.png` tree into a single sheet. `onlyDirs`
 * keeps just those facings, in that order (Streetwear default is east/west;
 * hero Walk passes N,E,S,W). */
function packClip(
  heroDir: string,
  clipDirName: string,
  outDir: string,
  keyBase: string,
  onlyDirs?: readonly string[],
): PackedClip {
  const clipPath = path.join(heroDir, 'animations', clipDirName);
  const clipKey = clipDirName.replace(HASH_SUFFIX, '');
  const warnings: string[] = [];

  const listed = fs
    .readdirSync(clipPath, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  const dirs = onlyDirs
    ? onlyDirs
        .map((want) => listed.find((n) => n.replace(HASH_SUFFIX, '') === want))
        .filter((n): n is string => !!n)
    : listed;

  const rows = dirs.map((dir) => {
    const files = fs
      .readdirSync(path.join(clipPath, dir))
      .filter((f) => f.toLowerCase().endsWith('.png'))
      .sort();
    // A facing folder can carry an export hash (`west-0247c925`); the key
    // drops it, exactly as play-art-prep does for every segment.
    return { dir: dir.replace(HASH_SUFFIX, ''), files: files.map((f) => path.join(clipPath, dir, f)), names: files };
  });

  if (rows.length === 0) throw new Error(`${clipKey}: no direction folders`);

  // Flag the exact traps the manual ingest hit before: uneven frame counts
  // between directions, and empty folders.
  const counts = new Set(rows.map((r) => r.files.length));
  if (counts.size > 1) {
    warnings.push(
      `uneven frame counts across directions (${rows.map((r) => `${r.dir}:${r.files.length}`).join(', ')}) — this clip needs a human decision`,
    );
  }
  for (const row of rows) {
    if (row.files.length === 0) warnings.push(`direction "${row.dir}" has no frames`);
  }

  const allPngs = rows.flatMap((r) => r.files.map(readPng));
  if (allPngs.length === 0) throw new Error(`${clipKey}: every direction folder is empty`);
  const sizes = new Set(allPngs.map((p) => `${p.width}x${p.height}`));
  if (sizes.size > 1) {
    warnings.push(`mixed frame sizes in one clip (${[...sizes].join(', ')}) — not packable as a grid`);
  }

  const { cells, trim } = applyTrim(allPngs);
  let cellI = 0;
  const cellW = cells[0].width;
  const cellH = cells[0].height;
  const cols = Math.max(...rows.map((r) => r.files.length));

  const sheetW = cols * cellW + (cols - 1) * GUTTER;
  const sheetH = rows.length * cellH + (rows.length - 1) * GUTTER;
  if (sheetW > MAX_SHEET_PX || sheetH > MAX_SHEET_PX) {
    throw new Error(`${clipKey}: sheet ${sheetW}x${sheetH} exceeds the ${MAX_SHEET_PX}px cap`);
  }

  const sheet = new PNG({ width: sheetW, height: sheetH, fill: true });
  const frames: Record<string, FrameRect> = {};

  rows.forEach((row, rowIndex) => {
    const y = rowIndex * (cellH + GUTTER);
    row.files.forEach((_file, colIndex) => {
      const x = colIndex * (cellW + GUTTER);
      blit(cells[cellI], sheet, x, y);
      cellI += 1;
      const frameName = row.names[colIndex].replace(/\.png$/i, '');
      frames[`${row.dir}/${frameName}`] = { x, y, w: cellW, h: cellH };
    });
  });

  const sheetFile = `${keyBase}/${clipKey}.png`;
  const outPath = path.join(outDir, `${clipKey}.png`);
  writePackedPng(outPath, sheet);
  const ms = clipMs(clipKey);
  const tier = isCoreClip(clipKey) ? 'core' : 'combat';

  return {
    key: `${keyBase}/${clipKey}`,
    action: clipKey,
    entry: { sheet: sheetFile, sheetW, sheetH, frames, ...trim, ms, dirs: rows.map((r) => r.dir), tier },
    footAt: measureFootAt(allPngs),
    dirs: rows.map((r) => r.dir),
    frameCount: cols,
    warnings,
    trim,
    ms,
    png: sheet,
  };
}

const HEROES_ROOT = 'assets/play/skins/cast/heroes';
const CAST_GROUPS = ['heroes', 'creeps', 'towers', 'boss'];

function main() {
  const repo = path.resolve(__dirname, '..');
  const one = arg('hero');
  const id = arg('id');
  const all = process.argv.includes('--all');
  const family = arg('family');
  const skin = arg('skin');
  if (process.argv.includes('--auras-only')) {
    packAurasOnly(repo);
    writeRegistry(repo);
    return;
  }
  if (process.argv.includes('--registry-only')) {
    // Rebuild generated-play-sheets.ts + legacy-play-sheets.json from the sheets.json files on disk.
    writeRegistry(repo);
    return;
  }
  if (!one && !all && !family && !skin && !id) {
    throw new Error(
      'Usage: npx tsx scripts/art-pack.ts (--id <id> | --hero <id> | --all | --family <name> | --skin streetwear [--ui-only | --heroes-only | --boards-only | --fx-only] | --auras-only | --registry-only) [--preview]',
    );
  }
  if (id) {
    const m = /^(hero|creep|boss|tower)_([a-z0-9-]+)_(streetwear|cast)$/.exec(id);
    if (!m) throw new Error(`--id ${id}: expected hero_slug_theme`);
    const group = m[1] === 'hero' ? 'heroes' : m[1] === 'creep' ? 'creeps' : m[1] === 'boss' ? 'boss' : 'towers';
    if (m[3] === 'streetwear') {
      packSwCharacter(repo, group, m[2]);
    } else {
      packHero(repo, m[2], group);
    }
    writeRegistry(repo);
    return;
  }

  if (skin) {
    if (skin !== 'streetwear') throw new Error(`unknown skin "${skin}" (only streetwear packs this way)`);
    if (process.argv.includes('--ui-only')) {
      packStreetwearUiOnly(repo);
      writeRegistry(repo);
      return;
    }
    if (process.argv.includes('--heroes-only')) {
      packStreetwearHeroes(repo);
      writeRegistry(repo);
      return;
    }
    if (process.argv.includes('--boards-only')) {
      packStreetwearBoardsOnly(repo);
      writeRegistry(repo);
      return;
    }
    if (process.argv.includes('--fx-only')) {
      packStreetwearFxOnly(repo);
      writeRegistry(repo);
      return;
    }
    packStreetwear(repo);
    writeRegistry(repo);
    return;
  }

  if (family) {
    packFlatFamily(repo, family);
    writeRegistry(repo);
    return;
  }

  // --all packs every cast character: heroes, creeps, towers and bosses.
  const groupOf = (g: string) => {
    const kind = charKind(g);
    const rawRoot = path.join(repo, 'art-src/pixellab');
    if (fs.existsSync(rawRoot)) {
      const slugs = fs
        .readdirSync(rawRoot)
        .filter((n) => n.startsWith(`${kind}.`) && n.endsWith('.cast'))
        .map((n) => n.slice(`${kind}.`.length, n.length - '.cast'.length));
      if (slugs.length > 0) return slugs.sort().map((hero) => ({ group: g, hero }));
    }
    const dir = path.join(repo, path.dirname(HEROES_ROOT), g);
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => ({ group: g, hero: d.name }))
      .sort((a, b) => a.hero.localeCompare(b.hero));
  };
  const heroes = all
    ? CAST_GROUPS.flatMap(groupOf)
    : [{ group: 'heroes', hero: one as string }];

  let failures = 0;
  for (const { group, hero } of heroes) {
    try {
      packHero(repo, hero, group);
    } catch (err) {
      // One bad hero folder must not abandon the rest of the library.
      failures += 1;
      console.log(`packed ${hero}: FAILED — ${(err as Error).message}`);
    }
  }

  // Rebuilt from every packed hero on disk, so a single-hero run keeps the rest.
  writeRegistry(repo);
  if (failures > 0) {
    console.log(`\n${failures} hero(es) failed to pack — see above.`);
    process.exitCode = 1;
  }
}

/**
 * Pack a FLAT family (no clip/direction nesting — just N independent PNGs,
 * e.g. `kenney-td`'s 299 tower/tile pieces) into one or more grid sheets, one
 * cell per file, keyed by the file's own basename (no extension) — the exact
 * tail `skinArtDrawable`/`roleArtDrawable` look up after stripping the family
 * prefix. Requires every file in the family to share one size (true today for
 * kenney-td: 299×64×64); a mixed-size family needs a bin packer instead and
 * is refused rather than mis-packed.
 */
function packFlatFamily(repo: string, family: string) {
  const dir = path.join(repo, 'assets/play', family);
  if (!fs.existsSync(dir)) throw new Error(`no such family folder: assets/play/${family}`);

  const files = walk(dir)
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .sort();
  if (files.length === 0) throw new Error(`${family}: no PNGs found`);

  const pngs = files.map(readPng);
  const sizes = new Set(pngs.map((p) => `${p.width}x${p.height}`));
  if (sizes.size > 1) {
    throw new Error(`${family}: mixed sizes (${[...sizes].join(', ')}) — needs a bin packer, not a grid`);
  }
  const cellW = pngs[0].width;
  const cellH = pngs[0].height;

  const perRow = Math.max(1, Math.floor((MAX_SHEET_PX - GUTTER) / (cellW + GUTTER)));
  const rows = Math.ceil(files.length / perRow);
  const sheetW = perRow * cellW + (perRow - 1) * GUTTER;
  const sheetH = rows * cellH + (rows - 1) * GUTTER;
  if (sheetH > MAX_SHEET_PX) {
    throw new Error(`${family}: ${files.length} cells need ${sheetH}px tall, over the ${MAX_SHEET_PX}px cap`);
  }

  const sheet = new PNG({ width: sheetW, height: sheetH, fill: true });
  const frames: Record<string, FrameRect> = {};
  files.forEach((file, i) => {
    const col = i % perRow;
    const row = Math.floor(i / perRow);
    const x = col * (cellW + GUTTER);
    const y = row * (cellH + GUTTER);
    blit(pngs[i], sheet, x, y);
    const key = path.basename(file).replace(/\.png$/i, '');
    frames[key] = { x, y, w: cellW, h: cellH };
  });

  const keyBase = `sheets/${family}`;
  const outDir = path.join(repo, 'assets/play', keyBase);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'atlas.png'), PNG.sync.write(sheet));

  const manifest = { [keyBase]: { sheet: `${keyBase}/atlas.png`, sheetW, sheetH, frames } };
  fs.writeFileSync(path.join(outDir, 'sheets.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(
    `packed ${family}: ${files.length} files → 1 sheet (${sheetW}x${sheetH}, ${perRow}×${rows} grid)`,
  );
}

/* ------------------------------------------------ Streetwear skin pack ---- */

const SW_SRC = 'assets/play/skins/streetwear';
const SW_SHEETS = 'sheets/streetwear';
// Pinned by check:streetwear-walk: SW_WALK_ORDER = ['north', 'east', 'south', 'west']

function swRoot(repo: string): string {
  const migrated = path.join(repo, 'art-src/pixellab/streetwear-pack/migrated/raw');
  if (fs.existsSync(migrated)) return migrated;
  return path.join(repo, SW_SRC);
}

function listSwChars(repo: string, group: string): string[] {
  const rawRoot = path.join(repo, 'art-src/pixellab');
  if (fs.existsSync(rawRoot)) {
    const kind = charKind(group);
    const suffix = `.streetwear`;
    const prefix = `${kind}.`;
    const slugs = fs
      .readdirSync(rawRoot)
      .filter((n) => n.startsWith(prefix) && n.endsWith(suffix))
      .map((n) => n.slice(prefix.length, n.length - suffix.length))
      .sort();
    if (slugs.length > 0) return slugs;
  }
  const dir = path.join(repo, SW_SRC, group);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

function charKind(group: string): 'hero' | 'creep' | 'boss' | 'tower' {
  if (group === 'heroes') return 'hero';
  if (group === 'creeps') return 'creep';
  if (group === 'boss') return 'boss';
  return 'tower';
}

function charRawDir(repo: string, theme: string, group: string, slug: string): string {
  const kind = charKind(group);
  const base = path.join(repo, 'art-src/pixellab', `${kind}.${slug}.${theme}`);
  for (const gen of ['picked', 'migrated']) {
    const raw = path.join(base, gen, 'raw');
    if (fs.existsSync(raw)) return raw;
  }
  if (fs.existsSync(base)) {
    const gens = fs
      .readdirSync(base, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    for (const g of gens.reverse()) {
      const raw = path.join(base, g, 'raw');
      if (fs.existsSync(raw)) return raw;
    }
  }
  const legacy = path.join(repo, 'assets/play/skins', theme, group, slug);
  if (fs.existsSync(legacy)) return legacy;
  throw new Error(`no source for ${theme}/${group}/${slug}`);
}

function charArtId(theme: string, group: string, slug: string): string {
  return `${charKind(group)}_${kebab(slug)}_${kebab(theme)}`;
}

function charArtDir(repo: string, theme: string, group: string, slug: string): string {
  return path.join(repo, 'assets/art', charArtRel(theme, group, slug));
}

type SwCharMeta = {
  /** Feet line of the east rotation, fraction of the frame height from the top. */
  footAt: number;
  /** Ground point row (feet line minus the footprint inset, src/play/ground-point.ts),
   * fraction of the frame height from the top. Auras and floor rings centre here. */
  groundAt: number;
  /** Visible body height / frame height (east rotation) — sizes the box so a
   * Streetwear figure matches the cast figure it replaces on screen. */
  bodyRatio: number;
  /** Clip name → frames per facing (uniform across packed facings). */
  clips: Record<string, number>;
  /** Walk facing folders actually packed, in `skinWalkDirIndex` order. */
  walkOrder?: string[];
};

type SwFxMeta = { frames: number; fps: number; loop: boolean; cell: number; anchorX: number; anchorY: number };

/** Facings present on disk for one clip, in `wanted` order (missing skipped). */
function existingClipDirs(clipPath: string, wanted: readonly string[]): string[] {
  if (!fs.existsSync(clipPath)) return [];
  const found = new Set(
    fs
      .readdirSync(clipPath, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name.replace(HASH_SUFFIX, '')),
  );
  return wanted.filter((d) => found.has(d));
}

/** Pack one Streetwear character folder: clip sheets + the 8-rotation strip.
 * Hero Walk packs N/E/S/W when those folders exist; every other clip stays E/W
 * so path walkers keep a side profile. */
function packSwCharacter(repo: string, group: string, slug: string): SwCharMeta {
  const dir = charRawDir(repo, 'streetwear', group, slug);
  const keyBase = `${SW_SHEETS}/${group}/${slug}`;
  const artId = charArtId('streetwear', group, slug);
  const artDir = charArtDir(repo, 'streetwear', group, slug);
  const outDir = path.join(repo, 'assets/play', keyBase);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.rmSync(artDir, { recursive: true, force: true });
  const packed: PackedClip[] = [];
  const clips: Record<string, number> = {};
  let walkOrder: string[] | undefined;
  const animRoot = path.join(dir, 'animations');
  if (fs.existsSync(animRoot)) {
    for (const clip of fs.readdirSync(animRoot, { withFileTypes: true }).filter((d) => d.isDirectory())) {
      const clipPath = path.join(animRoot, clip.name);
      const dirs =
        group === 'heroes' && clip.name === 'Walk'
          ? existingClipDirs(clipPath, SW_WALK_ORDER)
          : [...SW_DIRS];
      const p = packClip(dir, clip.name, outDir, keyBase, dirs.length > 0 ? dirs : SW_DIRS);
      for (const w of p.warnings) throw new Error(`${group}/${slug}/${clip.name}: ${w}`);
      packed.push(p);
      clips[p.action] = p.frameCount;
      if (p.action === 'Walk') walkOrder = p.dirs;
    }
  }
  const rotations = packRotations(dir, outDir, keyBase);
  if (!rotations) throw new Error(`${group}/${slug}: no rotations`);
  packed.push(rotations);
  const manifest: Record<string, SheetEntry> = {};
  for (const p of packed) manifest[p.key] = p.entry;
  fs.writeFileSync(path.join(outDir, 'sheets.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  const east = readPng(path.join(dir, 'rotations', 'east.png'));
  const box = alphaBox(east);
  if (!box) throw new Error(`${group}/${slug}: empty east rotation`);
  const meta: SwCharMeta = {
    footAt: Number(((box.y1 + 1) / east.height).toFixed(4)),
    groundAt: Number(((groundRow(box.y1 + 1, box.y1 - box.y0 + 1)) / east.height).toFixed(4)),
    bodyRatio: Number(((box.y1 - box.y0 + 1) / east.height).toFixed(4)),
    clips,
    ...(walkOrder && walkOrder.length > 0 ? { walkOrder } : {}),
  };
  atlasCharacterTiers(repo, artId, artDir, packed, keyBase);
  return meta;
}

/** Crop the frames of a PixelLab VFX export: TexturePacker `<kind>.json`
 * (pivot = anchor) or a `--part` / game-pack `manifest.json` clip (offset =
 * frame top-left relative to the anchor). */
function vfxExportFrames(
  png: string,
  meta: string,
  clipName?: string,
): { frames: PNG[]; anchor: { x: number; y: number }; fps: number; loop: boolean } {
  const sheet = readPng(png);
  const j = JSON.parse(fs.readFileSync(meta, 'utf8'));
  const cut = (x: number, y: number, w: number, h: number) => {
    const p = new PNG({ width: w, height: h, fill: true });
    PNG.bitblt(sheet, p, x, y, w, h, 0, 0);
    return p;
  };
  if (Array.isArray(j.frames)) {
    const f0 = j.frames[0];
    const ms = Number(f0.duration) || 83;
    return {
      frames: j.frames.map((f: { frame: FrameRect }) => cut(f.frame.x, f.frame.y, f.frame.w, f.frame.h)),
      anchor: { x: f0.pivot.x * f0.frame.w, y: f0.pivot.y * f0.frame.h },
      fps: Math.round(1000 / ms),
      loop: false,
    };
  }
  const c = clipName ? j.clips.find((k: { name: string }) => k.name === clipName) : j.clips[0];
  if (!c) throw new Error(`${meta}: no clip ${clipName}`);
  // The manifest names its own sheet file, which we saved under a different
  // name — the grid geometry is what we trust.
  const cols = c.sheets[0].columns as number;
  const frames: PNG[] = [];
  for (let i = 0; i < c.frames; i += 1) {
    frames.push(cut((i % cols) * c.frame.w, Math.floor(i / cols) * c.frame.h, c.frame.w, c.frame.h));
  }
  return { frames, anchor: { x: -c.offset.x, y: -c.offset.y }, fps: j.fps ?? 12, loop: !!c.loop };
}

/** One horizontal strip of square cells (frames centred), keyed `frame_NNN`. */
function writeSquareStrip(
  repo: string,
  key: string,
  layers: { frames: PNG[]; dx: number; dy: number }[],
  cell: number,
): SheetEntry {
  const n = layers[0].frames.length;
  const sheetW = n * cell + (n - 1) * GUTTER;
  if (sheetW > MAX_SHEET_PX) throw new Error(`${key}: strip ${sheetW}px over the cap`);
  const sheet = new PNG({ width: sheetW, height: cell, fill: true });
  const frames: Record<string, FrameRect> = {};
  for (let i = 0; i < n; i += 1) {
    const x = i * (cell + GUTTER);
    for (const layer of layers) {
      const f = layer.frames[i % layer.frames.length];
      PNG.bitblt(f, sheet, 0, 0, f.width, f.height, x + layer.dx, layer.dy);
    }
    frames[`frame_${String(i).padStart(3, '0')}`] = { x, y: 0, w: cell, h: cell };
  }
  const file = path.join(repo, 'assets/play', `${key}.png`);
  writePackedPng(file, sheet);
  return { sheet: `${key}.png`, sheetW, sheetH: cell, frames };
}

/** One horizontal strip of same-size frames, keyed `frame_NNN` (ambient clips keep their own aspect). */
function writeFrameStrip(repo: string, key: string, frames: PNG[]): SheetEntry {
  const w = frames[0].width;
  const h = frames[0].height;
  const n = frames.length;
  const sheetW = n * w + (n - 1) * GUTTER;
  if (sheetW > MAX_SHEET_PX) throw new Error(`${key}: strip ${sheetW}px over the cap`);
  const sheet = new PNG({ width: sheetW, height: h, fill: true });
  const rects: Record<string, FrameRect> = {};
  frames.forEach((f, i) => {
    const x = i * (w + GUTTER);
    PNG.bitblt(f, sheet, 0, 0, w, h, x, 0);
    rects[`frame_${String(i).padStart(3, '0')}`] = { x, y: 0, w, h };
  });
  writePackedPng(path.join(repo, 'assets/play', `${key}.png`), sheet);
  return { sheet: `${key}.png`, sheetW, sheetH: h, frames: rects };
}

/** Element effects → square-cell strips (the board's sprite drawer is square). */
function packSwEffects(repo: string): { manifest: Record<string, SheetEntry>; meta: Record<string, SwFxMeta> } {
  const manifest: Record<string, SheetEntry> = {};
  const meta: Record<string, SwFxMeta> = {};
  const root = path.join(swRoot(repo), 'fx/elements');
  for (const el of fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    for (const kind of ['shot', 'hit', 'burst', 'status', 'slash']) {
      const png = path.join(root, el.name, `${kind}.png`);
      const metaFile = [`${kind}.json`, `${kind}.manifest.json`].map((m) => path.join(root, el.name, m)).find((m) => fs.existsSync(m));
      if (!fs.existsSync(png) || !metaFile) continue;
      const fx = vfxExportFrames(png, metaFile);
      const w = fx.frames[0].width;
      const h = fx.frames[0].height;
      const cell = Math.max(w, h);
      const dx = (cell - w) >> 1;
      const dy = (cell - h) >> 1;
      const key = `${SW_SHEETS}/fx/${el.name}/${kind}`;
      manifest[key] = writeSquareStrip(repo, key, [{ frames: fx.frames, dx, dy }], cell);
      meta[`${el.name}/${kind}`] = {
        frames: fx.frames.length,
        fps: fx.fps,
        loop: kind === 'shot' || (kind === 'status' && el.name !== 'root'),
        cell,
        anchorX: Number(((fx.anchor.x + dx) / cell).toFixed(4)),
        anchorY: Number(((fx.anchor.y + dy) / cell).toFixed(4)),
      };
    }
  }
  return { manifest, meta };
}

/**
 * One manifest (and so one small indexed atlas) per aura style: a style only
 * loads its own pixels, not every style's. Clears the old shared
 * `auras/atlas.png` + `auras/sheets.json`.
 */
function writeAuraManifests(repo: string, manifest: Record<string, SheetEntry>): void {
  const auraDir = path.join(repo, 'assets/play', SW_SHEETS, 'auras');
  fs.mkdirSync(auraDir, { recursive: true });
  for (const f of fs.readdirSync(auraDir)) {
    const full = path.join(auraDir, f);
    if (fs.statSync(full).isFile()) fs.rmSync(full);
  }
  const byStyle = new Map<string, Record<string, SheetEntry>>();
  for (const [key, entry] of Object.entries(manifest)) {
    const style = key.split('/').slice(-2, -1)[0];
    byStyle.set(style, { ...(byStyle.get(style) ?? {}), [key]: entry });
  }
  for (const [style, part] of byStyle) {
    fs.mkdirSync(path.join(auraDir, style), { recursive: true });
    fs.writeFileSync(path.join(auraDir, style, 'sheets.json'), `${JSON.stringify(part, null, 2)}\n`);
  }
}

/** `--auras-only`: repack just the aura strips + atlases and swap `auras` in meta.json. */
function packAurasOnly(repo: string): void {
  const auras = packSwAuras(repo);
  writeAuraManifests(repo, auras.manifest);
  const auraDir = path.join(repo, 'assets/play', SW_SHEETS, 'auras');
  let files = 0;
  for (const manifest of walk(auraDir).filter((f) => f.endsWith('sheets.json'))) {
    files += atlasSheetsDir(repo, path.dirname(manifest));
  }
  const metaPath = path.join(repo, 'assets/play', SW_SHEETS, 'meta.json');
  const raw = fs.readFileSync(metaPath, 'utf8');
  const crlf = raw.includes('\r\n');
  const meta = JSON.parse(raw) as Record<string, unknown>;
  meta.auras = auras.meta;
  const text = `${JSON.stringify(meta, null, 2)}\n`;
  fs.writeFileSync(metaPath, crlf ? text.replace(/\n/g, '\r\n') : text);
  console.log(`packed ${Object.keys(auras.meta).length} aura styles into ${files} atlases`);
}

/** Pet auras → a behind strip and a front strip sharing one square cell, both
 * anchored at the pet's feet. Greyscale: the app palette-maps them at runtime. */
function packSwAuras(repo: string): { manifest: Record<string, SheetEntry>; meta: Record<string, SwFxMeta & { refBodyPx: number }> } {
  const manifest: Record<string, SheetEntry> = {};
  const meta: Record<string, SwFxMeta & { refBodyPx: number }> = {};
  const root = path.join(swRoot(repo), 'fx/auras');
  // Authored around Kael (visible body 106 px, feet line = lowest row + 1). The
  // anchor is the GROUND point (feet line minus the footprint inset), not the toe edge.
  const REF_BODY_PX = 106;
  for (const style of fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const metaFile = path.join(root, style.name, 'manifest.json');
    const back = vfxExportFrames(path.join(root, style.name, 'behind.png'), metaFile, 'behind');
    const hasFront = fs.existsSync(path.join(root, style.name, 'front.png'));
    const front = hasFront ? vfxExportFrames(path.join(root, style.name, 'front.png'), metaFile, 'front') : null;
    const parts = [back, ...(front ? [front] : [])].map((p) => ({
      p,
      left: -p.anchor.x,
      top: -p.anchor.y,
      w: p.frames[0].width,
      h: p.frames[0].height,
    }));
    const left = Math.min(...parts.map((q) => q.left));
    const top = Math.min(...parts.map((q) => q.top));
    const right = Math.max(...parts.map((q) => q.left + q.w));
    const bottom = Math.max(...parts.map((q) => q.top + q.h));
    const cell = Math.max(right - left, bottom - top);
    const ox = ((cell - (right - left)) >> 1) - left; // anchor x inside the cell
    const oy = ((cell - (bottom - top)) >> 1) - top;
    for (const q of parts) {
      const which = q.p === back ? 'behind' : 'front';
      const key = `${SW_SHEETS}/auras/${style.name}/${which}`;
      manifest[key] = writeSquareStrip(repo, key, [{ frames: q.p.frames, dx: ox + q.left, dy: oy + q.top }], cell);
    }
    meta[style.name] = {
      frames: back.frames.length,
      fps: back.fps,
      loop: true,
      cell,
      anchorX: Number((ox / cell).toFixed(4)),
      anchorY: Number(((oy - groundInset(REF_BODY_PX)) / cell).toFixed(4)),
      refBodyPx: REF_BODY_PX,
    };
  }
  return { manifest, meta };
}

/** Stepped greyscale → 5-stop ramp (dark → light), outline (< 28) kept. */
function rampMap(src: PNG, ramp: [number, number, number][]): PNG {
  const p = new PNG({ width: src.width, height: src.height });
  src.data.copy(p.data);
  for (let i = 0; i < p.data.length; i += 4) {
    if (!p.data[i + 3]) continue;
    const L = 0.299 * p.data[i] + 0.587 * p.data[i + 1] + 0.114 * p.data[i + 2];
    if (L < 28) continue;
    const k = Math.min(ramp.length - 1, Math.round(((L - 28) / 227) * (ramp.length - 1)));
    [p.data[i], p.data[i + 1], p.data[i + 2]] = ramp[k];
  }
  return p;
}

/** One Streetwear menu piece: its crop, the stretch insets (art px; the
 * corners never stretch) and the drawn size of one art pixel in dp. */
type SwUiPiece = { w: number; h: number; inset: [number, number, number, number]; scale: number };

/**
 * Menu UI kit (2026-10-11): crops the PixelLab kit sheets in `ui/kit/` into
 * 9-slice pieces, bakes the three button colours + pressed states from the one
 * greyscale button, and a dark "off" chip from the yellow one. One frame
 * (`img`) per piece; the atlas pass merges them into one file.
 */
function packSwUiKit(repo: string): Record<string, SwUiPiece> {
  const kit = path.join(swRoot(repo), 'ui/kit');
  const crop = (file: string, x: number, y: number, w: number, h: number) => {
    const src = readPng(path.join(kit, file));
    const out = new PNG({ width: w, height: h, fill: true });
    PNG.bitblt(src, out, x, y, w, h, 0, 0);
    return out;
  };
  const mix = (c: [number, number, number], t: [number, number, number], k: number) =>
    [0, 1, 2].map((i) => Math.round(c[i] + (t[i] - c[i]) * k)) as [number, number, number];
  const BLACK: [number, number, number] = [12, 10, 14];
  const WHITE: [number, number, number] = [255, 255, 255];
  // Face → the colour, bevel → darker, top highlight → lighter. Outline stays.
  const buttonRamp = (hex: string, dim = 0) => {
    const c = mix(hexRgb(hex), BLACK, dim);
    return [mix(c, BLACK, 0.6), mix(c, BLACK, 0.45), mix(c, BLACK, 0.25), c, mix(c, WHITE, 0.5)];
  };
  const button = crop('button-grey.png', 51, 53, 119, 44);
  const chipOn = crop('pieces.png', 31, 159, 450, 66);
  // Plain chips (emci 2026-10-11): the hazard stripes at both ends sat under
  // short labels and made them unreadable — paint them with the face colour,
  // keep the outline and the top highlight line.
  for (let y = 8; y <= 54; y += 1) {
    for (let x = 10; x < chipOn.width - 8; x += 1) {
      if (x > 100 && x < 350) continue;
      const i = (y * chipOn.width + x) * 4;
      if (chipOn.data[i + 3] < 10 || chipOn.data[i] + chipOn.data[i + 1] + chipOn.data[i + 2] < 40) continue;
      [chipOn.data[i], chipOn.data[i + 1], chipOn.data[i + 2]] = [222, 165, 49];
    }
  }
  const pieces: Record<string, { png: PNG; inset: [number, number, number, number]; scale: number }> = {
    panel: { png: crop('panel.png', 34, 19, 318, 239), inset: [56, 56, 56, 56], scale: 0.5 },
    header: { png: crop('header.png', 23, 21, 642, 335), inset: [48, 96, 48, 96], scale: 0.3 },
    back: { png: crop('pieces.png', 256, 64, 65, 65), inset: [0, 0, 0, 0], scale: 0.6 },
    toggle: { png: crop('pieces.png', 185, 238, 144, 44), inset: [0, 0, 0, 0], scale: 0.5 },
    'chip-on': { png: chipOn, inset: [16, 24, 16, 24], scale: 0.3 },
    'chip-off': {
      png: rampMap(chipOn, ['#1f1f23', '#2b2b2e', '#3f3f46', '#52525b', '#a1a1aa'].map(hexRgb)),
      inset: [16, 24, 16, 24],
      scale: 0.3,
    },
  };
  // Street shell v2 (batch 7): bars, sheet, toast, HUD bits, portrait, icons, rooms.
  const sheet = crop('sheet.png', 0, 95, 448, 394);
  // The drag handle sits in the stretching top edge: cut it out as its own
  // piece and patch the hole with the panel texture 24 rows below.
  let hx0 = 1e9, hy0 = 1e9, hx1 = -1, hy1 = -1;
  for (let y = 25; y < 75; y += 1) {
    for (let x = 150; x < 300; x += 1) {
      // Background removal punched the handle's white face out: find the hole.
      const i = (y * sheet.width + x) * 4;
      if (sheet.data[i + 3] < 10) {
        hx0 = Math.min(hx0, x); hy0 = Math.min(hy0, y); hx1 = Math.max(hx1, x); hy1 = Math.max(hy1, y);
      }
    }
  }
  if (hx1 < 0) throw new Error('ui kit: sheet handle not found');
  [hx0, hy0, hx1, hy1] = [hx0 - 10, hy0 - 10, hx1 + 10, hy1 + 10];
  const handle = new PNG({ width: hx1 - hx0 + 1, height: hy1 - hy0 + 1, fill: true });
  PNG.bitblt(sheet, handle, hx0, hy0, handle.width, handle.height, 0, 0);
  for (let i = 0; i < handle.data.length; i += 4) {
    if (handle.data[i + 3] < 10) [handle.data[i], handle.data[i + 1], handle.data[i + 2], handle.data[i + 3]] = [242, 237, 228, 255];
  }
  for (let y = hy0; y <= hy1; y += 1) {
    for (let x = hx0; x <= hx1; x += 1) {
      const d = (y * sheet.width + x) * 4;
      const s = ((y + 24) * sheet.width + x) * 4;
      for (let c = 0; c < 4; c += 1) sheet.data[d + c] = sheet.data[s + c];
    }
  }
  const toast = crop('toast.png', 17, 23, 653, 331);
  // The reroll left smudges in the middle: repaint the paper flat, keep the
  // outline (outer 14px) and the mustard tab (first 80px).
  for (let y = 14; y < toast.height - 14; y += 1) {
    for (let x = 80; x < toast.width - 14; x += 1) {
      const i = (y * toast.width + x) * 4;
      if (toast.data[i] < 40 && toast.data[i + 1] < 40 && toast.data[i + 2] < 40 && toast.data[i + 3] > 200) continue;
      [toast.data[i], toast.data[i + 1], toast.data[i + 2], toast.data[i + 3]] = [242, 237, 228, 255];
    }
  }
  Object.assign(pieces, {
    resbar: { png: crop('resbar.png', 42, 214, 604, 88), inset: [16, 40, 16, 40], scale: 0.5 },
    tabbar: { png: crop('tabbar.png', 38, 215, 611, 87), inset: [20, 48, 16, 48], scale: 0.7 },
    sheet: { png: sheet, inset: [120, 120, 40, 40], scale: 0.5 },
    'sheet-handle': { png: handle, inset: [0, 0, 0, 0], scale: 0.5 },
    toast: { png: toast, inset: [24, 24, 24, 90], scale: 0.3 },
    pause: { png: crop('hud.png', 190, 38, 132, 125), inset: [0, 0, 0, 0], scale: 0.3 },
    alert: { png: crop('hud.png', 125, 204, 261, 115), inset: [30, 40, 30, 40], scale: 0.4 },
    portrait: { png: crop('portrait.png', 300, 64, 159, 124), inset: [0, 0, 0, 0], scale: 0.4 },
  });
  for (const f of fs.readdirSync(path.join(kit, '../nav')).filter((f) => f.endsWith('.png'))) {
    const png = readPng(path.join(kit, '../nav', f));
    pieces[`nav-${f.replace(/\.png$/, '')}`] = { png, inset: [0, 0, 0, 0], scale: 1 };
  }
  for (const f of fs.readdirSync(path.join(kit, '../rooms')).filter((f) => f.endsWith('.png'))) {
    // The isometric Hideout (hideout-iso*) is the live room. Skip the unused
    // flat hideout-full fit and the opaque hideout.png (replaced by iso).
    if (f === 'hideout-full.png' || f === 'hideout.png') continue;
    const png = readPng(path.join(kit, '../rooms', f));
    pieces[`room-${f.replace(/\.png$/, '')}`] = { png, inset: [0, 0, 0, 0], scale: 1 };
  }
  // Ambient critters / particles (32px) for the Hideout and Underground.
  for (const f of fs.readdirSync(path.join(kit, '../ambient')).filter((f) => f.endsWith('.png'))) {
    pieces[`amb-${f.replace(/\.png$/, '')}`] = { png: readPng(path.join(kit, '../ambient', f)), inset: [0, 0, 0, 0], scale: 1 };
  }
  // Underground stops (one backdrop per depth band) + the passing train.
  for (const f of fs.readdirSync(path.join(kit, '../stops')).filter((f) => f.endsWith('.png'))) {
    pieces[`stop-${f.replace(/\.png$/, '')}`] = { png: readPng(path.join(kit, '../stops', f)), inset: [0, 0, 0, 0], scale: 1 };
  }
  for (const [name, hex] of [['primary', '#E0A526'], ['secondary', '#4B5563'], ['danger', '#C8202B']] as const) {
    pieces[`button-${name}`] = { png: rampMap(button, buttonRamp(hex)), inset: [8, 12, 12, 12], scale: 0.75 };
    pieces[`button-${name}-pressed`] = { png: rampMap(button, buttonRamp(hex, 0.25)), inset: [8, 12, 12, 12], scale: 0.75 };
  }
  const outDir = path.join(repo, 'assets/play', SW_SHEETS, 'ui-kit');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const manifest: Record<string, SheetEntry> = {};
  const meta: Record<string, SwUiPiece> = {};
  for (const [name, p] of Object.entries(pieces)) {
    const key = `${SW_SHEETS}/ui-kit/${name}`;
    writePackedPng(path.join(repo, 'assets/play', `${key}.png`), p.png);
    manifest[key] = { sheet: `${key}.png`, sheetW: p.png.width, sheetH: p.png.height, frames: { img: { x: 0, y: 0, w: p.png.width, h: p.png.height } } };
    meta[name] = { w: p.png.width, h: p.png.height, inset: p.inset, scale: p.scale };
  }
  fs.writeFileSync(path.join(outDir, 'sheets.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return meta;
}

/** Nearest-neighbour scale (keeps pixel art crisp). */
function scaleNearest(src: PNG, w: number, h: number): PNG {
  const out = new PNG({ width: w, height: h, fill: true });
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const sx = Math.min(src.width - 1, Math.floor((x * src.width) / w));
      const sy = Math.min(src.height - 1, Math.floor((y * src.height) / h));
      src.data.copy(out.data, (y * w + x) * 4, (sy * src.width + sx) * 4, (sy * src.width + sx) * 4 + 4);
    }
  }
  return out;
}

/** Alpha-blend `src` onto `dst` at (dx, dy), clipped to `dst`. */
function overBlend(src: PNG, dst: PNG, dx: number, dy: number) {
  for (let y = 0; y < src.height; y += 1) {
    const ty = dy + y;
    if (ty < 0 || ty >= dst.height) continue;
    for (let x = 0; x < src.width; x += 1) {
      const tx = dx + x;
      if (tx < 0 || tx >= dst.width) continue;
      const si = (y * src.width + x) * 4;
      const a = src.data[si + 3] / 255;
      if (a === 0) continue;
      const di = (ty * dst.width + tx) * 4;
      for (let c = 0; c < 3; c += 1) dst.data[di + c] = Math.round(src.data[si + c] * a + dst.data[di + c] * (1 - a));
      dst.data[di + 3] = 255;
    }
  }
}

/**
 * Turf War boards (2026-10-11): one 512×512 picture per map, baked from the
 * Streetwear map art so the board draws as ONE sprite (paint only — path,
 * pads and hit-testing still come from `board-data.ts`).
 *   ground  — the asphalt/sidewalk Wang set on a dual grid (road = PATH/START cells)
 *   paint   — a dashed mustard centre line along the walk polyline
 *   pads    — a manhole cover on every tower pad
 *   props   — street props on open sidewalk away from road and pads
 *   ends    — a paint splat at the spawn, a graffiti tag at the exit
 */
function packSwBoards(repo: string): Record<string, { pads: number; ambient?: unknown }> {
  const CELL_PX = 32;
  const N = 16;
  const SIZE = CELL_PX * N;
  const UNIT = SIZE / 100; // board units → px
  const mapDir = path.join(swRoot(repo), 'map');
  const wangPng = readPng(path.join(mapDir, 'asphalt-sidewalk.png'));
  const wangJson = JSON.parse(fs.readFileSync(path.join(mapDir, 'asphalt-sidewalk.json'), 'utf8')) as {
    tileset_data: { tiles: { corners: Record<'NE' | 'NW' | 'SE' | 'SW', 'lower' | 'upper'>; bounding_box: { x: number; y: number; width: number; height: number } }[] };
  };
  const tileFor = new Map<string, PNG>();
  for (const t of wangJson.tileset_data.tiles) {
    const key = `${t.corners.NW}${t.corners.NE}${t.corners.SW}${t.corners.SE}`;
    const b = t.bounding_box;
    const tile = new PNG({ width: b.width, height: b.height, fill: true });
    PNG.bitblt(wangPng, tile, b.x, b.y, b.width, b.height, 0, 0);
    if (!tileFor.has(key)) tileFor.set(key, tile);
  }
  const prop = (name: string, px: number) => scaleNearest(readPng(path.join(swRoot(repo), 'props', `${name}.png`)), px, px);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { BOARD_MAPS, TILE } = require('../src/play/board-data') as typeof import('../src/play/board-data');

  const outDir = path.join(repo, 'assets/play', SW_SHEETS, 'board');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const manifest: Record<string, SheetEntry> = {};
  const meta: Record<string, { pads: number; ambient?: unknown }> = {};
  for (const map of Object.values(BOARD_MAPS)) {
    // T3 (2026-10-17): the default board is painted from PixelLab parts (turf-board-art.ts) + a glow layer for T4.
    if (map.id === 'ato' && turfBoardArtAvailable()) {
      const art = paintTurfBoard(map);
      for (const [key, png] of [[`${SW_SHEETS}/board/ato`, art.board], [`${SW_SHEETS}/board/ato-glow`, art.glow], [`${SW_SHEETS}/board/ato-fire`, art.fire]] as const) {
        writePackedPng(path.join(repo, 'assets/play', `${key}.png`), png);
        manifest[key] = { sheet: `${key}.png`, sheetW: SIZE, sheetH: SIZE, frames: { img: { x: 0, y: 0, w: SIZE, h: SIZE } } };
      }
      // T8: every other theme = its own board + glow + fire (`ato-<theme>`); the ambient clips below are shared.
      const themed: Record<string, { pads: number; ambient: TurfBoardArt['ambient'] }> = {};
      for (const theme of TURF_THEME_IDS) {
        const id = turfBoardArtId(map.id, theme);
        if (id === map.id || !turfBoardArtAvailable(theme)) continue;
        const t = paintTurfBoard(map, theme);
        for (const [key, png] of [[`${SW_SHEETS}/board/${id}`, t.board], [`${SW_SHEETS}/board/${id}-glow`, t.glow], [`${SW_SHEETS}/board/${id}-fire`, t.fire]] as const) {
          writePackedPng(path.join(repo, 'assets/play', `${key}.png`), png);
          manifest[key] = { sheet: `${key}.png`, sheetW: SIZE, sheetH: SIZE, frames: { img: { x: 0, y: 0, w: SIZE, h: SIZE } } };
        }
        themed[id] = { pads: t.pads, ambient: t.ambient };
      }
      // T4: the ambient clips (flame / smoke / steam from PixelLab vfx exports, the pigeon still) as strips on the board family.
      const clips: Record<string, { frames: number; fps: number; w: number; h: number; ax: number; ay: number }> = {};
      const ambientDir = turfAmbientSrc();
      if (ambientDir) {
        for (const name of ['flame', 'smoke', 'steam']) {
          const fx = vfxExportFrames(path.join(ambientDir, `${name}.png`), path.join(ambientDir, `${name}.json`));
          const key = `${SW_SHEETS}/board/ato-${name}`;
          manifest[key] = writeFrameStrip(repo, key, fx.frames);
          clips[name] = { frames: fx.frames.length, fps: fx.fps, w: fx.frames[0].width, h: fx.frames[0].height, ax: Math.round(fx.anchor.x), ay: Math.round(fx.anchor.y) };
        }
        const pigeon = readPng(path.join(ambientDir, 'pigeon.png'));
        const pkey = `${SW_SHEETS}/board/ato-pigeon`;
        manifest[pkey] = writeFrameStrip(repo, pkey, [pigeon]);
        clips.pigeon = { frames: 1, fps: 1, w: pigeon.width, h: pigeon.height, ax: 8, ay: 14 };
      }
      meta[map.id] = { pads: art.pads, ambient: { ...art.ambient, clips } };
      for (const [id, t] of Object.entries(themed)) meta[id] = { pads: t.pads, ambient: { ...t.ambient, clips } };
      continue;
    }
    const board = new PNG({ width: SIZE, height: SIZE, fill: true });
    const road = (cx: number, cy: number) => {
      const x = Math.max(0, Math.min(N - 1, cx));
      const y = Math.max(0, Math.min(N - 1, cy));
      const v = map.grid[y][x];
      return v === TILE.PATH || v === TILE.START ? 'lower' : 'upper';
    };
    // Ground: dual grid — a tile sits on every cell corner, half a cell offset.
    for (let vy = 0; vy <= N; vy += 1) {
      for (let vx = 0; vx <= N; vx += 1) {
        const key = `${road(vx - 1, vy - 1)}${road(vx, vy - 1)}${road(vx - 1, vy)}${road(vx, vy)}`;
        const tile = tileFor.get(key) ?? tileFor.get('upperupperupperupper');
        if (tile) overBlend(tile, board, vx * CELL_PX - CELL_PX / 2, vy * CELL_PX - CELL_PX / 2);
      }
    }
    // Dim the pale sidewalk so towers and foes read on top (road stays dark).
    for (let i = 0; i < board.data.length; i += 4) {
      for (let c = 0; c < 3; c += 1) board.data[i + c] = Math.round(board.data[i + c] * 0.74);
    }
    // Centre line: 6px-wide mustard dashes (12 on, 10 off) along the polyline.
    const pts = map.path.map((p) => ({ x: p.x * SIZE, y: p.y * SIZE }));
    let run = 0;
    for (let i = 1; i < pts.length; i += 1) {
      const a = pts[i - 1];
      const b = pts[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      for (let d = 0; d < len; d += 1, run += 1) {
        if (run % 22 >= 12) continue;
        const x = Math.round(a.x + ((b.x - a.x) * d) / len);
        const y = Math.round(a.y + ((b.y - a.y) * d) / len);
        for (let oy = -2; oy <= 2; oy += 1) {
          for (let ox = -2; ox <= 2; ox += 1) {
            const tx = x + ox;
            const ty = y + oy;
            if (tx < 0 || ty < 0 || tx >= SIZE || ty >= SIZE) continue;
            const di = (ty * SIZE + tx) * 4;
            [board.data[di], board.data[di + 1], board.data[di + 2], board.data[di + 3]] = [224, 165, 38, 255];
          }
        }
      }
    }
    // Spawn + exit marks.
    const mark = (name: string, p: { x: number; y: number }) => {
      const s = prop(name, 56);
      const clamp = (v: number) => Math.max(0, Math.min(SIZE - 56, Math.round(v - 28)));
      overBlend(s, board, clamp(p.x), clamp(p.y));
    };
    mark('paint-splat-decal', pts[0]);
    mark('graffiti-tag-decal', pts[pts.length - 1]);
    // Pads: a manhole cover on each tower pad.
    const padArt = prop('pad-manhole-ring', 44);
    for (const pad of map.pads) overBlend(padArt, board, Math.round(pad.x * UNIT - 22), Math.round(pad.y * UNIT - 22));
    // Props on open sidewalk: the cell and its 4 neighbours are sidewalk, no pad within 1 cell.
    const PROPS = ['fire-hydrant', 'dumpster', 'traffic-cone', 'crate', 'streetlight', 'tire-stack', 'trash-bags', 'oil-drum', 'newspaper-box', 'barrel-fire'];
    const padCells = map.pads.map((p) => ({ x: Math.floor(p.x / (100 / N)), y: Math.floor(p.y / (100 / N)) }));
    const taken: { x: number; y: number }[] = [];
    let placed = 0;
    for (let cy = 0; cy < N && placed < PROPS.length; cy += 1) {
      for (let cx = 0; cx < N && placed < PROPS.length; cx += 1) {
        let open = true;
        for (const [ox, oy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) if (road(cx + ox, cy + oy) === 'lower') open = false;
        if (!open) continue;
        if (padCells.some((p) => Math.abs(p.x - cx) <= 1 && Math.abs(p.y - cy) <= 1)) continue;
        if (taken.some((t) => Math.abs(t.x - cx) <= 2 && Math.abs(t.y - cy) <= 2)) continue;
        taken.push({ x: cx, y: cy });
        overBlend(prop(PROPS[placed], 40), board, cx * CELL_PX - 4, cy * CELL_PX - 8);
        placed += 1;
      }
    }
    // Soft edge vignette so the board sits in the dark screen.
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        const edge = Math.min(x, y, SIZE - 1 - x, SIZE - 1 - y);
        if (edge >= 24) continue;
        const k = 0.55 + 0.45 * (edge / 24);
        const di = (y * SIZE + x) * 4;
        for (let c = 0; c < 3; c += 1) board.data[di + c] = Math.round(board.data[di + c] * k);
      }
    }
    const key = `${SW_SHEETS}/board/${map.id}`;
    writePackedPng(path.join(repo, 'assets/play', `${key}.png`), board);
    manifest[key] = { sheet: `${key}.png`, sheetW: SIZE, sheetH: SIZE, frames: { img: { x: 0, y: 0, w: SIZE, h: SIZE } } };
    meta[map.id] = { pads: map.pads.length };
  }
  fs.writeFileSync(path.join(outDir, 'sheets.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return meta;
}

function hexRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 5-stop ramp from one element colour: deep shadow → base → near white. */
function rampFromColor(hex: string): [number, number, number][] {
  const c = hexRgb(hex);
  const mix = (t: [number, number, number], k: number): [number, number, number] =>
    [0, 1, 2].map((i) => Math.round(c[i] + (t[i] - c[i]) * k)) as [number, number, number];
  return [mix([12, 6, 10], 0.75), mix([12, 6, 10], 0.4), c, mix([255, 255, 255], 0.55), [255, 255, 255]];
}

/** Bake every sword element × tier icon (greyscale tier sword tinted per
 * element) into one strip per tier. Baking beats runtime recolouring in a list. */
function bakeSwSwords(repo: string): number {
  const swords = JSON.parse(fs.readFileSync(path.join(repo, 'src/play/data/swords.json'), 'utf8')) as {
    tiers: string[];
    elements: { id: string; color: string }[];
  };
  // Packed as sheets (keys `sheets/streetwear/swords/<tier>`, frames keyed by
  // element id), not 105 loose PNGs: each loose still is one OTA asset.
  fs.rmSync(path.join(swRoot(repo), 'ui/swords/baked'), { recursive: true, force: true });
  const outDir = path.join(repo, 'assets/play', SW_SHEETS, 'swords');
  fs.rmSync(outDir, { recursive: true, force: true });
  const manifest: Record<string, SheetEntry> = {};
  let n = 0;
  for (const tier of swords.tiers) {
    const base = readPng(path.join(swRoot(repo), `ui/swords/sword-${tier}.png`));
    const key = `${SW_SHEETS}/swords/${tier}`;
    const entry = writeSquareStrip(repo, key, [{ frames: swords.elements.map((el) => rampMap(base, rampFromColor(el.color))), dx: 0, dy: 0 }], base.width);
    entry.frames = Object.fromEntries(Object.values(entry.frames).map((rect, i) => [swords.elements[i].id, rect]));
    manifest[key] = entry;
    n += swords.elements.length;
  }
  fs.writeFileSync(path.join(outDir, 'sheets.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return n;
}

/** Rebuild the ui-kit atlases without re-packing every character. */
function packStreetwearUiOnly(repo: string) {
  const metaPath = path.join(repo, 'assets/play', SW_SHEETS, 'meta.json');
  const prev = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as {
    chars: unknown;
    fx: unknown;
    auras: unknown;
    ui: unknown;
    boards: unknown;
  };
  const ui = packSwUiKit(repo);
  fs.writeFileSync(metaPath, `${JSON.stringify({ ...prev, ui }, null, 2)}\n`);
  atlasSheetsDir(repo, path.join(repo, 'assets/play', SW_SHEETS, 'ui-kit'));
  console.log('packed streetwear ui-kit');
}

/** Rebuild the Turf War board atlas (and meta.boards) without re-packing anything else. */
function packStreetwearBoardsOnly(repo: string) {
  const metaPath = path.join(repo, 'assets/play', SW_SHEETS, 'meta.json');
  const prev = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as Record<string, unknown>;
  const boards = packSwBoards(repo);
  fs.writeFileSync(metaPath, `${JSON.stringify({ ...prev, boards }, null, 2)}\n`);
  atlasSheetsDir(repo, path.join(repo, 'assets/play', SW_SHEETS, 'board'));
  console.log(`packed streetwear boards: ${Object.keys(boards).join(', ')}`);
}

/** Rebuild the element FX atlas (and meta.fx) without re-packing anything else (Turf War T5). */
function packStreetwearFxOnly(repo: string) {
  const metaPath = path.join(repo, 'assets/play', SW_SHEETS, 'meta.json');
  const prev = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as Record<string, unknown>;
  const fx = packSwEffects(repo);
  const fxDir = path.join(repo, 'assets/play', SW_SHEETS, 'fx');
  fs.writeFileSync(path.join(fxDir, 'sheets.json'), `${JSON.stringify(fx.manifest, null, 2)}\n`);
  fs.writeFileSync(metaPath, `${JSON.stringify({ ...prev, fx: fx.meta }, null, 2)}\n`);
  atlasSheetsDir(repo, fxDir);
  console.log(`packed streetwear fx: ${Object.keys(fx.meta).length} effects`);
}

/** Re-pack every Streetwear hero (Walk N/E/S/W + other clips E/W) without
 * touching creeps, towers, FX, UI kit or boards. Atlases each hero before the
 * next so a mid-run failure does not leave a wiped folder. */
function packStreetwearHeroes(repo: string) {
  const metaPath = path.join(repo, 'assets/play', SW_SHEETS, 'meta.json');
  const prev = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as {
    chars: Record<string, SwCharMeta>;
    fx: unknown;
    auras: unknown;
    ui: unknown;
    boards: unknown;
  };
  const slugs = listSwChars(repo, 'heroes');
  for (const slug of slugs) {
    prev.chars[`heroes/${slug}`] = packSwCharacter(repo, 'heroes', slug);
    const files = atlasSheetsDir(repo, path.join(repo, 'assets/play', SW_SHEETS, 'heroes', slug));
    const walk = prev.chars[`heroes/${slug}`].walkOrder?.join('+') ?? 'none';
    console.log(
      `packed streetwear heroes/${slug}: ${Object.keys(prev.chars[`heroes/${slug}`].clips).join(', ')} (Walk ${walk}, ${files} atlas)`,
    );
  }
  fs.writeFileSync(metaPath, `${JSON.stringify(prev, null, 2)}\n`);
  console.log(`meta: ${path.relative(repo, metaPath)} (${slugs.length} heroes)`);
}

function packStreetwear(repo: string) {
  const chars: Record<string, SwCharMeta> = {};
  for (const group of ['heroes', 'creeps', 'towers', 'boss']) {
    for (const slug of listSwChars(repo, group)) {
      chars[`${group}/${slug}`] = packSwCharacter(repo, group, slug);
      console.log(`packed streetwear ${group}/${slug}: ${Object.keys(chars[`${group}/${slug}`].clips).join(', ') || 'rotations only'}`);
    }
  }
  const fx = packSwEffects(repo);
  const auras = packSwAuras(repo);
  const fxDir = path.join(repo, 'assets/play', SW_SHEETS, 'fx');
  fs.writeFileSync(path.join(fxDir, 'sheets.json'), `${JSON.stringify(fx.manifest, null, 2)}\n`);
  writeAuraManifests(repo, auras.manifest);
  const swords = bakeSwSwords(repo);
  const metaPath = path.join(repo, 'assets/play', SW_SHEETS, 'meta.json');
  const ui = packSwUiKit(repo);
  const boards = packSwBoards(repo);
  fs.writeFileSync(metaPath, `${JSON.stringify({ chars, fx: fx.meta, auras: auras.meta, ui, boards }, null, 2)}\n`);
  let files = 0;
  for (const manifest of walk(path.join(repo, 'assets/play', SW_SHEETS)).filter((f) => f.endsWith('sheets.json'))) {
    files += atlasSheetsDir(repo, path.dirname(manifest));
  }
  console.log(`packed streetwear fx: ${Object.keys(fx.meta).length} effects, ${Object.keys(auras.meta).length} auras, ${swords} baked sword icons`);
  console.log(`streetwear atlases: ${files} PNG files (EAS caps an update at 1000 assets)`);
  console.log(`meta: ${path.relative(repo, metaPath)}`);
}

/**
 * Merge every clip sheet listed in one `sheets.json` into as few atlases as
 * fit the 4096px cap (shelf packing, whole sheets as blocks, 1px gutter). The
 * keys stay per clip — only `sheet`, `sheetW/H` and the rects move — so the
 * drawers are unchanged. One PNG per character instead of one per clip keeps
 * the OTA under EAS's 1000-assets-per-update limit. Returns the file count.
 */
function writeAtlasJson(
  file: string,
  image: string,
  png: PNG,
  packed: PackedClip[],
  format: ArtFormat,
  diskBytes: number,
) {
  const frames: AtlasJson['frames'] = {};
  const tags: AtlasJson['meta']['frameTags'] = [];
  let tagFrom = 0;
  for (const clip of packed) {
    const keys = Object.keys(clip.entry.frames);
    let i = 0;
    for (const [legacyKey, rect] of Object.entries(clip.entry.frames)) {
      const [dir, frameName] = legacyKey.includes('/') ? legacyKey.split('/') : [legacyKey, 'frame_000'];
      const n = Number.parseInt((frameName ?? '0').replace(/frame_/, ''), 10);
      const key = atlasFrameKey(clip.action.toLowerCase(), dir, Number.isFinite(n) ? n : i);
      frames[key] = {
        frame: rect,
        rotated: false,
        trimmed: true,
        spriteSourceSize: {
          x: clip.trim.offsetX,
          y: clip.trim.offsetY,
          w: rect.w,
          h: rect.h,
        },
        sourceSize: { w: clip.trim.sourceW, h: clip.trim.sourceH },
        duration: clip.ms,
        dir: toLongDir(dir),
        clip: clip.action,
      };
      i += 1;
    }
    tags.push({
      name: clip.action.toLowerCase(),
      from: tagFrom,
      to: tagFrom + Math.max(0, keys.length - 1),
      direction: 'forward',
    });
    tagFrom += keys.length;
  }
  const json: AtlasJson = {
    frames,
    meta: {
      app: 'ATO art:pack',
      version: '1',
      image,
      format,
      size: { w: png.width, h: png.height },
      scale: '1',
      frameTags: tags,
      decodedBytes: png.width * png.height * 4,
      diskBytes,
      tier: packed[0]?.entry.tier,
    },
  };
  fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
}

function atlasCharacterTiers(
  repo: string,
  artId: string,
  artDir: string,
  packed: PackedClip[],
  keyBase: string,
) {
  fs.mkdirSync(artDir, { recursive: true });
  const groups: Record<'core' | 'combat', PackedClip[]> = {
    core: packed.filter((p) => p.entry.tier === 'core'),
    combat: packed.filter((p) => p.entry.tier !== 'core'),
  };
  const manifestPath = path.join(repo, 'assets/play', keyBase, 'sheets.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, SheetEntry>;

  for (const tier of ['core', 'combat'] as const) {
    const clips = groups[tier];
    if (clips.length === 0) continue;
    const items = clips.map((c) => ({ id: c.action, w: c.png.width, h: c.png.height, clip: c }));
    items.sort((a, b) => b.h - a.h || a.id.localeCompare(b.id));
    const area = items.reduce((sum, i) => sum + (i.w + GUTTER) * (i.h + GUTTER), 0);
    const widest = Math.max(...items.map((i) => i.w));
    const width = Math.min(
      MAX_SHEET_PX,
      Math.max(widest, Math.min(TARGET_SHEET_PX, Math.ceil(Math.sqrt(area) * 1.1))),
    );
    let x = 0;
    let y = 0;
    let shelf = 0;
    let atlasW = 0;
    let atlasH = 0;
    const place = new Map<string, { x: number; y: number }>();
    for (const it of items) {
      if (x > 0 && x + it.w > width) {
        y += shelf + GUTTER;
        x = 0;
        shelf = 0;
      }
      if (y + it.h > MAX_SHEET_PX) {
        throw new Error(`${artId}.${tier} exceeds the ${MAX_SHEET_PX}px cap`);
      }
      place.set(it.id, { x, y });
      shelf = Math.max(shelf, it.h);
      atlasW = Math.max(atlasW, x + it.w);
      atlasH = Math.max(atlasH, y + it.h);
      x += it.w + GUTTER;
    }
    const sheet = new PNG({ width: atlasW, height: atlasH, fill: true });
    const pngName = `${artId}.${tier}.png`;
    const rel = path.relative(path.join(repo, 'assets'), path.join(artDir, pngName)).split(path.sep).join('/');
    for (const it of items) {
      const p = place.get(it.id)!;
      blit(it.clip.png, sheet, p.x, p.y);
      for (const rect of Object.values(it.clip.entry.frames)) {
        rect.x += p.x;
        rect.y += p.y;
      }
      it.clip.entry.sheet = rel;
      it.clip.entry.sheetW = atlasW;
      it.clip.entry.sheetH = atlasH;
      it.clip.entry.tier = tier;
      manifest[it.clip.key] = it.clip.entry;
    }
    const written = writePackedPng(path.join(artDir, pngName), sheet);
    writeAtlasJson(path.join(artDir, `${artId}.${tier}.json`), pngName, sheet, clips, written.format, written.bytes);
    const over = atlasW > TARGET_SHEET_PX || atlasH > TARGET_SHEET_PX ? ` (over ${TARGET_SHEET_PX} target)` : '';
    console.log(
      `  ${pngName} ${atlasW}x${atlasH} ${decodedMb(atlasW, atlasH).toFixed(2)} MB decoded ${written.format}${over}`,
    );
  }
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const clipDir = path.join(repo, 'assets/play', keyBase);
  if (fs.existsSync(clipDir)) {
    for (const f of fs.readdirSync(clipDir).filter((n) => n.endsWith('.png'))) {
      fs.rmSync(path.join(clipDir, f));
    }
  }
}

function atlasSheetsDir(repo: string, dir: string): number {
  const manifestPath = path.join(dir, 'sheets.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, SheetEntry>;
  const sources = [...new Set(Object.values(manifest).map((e) => e.sheet))];
  // Clear atlases from an earlier run that are not this run's sources.
  for (const f of fs.readdirSync(dir).filter((f) => /^atlas(-\d+)?\.png$/.test(f))) {
    if (!sources.includes(`${path.relative(path.join(repo, 'assets/play'), dir).split(path.sep).join('/')}/${f}`)) fs.rmSync(path.join(dir, f));
  }
  const playSources = sources.filter((s) => !s.startsWith('art/'));
  if (playSources.length === 0) return 0;
  const pngs = new Map(playSources.map((s) => [s, readPng(path.join(repo, 'assets/play', s))]));
  // Group sheets so each atlas keeps ≤256 colours (the pixel-exact palette
  // PNG); sheets that are already truecolour go together.
  const colours = (png: PNG) => {
    const set = new Set<number>();
    for (let i = 0; i < png.data.length; i += 4) set.add(png.data.readUInt32BE(i));
    return set;
  };
  const byHeight = [...playSources].sort((a, b) => pngs.get(b)!.height - pngs.get(a)!.height || a.localeCompare(b));
  const bins: { set: Set<number> | null; items: string[] }[] = [];
  for (const s of byHeight) {
    const own = colours(pngs.get(s)!);
    // Truecolour sheets share one group: merging them costs no extra bytes.
    const bin =
      own.size > 256 ? bins.find((b) => !b.set) : bins.find((b) => b.set && new Set([...b.set, ...own]).size <= 256);
    if (bin) {
      if (bin.set) own.forEach((c) => bin.set!.add(c));
      bin.items.push(s);
    } else bins.push({ set: own.size > 256 ? null : own, items: [s] });
  }
  // Shelf placement per group: atlas index + offset per source sheet.
  const place = new Map<string, { atlas: number; x: number; y: number }>();
  const heights: number[] = [];
  const widths: number[] = [];
  let atlas = -1;
  for (const bin of bins) {
    const area = bin.items.reduce((sum, s) => sum + (pngs.get(s)!.width + GUTTER) * (pngs.get(s)!.height + GUTTER), 0);
    const widest = Math.max(...bin.items.map((s) => pngs.get(s)!.width));
    const width = Math.min(
      MAX_SHEET_PX,
      Math.max(widest, Math.min(TARGET_SHEET_PX, Math.ceil(Math.sqrt(area) * 1.1))),
    );
    atlas += 1;
    let x = 0;
    let y = 0;
    let shelf = 0;
    for (const s of bin.items) {
      const png = pngs.get(s)!;
      if (x > 0 && x + png.width > width) {
        y += shelf + GUTTER;
        x = 0;
        shelf = 0;
      }
      if (y + png.height > MAX_SHEET_PX) {
        atlas += 1;
        x = 0;
        y = 0;
        shelf = 0;
      }
      place.set(s, { atlas, x, y });
      shelf = Math.max(shelf, png.height);
      heights[atlas] = Math.max(heights[atlas] ?? 0, y + png.height);
      widths[atlas] = Math.max(widths[atlas] ?? 0, x + png.width);
      x += png.width + GUTTER;
    }
  }
  const order = byHeight;
  const rel = path.relative(path.join(repo, 'assets/play'), dir).split(path.sep).join('/');
  const names = heights.map((_, i) => (heights.length === 1 ? 'atlas.png' : `atlas-${i}.png`));
  const outs = heights.map((h, i) => new PNG({ width: widths[i], height: h, fill: true }));
  for (const s of order) {
    const p = place.get(s)!;
    blit(pngs.get(s)!, outs[p.atlas], p.x, p.y);
  }
  for (const entry of Object.values(manifest)) {
    if (entry.sheet.startsWith('art/')) continue;
    const p = place.get(entry.sheet)!;
    for (const rect of Object.values(entry.frames)) {
      rect.x += p.x;
      rect.y += p.y;
    }
    entry.sheet = `${rel}/${names[p.atlas]}`;
    entry.sheetW = widths[p.atlas];
    entry.sheetH = heights[p.atlas];
  }
  for (const s of playSources) fs.rmSync(path.join(repo, 'assets/play', s));
  outs.forEach((png, i) => writePackedPng(path.join(dir, names[i]), png));
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return outs.length;
}

function walk(dir: string): string[] {
  return walkFiles(dir);
}

function packHero(repo: string, hero: string, group = 'heroes') {
  const heroDir = charRawDir(repo, 'cast', group, hero);

  const keyBase = `sheets/cast/${group}/${hero}`;
  const outDir = path.join(repo, 'assets/play', keyBase);
  fs.rmSync(outDir, { recursive: true, force: true });

  const animRoot = path.join(heroDir, 'animations');
  const clipDirs = fs.existsSync(animRoot)
    ? fs
        .readdirSync(animRoot, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    : [];

  const packed: PackedClip[] = [];
  for (const clipDir of clipDirs) {
    try {
      packed.push(packClip(heroDir, clipDir, outDir, keyBase));
    } catch (err) {
      // A broken clip is reported and skipped; the hero's other actions ship.
      console.log(`  ${clipDir.padEnd(34)} SKIPPED — ${(err as Error).message}`);
    }
  }
  const rotations = packRotations(heroDir, outDir, keyBase);
  if (rotations) packed.push(rotations);
  if (packed.length === 0) throw new Error('no packable actions found');

  const manifest: Record<string, SheetEntry> = {};
  let framesIn = 0;
  for (const p of packed) {
    manifest[p.key] = p.entry;
    framesIn += Object.keys(p.entry.frames).length;
  }

  const manifestPath = path.join(repo, 'assets/play', keyBase, 'sheets.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`packed ${hero}: ${framesIn} frames → ${packed.length} sheets`);
  for (const p of packed) {
    const size = `${p.entry.sheetW}x${p.entry.sheetH}`;
    const foot = p.footAt == null ? 'footAt: ?' : `footAt ${p.footAt}`;
    console.log(`  ${path.basename(p.entry.sheet).padEnd(34)} ${size.padEnd(11)} ${foot}`);
    for (const w of p.warnings) console.log(`    ! ${w}`);
  }
  const warned = packed.filter((p) => p.warnings.length > 0).length;
  console.log(warned === 0 ? 'no warnings' : `${warned} clip(s) need a human decision`);
  console.log(`manifest: ${path.relative(repo, manifestPath)}`);

  // The action catalog is a hero thing (it proposes heroes.json roles).
  if (group === 'heroes') writeCatalog(repo, hero, keyBase, packed);

  if (process.argv.includes('--preview')) writePreview(repo, hero, keyBase, manifest);
  const artId = charArtId('cast', group, hero);
  const artDir = charArtDir(repo, 'cast', group, hero);
  atlasCharacterTiers(repo, artId, artDir, packed, keyBase);
}

/**
 * Emit the hero's ACTION CATALOG — the engine half of this script.
 *
 * Every action the folder actually contains is listed under its authored name
 * with its directions, frame count, measured foot line and sheet, so app code
 * can ask for an action by name (a skill, a taunt, a one-off) without anyone
 * hand-maintaining a list. Role guesses (idle / walk / attack / …) are
 * PROPOSALS only — `heroes.json` stays the source of truth, and this file
 * reports where the two disagree instead of overwriting anything.
 */
function writeCatalog(repo: string, hero: string, keyBase: string, packed: PackedClip[]) {
  const actions: Record<string, unknown> = {};
  const proposed: Record<string, string> = {};
  const ambiguous: string[] = [];

  for (const p of packed) {
    actions[p.action] = {
      sheetKey: p.key,
      dirs: p.dirs,
      frames: p.frameCount,
      footAt: p.footAt ?? null,
    };
    if (p.action === 'rotations') continue;
    const roles = inferRoles(p.action);
    if (roles.length === 1) {
      // First match wins; a second action claiming the same role is a conflict.
      if (proposed[roles[0]]) ambiguous.push(`${roles[0]}: ${proposed[roles[0]]} vs ${p.action}`);
      else proposed[roles[0]] = p.action;
    } else if (roles.length > 1) {
      ambiguous.push(`${p.action} → could be ${roles.join(' or ')}`);
    } else {
      ambiguous.push(`${p.action} → no role guess (extra action, callable by name)`);
    }
  }

  const catalogPath = path.join(repo, 'assets/play', keyBase, 'catalog.json');
  fs.writeFileSync(
    catalogPath,
    `${JSON.stringify({ hero, actions, proposedRoles: proposed }, null, 2)}\n`,
  );
  console.log(`catalog: ${path.relative(repo, catalogPath)} (${Object.keys(actions).length} actions)`);

  // Cross-check the guesses against the hand-authored mapping, when one exists.
  const heroesFile = path.join(repo, 'src/play/data/heroes.json');
  if (fs.existsSync(heroesFile)) {
    const rows = JSON.parse(fs.readFileSync(heroesFile, 'utf8')) as {
      id: string;
      clips?: Record<string, string | null>;
    }[];
    const authored = rows.find((r) => r.id === hero)?.clips;
    if (authored) {
      const diffs: string[] = [];
      for (const [role, clip] of Object.entries(authored)) {
        if (!clip) continue;
        if (proposed[role] !== clip) diffs.push(`${role}: authored ${clip}, guessed ${proposed[role] ?? '—'}`);
      }
      console.log(
        diffs.length === 0
          ? `role guesses match heroes.json for ${hero} (${Object.keys(authored).length}/${Object.keys(authored).length})`
          : `role guesses differ from heroes.json:\n${diffs.map((d) => `    ~ ${d}`).join('\n')}`,
      );
    }
  }
  for (const a of ambiguous) console.log(`    ? ${a}`);
}

/**
 * Emit the app-side registry: the frame rects plus one `require()` per sheet.
 *
 * SPIKE NOTE: bundling the sheets is deliberate for now — it proves the crop
 * without a network. The hosting step replaces `PLAY_SHEET_ART` with cached
 * remote URIs; `PLAY_SHEETS` (the rects) stays exactly as it is.
 */
function requirePathForSheet(sheet: string): string {
  return sheet.startsWith('art/') ? `@/assets/${sheet}` : `@/assets/play/${sheet}`;
}

function writeRegistry(repo: string) {
  const out = path.join(repo, 'src/play/generated-play-sheets.ts');
  const jsonOut = path.join(repo, 'assets/art/legacy-play-sheets.json');
  const sheetsRoot = path.join(repo, 'assets/play/sheets');

  const manifest: Record<string, SheetEntry> = {};
  const walkManifests = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walkManifests(full);
      else if (entry.name === 'sheets.json') {
        Object.assign(manifest, JSON.parse(fs.readFileSync(full, 'utf8')));
      }
    }
  };
  walkManifests(sheetsRoot);

  const keys = Object.keys(manifest).sort();
  const ordered: Record<string, SheetEntry> = {};
  for (const k of keys) ordered[k] = manifest[k];
  fs.mkdirSync(path.dirname(jsonOut), { recursive: true });
  fs.writeFileSync(jsonOut, `${JSON.stringify(ordered)}\n`);

  const uniqueSheets = [...new Set(keys.map((k) => manifest[k].sheet))];
  const sheetAlias = uniqueSheets
    .map((s, i) => `const _s${i} = require('${requirePathForSheet(s)}');`)
    .join('\n');
  const sheetIndex = new Map(uniqueSheets.map((s, i) => [s, i]));
  const requires = keys.map((k) => `  '${k}': _s${sheetIndex.get(manifest[k].sheet)!},`).join('\n');

  const body = `/**
 * AUTO-GENERATED by scripts/art-pack.ts — do not edit by hand.
 *
 * Rects live in assets/art/legacy-play-sheets.json (JSON module). This file
 * keeps literal require()s so Metro / EAS bundle the atlases.
 */
import type { ImageSourcePropType } from 'react-native';
import legacy from '../../assets/art/legacy-play-sheets.json';

export type SheetFrameRect = { x: number; y: number; w: number; h: number };

export type PlaySheet = {
  sheet: string;
  sheetW: number;
  sheetH: number;
  frames: Record<string, SheetFrameRect>;
  sourceW?: number;
  sourceH?: number;
  offsetX?: number;
  offsetY?: number;
  ms?: number;
  dirs?: string[];
  tier?: 'core' | 'combat' | 'ui';
};

/** Frame rects per clip sheet, including trim offsets when packed with art:pack. */
export const PLAY_SHEETS: Record<string, PlaySheet> = legacy as Record<string, PlaySheet>;

${sheetAlias}

/** Bundled sheet images. */
export const PLAY_SHEET_ART: Record<string, ImageSourcePropType> = {
${requires}
};
`;
  fs.writeFileSync(out, body);
  console.log(`registry: ${path.relative(repo, out)} + legacy-play-sheets.json (${keys.length} sheets)`);
}

/** Standalone HTML that animates every packed clip straight out of its sheet —
 * the same crop maths the app will use, so a wrong rect is visible here. */
function writePreview(repo: string, hero: string, keyBase: string, manifest: Record<string, SheetEntry>) {
  const out = path.join(repo, 'assets/play', keyBase, 'preview.html');
  // Inline every sheet as a data URI so the preview is one self-contained file
  // that renders anywhere — emailed, opened from a phone, or dropped in a chat.
  const withData: Record<string, SheetEntry & { src: string }> = {};
  for (const [key, entry] of Object.entries(manifest)) {
    const file = entry.sheet.startsWith('art/')
      ? path.join(repo, 'assets', entry.sheet)
      : path.join(repo, 'assets/play', entry.sheet);
    const b64 = fs.readFileSync(file).toString('base64');
    withData[key] = { ...entry, src: `data:image/png;base64,${b64}` };
  }
  const data = JSON.stringify(withData);
  const html = `<!doctype html><meta charset="utf-8"><title>${hero} sheets</title>
<style>
 :root{color-scheme:dark}
 body{background:#111;color:#eee;font:14px system-ui;margin:0;padding:24px}
 h1{font-size:18px;margin:0 0 4px} p{color:#9aa;margin:0 0 20px}
 .grid{display:flex;flex-wrap:wrap;gap:20px}
 .clip{background:#1b1b1f;border:1px solid #2c2c33;border-radius:10px;padding:12px;width:190px}
 .name{font-size:12px;color:#cfcfd6;margin-bottom:8px;word-break:break-all}
 .stage{display:flex;gap:10px}
 .sprite{image-rendering:pixelated;background:#0c0c0f;border-radius:6px}
 .meta{font-size:11px;color:#8a8a93;margin-top:8px}
</style>
<h1>${hero} — packed sheets</h1>
<p>Each sprite below is one window onto a sheet, moved frame by frame. If the crop maths is wrong, it shows here.</p>
<div class="grid" id="grid"></div>
<script>
const manifest = ${data};
const grid = document.getElementById('grid');
for (const [key, entry] of Object.entries(manifest)) {
  const frames = Object.entries(entry.frames);
  const dirs = [...new Set(frames.map(([k]) => k.split('/')[0]))];
  const card = document.createElement('div');
  card.className = 'clip';
  card.innerHTML = '<div class="name">' + key.split('/').pop() + '</div>';
  const stage = document.createElement('div');
  stage.className = 'stage';
  for (const dir of dirs) {
    const mine = frames.filter(([k]) => k.startsWith(dir + '/'));
    const first = mine[0][1];
    const el = document.createElement('div');
    el.className = 'sprite';
    el.style.width = first.w + 'px';
    el.style.height = first.h + 'px';
    el.style.backgroundImage = 'url("' + entry.src + '")';
    el.style.backgroundRepeat = 'no-repeat';
    let i = 0;
    setInterval(() => {
      const r = mine[i % mine.length][1];
      el.style.backgroundPosition = (-r.x) + 'px ' + (-r.y) + 'px';
      i += 1;
    }, 90);
    stage.appendChild(el);
  }
  card.appendChild(stage);
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = entry.sheetW + '×' + entry.sheetH + ' · ' + frames.length + ' frames · ' + dirs.join(', ');
  card.appendChild(meta);
  grid.appendChild(card);
}
</script>`;
  fs.writeFileSync(out, html);
  console.log(`preview: ${path.relative(repo, out)}`);
}

main();
