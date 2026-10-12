/**
 * Play art packer (SPIKE scope: one hero at a time).
 *
 * Packs a character's per-frame PNGs into one sheet PER CLIP:
 *   rows    = directions (east, west, ...) in the order they are found
 *   columns = frames (frame_000, frame_001, ...)
 *
 * Why per CLIP and not per HERO: a whole hero packs to ~2176x1792, which is
 * ~15MB once the phone decodes it. Only the clips actually playing need to be
 * in memory, so per-clip sheets (~2176x256, ~2MB) keep the board cheap. Both
 * stay under the 4096px cap Android drivers are only reliably safe up to.
 *
 * Frames are laid out with a 1px transparent gutter so a crop can never sample
 * the neighbouring frame's edge (texture bleeding). The crop rect written to
 * the manifest is the frame ONLY — it never includes the gutter.
 *
 * Usage: npx tsx scripts/play-art-pack.ts --hero archangel
 *        npx tsx scripts/play-art-pack.ts --all
 *        npx tsx scripts/play-art-pack.ts --hero archangel --preview
 *
 * The app-side registry is rebuilt by SCANNING every packed hero, so packing
 * one hero can never drop the others.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

import { PNG } from 'pngjs';

/**
 * Write a sheet as a PALETTE png when it has ≤256 distinct RGBA colours (pixel
 * art nearly always does) — pixel-exact, typically 3-4x smaller than RGBA,
 * which is what keeps an OTA's first download small. Falls back to RGBA.
 */
