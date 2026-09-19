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

import { PNG } from 'pngjs';

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
  fs.writeFileSync(outPath, PNG.sync.write(sheet));

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

/** Pack one `<clip>/<dir>/frame_NNN.png` tree into a single sheet. */
function packClip(heroDir: string, clipDirName: string, outDir: string, keyBase: string): PackedClip {
  const clipPath = path.join(heroDir, 'animations', clipDirName);
  const clipKey = clipDirName.replace(HASH_SUFFIX, '');
  const warnings: string[] = [];

  const dirs = fs
    .readdirSync(clipPath, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  const rows = dirs.map((dir) => {
    const files = fs
      .readdirSync(path.join(clipPath, dir))
      .filter((f) => f.toLowerCase().endsWith('.png'))
      .sort();
    return { dir, files: files.map((f) => path.join(clipPath, dir, f)), names: files };
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
  fs.writeFileSync(outPath, PNG.sync.write(sheet));

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

function main() {
  const repo = path.resolve(__dirname, '..');
  const one = arg('hero');
  const all = process.argv.includes('--all');
  if (!one && !all) {
    throw new Error('Usage: npx tsx scripts/play-art-pack.ts (--hero <id> | --all) [--preview]');
  }

  const heroes = all
    ? fs
        .readdirSync(path.join(repo, HEROES_ROOT), { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort()
    : [one as string];

  let failures = 0;
  for (const hero of heroes) {
    try {
      packHero(repo, hero);
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

function packHero(repo: string, hero: string) {
  const heroDir = path.join(repo, HEROES_ROOT, hero);
  if (!fs.existsSync(heroDir)) throw new Error(`no art folder at ${HEROES_ROOT}/${hero}`);

  const keyBase = `sheets/cast/heroes/${hero}`;
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

  writeCatalog(repo, hero, keyBase, packed);

  if (process.argv.includes('--preview')) writePreview(repo, hero, keyBase, manifest);
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
