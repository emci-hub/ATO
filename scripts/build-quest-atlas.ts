/**
 * Quests atlas builder (ATO-BUILD PHASE-22).
 * Run: npm run build:quest-atlas
 *
 * Packs the approved art in art-src/quests into assets/quests/<atlas>.png + .json
 * (lantern, masquerade, city, shared) and generates src/lib/quests/art-keys.ts.
 *
 *  - Pure JS (scripts/quest-png.ts, node:zlib only): no sharp / pngjs (R24).
 *  - Every frame is pre-scaled x2 with nearest-neighbour (1 art px = 2 atlas px = 2 pt at 1x).
 *  - R20: every frame sits in a cell with 2 px of transparent-safe padding, filled by edge
 *    extrude, so a neighbour can never bleed in. `check:quest-atlas` asserts it.
 *  - Animated sets (NPCs, heroes) are trimmed to one box shared by all their frames, so a
 *    clip keeps one size; `fx`/`fy` is the foot point in the original canvas.
 *  - Each plate also gets a baked, darkened, blurred copy (`plate.<loc>.blur`, stored at 1x
 *    art-pixel size, k = 1) for the glass dialogue backdrop.
 *
 * Which source file is which asset comes from art-src/quests/params.json (ids). Add an asset
 * by adding it to MANIFEST below; the file lists are the only place that names art.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { type Img, alphaBox, blit, crop, decodePng, encodePng, newImg, over, scaleNearest } from './quest-png';

const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'art-src', 'quests');
const OUT = join(ROOT, 'assets', 'quests');
const KEYS_FILE = join(ROOT, 'src', 'lib', 'quests', 'art-keys.ts');

export const ATLAS_NAMES = ['lantern', 'masquerade', 'city', 'shared'] as const;
export type AtlasName = (typeof ATLAS_NAMES)[number];

export const PAD = 2;
export const SCALE = 2;
export const MAX_SIDE = 2048;

export interface FrameRec {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Trim offset inside the original canvas (atlas px). */
  ox: number;
  oy: number;
  /** Original canvas size (atlas px). */
  cw: number;
  ch: number;
  /** Atlas px per art px: 2 normally, 1 for the baked blur. */
  k: number;
  /** Foot point in the original canvas (atlas px). */
  fx: number;
  fy: number;
}

export interface AtlasJson {
  name: AtlasName;
  width: number;
  height: number;
  pad: number;
  frames: Record<string, FrameRec>;
  /** Clips in this atlas: frames are <clip>.0 .. <clip>.<n-1>. */
  anims: Record<string, { n: number; ms: number | number[] }>;
}

interface Item {
  atlas: AtlasName;
  key: string;
  img: Img;
  trim: boolean;
  k: number;
  /** Shared trim group (an animation): all frames crop to the group's union box. */
  group?: string;
}

const params = JSON.parse(readFileSync(join(SRC, 'params.json'), 'utf8')) as { assets: Record<string, { file: string }> };
function file(id: string): string {
  const a = params.assets[id];
  if (!a) throw new Error(`params.json has no asset "${id}"`);
  return join(SRC, a.file);
}
const read = (path: string): Img => decodePng(readFileSync(path), path);

