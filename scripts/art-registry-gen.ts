/**
 * npm run art:registry
 *
 * Regenerates src/art/generated-art.ts (literal requires) and fills usedBy by
 * scanning getArt('id') / findArt( calls. Merges size/format from packed files.
 */
import fs from 'node:fs';
import path from 'node:path';

import { PNG } from 'pngjs';

import crypto from 'node:crypto';

import type { ArtAsset, ArtRegistry, ArtStatus, ArtType } from '../src/art/registry.types';
import { detectFormat, walkFiles } from './art-png';
import { kebab } from './art-dirs';
import { classifyArt, placeWithUsage, stripUsageFolder } from './art-categories';

const repo = path.resolve(__dirname, '..');

const ROOM_IDS: Record<string, { id: string; type: ArtType; placement: string }> = {
  'ui/markers/streetwear/bar-hideout.png': { id: 'ui.markers.streetwear.bar-hideout', type: 'ui', placement: 'world-marker' },
  'rooms/hideout/bar-hideout.png': { id: 'ui.markers.streetwear.bar-hideout', type: 'ui', placement: 'world-marker' },
  'rooms/hideout/hideout-td-back.png': { id: 'room.hideout.back', type: 'room-layer', placement: 'back-wall' },
  'rooms/hideout/hideout-td-floor.png': { id: 'room.hideout.floor', type: 'room-layer', placement: 'floor' },
  'rooms/hideout/hideout-td-props.png': { id: 'room.hideout.props', type: 'room-layer', placement: 'floor' },
  'rooms/hideout/hideout-td-neon-a.png': { id: 'room.hideout.neon-a', type: 'room-layer', placement: 'overlay' },
  'rooms/hideout/hideout-td-neon-b.png': { id: 'room.hideout.neon-b', type: 'room-layer', placement: 'overlay' },
  'rooms/hideout/hideout-td-occlude-day-a.png': { id: 'room.hideout.occluder-day-a', type: 'room-layer', placement: 'front-occluder' },
  'rooms/hideout/hideout-td-occlude-day-b.png': { id: 'room.hideout.occluder-day-b', type: 'room-layer', placement: 'front-occluder' },
  'rooms/hideout/hideout-td-occlude-night-a.png': { id: 'room.hideout.occluder-night-a', type: 'room-layer', placement: 'front-occluder' },
  'rooms/hideout/hideout-td-occlude-night-b.png': { id: 'room.hideout.occluder-night-b', type: 'room-layer', placement: 'front-occluder' },
  'rooms/hideout/boarded.png': { id: 'room.hideout.boarded', type: 'room-layer', placement: 'wall-mounted' },
  'rooms/hideout/tarp.png': { id: 'room.hideout.tarp', type: 'room-layer', placement: 'wall-mounted' },
  'rooms/hideout/scaffold.png': { id: 'room.hideout.scaffold', type: 'room-layer', placement: 'wall-mounted' },
  'rooms/hideout/build-sign.png': { id: 'room.hideout.build-sign', type: 'room-layer', placement: 'wall-mounted' },
  'rooms/hideout/neighbor-boarded-td.png': { id: 'room.hideout.neighbor-boarded-td', type: 'room-layer', placement: 'back-wall' },
  'rooms/hideout/neighbor-boarded.png': { id: 'room.hideout.neighbor-boarded', type: 'room-layer', placement: 'back-wall' },
  'rooms/hideout/zzz-0.png': { id: 'room.hideout.zzz-0', type: 'fx', placement: 'overlay' },
  'rooms/hideout/zzz-1.png': { id: 'room.hideout.zzz-1', type: 'fx', placement: 'overlay' },
  'rooms/hideout/zzz-2.png': { id: 'room.hideout.zzz-2', type: 'fx', placement: 'overlay' },
  'ui/markers/streetwear/bar-loft.png': { id: 'ui.markers.streetwear.bar-loft', type: 'ui', placement: 'world-marker' },
  'ui/markers/streetwear/bar-garage.png': { id: 'ui.markers.streetwear.bar-garage', type: 'ui', placement: 'world-marker' },
  'ui/markers/streetwear/bar-rooftop.png': { id: 'ui.markers.streetwear.bar-rooftop', type: 'ui', placement: 'world-marker' },
  'ui/markers/streetwear/bar-marker.png': { id: 'ui.markers.streetwear.bar-marker', type: 'ui', placement: 'world-marker' },
  'rooms/loft/loft-td-back.png': { id: 'room.loft.back', type: 'room-layer', placement: 'back-wall' },
  'rooms/loft/loft-td-floor.png': { id: 'room.loft.floor', type: 'room-layer', placement: 'floor' },
  'rooms/loft/loft-td-props.png': { id: 'room.loft.props', type: 'room-layer', placement: 'floor' },
  'rooms/loft/loft-td-neon-a.png': { id: 'room.loft.neon-a', type: 'room-layer', placement: 'overlay' },
  'rooms/loft/loft-td-neon-b.png': { id: 'room.loft.neon-b', type: 'room-layer', placement: 'overlay' },
  'rooms/loft/loft-td-occlude-day-a.png': { id: 'room.loft.occluder-day-a', type: 'room-layer', placement: 'front-occluder' },
  'rooms/loft/loft-td-occlude-day-b.png': { id: 'room.loft.occluder-day-b', type: 'room-layer', placement: 'front-occluder' },
  'rooms/loft/loft-td-occlude-night-a.png': { id: 'room.loft.occluder-night-a', type: 'room-layer', placement: 'front-occluder' },
  'rooms/loft/loft-td-occlude-night-b.png': { id: 'room.loft.occluder-night-b', type: 'room-layer', placement: 'front-occluder' },
  'rooms/loft/loft-td-window-day.png': { id: 'room.loft.window-day', type: 'room-layer', placement: 'window' },
  'rooms/loft/loft-td-window-night.png': { id: 'room.loft.window-night', type: 'room-layer', placement: 'window' },
  'rooms/loft/loft-td-glow.png': { id: 'room.loft.glow', type: 'room-layer', placement: 'overlay' },
  'rooms/underground/underground-td-back.png': { id: 'room.underground.back', type: 'room-layer', placement: 'back-wall' },
  'rooms/underground/underground-td-floor.png': { id: 'room.underground.floor', type: 'room-layer', placement: 'floor' },
  'rooms/underground/underground-td-props.png': { id: 'room.underground.props', type: 'room-layer', placement: 'floor' },
  'rooms/underground/underground-td-neon-a.png': { id: 'room.underground.neon-a', type: 'room-layer', placement: 'overlay' },
  'rooms/underground/underground-td-neon-b.png': { id: 'room.underground.neon-b', type: 'room-layer', placement: 'overlay' },
  'rooms/underground/underground-td-occlude-day-a.png': { id: 'room.underground.occluder-day-a', type: 'room-layer', placement: 'front-occluder' },
  'rooms/underground/underground-td-occlude-day-b.png': { id: 'room.underground.occluder-day-b', type: 'room-layer', placement: 'front-occluder' },
  'rooms/underground/underground-td-occlude-night-a.png': { id: 'room.underground.occluder-night-a', type: 'room-layer', placement: 'front-occluder' },
  'rooms/underground/underground-td-occlude-night-b.png': { id: 'room.underground.occluder-night-b', type: 'room-layer', placement: 'front-occluder' },
};

