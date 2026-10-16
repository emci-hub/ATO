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
import { inferSetVariant } from './art-sets';
import { FLAT_SKELETONS, ROOM_SLOTS, SHEET_SKELETONS } from '../src/art/skeletons';

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

/* ------------------------------------------------ clean ids + typed tree -- */
/* Every id reads `<kind>.<set>[.<variant>][.<part>]` (variant `default` and
 * repeats of the set are dropped). Hand-set room ids are kept as they are.
 * A renamed asset keeps its old ids in `legacyKeys`, which getArt resolves. */

const KIND_BY_CATEGORY: Record<string, string> = {
  icons: 'icon',
  ui: 'ui',
  fx: 'fx',
  props: 'prop',
  tiles: 'tile',
  rooms: 'room',
  backgrounds: 'background',
  branding: 'brand',
};
const CHARACTER_KINDS = new Set(['hero', 'pet', 'npc', 'creep', 'tower', 'boss']);
const FIXED_IDS = new Set(Object.values(ROOM_IDS).map((r) => r.id));

function canonicalId(asset: ArtAsset, soloSets: Set<string>): string {
  if (FIXED_IDS.has(asset.id)) return asset.id;
  const { set: rawSet, variant: rawVariant, part: rawPart } = inferSetVariant(asset.path, asset.category, asset.id);
  const head = asset.id.split('.')[0] ?? '';
  const kind = CHARACTER_KINDS.has(head) ? head : (KIND_BY_CATEGORY[asset.category] ?? head);
  const set = kebab(rawSet).replace(/^brand-/, '');
  const variant = kebab(rawVariant);
  let part = kebab(rawPart)
    .replace(/^brand-/, '')
    .replace(new RegExp(`^${set}-td-`), '')
    .replace(new RegExp(`^${set}-`), '');
  const segs = [kind, set];
  if (variant && variant !== 'default' && variant !== set) segs.push(variant);
  // A one-picture set needs no part name (brand.icon, not brand.icon.icon); a
  // set with several keeps every part so no id is also another id's folder.
  const solo = soloSets.has(`${asset.category}/${rawSet}/${rawVariant}`);
  if (part && !(solo && (part === set || part === variant))) segs.push(part);
  return segs.join('.');
}

function soloSetKeys(assets: ArtAsset[]): Set<string> {
  const count = new Map<string, number>();
  for (const a of assets) {
    const { set, variant } = inferSetVariant(a.path, a.category, a.id);
    const k = `${a.category}/${set}/${variant}`;
    count.set(k, (count.get(k) ?? 0) + 1);
  }
  return new Set([...count].filter(([, n]) => n === 1).map(([k]) => k));
}