/** `<dir>/<prefix>N.png` files in numeric order. */
function seq(dir: string, prefix: string): string[] {
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)\\.png$`);
  const found = readdirSync(join(SRC, dir))
    .map((n) => ({ n, m: re.exec(n) }))
    .filter((e) => e.m)
    .sort((a, b) => Number(a.m![1]) - Number(b.m![1]));
  if (!found.length) throw new Error(`no frames for ${dir}/${prefix}`);
  return found.map((e) => join(SRC, dir, e.n));
}

// --- manifest ----------------------------------------------------------------

interface Campaign {
  id: 'lantern' | 'masquerade' | 'city';
  /** [location slug, params id for far, mid, ground (lantern only)] */
  locations: { slug: string; far: string; mid: string; ground?: string }[];
  props: { name: string; id: string }[];
  npcs: string[];
  endings: string[];
  ambient: { name: string; dir: string; prefix: string; ms: number }[];
}

const CAMPAIGNS: Campaign[] = [
  {
    id: 'lantern',
    locations: [
      { slug: 'flooded-gate', far: 'far-1-gate', mid: 'mid-1-rockarch', ground: 'ground-1-gate' },
      { slug: 'tunnel-fork', far: 'far-2-fork', mid: 'mid-2-fork', ground: 'ground-2-fork' },
      { slug: 'toll-bridge', far: 'far-3-bridge', mid: 'mid-3-bridge', ground: 'ground-3-bridge' },
      { slug: 'singing-lake', far: 'far-4-lake', mid: 'mid-4-lake', ground: 'ground-4-lake' },
      { slug: 'ceiling-crack', far: 'far-5-daylight', mid: 'mid-5-daylight', ground: 'ground-5-daylight' },
    ],
    props: ['lantern', 'rope-bridge', 'raft', 'mine-cart', 'glow-crystal', 'ration-crate'].map((n) => ({ name: n, id: `prop-${n}` })),
    npcs: ['rook', 'vey'],
    endings: ['singing-deep', 'long-way-home', 'rooks-lantern', 'toll-forward'],
    ambient: [{ name: 'drip', dir: 'vfx', prefix: 'a-l3-drip-', ms: 140 }],
  },
  {
    id: 'masquerade',
    locations: [
      { slug: 'ballroom', far: 'masquerade-far-1-ballroom', mid: 'masquerade-mid-1-ballroom' },
      { slug: 'balcony', far: 'masquerade-far-2-balcony', mid: 'masquerade-mid-2-balcony' },
      { slug: 'servants-stair', far: 'masquerade-far-3-servants-stair', mid: 'masquerade-mid-3-servants-stair' },
      { slug: 'library', far: 'masquerade-far-4-library', mid: 'masquerade-mid-4-library' },
      { slug: 'garden-maze', far: 'masquerade-far-5-garden-maze', mid: 'masquerade-mid-5-garden-maze' },
    ],
    props: ['mask-1-wine', 'mask-2-gold', 'mask-3-fox', 'mask-4-moon', 'candelabra', 'letter', 'wine-table', 'clock'].map((n) => ({
      name: n,
      id: `masquerade-prop-${n}`,
    })),
    npcs: ['ines', 'corvin', 'pell'],
    endings: ['last-waltz', 'quiet-exit', 'unmasked-together', 'clock-twice'],
    ambient: [
      { name: 'candle-flame', dir: 'vfx', prefix: 'a-m1-candle-flame-', ms: 120 },
      { name: 'curtain', dir: 'vfx', prefix: 'a-m2-curtain-', ms: 180 },
      { name: 'dancers', dir: 'vfx', prefix: 'a-m3-dancers-', ms: 200 },
    ],
  },
  {
    id: 'city',
    locations: [
      { slug: 'cancelled-platform', far: 'city-far-1-platform', mid: 'city-mid-1-platform' },
      { slug: 'night-street', far: 'city-far-2-night-street', mid: 'city-mid-2-night-street' },
      { slug: 'rooftop', far: 'city-far-3-rooftop', mid: 'city-mid-3-rooftop' },
      { slug: 'diner', far: 'city-far-4-diner', mid: 'city-mid-4-diner' },
      { slug: 'last-bus-stop', far: 'city-far-5-last-bus-stop', mid: 'city-mid-5-last-bus-stop' },
    ],
    props: ['departure-board', 'vending-machine', 'phone', 'bike', 'umbrella', 'food-cart'].map((n) => ({ name: n, id: `city-prop-${n}` })),
    npcs: ['mara', 'theo', 'dee'],
    endings: ['night-bus-crew', 'sunrise-walk', 'diner-dawn', 'first-train'],
    ambient: [
      { name: 'rain', dir: 'vfx', prefix: 'a-c2-rain-tile-', ms: 90 },
      { name: 'train', dir: 'vfx', prefix: 'a-c3-train-', ms: 160 },
    ],
  },
];

const HEROES = [
  'druid',
  'champion',
  'witch',
  'ratkin-treasure-hunter',
  'death-knight',
  'abyssal-assassin',
  'arcane-engineer',
  'demon-guardian',
  'seraphic-cleric',
  'crystal-berserker',
];
/** The first three also have talk / react / walk / triumph clips. */
const HERO_CLIPS = ['talk', 'react', 'walk', 'triumph'];
const EXTRA_CLIP_HEROES = ['druid', 'champion', 'witch'];

const EMBLEMS = [
  'openness',
  'conscientiousness',
  'extraversion',
  'agreeableness',
  'c_assert',
  'c_coop',
  'autonomy',
  'playfulness',
  'self_efficacy',
  'locus_of_control',
];
const ICONS = ['stat-supplies', 'stat-heart', 'stat-laurel', 'u3-explore', 'u3-ledger', 'u3-quote', 'u3-swords', 'u3-hourglass', 'rewind'];
const VFX = [
  { name: 'sparkle', prefix: 'v1-sparkle-burst-', ms: 80 },
  { name: 'dust', prefix: 'v2-dust-puff-', ms: 90 },
  { name: 'stat-up', prefix: 'v3-stat-up-', ms: 100 },
  { name: 'stat-down', prefix: 'v3-stat-down-', ms: 100 },
];

/** Frame times (ms) per clip. A number is one time for every frame. */
const CLIP_MS: Record<string, number> = { idle: 300, talk: 120, react: 100, walk: 100, triumph: 120 };

export const ALIASES: [string, string][] = [['prop.masquerade.mask', 'prop.masquerade.mask-1-wine']];

export const BUILD_ANIMS: Record<string, { n: number; ms: number | number[] }> = {};

// --- collecting --------------------------------------------------------------

function collect(): { items: Item[]; blurs: Item[] } {
  const items: Item[] = [];
  const blurs: Item[] = [];
  const add = (atlas: AtlasName, key: string, img: Img, trim = false, group?: string) => items.push({ atlas, key, img, trim, k: SCALE, group });
  const addAnim = (atlas: AtlasName, key: string, files: string[], ms: number, trim: boolean) => {
    files.forEach((f, i) => add(atlas, `${key}.${i}`, read(f), trim, trim ? key : undefined));
    BUILD_ANIMS[key] = { n: files.length, ms };
  };

  for (const c of CAMPAIGNS) {
    for (const loc of c.locations) {
      const lk = `${c.id}.${loc.slug}`;
      const far = read(file(loc.far));
      const mid = read(file(loc.mid));
      add(c.id, `plate.${lk}.far`, far);
      add(c.id, `plate.${lk}.mid`, mid);
      const scene = newImg(far.w, far.h);
      over(scene, far, 0, 0);
      over(scene, mid, 0, 0);
      if (loc.ground) {
        const g = read(file(loc.ground));
        add(c.id, `plate.${lk}.ground`, g);
        over(scene, g, 0, far.h - g.h);
      }
      blurs.push({ atlas: c.id, key: `plate.${lk}.blur`, img: bakeBlur(scene), trim: false, k: 1 });
    }
    for (const p of c.props) add(c.id, `prop.${c.id}.${p.name}`, read(file(p.id)));
    for (const n of c.npcs) {
      addAnim(c.id, `npc.${n}.idle`, seq('npcs/snapped', `${n}-idle-`), CLIP_MS.idle, true);
      addAnim(c.id, `npc.${n}.talk`, seq('npcs/snapped', `${n}-talk-`), CLIP_MS.talk, true);
      add(c.id, `npc.${n}.portrait`, read(file(`portrait-${n}`)));
    }
    for (const e of c.endings) add(c.id, `end.${c.id}.ending-${e}`, read(file(`ending-${c.id}.ending-${e}`)));
    for (const a of c.ambient) addAnim(c.id, `amb.${c.id}.${a.name}`, seq(a.dir, a.prefix), a.ms, false);
  }

  for (const h of HEROES) {
    addAnim('shared', `hero.${h}.idle`, seq('heroes/snapped', `${h}-idle-`), CLIP_MS.idle, true);
    if (EXTRA_CLIP_HEROES.includes(h)) for (const clip of HERO_CLIPS) addAnim('shared', `hero.${h}.${clip}`, seq('heroes/snapped', `${h}-${clip}-`), CLIP_MS[clip], true);
  }
  for (const i of ICONS) add('shared', `ui.${i}`, read(join(SRC, 'icons', `${i}.png`)));
  for (const v of VFX) addAnim('shared', `vfx.${v.name}`, seq('vfx', v.prefix), v.ms, false);
  add('shared', 'd20', read(join(SRC, 'shared', 'd20.png')));
  addAnim('shared', 'd20.tumble', seq('shared', 'd20-tumble-'), 60, false);
  for (const e of EMBLEMS) add('shared', `emblem.${e}`, read(join(SRC, 'emblems', `${e}.png`)));
  for (const c of CAMPAIGNS) add('shared', `badge.${c.id}`, read(join(SRC, 'shared', `badge-${c.id}.png`)));
  return { items, blurs };
}

/** Darken, then blur (3 box passes, radius 3) a flattened plate. Output is opaque. */
function bakeBlur(src: Img): Img {
  const out = newImg(src.w, src.h);
  for (let i = 0; i < src.w * src.h; i++) {
    const a = src.d[i * 4 + 3] / 255;
    for (let c = 0; c < 3; c++) out.d[i * 4 + c] = Math.round(src.d[i * 4 + c] * a * 0.55 + 5 * (1 - a));
    out.d[i * 4 + 3] = 255;
  }
  const R = 3;
  const tmp = new Float32Array(src.w * src.h * 3);
  for (let pass = 0; pass < 3; pass++) {
    for (const horizontal of [true, false]) {
      for (let y = 0; y < src.h; y++) {
        for (let x = 0; x < src.w; x++) {
          for (let c = 0; c < 3; c++) {
            let sum = 0;
            for (let d = -R; d <= R; d++) {
              const xx = horizontal ? Math.min(src.w - 1, Math.max(0, x + d)) : x;
              const yy = horizontal ? y : Math.min(src.h - 1, Math.max(0, y + d));
              sum += out.d[(yy * src.w + xx) * 4 + c];
            }
            tmp[(y * src.w + x) * 3 + c] = sum / (2 * R + 1);
          }
        }
      }
      for (let i = 0; i < src.w * src.h; i++) for (let c = 0; c < 3; c++) out.d[i * 4 + c] = Math.round(tmp[i * 3 + c]);
    }
  }
  return out;
}

// --- trimming + packing --------------------------------------------------------

interface Prepared {
  item: Item;
  img: Img; // scaled (or 1x for the blur), trimmed
  ox: number;
  oy: number;
  cw: number;
  ch: number;
  fx: number;
  fy: number;
}

function prepare(items: Item[]): Prepared[] {
  const union = new Map<string, { x0: number; y0: number; x1: number; y1: number }>();
  for (const it of items) {
    if (!it.group) continue;
    const b = alphaBox(it.img);
    if (!b) continue;
    const u = union.get(it.group);
    union.set(it.group, u ? { x0: Math.min(u.x0, b.x0), y0: Math.min(u.y0, b.y0), x1: Math.max(u.x1, b.x1), y1: Math.max(u.y1, b.y1) } : b);
  }
  return items.map((it) => {
    const k = it.k;
    const own = alphaBox(it.img) ?? { x0: 0, y0: 0, x1: it.img.w - 1, y1: it.img.h - 1 };
    const box = it.group ? union.get(it.group)! : it.trim ? own : { x0: 0, y0: 0, x1: it.img.w - 1, y1: it.img.h - 1 };
    const cropped = crop(it.img, box.x0, box.y0, box.x1 - box.x0 + 1, box.y1 - box.y0 + 1);
    // Foot: bottom of the visible figure, horizontally the canvas centre (canvases are concentric).
    const foot = it.group || it.trim ? { x: it.img.w / 2, y: (it.group ? box.y1 : own.y1) + 1 } : { x: (own.x0 + own.x1 + 1) / 2, y: own.y1 + 1 };
    return {
      item: it,
      img: k === 1 ? cropped : scaleNearest(cropped, k),
      ox: box.x0 * k,
      oy: box.y0 * k,
      cw: it.img.w * k,
      ch: it.img.h * k,
      fx: Math.round(foot.x * k),
      fy: Math.round(foot.y * k),
    };
  });
}

function pack(name: AtlasName, list: Prepared[]): { png: Buffer; json: AtlasJson } {
  const cells = list.map((p) => ({ p, w: p.img.w + PAD * 2, h: p.img.h + PAD * 2 })).sort((a, b) => b.h - a.h || b.w - a.w || (a.p.item.key < b.p.item.key ? -1 : 1));
  const pos = new Map<Prepared, { x: number; y: number }>();
  let x = 0;
  let y = 0;
  let shelf = 0;
  for (const c of cells) {
    if (x + c.w > MAX_SIDE) {
      x = 0;
      y += shelf;
      shelf = 0;
    }
    pos.set(c.p, { x, y });
    x += c.w;
    shelf = Math.max(shelf, c.h);
  }
  const used = y + shelf;
  const height = Math.ceil(used / 4) * 4;
  if (height > MAX_SIDE) throw new Error(`atlas "${name}" needs ${MAX_SIDE}x${height}: split it into more atlases (ATO-BUILD §1.9 budget)`);
  const widthUsed = Math.max(...cells.map((c) => (pos.get(c.p)!.x + c.w)));
  const width = Math.ceil(widthUsed / 4) * 4;
  const img = newImg(width, height);
  const frames: Record<string, FrameRec> = {};
  for (const c of cells) {
    const { x: cx, y: cy } = pos.get(c.p)!;
    const { img: s } = c.p;
    blit(img, s, cx + PAD, cy + PAD);
    // R20: edge extrude into the padding ring.
    for (let yy = 0; yy < c.h; yy++) {
      for (let xx = 0; xx < c.w; xx++) {
        if (xx >= PAD && xx < c.w - PAD && yy >= PAD && yy < c.h - PAD) continue;
        const sx = Math.min(s.w - 1, Math.max(0, xx - PAD));
        const sy = Math.min(s.h - 1, Math.max(0, yy - PAD));
        const from = (sy * s.w + sx) * 4;
        img.d.set(s.d.subarray(from, from + 4), ((cy + yy) * width + cx + xx) * 4);
      }
    }
    frames[c.p.item.key] = {
      x: cx + PAD,
      y: cy + PAD,
      w: s.w,
      h: s.h,
      ox: c.p.ox,
      oy: c.p.oy,
      cw: c.p.cw,
      ch: c.p.ch,
      k: c.p.item.k,
      fx: c.p.fx,
      fy: c.p.fy,
    };
  }
  const anims: Record<string, { n: number; ms: number | number[] }> = {};
  for (const [k, a] of Object.entries(BUILD_ANIMS)) if (frames[`${k}.0`]) anims[k] = a;
  return { png: encodePng(img), json: { name, width, height, pad: PAD, frames, anims } };
}

// --- art-keys.ts ---------------------------------------------------------------

export function renderArtKeys(atlases: AtlasJson[]): string {
  const frames: Record<string, [number, ...number[]]> = {};
  for (const a of atlases) {
    const idx = ATLAS_NAMES.indexOf(a.name);
    for (const [k, f] of Object.entries(a.frames)) frames[k] = [idx, f.x, f.y, f.w, f.h, f.ox, f.oy, f.cw, f.ch, f.k, f.fx, f.fy];
  }
  for (const [alias, of] of ALIASES) frames[alias] = frames[of];
  const sorted = Object.keys(frames).sort();
  const lines = sorted.map((k) => `  ${JSON.stringify(k)}: [${frames[k].join(', ')}],`);
  const allAnims: Record<string, { n: number; ms: number | number[] }> = Object.assign({}, ...atlases.map((a) => a.anims));
  const anims = Object.keys(allAnims)
    .sort()
    .map((k) => `  ${JSON.stringify(k)}: { n: ${allAnims[k].n}, ms: ${JSON.stringify(allAnims[k].ms)} },`);
  const locations = CAMPAIGNS.flatMap((c) => c.locations.map((l) => `${c.id}.${l.slug}`));
  const endings = CAMPAIGNS.flatMap((c) => c.endings.map((e) => `${c.id}.ending-${e}`));
  const props = CAMPAIGNS.flatMap((c) => c.props.map((p) => `${c.id}.${p.name}`)).concat(ALIASES.map(([a]) => a.replace(/^prop\./, '')));
  const list = (xs: string[]) => xs.map((x) => `  '${x}',`).join('\n');
  return `/**
 * GENERATED by scripts/build-quest-atlas.ts (ATO-BUILD PHASE-22). Do not edit by hand:
 * run \`npm run build:quest-atlas\`. \`check:quest-atlas\` fails when this file is stale.
 *
 * Art location keys a Quests scene may name, plus the atlas frame table the stage reads.
 * Pure data (no require of images), so node scripts can import it; the sheets themselves
 * are required in src/components/quests/atlas-sprite.tsx.
 */

