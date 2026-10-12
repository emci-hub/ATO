/**
 * One-shot migration: old assets/play + games/grove/ref → art-src (raw) and
 * assets/art (runtime). Writes assets/art/migration-map.json.
 *
 * Safe conversions only: rename, move, dedupe by md5, archive orphans.
 * Does not restyle. Packed sheets are snapshotted then left for art:pack to replace.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { kebab } from './art-dirs';

const repo = path.resolve(__dirname, '..');
const MAP: { from: string; to: string; action: 'move' | 'copy' | 'archive' | 'skip-dupe' }[] = [];

function md5File(file: string): string {
  return crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
}

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function ensureDir(file: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function relocate(from: string, to: string, action: 'move' | 'copy' | 'archive') {
  if (!fs.existsSync(from)) return;
  ensureDir(to);
  if (fs.existsSync(to)) {
    const same = fs.statSync(from).isFile() && fs.statSync(to).isFile() && md5File(from) === md5File(to);
    if (same) {
      if (action === 'move' || action === 'archive') fs.rmSync(from);
      MAP.push({ from: path.relative(repo, from), to: path.relative(repo, to), action: 'skip-dupe' });
      return;
    }
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  if (action === 'copy') fs.copyFileSync(from, to);
  else fs.renameSync(from, to);
  MAP.push({ from: path.relative(repo, from), to: path.relative(repo, to), action });
}

function moveTree(fromDir: string, toDir: string, action: 'move' | 'copy' | 'archive' = 'move') {
  if (!fs.existsSync(fromDir)) return;
  for (const file of walk(fromDir)) {
    const rel = path.relative(fromDir, file);
    relocate(file, path.join(toDir, rel), action);
  }
}

function seenHashes(): Set<string> {
  const set = new Set<string>();
  const addRoot = (root: string) => {
    for (const f of walk(root)) {
      if (f.toLowerCase().endsWith('.png')) {
        try {
          set.add(md5File(f));
        } catch {
          /* ignore */
        }
      }
    }
  };
  addRoot(path.join(repo, 'art-src'));
  addRoot(path.join(repo, 'assets/play/skins'));
  return set;
}

function kebabPngName(name: string): string {
  const ext = path.extname(name).toLowerCase();
  const stem = name.slice(0, name.length - ext.length);
  return `${kebab(stem)}${ext}`;
}

function isLooseFrame(name: string): boolean {
  return /frame_\d+/i.test(name);
}

/** Copy unused stills (not loose PixelLab frames) into assets/art as resource. */
function copyResourceStills(fromDir: string, toDir: string, prefix: string) {
  if (!fs.existsSync(fromDir)) return;
  for (const file of walk(fromDir)) {
    const ext = path.extname(file).toLowerCase();
    if (!['.png', '.gif', '.webp', '.jpg', '.jpeg', '.svg'].includes(ext)) continue;
    if (isLooseFrame(path.basename(file))) {
      // One preview still per clip folder so unused anims still show in the library.
      const sibs = fs.readdirSync(path.dirname(file)).filter((n) => /frame_000/i.test(n));
      if (!sibs.includes(path.basename(file))) continue;
    }
    const rel = path.relative(fromDir, file);
    const destName = kebabPngName(path.basename(file));
    const dest = path.join(toDir, prefix, path.dirname(rel).split(path.sep).map(kebab).filter((s) => s && s !== '.').join('/'), destName);
    relocate(file, dest, 'copy');
  }
}

function writeMigratedGenJson(id: string) {
  const dest = path.join(repo, 'art-src/pixellab', id, 'migrated', 'gen.json');
  if (fs.existsSync(dest)) return;
  ensureDir(dest);
  fs.writeFileSync(
    dest,
    `${JSON.stringify(
      {
        tool: 'pixellab',
        model: null,
        prompt: null,
        negative: null,
        seed: null,
        view: 'low top-down',
        palette: null,
        createdAt: '2026-10-12T00:00:00.000Z',
        operator: 'art-migrate',
        picked: true,
        critique: { score: null, notes: 'migrated from assets/play; no generation params on file' },
      },
      null,
      2,
    )}\n`,
  );
}