function relArt(file: string): string {
  return path.relative(path.join(repo, 'assets/art'), file).split(path.sep).join('/');
}

function classifiedCategory(rel: string) {
  return classifyArt(rel).category;
}

function guess(input: string): Partial<ArtAsset> {
  const rel = stripUsageFolder(input);
  const classified = classifyArt(rel);
  const mapped = ROOM_IDS[input] ?? ROOM_IDS[rel];
  if (mapped) {
    return {
      id: mapped.id,
      category: classified.category,
      type: mapped.type,
      placement: mapped.placement,
      theme: 'streetwear',
      camera: 'td-3q-low',
      status: 'candidate',
    };
  }
  const parts = rel.split('/');
  const top = parts[0] ?? classified.category;
  const file = parts[parts.length - 1] ?? '';
  const pathId = kebab(rel.replace(/\.[^.]+$/, '').replace(/\//g, '.'));

  if (top === 'heroes') {
    const slug = parts[1] ?? 'unknown';
    const theme = parts[2] ?? 'streetwear';
    const atlasN = /atlas(?:-(\d+))?\.png$/i.exec(file);
    const tier = /\.(core|combat)\.png$/.exec(file)?.[1] ?? (atlasN ? `atlas${atlasN[1] ?? '0'}` : null);
    const kind = classified.type === 'pet' ? 'pet' : classified.type === 'npc' ? 'npc' : 'hero';
    const id = tier ? `${kind}.${slug}.${theme}.${tier}` : `${kind}.${pathId}`;
    return {
      id,
      category: 'heroes',
      type: classified.type,
      theme,
      placement: 'floor',
      camera: theme === 'streetwear' ? 'td-3q-low' : 'front',
      status: theme === 'streetwear' ? 'approved' : theme === 'cast' ? 'alt-skin' : 'needs-restyle',
    };
  }
  if (top === 'enemies-bosses') {
    const slug = parts[1] ?? 'unknown';
    const theme = parts[2] ?? 'cast';
    const atlasN = /atlas(?:-(\d+))?\.png$/i.exec(file);
    const tier = /\.(core|combat)\.png$/.exec(file)?.[1] ?? (atlasN ? `atlas${atlasN[1] ?? '0'}` : 'core');
    const kind =
      classified.type === 'creep' ? 'creep' : classified.type === 'tower' ? 'tower' : 'boss';
    return {
      id: `${kind}.${slug}.${theme}.${tier}`,
      category: 'enemies-bosses',
      type: classified.type,
      theme,
      placement: 'floor',
      camera: 'front',
      status: theme === 'cast' ? 'alt-skin' : 'needs-restyle',
    };
  }
  if (top === 'branding' || top === 'brand') {
    return {
      id: `brand.${kebab(path.basename(rel, path.extname(rel)))}`,
      category: 'branding',
      type: 'brand',
      theme: 'none',
      placement: 'screen-ui',
      camera: 'flat-ui',
      status: 'candidate',
    };
  }
  if (top === 'icons') {
    const kenney = rel.includes('kenney');
    return {
      id: `icon.${pathId}`,
      category: 'icons',
      type: 'icon',
      theme: kenney ? 'third-party-kenney' : rel.includes('template') ? 'none' : 'streetwear',
      placement: 'hud',
      camera: 'flat-ui',
      status: kenney ? 'needs-restyle' : 'resource',
    };
  }
  if (top === 'ui') {
    const off = rel.includes('kenney') || rel.includes('craftpix') || rel.includes('template');
    return {
      id: `ui.${pathId}`,
      category: 'ui',
      type: 'ui',
      theme: rel.includes('kenney') ? 'third-party-kenney' : rel.includes('template') ? 'none' : 'streetwear',
      placement: rel.includes('markers') ? 'world-marker' : 'hud',
      camera: 'flat-ui',
      status: off ? 'needs-restyle' : 'resource',
    };
  }
  if (top === 'backgrounds') {
    return {
      id: `background.${kebab(path.basename(rel, path.extname(rel)))}`,
      category: 'backgrounds',
      type: 'background',
      theme: 'classic',
      placement: 'back-wall',
      camera: 'front',
      status: 'resource',
    };
  }
  if (top === 'props') {
    const scribble = rel.includes('scribble');
    return {
      id: `prop.${pathId}`,
      category: 'props',
      type: 'prop',
      theme: scribble ? 'third-party-scribble' : rel.includes('loft') ? 'streetwear' : 'streetwear',
      placement: 'floor',
      camera: 'td-3q-low',
      status: 'resource',
    };
  }
  if (top === 'tiles') {
    const scribble = rel.includes('scribble');
    return {
      id: `tile.${pathId}`,
      category: 'tiles',
      type: 'tile',
      theme: scribble ? 'third-party-scribble' : rel.includes('streetwear') ? 'streetwear' : 'third-party-kenney',
      placement: 'map-tile',
      camera: 'flat-ui',
      status: scribble || rel.includes('streetwear') ? 'resource' : 'needs-restyle',
    };
  }
  if (top === 'fx') {
    return {
      id: `fx.${pathId}`,
      category: 'fx',
      type: 'fx',
      theme: 'streetwear',
      placement: 'overlay',
      camera: 'td-3q-low',
      status: 'resource',
    };
  }
  if (top === 'rooms') {
    return {
      id: `room.${pathId}`,
      category: 'rooms',
      type: 'room-layer',
      theme: 'streetwear',
      placement: 'floor',
      camera: 'td-3q-low',
      status: 'candidate',
    };
  }
  return {
    id: pathId.replace(/-/g, '.'),
    category: classified.category,
    type: classified.type,
    theme: 'none',
    placement: 'todo',
    camera: 'todo',
    status: 'candidate',
  };
}

function restyleFor(theme: string | undefined): ArtAsset['restyle'] | undefined {
  if (!theme || theme === 'streetwear' || theme === 'cast' || theme === 'none') return undefined;
  const preset = theme.includes('kenney') || theme.includes('scribble') || theme.includes('craftpix') ? 'tile' : 'char8';
  return {
    priority: theme.includes('kenney') ? 2 : 3,
    reason: `${theme} is off-style for streetwear screens`,
    pixellabPreset: preset as 'tile' | 'char8',
    refIds: [],
  };
}

function addUsed(map: Map<string, string[]>, id: string, file: string) {
  if (!id) return;
  const list = map.get(id) ?? [];
  if (!list.includes(file)) list.push(file);
  map.set(id, list);
}

function usedByScan(assets: ArtAsset[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const byPath = new Map(assets.map((a) => [a.path, a.id]));
  const byArt = new Map(assets.map((a) => [a.path.replace(/^assets\//, ''), a.id]));

  const roots = [path.join(repo, 'src')];
  for (const root of roots) {
    for (const file of walkFiles(root)) {
      if (!/\.(ts|tsx)$/.test(file)) continue;
      const rel = path.relative(repo, file).split(path.sep).join('/');
      if (rel === 'src/art/generated-art.ts') continue;
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(/(?:getArt|getArtSource|png)\(\s*['"]([^'"]+)['"]/g)) {
        addUsed(map, m[1], rel);
      }
      for (const m of src.matchAll(/require\(\s*['"]@\/(assets\/art\/[^'"]+)['"]\s*\)/g)) {
        const artPath = m[1];
        const id = byPath.get(artPath);
        if (id) addUsed(map, id, rel);
      }
      for (const m of src.matchAll(/from ['"]@\/(assets\/art\/[^'"]+)['"]/g)) {
        const artPath = m[1];
        const id = byPath.get(artPath);
        if (id) addUsed(map, id, rel);
      }
    }
  }

  const sheetFiles = [
    path.join(repo, 'assets/art/legacy-play-sheets.json'),
    ...walkFiles(path.join(repo, 'assets/play/sheets')).filter((f) => f.endsWith('sheets.json')),
  ];
  for (const file of sheetFiles) {
    if (!fs.existsSync(file)) continue;
    const rel = path.relative(repo, file).split(path.sep).join('/');
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/"sheet":\s*"(art\/[^"]+)"/g)) {
      const id = byArt.get(m[1]);
      if (id) addUsed(map, id, rel);
    }
  }

  for (const a of assets) {
    if (a.replaces) addUsed(map, a.replaces, 'assets/art/registry.json');
    for (const ref of a.restyle?.refIds ?? []) addUsed(map, ref, 'assets/art/registry.json');
  }
  return map;
}

function sidecars(pngPath: string): string[] {
  const stem = pngPath.replace(/\.png$/i, '');
  return [`${stem}.json`, `${stem}.map.json`].filter((f) => fs.existsSync(f));
}

function moveFile(from: string, to: string) {
  if (!fs.existsSync(from) || from === to) return;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  if (fs.existsSync(to)) {
    const same = fs.readFileSync(from).equals(fs.readFileSync(to));
    if (same) {
      fs.rmSync(from);
      return;
    }
    throw new Error(`dest exists and differs: ${to}`);
  }
  fs.renameSync(from, to);
}

function rmEmpty(dir: string, stopAt: string) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return;
  for (const name of fs.readdirSync(dir)) rmEmpty(path.join(dir, name), stopAt);
  if (dir !== stopAt && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
}

function main() {
  const registryPath = path.join(repo, 'assets/art/registry.json');
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as ArtRegistry;
  const byId = new Map(registry.assets.map((a) => [a.id, a]));
  const byPath = new Map(registry.assets.map((a) => [a.path, a]));

  const artRoot = path.join(repo, 'assets/art');
  const skip = (rel: string) =>
    rel.startsWith('_contact/') ||
    rel === 'registry.json' ||
    rel === 'ART_LIBRARY.md' ||
    rel === 'library.html' ||
    rel === 'library-portable.html' ||
    rel === 'art-decisions.json' ||
    rel === 'migration-map.json' ||
    rel === 'legacy-play-sheets.json' ||
    rel.startsWith('shared/') ||
    rel.endsWith('.md');

  const pngs = walkFiles(artRoot).filter((f) => {
    const rel = relArt(f);
    return /\.(png)$/i.test(f) && !skip(rel);
  });

  for (const file of pngs) {
    const rel = relArt(file);
    const artPath = `assets/art/${rel}`;
    const guessed = guess(rel);
    const id = guessed.id!;
    let asset = byId.get(id) ?? byPath.get(artPath);
    const buf = fs.readFileSync(file);
    let w = 0;
    let h = 0;
    try {
      const png = PNG.sync.read(buf);
      w = png.width;
      h = png.height;
    } catch {
      /* not a pngjs-readable file */
    }
    const format = detectFormat(buf);
    if (!asset) {
      asset = {
        id,
        path: artPath,
        category: guessed.category ?? classifiedCategory(rel),
        type: guessed.type ?? 'ui',
        theme: guessed.theme ?? 'none',
        placement: guessed.placement ?? 'todo',
        camera: guessed.camera ?? 'todo',
        size: { w, h },
        status: (guessed.status ?? 'candidate') as ArtStatus,
        source: String(guessed.theme).startsWith('third-party') ? 'third-party' : 'pixellab',
        diskBytes: buf.length,
        decodedBytes: w * h * 4,
        format,
        notes: `md5:${crypto.createHash('md5').update(buf).digest('hex')}`,
        restyle: restyleFor(guessed.theme),
        restyleTarget: guessed.status === 'alt-skin' ? 'streetwear' : undefined,
        inUse: false,
        tags: [],
      };
      registry.assets.push(asset);
      byId.set(id, asset);
    } else {
      asset.path = artPath;
      asset.category = guessed.category ?? asset.category ?? classifiedCategory(rel);
      asset.size = { w, h };
      asset.diskBytes = buf.length;
      asset.decodedBytes = w * h * 4;
      asset.format = format;
      const md5 = crypto.createHash('md5').update(buf).digest('hex');
      if (!asset.notes || asset.notes.startsWith('md5:')) asset.notes = `md5:${md5}`;
      if (guessed.status === 'alt-skin') asset.restyleTarget = 'streetwear';
      if (!asset.restyle) asset.restyle = restyleFor(asset.theme);
    }
  }

  const used = usedByScan(registry.assets);
  const pathRewrites: [string, string][] = [];
  for (const asset of registry.assets) {
    asset.usedBy = used.get(asset.id) ?? [];
    asset.inUse = asset.usedBy.length > 0;
    if (
      !asset.inUse &&
      (asset.status === 'candidate' || asset.status === 'approved') &&
      (asset.type === 'ui' ||
        asset.type === 'icon' ||
        asset.type === 'prop' ||
        asset.type === 'tile' ||
        asset.type === 'pet' ||
        asset.type === 'npc' ||
        asset.type === 'background' ||
        asset.type === 'fx')
    ) {
      asset.status = 'resource';
    }
    if (!asset.restyle) asset.restyle = restyleFor(asset.theme);

    const rel = asset.path.replace(/^assets\/art\//, '');
    const core = classifyArt(rel).dest;
    const destRel = placeWithUsage(core, asset.inUse);
    if (destRel !== rel && asset.path.endsWith('.png')) {
      const from = path.join(repo, asset.path);
      const to = path.join(repo, 'assets/art', destRel);
      moveFile(from, to);
      for (const side of sidecars(from)) {
        moveFile(side, path.join(path.dirname(to), path.basename(side)));
      }
      pathRewrites.push([rel, destRel]);
      asset.path = `assets/art/${destRel}`;
      if (asset.atlas) {
        asset.atlas.file = asset.atlas.file.replace(rel, destRel);
        asset.atlas.json = asset.atlas.json.replace(rel, destRel);
      }
    }
  }
  rmEmpty(artRoot, artRoot);

  if (pathRewrites.length > 0) {
    const rewrite = (text: string) => {
      let next = text;
      for (const [from, to] of pathRewrites) {
        next = next.split(`art/${from}`).join(`art/${to}`);
        next = next.split(`assets/art/${from}`).join(`assets/art/${to}`);
      }
      return next;
    };
    const sheetsRoot = path.join(repo, 'assets/play/sheets');
    if (fs.existsSync(sheetsRoot)) {
      for (const file of walkFiles(sheetsRoot).filter((f) => f.endsWith('sheets.json'))) {
        fs.writeFileSync(file, rewrite(fs.readFileSync(file, 'utf8')));
      }
    }
    const legacy = path.join(artRoot, 'legacy-play-sheets.json');
    if (fs.existsSync(legacy)) fs.writeFileSync(legacy, rewrite(fs.readFileSync(legacy, 'utf8')));
    const genSheets = path.join(repo, 'src/play/generated-play-sheets.ts');
    if (fs.existsSync(genSheets)) fs.writeFileSync(genSheets, rewrite(fs.readFileSync(genSheets, 'utf8')));
  }

  registry.assets = registry.assets.filter((a) => a.status === 'archived' || fs.existsSync(path.join(repo, a.path)));
  const seen = new Set<string>();
  registry.assets = registry.assets.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
  registry.version = 1;
  registry.assets.sort((a, b) => a.id.localeCompare(b.id));
  fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);

  const live = registry.assets.filter((a) => a.status !== 'archived' && a.status !== 'deprecated' && a.path.endsWith('.png'));
  const ids = live.map((a) => a.id);
  const lines: string[] = [];
  lines.push('// AUTO-GENERATED by scripts/art-registry-gen.ts — do not edit.');
  lines.push("import type { ImageSourcePropType } from 'react-native';");
  lines.push('');
  lines.push('/** Literal require() map for every non-archived registry PNG (Metro / EAS). */');
  lines.push('export const ART_SOURCES: Record<string, ImageSourcePropType> = {');
  for (const a of live) {
    const req = a.path.replace(/^assets\//, '@/assets/');
    lines.push(`  '${a.id}': require('${req}'),`);
  }
  lines.push('};');
  lines.push('');
  if (ids.length === 0) {
    lines.push('export type ArtId = string;');
  } else {
    lines.push(`export type ArtId =`);
    ids.forEach((id, i) => {
      lines.push(`  | '${id}'${i === ids.length - 1 ? ';' : ''}`);
    });
  }
  lines.push('');
  fs.writeFileSync(path.join(repo, 'src/art/generated-art.ts'), `${lines.join('\n')}\n`);
  console.log(`art:registry ${live.length} live / ${registry.assets.length} total → src/art/generated-art.ts`);
}

main();