/** Scene locations (campaign.slug). */
export const QUEST_LOCATION_KEYS: readonly string[] = [
${list(locations)}
];

/** Ending art keys (campaign.ending-slug). */
export const QUEST_ENDING_ART_KEYS: readonly string[] = [
${list(endings)}
];

/** Prop ids a scene may place (campaign.name). */
export const QUEST_PROP_KEYS: readonly string[] = [
${list(props)}
];

/** NPC ids a scene may cast. */
export const QUEST_CAST_KEYS: readonly string[] = [
${list(CAMPAIGNS.flatMap((c) => c.npcs))}
];

/** Hero slugs with stage sprites. */
export const QUEST_HERO_KEYS: readonly string[] = [
${list(HEROES)}
];

/** Axis emblems (frame \`emblem.<axis>\`). */
export const QUEST_EMBLEM_KEYS: readonly string[] = [
${list(EMBLEMS)}
];

/** Trait axis -> emblem frame (\`emblem.<value>\`). The two conflict axes have short art names. */
export const QUEST_EMBLEM_FOR_AXIS: Readonly<Record<string, string>> = {
${EMBLEMS.map((e) => `  ${e === 'c_assert' ? 'conflict_assertiveness' : e === 'c_coop' ? 'conflict_cooperativeness' : e}: '${e}',`).join('\n')}
};