function encodeSheetPng(png: PNG): Buffer {
  const index = new Map<number, number>();
  const px = new Uint32Array(png.width * png.height);
  for (let i = 0; i < px.length; i += 1) {
    const o = i * 4;
    const a = png.data[o + 3];
    const c = a === 0 ? 0 : ((png.data[o] << 24) | (png.data[o + 1] << 16) | (png.data[o + 2] << 8) | a) >>> 0;
    px[i] = c;
    if (!index.has(c)) {
      if (index.size === 256) return PNG.sync.write(png, { deflateLevel: 9 });
      index.set(c, index.size);
    }
  }
  const colors = [...index.keys()];
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(png.width, 0);
  ihdr.writeUInt32BE(png.height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 3; // colour type: palette
  const plte = Buffer.alloc(colors.length * 3);
  const trns = Buffer.alloc(colors.length);
  colors.forEach((c, i) => {
    plte[i * 3] = (c >>> 24) & 255;
    plte[i * 3 + 1] = (c >>> 16) & 255;
    plte[i * 3 + 2] = (c >>> 8) & 255;
    trns[i] = c & 255;
  });
  const raw = Buffer.alloc((png.width + 1) * png.height);
  for (let y = 0; y < png.height; y += 1) {
    raw[y * (png.width + 1)] = 0; // filter: none (the norm for palette images)
    for (let x = 0; x < png.width; x += 1) raw[y * (png.width + 1) + 1 + x] = index.get(px[y * png.width + x])!;
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('PLTE', plte),
    chunk('tRNS', trns),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Transparent gutter between frames, px. 1px is the pixel-art default. */
const GUTTER = 1;
/** Hard cap on either sheet dimension — Android's reliable texture ceiling. */
const MAX_SHEET_PX = 4096;

const HASH_SUFFIX = /-[0-9a-f]{8}$/;

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

/** Sort facings into turning order; anything unrecognised keeps a stable tail. */
function byCompass(a: string, b: string): number {
  const ia = ROTATION_ORDER.indexOf(a);
  const ib = ROTATION_ORDER.indexOf(b);
  if (ia === -1 && ib === -1) return a.localeCompare(b);
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
}

/** Roles an action name suggests (0 = unknown, 2+ = ambiguous). */
function inferRoles(actionName: string): string[] {
  const lower = actionName.toLowerCase();
  return Object.entries(ROLE_WORDS)
    .filter(([, words]) => words.some((w) => lower.includes(w)))
    .map(([role]) => role);
}

type FrameRect = { x: number; y: number; w: number; h: number };

export type SheetEntry = {
  /** Sheet file, relative to `assets/play/`. */
  sheet: string;
  /** Sheet pixel size — the drawer needs it to place the crop window. */
  sheetW: number;
  sheetH: number;
  /** Frame rects, keyed `<direction>/frame_NNN` (the old PLAY_ART key tail). */
  frames: Record<string, FrameRect>;
};

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

function readPng(file: string): PNG {
  return PNG.sync.read(fs.readFileSync(file));
}

/** Copy `src` into `dst` at (dx, dy). Straight RGBA blit, no blending. */
function blit(src: PNG, dst: PNG, dx: number, dy: number) {
  for (let y = 0; y < src.height; y += 1) {
    for (let x = 0; x < src.width; x += 1) {
      const si = (y * src.width + x) * 4;
      const di = ((dy + y) * dst.width + (dx + x)) * 4;
      dst.data[di] = src.data[si];
      dst.data[di + 1] = src.data[si + 1];
      dst.data[di + 2] = src.data[si + 2];
      dst.data[di + 3] = src.data[si + 3];
    }
  }
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
};

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
    .sort((a, b) => byCompass(a.replace(/\.png$/i, ''), b.replace(/\.png$/i, '')));
  if (files.length === 0) return undefined;

  const pngs = files.map((f) => readPng(path.join(rotPath, f)));
  const warnings: string[] = [];
  const sizes = new Set(pngs.map((p) => `${p.width}x${p.height}`));
  if (sizes.size > 1) warnings.push(`mixed rotation sizes (${[...sizes].join(', ')})`);
  if (files.length !== 8 && files.length !== 4) {
    warnings.push(`${files.length} rotations (expected 4 or 8) — check the export`);
  }

  const cellW = pngs[0].width;
  const cellH = pngs[0].height;
  const sheetW = files.length * cellW + (files.length - 1) * GUTTER;
  if (sheetW > MAX_SHEET_PX || cellH > MAX_SHEET_PX) {
    throw new Error(`rotations: strip ${sheetW}x${cellH} exceeds the ${MAX_SHEET_PX}px cap`);
  }
  const sheet = new PNG({ width: sheetW, height: cellH, fill: true });
  const frames: Record<string, FrameRect> = {};

  files.forEach((file, i) => {
    const x = i * (cellW + GUTTER);
    blit(pngs[i], sheet, x, 0);
    frames[file.replace(/\.png$/i, '')] = { x, y: 0, w: cellW, h: cellH };
  });

  const outPath = path.join(outDir, 'rotations.png');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, encodeSheetPng(sheet));

  return {
    key: `${keyBase}/rotations`,
    action: 'rotations',
    entry: { sheet: `${keyBase}/rotations.png`, sheetW, sheetH: cellH, frames },
    footAt: measureFootAt(pngs),
    dirs: files.map((f) => f.replace(/\.png$/i, '')),
    frameCount: 1,
    warnings,
  };
}

/** Pack one `<clip>/<dir>/frame_NNN.png` tree into a single sheet. `onlyDirs`
 * keeps just those facings (the Streetwear pack ships east/west only — the
 * board never draws north/south, so they stay in the repo, out of the bundle). */
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

  const dirs = fs
    .readdirSync(clipPath, { withFileTypes: true })
    .filter((d) => d.isDirectory() && (!onlyDirs || onlyDirs.includes(d.name.replace(HASH_SUFFIX, ''))))
    .map((d) => d.name);

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

  const cellW = allPngs[0].width;
  const cellH = allPngs[0].height;
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
    row.files.forEach((file, colIndex) => {
      const x = colIndex * (cellW + GUTTER);
      blit(readPng(file), sheet, x, y);
      const frameName = row.names[colIndex].replace(/\.png$/i, '');
      frames[`${row.dir}/${frameName}`] = { x, y, w: cellW, h: cellH };
    });
  });

  const sheetFile = `${keyBase}/${clipKey}.png`;
  const outPath = path.join(outDir, `${clipKey}.png`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, encodeSheetPng(sheet));

  return {
    key: `${keyBase}/${clipKey}`,
    action: clipKey,
    entry: { sheet: sheetFile, sheetW, sheetH, frames },
    footAt: measureFootAt(allPngs),
    dirs: rows.map((r) => r.dir),
    frameCount: cols,
    warnings,
  };
}