/** Rename every asset to its clean id (deterministic: path order, numbered on a clash). */
function applyCleanIds(assets: ArtAsset[], fresh: Set<ArtAsset>) {
  const taken = new Set<string>();
  const solo = soloSetKeys(assets);
  for (const a of [...assets].sort((x, y) => x.path.localeCompare(y.path))) {
    const base = canonicalId(a, solo);
    let id = base;
    for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`;
    taken.add(id);
    if (fresh.has(a)) {
      a.id = id; // a brand-new file never had an old id worth keeping
    } else if (id !== a.id) {
      a.legacyKeys = [...new Set([...(a.legacyKeys ?? []), a.id])].filter((k) => k !== id).sort();
      a.id = id;
    }
  }
}

/** room.hideout.neon-a → ['room','hideout','neonA'] (a valid TS property path). */
function accessorPath(id: string): string[] {
  return id.split('.').map((seg) => {
    const camel = seg.replace(/[-_]+([a-z0-9])/g, (_, c: string) => c.toUpperCase());
    return /^[0-9]/.test(camel) ? `_${camel}` : camel;
  });
}

type Tree = { [k: string]: Tree | string };

function artTree(ids: string[]): Tree {
  const root: Tree = {};
  for (const id of ids) {
    const keys = accessorPath(id);
    let node = root;
    keys.forEach((k, i) => {
      const leaf = i === keys.length - 1;
      const cur = node[k];
      if (leaf) {
        if (cur !== undefined) throw new Error(`art tree clash at ${id} (${keys.join('.')})`);
        node[k] = id;
      } else {
        if (typeof cur === 'string') throw new Error(`art tree clash: ${cur} is also a folder of ${id}`);
        node = (node[k] ??= {}) as Tree;
      }
    });
  }
  return root;
}

function printTree(tree: Tree, indent: string): string[] {
  const out: string[] = [];
  for (const k of Object.keys(tree).sort()) {
    const v = tree[k];
    if (typeof v === 'string') out.push(`${indent}${k}: '${v}',`);
    else out.push(`${indent}${k}: {`, ...printTree(v, `${indent}  `), `${indent}},`);
  }
  return out;
}

type Grouped = Record<string, Record<string, Record<string, string>>>;
type Flat = Record<string, Record<string, string>>;

/**
 * Streetwear packed sheets sorted into skeletons (src/art/skeletons.ts):
 * grouped families give item → slot → sheet key, flat ones name → sheet key.
 * A part that is not a slot of its family stops the sync with a fix-it message.
 */
function sheetSkeletons(): { grouped: Grouped; flat: Flat } {
  const grouped: Grouped = Object.fromEntries(Object.keys(SHEET_SKELETONS).map((f) => [f, {}]));
  const flat: Flat = Object.fromEntries(Object.keys(FLAT_SKELETONS).map((f) => [f, {}]));
  const file = path.join(repo, 'assets/art/legacy-play-sheets.json');
  if (!fs.existsSync(file)) return { grouped, flat };
  const problems: string[] = [];
  const put = (family: keyof typeof SHEET_SKELETONS, item: string, slot: string, key: string) => {
    if (!(SHEET_SKELETONS[family] as readonly string[]).includes(slot)) {
      problems.push(`${key}: "${slot}" is not a ${family} slot (${SHEET_SKELETONS[family].join('/')})`);
      return;
    }
    const prev = grouped[family][item]?.[slot];
    if (prev && prev !== key) {
      problems.push(`${key}: ${family} "${item}" already has ${slot} from ${prev} — rename one`);
      return;
    }
    (grouped[family][item] ??= {})[slot] = key;
  };
  const putFlat = (family: keyof typeof FLAT_SKELETONS, name: string, key: string) => {
    const slots = FLAT_SKELETONS[family];
    if (slots && !slots.includes(name)) problems.push(`${key}: "${name}" is not a ${family} slot`);
    else flat[family][name] = key;
  };
  const clip = (s: string) => (s === 'rotations' ? s : s.toLowerCase());
  for (const key of Object.keys(JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>)) {
    const p = key.split('/');
    if (p[0] !== 'sheets' || p[1] !== 'streetwear') continue;
    const [group, a, b] = [p[2], p[3], p[4]];
    if (group === 'heroes' && b) put('hero', a, clip(b), key);
    else if ((group === 'creeps' || group === 'boss') && b) put('enemy', a, clip(b), key);
    else if (group === 'towers' && b) put('tower', a, clip(b), key);
    else if (group === 'fx' && b) put('fx', a, b, key);
    else if (group === 'auras' && b) put('aura', a, b, key);
    else if (group === 'ui-kit' && a) putFlat('ui', a, key);
    else if (group === 'swords' && a) putFlat('sword', a, key);
    else if (group === 'board' && a) putFlat('board', a, key);
    else if (group !== 'meta.json') problems.push(`${key}: "${group}" has no skeleton — add a family to src/art/skeletons.ts`);
  }
  if (problems.length > 0) {
    throw new Error(`art skeletons: ${problems.length} part(s) fit no slot — add the slot to src/art/skeletons.ts or rename the art:\n  ${problems.join('\n  ')}`);
  }
  return { grouped, flat };
}

/** ROOM skeleton: room → ROOM_SLOTS slot → registry id (room layers only). */
function roomSkeleton(ids: string[]): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const id of ids) {
    if (!FIXED_IDS.has(id)) continue;
    const m = /^room\.([^.]+)\.([^.]+)$/.exec(id);
    if (!m) continue;
    const slot = accessorPath(m[2])[0];
    if ((ROOM_SLOTS as readonly string[]).includes(slot)) (out[m[1]] ??= {})[slot] = id;
  }
  return out;
}

const tsKey = (k: string) => (/^[a-z_$][\w$]*$/i.test(k) ? k : `'${k}'`);

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
  const byAccessor = new Map(assets.map((a) => [accessorPath(a.id).join('.'), a.id]));
  const byLegacy = new Map(assets.flatMap((a) => (a.legacyKeys ?? []).map((k) => [k, a.id] as const)));

  // Images the app loads from outside the library (assets/play/...), by content hash:
  // a library file with the same bytes is in use too (e.g. the cast hero atlases).
  const copyUsers = new Map<string, Set<string>>();
  const roots = [path.join(repo, 'src')];
  for (const root of roots) {
    for (const file of walkFiles(root)) {
      if (!/\.(ts|tsx)$/.test(file)) continue;
      const rel = path.relative(repo, file).split(path.sep).join('/');
      if (rel === 'src/art/generated-art.ts') continue;
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(/(?:getArt|getArtSource|png)\(\s*['"]([^'"]+)['"]/g)) {
        addUsed(map, byLegacy.get(m[1]) ?? m[1], rel);
      }
      // Typed tree: ART.room.hideout.neonA → room.hideout.neon-a
      for (const m of src.matchAll(/\bART((?:\.[A-Za-z_$][\w$]*)+)/g)) {
        const id = byAccessor.get(m[1].slice(1));
        if (id) addUsed(map, id, rel);
      }
      // Room skeleton: ROOM.hideout.neonA → room.hideout.neon-a
      for (const m of src.matchAll(/\bROOM\.([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)/g)) {
        const id = byAccessor.get(`room.${m[1]}.${m[2]}`);
        if (id) addUsed(map, id, rel);
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
      for (const m of src.matchAll(/require\(\s*['"]@\/(assets\/(?!art\/)[^'"]+\.png)['"]\s*\)/g)) {
        const abs = path.join(repo, m[1]);
        if (!fs.existsSync(abs)) continue;
        const md5 = crypto.createHash('md5').update(fs.readFileSync(abs)).digest('hex');
        const users = copyUsers.get(md5) ?? new Set<string>();
        users.add(rel);
        copyUsers.set(md5, users);
      }
    }
  }
  for (const a of assets) {
    if (a.status === 'archived' || !a.path.endsWith('.png')) continue;
    const abs = path.join(repo, a.path);
    if (!fs.existsSync(abs)) continue;
    const users = copyUsers.get(crypto.createHash('md5').update(fs.readFileSync(abs)).digest('hex'));
    for (const rel of users ?? []) addUsed(map, a.id, rel);
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
  const byLegacyId = new Map(registry.assets.flatMap((a) => (a.legacyKeys ?? []).map((k) => [k, a] as const)));

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

  const fresh = new Set<ArtAsset>();
  for (const file of pngs) {
    const rel = relArt(file);
    const artPath = `assets/art/${rel}`;
    const guessed = guess(rel);
    const id = guessed.id!;
    let asset = byId.get(id) ?? byPath.get(artPath) ?? byLegacyId.get(id);
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
        set: '',
        variant: 'default',
        tags: [],
      };
      registry.assets.push(asset);
      byId.set(id, asset);
      fresh.add(asset);
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

  applyCleanIds(
    registry.assets.filter((a) => a.status !== 'archived'),
    fresh,
  );
  const used = usedByScan(registry.assets);
  const pathRewrites: [string, string][] = [];
  for (const asset of registry.assets) {
    asset.usedBy = (used.get(asset.id) ?? []).slice().sort((a, b) => a.localeCompare(b));
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
    const grouped = inferSetVariant(asset.path, asset.category, asset.id);
    asset.set = grouped.set;
    asset.variant = grouped.variant;
    asset.part = grouped.part;
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
  // Only in-use art ships in the app (emci 2026-10-12, "trim"): unused art stays in the
  // library and joins the bundle on its own once code names it (it becomes inUse).
  lines.push('/** Literal require() map for every in-use registry PNG (Metro / EAS). Unused art is library-only. */');
  lines.push('export const ART_SOURCES: Record<string, ImageSourcePropType> = {');
  for (const a of live.filter((x) => x.inUse)) {
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
  lines.push('/** Old id → current id. getArt / getArtSource accept either, so a rename never breaks code. */');
  lines.push('export const ART_ALIASES: Record<string, ArtId> = {');
  const aliases = live
    .flatMap((a) => (a.legacyKeys ?? []).map((k) => [k, a.id] as const))
    .sort((x, y) => x[0].localeCompare(y[0]));
  for (const [from, to] of aliases) lines.push(`  '${from}': '${to}',`);
  lines.push('};');
  lines.push('');
  lines.push('/**');
  lines.push(' * Every library id as a typed path: `getArtSource(ART.room.hideout.neonA)`.');
  lines.push(' * Segments are camelCase (`neon-a` → `neonA`; a leading digit gets `_`).');
  lines.push(' * A renamed or deleted id is a type error, not a blank image at runtime.');
  lines.push(' */');
  lines.push('export const ART = {');
  lines.push(...printTree(artTree(ids), '  '));
  lines.push('} as const;');
  lines.push('');
  lines.push('/**');
  lines.push(' * Packed Streetwear sheets by skeleton (src/art/skeletons.ts). Each value is a');
  lines.push(' * PLAY_SHEETS key. Items are keyed as the game spells them (hero/enemy ids,');
  lines.push(' * element, aura style, ui piece): `SHEET.hero.kael.idle`, `SHEET.fx.ember.hit`,');
  lines.push(" * `SHEET.aura.blaze.front`, `SHEET.ui['button-primary']`, `SHEET.sword.epic`.");
  lines.push(' */');
  lines.push('export const SHEET = {');
  const { grouped, flat } = sheetSkeletons();
  for (const family of Object.keys(SHEET_SKELETONS) as (keyof typeof SHEET_SKELETONS)[]) {
    lines.push(`  ${family}: {`);
    for (const item of Object.keys(grouped[family]).sort()) {
      lines.push(`    ${tsKey(item)}: {`);
      for (const slot of SHEET_SKELETONS[family]) {
        const key = grouped[family][item][slot];
        if (key) lines.push(`      ${slot}: '${key}',`);
      }
      lines.push('    },');
    }
    lines.push('  },');
  }
  for (const family of Object.keys(FLAT_SKELETONS)) {
    lines.push(`  ${family}: {`);
    for (const name of Object.keys(flat[family]).sort()) lines.push(`    ${tsKey(name)}: '${flat[family][name]}',`);
    lines.push('  },');
  }
  lines.push('} as const;');
  lines.push('');
  lines.push('/** Hero skeleton (rotations + HERO_CLIPS): `HERO.kael.idle`. Same as SHEET.hero. */');
  lines.push('export const HERO = SHEET.hero;');
  lines.push('export type HeroSlug = keyof typeof HERO;');
  lines.push('export type UiPiece = keyof typeof SHEET.ui;');
  lines.push('export type BoardId = keyof typeof SHEET.board;');
  lines.push('');
  lines.push('/** Room / map skeleton (ROOM_SLOTS): `ROOM.hideout.neonA` → registry id. */');
  lines.push('export const ROOM = {');
  const rooms = roomSkeleton(ids);
  for (const room of Object.keys(rooms).sort()) {
    lines.push(`  ${tsKey(room)}: {`);
    for (const slot of ROOM_SLOTS) if (rooms[room][slot]) lines.push(`    ${slot}: '${rooms[room][slot]}',`);
    lines.push('  },');
  }
  lines.push('} as const;');
  lines.push('');
  fs.writeFileSync(path.join(repo, 'src/art/generated-art.ts'), `${lines.join('\n')}\n`);
  console.log(`art:registry ${live.length} live / ${registry.assets.length} total → src/art/generated-art.ts`);
}

main();