function main() {
  const archive = path.join(repo, 'art-src/archive/2026-10');
  fs.mkdirSync(archive, { recursive: true });
  fs.mkdirSync(path.join(repo, 'art-src/pixellab'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'art-src/third-party'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'art-src/hand'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'assets/art/rooms'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'assets/art/brand'), { recursive: true });

  // Snapshot current packed sheets so a failed pack can be compared / restored.
  const oldSheets = path.join(repo, 'assets/play/sheets');
  if (fs.existsSync(oldSheets) && !fs.existsSync(path.join(archive, 'old-sheets'))) {
    moveTree(oldSheets, path.join(archive, 'old-sheets-snapshot'), 'copy');
  }

  const kinds: Record<string, string> = { heroes: 'hero', creeps: 'creep', boss: 'boss', towers: 'tower' };
  for (const theme of ['streetwear', 'cast']) {
    for (const [group, kind] of Object.entries(kinds)) {
      const root = path.join(repo, 'assets/play/skins', theme, group);
      if (!fs.existsSync(root)) continue;
      for (const slug of fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
        const from = path.join(root, slug);
        const to = path.join(repo, 'art-src/pixellab', `${kind}.${slug}.${theme}`, 'migrated', 'raw');
        moveTree(from, to, 'move');
        writeMigratedGenJson(`${kind}.${slug}.${theme}`);
      }
    }
  }

  // Rest of the streetwear pack (fx, ui, map, props) — packer still bakes from it.
  for (const extra of ['fx', 'ui', 'map', 'props', '_anchor']) {
    const from = path.join(repo, 'assets/play/skins/streetwear', extra);
    if (!fs.existsSync(from)) continue;
    moveTree(from, path.join(repo, 'art-src/pixellab/streetwear-pack/migrated/raw', extra), 'move');
  }
  // PLAY_ART stills (shop / rarity / icons) stay required from assets/play this release.
  const stillsRoot = path.join(repo, 'art-src/pixellab/streetwear-pack/migrated/raw/ui');
  for (const sub of ['icons', 'rarity', 'shop']) {
    const from = path.join(stillsRoot, sub);
    const to = path.join(repo, 'assets/play/skins/streetwear/ui', sub);
    if (fs.existsSync(from)) moveTree(from, to, 'copy');
  }
  // Unused streetwear stills (buttons, kit, props, map) stay in the library as resource.
  const swPack = path.join(repo, 'art-src/pixellab/streetwear-pack/migrated/raw');
  copyResourceStills(path.join(swPack, 'ui'), path.join(repo, 'assets/art/ui/streetwear'), '');
  copyResourceStills(path.join(swPack, 'props'), path.join(repo, 'assets/art/props/streetwear'), '');
  copyResourceStills(path.join(swPack, 'map'), path.join(repo, 'assets/art/tiles/streetwear'), '');

  // Cast skin.json stays (role map). Streetwear skin.json stays.
  // Third-party play packs → art-src (raw) + we'll copy referenced stills into assets/art later.
  const third: [string, string][] = [
    ['assets/play/kenney-td', 'art-src/third-party/kenney-td'],
    ['assets/play/kenney-icons', 'art-src/third-party/kenney-icons'],
    ['assets/play/kenney-ui', 'art-src/third-party/kenney-ui'],
    ['assets/play/craftpix-fields', 'art-src/third-party/craftpix-fields'],
    ['assets/play/craftpix-roads', 'art-src/third-party/craftpix-roads'],
    ['assets/play/skins/kenney-td', 'art-src/third-party/kenney-td-skin'],
    ['assets/play/skins/craftpix-td', 'art-src/third-party/craftpix-td-skin'],
    ['assets/play/licenses', 'art-src/third-party/licenses'],
  ];
  for (const [from, to] of third) {
    moveTree(path.join(repo, from), path.join(repo, to), 'move');
  }

  // Copy dungeon-legends stills into the library as resource; keep
  // assets/play/avatars for the profile-card shim this release.
  const legends = path.join(repo, 'assets/play/avatars');
  if (fs.existsSync(legends)) {
    moveTree(legends, path.join(repo, 'art-src/third-party/dungeon-legends'), 'copy');
    copyResourceStills(legends, path.join(repo, 'assets/art/characters/npcs/dungeon-legends'), '');
  }

  // Unused packs stay in the library as `resource` (never archived).
  // Loose frame_NNN go to art-src as sources; stills land under assets/art.
  const primal = path.join(repo, 'assets/play/primal');
  if (fs.existsSync(primal)) {
    moveTree(primal, path.join(repo, 'art-src/pixellab/primal-pack/migrated/raw'), 'move');
    copyResourceStills(
      path.join(repo, 'art-src/pixellab/primal-pack/migrated/raw'),
      path.join(repo, 'assets/art/characters/pets/primal'),
      '',
    );
  }
  const tiles = path.join(repo, 'assets/play/tiles');
  if (fs.existsSync(tiles)) {
    moveTree(tiles, path.join(repo, 'art-src/third-party/scribble-dungeons'), 'move');
    copyResourceStills(
      path.join(repo, 'art-src/third-party/scribble-dungeons'),
      path.join(repo, 'assets/art/tiles/third-party-scribble'),
      '',
    );
  }

  // Rooms → assets/art/rooms/<room>/ with kebab names. JSON maps follow.
  const rooms = path.join(repo, 'assets/play/rooms');
  if (fs.existsSync(rooms)) {
    for (const file of walk(rooms)) {
      const base = path.basename(file);
      let dest: string;
      if (base.startsWith('hideout-td') || base.startsWith('hideout-tease') || base.startsWith('bar-hideout')) {
        dest = path.join(repo, 'assets/art/rooms/hideout', base);
      } else if (base.startsWith('loft-')) {
        dest = path.join(repo, 'assets/art/rooms/loft', base);
      } else if (base.startsWith('underground-')) {
        dest = path.join(repo, 'assets/art/rooms/underground', base);
      } else if (base.startsWith('bar-')) {
        dest = path.join(repo, 'assets/art/ui/markers/streetwear', base);
      } else if (/^zzz-[0-2]\.png$/.test(base) || ['boarded.png', 'tarp.png', 'scaffold.png', 'build-sign.png', 'neighbor-boarded-td.png', 'neighbor-boarded.png'].includes(base)) {
        dest = path.join(repo, 'assets/art/rooms/hideout', base);
      } else {
        dest = path.join(archive, 'rooms', base);
      }
      relocate(file, dest, dest.startsWith(archive) ? 'archive' : 'move');
    }
  }

  // Pixel atlases stay runtime (used by pixel-atlas.tsx) — copy into assets/art/backgrounds.
  const pixel = path.join(repo, 'assets/play/pixel');
  if (fs.existsSync(pixel)) {
    moveTree(pixel, path.join(repo, 'assets/art/backgrounds/classic'), 'copy');
  }

  // grove/ref: skip files whose md5 already lives in art-src (cast/streetwear dupes).
  const hashes = seenHashes();
  const grove = path.join(repo, 'games/grove/ref');
  if (fs.existsSync(grove)) {
    for (const file of walk(grove)) {
      const rel = path.relative(grove, file);
      if (file.toLowerCase().endsWith('.png')) {
        const h = md5File(file);
        if (hashes.has(h)) {
          relocate(file, path.join(archive, 'grove-ref-dupes', rel), 'archive');
          continue;
        }
        hashes.add(h);
      }
      relocate(file, path.join(repo, 'art-src/pixellab/grove-ref/migrated/raw', rel), 'move');
    }
  }

  // Expo leftovers — copy into the library as resource; leave originals until emci OKs deletion.
  const expo = [
    'assets/images/react-logo.png',
    'assets/images/react-logo@2x.png',
    'assets/images/react-logo@3x.png',
    'assets/images/expo-badge.png',
    'assets/images/expo-badge-white.png',
    'assets/images/tutorial-web.png',
  ];
  for (const rel of expo) {
    const from = path.join(repo, rel);
    if (fs.existsSync(from)) {
      relocate(from, path.join(repo, 'assets/art/ui/template', kebabPngName(path.basename(rel))), 'copy');
    }
  }
  const tab = path.join(repo, 'assets/images/tabIcons');
  if (fs.existsSync(tab)) copyResourceStills(tab, path.join(repo, 'assets/art/ui/template'), '');

  // Brand copies (app.json keeps assets/images until emci OKs the swap).
  for (const [from, to] of [
    ['assets/images/icon.png', 'assets/art/brand/brand_icon.png'],
    ['assets/images/splash-icon.png', 'assets/art/brand/brand_splash.png'],
    ['assets/images/favicon.png', 'assets/art/brand/brand_favicon.png'],
    ['assets/images/android-icon-foreground.png', 'assets/art/brand/brand_android-foreground.png'],
    ['assets/images/android-icon-background.png', 'assets/art/brand/brand_android-background.png'],
    ['assets/images/android-icon-monochrome.png', 'assets/art/brand/brand_android-monochrome.png'],
    ['assets/images/logo-glow.png', 'assets/art/brand/brand_logo-glow.png'],
  ] as const) {
    const src = path.join(repo, from);
    if (fs.existsSync(src)) relocate(src, path.join(repo, to), 'copy');
  }

  // Restore kenney-ui sliced sources the packer/prep needs: they moved with kenney-ui.
  // play-art-prep slicePanelBorder reads assets/play/kenney-ui — copy the raw back
  // as a shim so check:kenney / PlayFrame keep working this release.
  const kenneyUiRaw = path.join(repo, 'art-src/third-party/kenney-ui');
  const kenneyUiShim = path.join(repo, 'assets/play/kenney-ui');
  if (fs.existsSync(kenneyUiRaw)) moveTree(kenneyUiRaw, kenneyUiShim, 'copy');
  for (const [raw, shim] of [
    ['art-src/third-party/kenney-icons', 'assets/play/kenney-icons'],
    ['art-src/third-party/craftpix-fields', 'assets/play/craftpix-fields'],
    ['art-src/third-party/craftpix-roads', 'assets/play/craftpix-roads'],
    ['art-src/third-party/kenney-td', 'assets/play/kenney-td'],
    ['art-src/third-party/kenney-td-skin', 'assets/play/skins/kenney-td'],
    ['art-src/third-party/craftpix-td-skin', 'assets/play/skins/craftpix-td'],
  ] as const) {
    const from = path.join(repo, raw);
    const to = path.join(repo, shim);
    if (fs.existsSync(from)) moveTree(from, to, 'copy');
  }

  // Crate still used by pet-games — copy one scribble tile back as a runtime still.
  const crateSrc = path.join(repo, 'art-src/third-party/scribble-dungeons/scribble-dungeons/crate.png');
  const crateSrcFlat = path.join(repo, 'art-src/third-party/scribble-dungeons/crate.png');
  const crateDst = path.join(repo, 'assets/art/props/storage/third-party-scribble/prop_crate_scribble.png');
  const crateFrom = fs.existsSync(crateSrc) ? crateSrc : crateSrcFlat;
  if (fs.existsSync(crateFrom)) relocate(crateFrom, crateDst, 'copy');
  const cratePlay = path.join(repo, 'assets/play/tiles/scribble-dungeons/crate.png');
  if (fs.existsSync(crateDst)) {
    ensureDir(cratePlay);
    fs.copyFileSync(crateDst, cratePlay);
  }

  const mapPath = path.join(repo, 'assets/art/migration-map.json');
  fs.writeFileSync(mapPath, `${JSON.stringify({ version: 1, count: MAP.length, entries: MAP }, null, 2)}\n`);
  const counts = MAP.reduce<Record<string, number>>((acc, e) => {
    acc[e.action] = (acc[e.action] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`migration-map: ${MAP.length} ops`, counts);
}

main();