const HEROES_ROOT = 'assets/play/skins/cast/heroes';
const CAST_GROUPS = ['heroes', 'creeps', 'towers', 'boss'];

function main() {
  const repo = path.resolve(__dirname, '..');
  const one = arg('hero');
  const all = process.argv.includes('--all');
  const family = arg('family');
  const skin = arg('skin');
  if (!one && !all && !family && !skin) {
    throw new Error(
      'Usage: npx tsx scripts/play-art-pack.ts (--hero <id> | --all | --family <name> | --skin streetwear [--ui-only]) [--preview]',
    );
  }

  if (skin) {
    if (skin !== 'streetwear') throw new Error(`unknown skin "${skin}" (only streetwear packs this way)`);
    if (process.argv.includes('--ui-only')) {
      packStreetwearUiOnly(repo);
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
  const groupOf = (g: string) =>
    fs
      .readdirSync(path.join(repo, path.dirname(HEROES_ROOT), g), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => ({ group: g, hero: d.name }))
      .sort((a, b) => a.hero.localeCompare(b.hero));
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
/** The board only ever draws east/west clip rows (path walkers keep a side
 * profile; towers/avatar play E/W). North/south stay in the repo. */
const SW_DIRS = ['east', 'west'] as const;

type SwCharMeta = {
  /** Feet line of the east rotation, fraction of the frame height from the top. */
  footAt: number;
  /** Visible body height / frame height (east rotation) — sizes the box so a
   * Streetwear figure matches the cast figure it replaces on screen. */
  bodyRatio: number;
  /** Clip name → frames per facing (east == west). */
  clips: Record<string, number>;
};

type SwFxMeta = { frames: number; fps: number; loop: boolean; cell: number; anchorX: number; anchorY: number };

/** Bounding box of opaque pixels, or null for an empty frame. */
function alphaBox(png: PNG): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = png.width, y0 = png.height, x1 = -1, y1 = -1;
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      if (png.data[(y * png.width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/** Pack one Streetwear character folder: E/W clip sheets + the 8-rotation strip. */
function packSwCharacter(repo: string, group: string, slug: string): SwCharMeta {
  const dir = path.join(repo, SW_SRC, group, slug);
  const keyBase = `${SW_SHEETS}/${group}/${slug}`;
  const outDir = path.join(repo, 'assets/play', keyBase);
  fs.rmSync(outDir, { recursive: true, force: true });
  const packed: PackedClip[] = [];
  const clips: Record<string, number> = {};
  const animRoot = path.join(dir, 'animations');
  if (fs.existsSync(animRoot)) {
    for (const clip of fs.readdirSync(animRoot, { withFileTypes: true }).filter((d) => d.isDirectory())) {
      const p = packClip(dir, clip.name, outDir, keyBase, SW_DIRS);
      for (const w of p.warnings) throw new Error(`${group}/${slug}/${clip.name}: ${w}`);
      packed.push(p);
      clips[p.action] = p.frameCount;
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
  return {
    footAt: Number(((box.y1 + 1) / east.height).toFixed(4)),
    bodyRatio: Number(((box.y1 - box.y0 + 1) / east.height).toFixed(4)),
    clips,
  };
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
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, encodeSheetPng(sheet));
  return { sheet: `${key}.png`, sheetW, sheetH: cell, frames };
}

/** Element effects → square-cell strips (the board's sprite drawer is square). */
function packSwEffects(repo: string): { manifest: Record<string, SheetEntry>; meta: Record<string, SwFxMeta> } {
  const manifest: Record<string, SheetEntry> = {};
  const meta: Record<string, SwFxMeta> = {};
  const root = path.join(repo, SW_SRC, 'fx/elements');
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

/** Pet auras → a behind strip and a front strip sharing one square cell, both
 * anchored at the pet's feet. Greyscale: the app palette-maps them at runtime. */
function packSwAuras(repo: string): { manifest: Record<string, SheetEntry>; meta: Record<string, SwFxMeta & { refBodyPx: number }> } {
  const manifest: Record<string, SheetEntry> = {};
  const meta: Record<string, SwFxMeta & { refBodyPx: number }> = {};
  const root = path.join(repo, SW_SRC, 'fx/auras');
  // Authored around the 64px Village Girl creep (visible body 49px tall).
  const REF_BODY_PX = 49;
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
      anchorY: Number((oy / cell).toFixed(4)),
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
  const kit = path.join(repo, SW_SRC, 'ui/kit');
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
    fs.writeFileSync(path.join(repo, 'assets/play', `${key}.png`), encodeSheetPng(p.png));
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
function packSwBoards(repo: string): Record<string, { pads: number }> {
  const CELL_PX = 32;
  const N = 16;
  const SIZE = CELL_PX * N;
  const UNIT = SIZE / 100; // board units → px
  const mapDir = path.join(repo, SW_SRC, 'map');
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
  const prop = (name: string, px: number) => scaleNearest(readPng(path.join(repo, SW_SRC, 'props', `${name}.png`)), px, px);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { BOARD_MAPS, TILE } = require('../src/play/board-data') as typeof import('../src/play/board-data');

  const outDir = path.join(repo, 'assets/play', SW_SHEETS, 'board');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const manifest: Record<string, SheetEntry> = {};
  const meta: Record<string, { pads: number }> = {};
  for (const map of Object.values(BOARD_MAPS)) {
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
    fs.writeFileSync(path.join(repo, 'assets/play', `${key}.png`), encodeSheetPng(board));
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
  fs.rmSync(path.join(repo, SW_SRC, 'ui/swords/baked'), { recursive: true, force: true });
  const outDir = path.join(repo, 'assets/play', SW_SHEETS, 'swords');
  fs.rmSync(outDir, { recursive: true, force: true });
  const manifest: Record<string, SheetEntry> = {};
  let n = 0;
  for (const tier of swords.tiers) {
    const base = readPng(path.join(repo, SW_SRC, `ui/swords/sword-${tier}.png`));
    const key = `${SW_SHEETS}/swords/${tier}`;
    const entry = writeSquareStrip(repo, key, [{ frames: swords.elements.map((el) => rampMap(base, rampFromColor(el.color))), dx: 0, dy: 0 }], base.width);
    entry.frames = Object.fromEntries(Object.values(entry.frames).map((rect, i) => [swords.elements[i].id, rect]));
    manifest[key] = entry;
    n += swords.elements.length;
  }
  fs.writeFileSync(path.join(outDir, 'sheets.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return n;
}

/** 84px blaze + outlined bubbles for the iso Hideout (Sprite Smith strips). */
function packHideoutAuraStrips(repo: string): Record<string, SheetEntry> {
  const srcDir = path.join(repo, SW_SRC, 'fx/hideout');
  const raw = JSON.parse(fs.readFileSync(path.join(srcDir, 'sheets.json'), 'utf8')) as {
    [name: string]: { sheet: string; frames: Record<string, { x: number; y: number; w: number; h: number }> };
  };
  const outDir = path.join(repo, 'assets/play', SW_SHEETS, 'hideout-fx');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const manifest: Record<string, SheetEntry> = {};
  for (const [name, entry] of Object.entries(raw)) {
    if (name.startsWith('_')) continue;
    const png = readPng(path.join(srcDir, entry.sheet));
    const key = `${SW_SHEETS}/hideout-fx/${name}`;
    const dest = path.join(repo, 'assets/play', `${key}.png`);
    fs.writeFileSync(dest, encodeSheetPng(png));
    manifest[key] = {
      sheet: `${key}.png`,
      sheetW: png.width,
      sheetH: png.height,
      frames: entry.frames,
    };
  }
  fs.writeFileSync(path.join(outDir, 'sheets.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

/** Rebuild ui-kit + hideout FX atlases without re-packing every character. */
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
  const hideoutFx = packHideoutAuraStrips(repo);
  fs.writeFileSync(
    metaPath,
    `${JSON.stringify({ ...prev, ui, hideoutFx: Object.keys(hideoutFx) }, null, 2)}\n`,
  );
  atlasSheetsDir(repo, path.join(repo, 'assets/play', SW_SHEETS, 'ui-kit'));
  atlasSheetsDir(repo, path.join(repo, 'assets/play', SW_SHEETS, 'hideout-fx'));
  console.log(`packed streetwear ui-kit + hideout FX (${Object.keys(hideoutFx).length} strips)`);
}

function packStreetwear(repo: string) {
  const chars: Record<string, SwCharMeta> = {};
  for (const group of ['heroes', 'creeps', 'towers', 'boss']) {
    const groupDir = path.join(repo, SW_SRC, group);
    for (const slug of fs.readdirSync(groupDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
      chars[`${group}/${slug}`] = packSwCharacter(repo, group, slug);
      console.log(`packed streetwear ${group}/${slug}: ${Object.keys(chars[`${group}/${slug}`].clips).join(', ') || 'rotations only'}`);
    }
  }
  const fx = packSwEffects(repo);
  const auras = packSwAuras(repo);
  const fxDir = path.join(repo, 'assets/play', SW_SHEETS, 'fx');
  fs.writeFileSync(path.join(fxDir, 'sheets.json'), `${JSON.stringify(fx.manifest, null, 2)}\n`);
  const auraDir = path.join(repo, 'assets/play', SW_SHEETS, 'auras');
  fs.writeFileSync(path.join(auraDir, 'sheets.json'), `${JSON.stringify(auras.manifest, null, 2)}\n`);
  const swords = bakeSwSwords(repo);
  const hideoutFx = packHideoutAuraStrips(repo);
  const metaPath = path.join(repo, 'assets/play', SW_SHEETS, 'meta.json');
  const ui = packSwUiKit(repo);
  const boards = packSwBoards(repo);
  fs.writeFileSync(metaPath, `${JSON.stringify({ chars, fx: fx.meta, auras: auras.meta, ui, boards, hideoutFx: Object.keys(hideoutFx) }, null, 2)}\n`);
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
function atlasSheetsDir(repo: string, dir: string): number {
  const manifestPath = path.join(dir, 'sheets.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, SheetEntry>;
  const sources = [...new Set(Object.values(manifest).map((e) => e.sheet))];
  // Clear atlases from an earlier run that are not this run's sources.
  for (const f of fs.readdirSync(dir).filter((f) => /^atlas(-\d+)?\.png$/.test(f))) {
    if (!sources.includes(`${path.relative(path.join(repo, 'assets/play'), dir).split(path.sep).join('/')}/${f}`)) fs.rmSync(path.join(dir, f));
  }
  const pngs = new Map(sources.map((s) => [s, readPng(path.join(repo, 'assets/play', s))]));
  // Group sheets so each atlas keeps ≤256 colours (the pixel-exact palette
  // PNG); sheets that are already truecolour go together.
  const colours = (png: PNG) => {
    const set = new Set<number>();
    for (let i = 0; i < png.data.length; i += 4) set.add(png.data.readUInt32BE(i));
    return set;
  };
  const byHeight = [...sources].sort((a, b) => pngs.get(b)!.height - pngs.get(a)!.height || a.localeCompare(b));
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
    const width = Math.min(MAX_SHEET_PX, Math.max(widest, Math.ceil(Math.sqrt(area) * 1.1)));
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
    const p = place.get(entry.sheet)!;
    for (const rect of Object.values(entry.frames)) {
      rect.x += p.x;
      rect.y += p.y;
    }
    entry.sheet = `${rel}/${names[p.atlas]}`;
    entry.sheetW = widths[p.atlas];
    entry.sheetH = heights[p.atlas];
  }
  for (const s of sources) fs.rmSync(path.join(repo, 'assets/play', s));
  outs.forEach((png, i) => fs.writeFileSync(path.join(dir, names[i]), encodeSheetPng(png)));
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return outs.length;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function packHero(repo: string, hero: string, group = 'heroes') {
  const root = path.posix.join(path.posix.dirname(HEROES_ROOT), group);
  const heroDir = path.join(repo, root, hero);
  if (!fs.existsSync(heroDir)) throw new Error(`no art folder at ${root}/${hero}`);

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
  // Last: merge the clip sheets into atlases (fewer OTA assets, same keys).
  console.log(`  → ${atlasSheetsDir(repo, path.join(repo, 'assets/play', keyBase))} atlas file(s)`);
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
function writeRegistry(repo: string) {
  const out = path.join(repo, 'src/play/generated-play-sheets.ts');
  const sheetsRoot = path.join(repo, 'assets/play/sheets');

  // Scan every `sheets.json` on disk and merge — this is what makes a
  // single-hero run safe: unpacked heroes keep their entries.
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
  const requires = keys
    .map((k) => `  '${k}': require('@/assets/play/${manifest[k].sheet}'),`)
    .join('\n');
  const ordered: Record<string, SheetEntry> = {};
  for (const k of keys) ordered[k] = manifest[k];
  const rects = JSON.stringify(ordered, null, 2);

  const body = `/**
 * AUTO-GENERATED by scripts/play-art-pack.ts — do not edit by hand.
 *
 * One entry per packed clip sheet: the sheet's pixel size and the crop rect of
 * every frame inside it, keyed by the same '<direction>/frame_NNN' tail the
 * old per-frame registry used.
 */
import type { ImageSourcePropType } from 'react-native';

export type SheetFrameRect = { x: number; y: number; w: number; h: number };

export type PlaySheet = {
  sheet: string;
  sheetW: number;
  sheetH: number;
  frames: Record<string, SheetFrameRect>;
};

/** Frame rects per clip sheet. */
export const PLAY_SHEETS: Record<string, PlaySheet> = ${rects} as const;

/** Bundled sheet images (spike). Replaced by cached remote URIs when the art
 * moves to storage — every other module reads sheets through \`playSheetArt\`. */
export const PLAY_SHEET_ART: Record<string, ImageSourcePropType> = {
${requires}
};
`;
  fs.writeFileSync(out, body);
  console.log(`registry: ${path.relative(repo, out)} (${keys.length} sheets)`);
}

/** Standalone HTML that animates every packed clip straight out of its sheet —
 * the same crop maths the app will use, so a wrong rect is visible here. */
function writePreview(repo: string, hero: string, keyBase: string, manifest: Record<string, SheetEntry>) {
  const out = path.join(repo, 'assets/play', keyBase, 'preview.html');
  // Inline every sheet as a data URI so the preview is one self-contained file
  // that renders anywhere — emailed, opened from a phone, or dropped in a chat.
  const withData: Record<string, SheetEntry & { src: string }> = {};
  for (const [key, entry] of Object.entries(manifest)) {
    const file = path.join(repo, 'assets/play', entry.sheet);
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