export const ATLAS_NAMES = ${JSON.stringify([...ATLAS_NAMES])} as const;
export type AtlasName = (typeof ATLAS_NAMES)[number];

/** Atlas pixel sizes, in ATLAS_NAMES order. */
export const ATLAS_SIZES: readonly (readonly [number, number])[] = [
${atlases.map((a) => `  [${a.width}, ${a.height}],`).join('\n')}
];

/** [atlas index, x, y, w, h, trim ox, trim oy, canvas w, canvas h, atlas px per art px, foot x, foot y] (atlas px). */
export type FrameTuple = readonly [number, number, number, number, number, number, number, number, number, number, number, number];

export const ATLAS_FRAMES: Readonly<Record<string, FrameTuple>> = {
${lines.join('\n')}
};

/** Clips: frames are \`<clip>.0 .. <clip>.<n-1>\`, each shown for \`ms\`. */
export const ATLAS_ANIMS: Readonly<Record<string, { n: number; ms: number | number[] }>> = {
${anims.join('\n')}
};
`;
}

// --- main ----------------------------------------------------------------------

export function build(): { atlases: AtlasJson[]; bytes: number } {
  const { items, blurs } = collect();
  const prepared = prepare([...items, ...blurs]);
  mkdirSync(OUT, { recursive: true });
  const atlases: AtlasJson[] = [];
  let bytes = 0;
  for (const name of ATLAS_NAMES) {
    const { png, json } = pack(name, prepared.filter((p) => p.item.atlas === name));
    writeFileSync(join(OUT, `${name}.png`), png);
    writeFileSync(join(OUT, `${name}.json`), `${JSON.stringify(json)}\n`);
    atlases.push(json);
    bytes += png.length;
    console.log(`${name}: ${json.width}x${json.height}, ${Object.keys(json.frames).length} frames, ${(png.length / 1024).toFixed(0)} KB`);
  }
  writeFileSync(KEYS_FILE, renderArtKeys(atlases));
  return { atlases, bytes };
}

if (process.argv[1] && /build-quest-atlas/.test(process.argv[1])) {
  const { bytes } = build();
  console.log(`total ${(bytes / 1024 / 1024).toFixed(2)} MB; wrote src/lib/quests/art-keys.ts`);
}
