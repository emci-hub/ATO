/**
 * Sprite gallery builder — the "Streetwear Skin" artifact.
 *
 * Packs every character (heroes, creeps, towers, bosses) into one sheet per
 * character from art-src/pixellab/<kind>.<slug>.streetwear/migrated/raw, copies
 * whichever stills of the old assets/play/skins/streetwear/ tree still exist
 * (map, props, fx, ui, icons), and writes a ready-to-publish page. Nothing here touches the app or its bundle.
 *
 * Usage: npx tsx scripts/sprite-gallery/build.ts [outDir]
 *   outDir defaults to <os tmp>/ato-sprite-gallery
 * Then publish <outDir>/streetwear-skin.html with every file in <outDir>/img
 * to the SAME artifact URL (see scripts/sprite-gallery/README.md).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PNG } from 'pngjs';

const REPO = path.resolve(__dirname, '..', '..');
// Old tree: only still groups (map, props, fx, ui, icons, shop, auras) may remain here; each is skipped when absent.
const SRC = path.join(REPO, 'assets/play/skins/streetwear');
const PIXELLAB = path.join(REPO, 'art-src/pixellab');
/** Raw frames of one character: <kind>.<slug>.streetwear/migrated/raw (kind: hero|creep|tower|boss). */
const rawDir = (kind: string, slug: string) => path.join(PIXELLAB, `${kind}.${slug}.streetwear`, 'migrated', 'raw');
const slugsOf = (kind: string) =>
  fs
    .readdirSync(PIXELLAB)
    .filter((d) => d.startsWith(`${kind}.`) && d.endsWith('.streetwear'))
    .map((d) => d.slice(kind.length + 1, -'.streetwear'.length))
    .filter((slug) => fs.existsSync(rawDir(kind, slug)))
    .sort();
const OUT = path.resolve(process.argv[2] ?? path.join(os.tmpdir(), 'ato-sprite-gallery'));

const ROT = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];
const CLIPS = ['Idle', 'Walk', 'Run', 'Dash', 'Attack', 'Skill', 'Hurt', 'Death'];
const FACES = ['east', 'west', 'north', 'south'];

type Row = { key: string; row: number; n: number };
type Sheet = { sheet: string; cell: number; rows: Row[] };
type Still = { src: string; name: string; w: number; h: number };

const read = (f: string) => PNG.sync.read(fs.readFileSync(f));
const pngs = (d: string) =>
  fs
    .readdirSync(d)
    .filter((f) => f.endsWith('.png'))
    .sort()
    .map((f) => path.join(d, f));

function sheetFor(dir: string, name: string): Sheet {
  const rows = [{ key: 'rotations', files: ROT.map((r) => path.join(dir, 'rotations', `${r}.png`)).filter((f) => fs.existsSync(f)) }];
  for (const c of CLIPS) {
    for (const f of FACES) {
      const d = path.join(dir, 'animations', c, f);
      if (fs.existsSync(d)) rows.push({ key: `${c}/${f}`, files: pngs(d) });
    }
  }
  const imgs = rows.map((r) => r.files.map(read));
  const W = imgs[0][0].width;
  const H = imgs[0][0].height;
  const cols = Math.max(...imgs.map((r) => r.length));
  const sheet = new PNG({ width: cols * W, height: rows.length * H });
  imgs.forEach((r, ri) => r.forEach((p, ci) => PNG.bitblt(p, sheet, 0, 0, W, H, ci * W, ri * H)));
  const file = `img/${name}.png`;
  fs.writeFileSync(path.join(OUT, file), PNG.sync.write(sheet, { deflateLevel: 9 }));
  return { sheet: file, cell: W, rows: rows.map((r, i) => ({ key: r.key, row: i, n: r.files.length })) };
}

// ---- effects, auras, shop (PixelLab VFX exports) ----
type Strip = { sheet: string; n: number; w: number; h: number };
const ELEMENT_RAMPS: Record<string, string[]> = {
  ember: ['#3a0d05', '#C8202B', '#FB923C', '#FFE29A', '#ffffff'],
  tide: ['#0a1f3d', '#1d5fa8', '#38BDF8', '#B8ECFF', '#ffffff'],
  root: ['#0b2a1a', '#1f7a4a', '#34D399', '#C2F5D9', '#ffffff'],
  spark: ['#3a2a00', '#b8860b', '#FACC15', '#FFF4A8', '#ffffff'],
  void: ['#1a0b2e', '#4c1d95', '#8b5cf6', '#c4b5fd', '#ffffff'],
};

/** Frames of a VFX export: TexturePacker-style `<kind>.json` or a game-pack `manifest.json` clip. */
function vfxFrames(png: string, meta: string, clip?: string): { frames: PNG[]; anchor?: { x: number; y: number } } {
  const sheet = read(png);
  const j = JSON.parse(fs.readFileSync(meta, 'utf8'));
  const cut = (x: number, y: number, w: number, h: number) => {
    const p = new PNG({ width: w, height: h });
    PNG.bitblt(sheet, p, x, y, w, h, 0, 0);
    return p;
  };
  if (Array.isArray(j.frames)) return { frames: j.frames.map((f: { frame: { x: number; y: number; w: number; h: number } }) => cut(f.frame.x, f.frame.y, f.frame.w, f.frame.h)) };
  const c = clip ? j.clips.find((k: { name: string }) => k.name === clip) : j.clips[0];
  if (!c) throw new Error(`${meta}: no clip ${clip}`);
  const s = c.sheets[0];
  const frames: PNG[] = [];
  for (let i = 0; i < c.frames; i++) frames.push(cut((i % s.columns) * c.frame.w, Math.floor(i / s.columns) * c.frame.h, c.frame.w, c.frame.h));
  return { frames, anchor: c.offset };
}

function writeStrip(frames: PNG[], name: string): Strip {
  const w = Math.max(...frames.map((f) => f.width));
  const h = Math.max(...frames.map((f) => f.height));
  const out = new PNG({ width: w * frames.length, height: h });
  frames.forEach((f, i) => PNG.bitblt(f, out, 0, 0, f.width, f.height, i * w + ((w - f.width) >> 1), (h - f.height) >> 1));
  const file = `img/${name}.png`;
  fs.writeFileSync(path.join(OUT, file), PNG.sync.write(out, { deflateLevel: 9 }));
  return { sheet: file, n: frames.length, w, h };
}

/** Stepped greyscale → ramp palette map (same as the runtime recolour). Outline (< 28) kept. */
function gradMap(src: PNG, ramp: string[]): PNG {
  const rgb = ramp.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
  const p = new PNG({ width: src.width, height: src.height });
  src.data.copy(p.data);
  for (let i = 0; i < p.data.length; i += 4) {
    if (!p.data[i + 3]) continue;
    const L = 0.299 * p.data[i] + 0.587 * p.data[i + 1] + 0.114 * p.data[i + 2];
    if (L < 28) continue;
    const k = Math.min(rgb.length - 1, Math.round(((L - 28) / 227) * (rgb.length - 1)));
    [p.data[i], p.data[i + 1], p.data[i + 2]] = rgb[k];
  }
  return p;
}

/** Alpha-over `top` onto `base` at (x, y), optional integer upscale. */
function over(base: PNG, top: PNG, x: number, y: number, scale = 1) {
  for (let ty = 0; ty < top.height * scale; ty++) for (let tx = 0; tx < top.width * scale; tx++) {
    const bx = x + tx, by = y + ty;
    if (bx < 0 || by < 0 || bx >= base.width || by >= base.height) continue;
    const s = (((ty / scale) | 0) * top.width + ((tx / scale) | 0)) * 4, t = (by * base.width + bx) * 4;
    const a = top.data[s + 3] / 255;
    if (!a) continue;
    for (let c = 0; c < 3; c++) base.data[t + c] = Math.round(top.data[s + c] * a + base.data[t + c] * (1 - a));
    base.data[t + 3] = Math.max(base.data[t + 3], top.data[s + 3]);
  }
}

function buildEffects() {
  const dir = path.join(SRC, 'fx/elements');
  const effects: Record<string, Record<string, Strip>> = {};
  if (!fs.existsSync(dir)) return effects;
  for (const el of fs.readdirSync(dir)) {
    if (!fs.statSync(path.join(dir, el)).isDirectory()) continue;
    effects[el] = {};
    for (const kind of ['shot', 'hit', 'burst', 'status', 'slash']) {
      const png = path.join(dir, el, `${kind}.png`);
      const meta = [`${kind}.json`, `${kind}.manifest.json`].map((m) => path.join(dir, el, m)).find((m) => fs.existsSync(m));
      if (fs.existsSync(png) && meta) effects[el][kind] = writeStrip(vfxFrames(png, meta).frames, `fx-${el}-${kind}`);
    }
  }
  return effects;
}

/** Each aura style in each element colour, composited behind/in front of a sample sprite. */
function buildAuras() {
  const dir = path.join(SRC, 'fx/auras');
  const auras: Record<string, Record<string, Strip>> = {};
  if (!fs.existsSync(dir)) return auras;
  const sample = read(path.join(SRC, 'creeps/village-girl/rotations/east.png'));
  let sx0 = 1e9, sx1 = -1, sy1 = -1;
  for (let y = 0; y < sample.height; y++) for (let x = 0; x < sample.width; x++) if (sample.data[(y * sample.width + x) * 4 + 3]) {
    sx0 = Math.min(sx0, x); sx1 = Math.max(sx1, x); sy1 = Math.max(sy1, y);
  }
  const feet = { x: Math.round((sx0 + sx1) / 2), y: sy1 + 1 };
  for (const style of fs.readdirSync(dir)) {
    const meta = path.join(dir, style, 'manifest.json');
    if (!fs.existsSync(meta)) continue;
    const back = vfxFrames(path.join(dir, style, 'behind.png'), meta, 'behind');
    const front = fs.existsSync(path.join(dir, style, 'front.png')) ? vfxFrames(path.join(dir, style, 'front.png'), meta, 'front') : null;
    const C = 112, ax = C / 2, ay = C - 14; // anchor (feet) on the preview canvas
    auras[style] = {};
    for (const [el, ramp] of Object.entries(ELEMENT_RAMPS)) {
      const frames = back.frames.map((b, i) => {
        const f = new PNG({ width: C, height: C });
        over(f, gradMap(b, ramp), ax + back.anchor!.x, ay + back.anchor!.y);
        over(f, sample, ax - feet.x, ay - feet.y);
        if (front) over(f, gradMap(front.frames[i % front.frames.length], ramp), ax + front.anchor!.x, ay + front.anchor!.y);
        return f;
      });
      auras[style][el] = writeStrip(frames, `aura-${style}-${el}`);
    }
  }
  return auras;
}

/** Finished shop cards (tier frame + element-coloured sword + tier gem) and the raw icons. */
function buildShop() {
  const ui = path.join(SRC, 'ui');
  const canCard = fs.existsSync(path.join(ui, 'rarity')) && fs.existsSync(path.join(ui, 'swords'));
  const tiers: [string, string][] = canCard ? [['common', 'ember'], ['rare', 'tide'], ['epic', 'root'], ['legendary', 'spark'], ['divine', 'void']] : [];
  const cards = tiers.map(([tier, el]) => {
    const frame = read(path.join(ui, `rarity/frame-${tier}.png`));
    const card = new PNG({ width: frame.width, height: frame.height });
    frame.data.copy(card.data);
    const sword = gradMap(read(path.join(ui, `swords/sword-${tier}.png`)), ELEMENT_RAMPS[el]);
    over(card, sword, (card.width - sword.width * 2) >> 1, ((card.height - sword.height * 2) >> 1) + 8, 2);
    const gem = read(path.join(ui, `rarity/gem-${tier}.png`));
    over(card, gem, (card.width - gem.width) >> 1, -6);
    const src = `img/card-${tier}.png`;
    fs.writeFileSync(path.join(OUT, src), PNG.sync.write(card));
    return { src, name: `${tier} · ${el} sword`, w: card.width, h: card.height };
  });
  const icons: Still[] = [];
  for (const sub of ['swords', 'shop', 'rarity']) {
    if (!fs.existsSync(path.join(ui, sub))) continue;
    for (const f of pngs(path.join(ui, sub)).filter((f) => !/frame-base|shine/.test(f))) {
      const dest = `img/shop-${sub}-${path.basename(f)}`;
      fs.copyFileSync(f, path.join(OUT, dest));
      const p = read(f);
      icons.push({ src: dest, name: `${sub}/${path.basename(f, '.png')}`, w: p.width, h: p.height });
    }
  }
  return { cards, icons };
}

/** Menu UI kit pieces, cut back out of the packed atlas (what the game draws). */
function buildMenu() {
  type Piece = { src: string; w: number; h: number; inset: number[]; scale: number };
  const sheetDir = path.join(SRC, '../../sheets/streetwear/ui-kit');
  const metaFile = path.join(SRC, '../../sheets/streetwear/meta.json');
  if (!fs.existsSync(path.join(sheetDir, 'sheets.json'))) return {} as Record<string, Piece>;
  const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8')).ui as Record<string, { inset: number[]; scale: number }>;
  const manifest = JSON.parse(fs.readFileSync(path.join(sheetDir, 'sheets.json'), 'utf8')) as Record<
    string,
    { sheet: string; frames: { img: { x: number; y: number; w: number; h: number } } }
  >;
  const out: Record<string, Piece> = {};
  for (const [key, entry] of Object.entries(manifest)) {
    const name = key.split('/').pop()!;
    const atlas = read(path.join(SRC, '../..', entry.sheet));
    const r = entry.frames.img;
    const piece = new PNG({ width: r.w, height: r.h });
    PNG.bitblt(atlas, piece, r.x, r.y, r.w, r.h, 0, 0);
    const src = `img/ui-${name}.png`;
    fs.writeFileSync(path.join(OUT, src), PNG.sync.write(piece));
    out[name] = { src, w: r.w, h: r.h, inset: meta[name]?.inset ?? [0, 0, 0, 0], scale: meta[name]?.scale ?? 1 };
  }
  return out;
}

function main() {
  fs.rmSync(path.join(OUT, 'img'), { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'img'), { recursive: true });

  const data: {
    heroes: Record<string, Sheet>;
    creeps: Record<string, Sheet>;
    towers: Record<string, Sheet>;
    bosses: Record<string, Sheet>;
    anchor: Sheet | null;
    effects: Record<string, Record<string, Strip>>;
    auras: Record<string, Record<string, Strip>>;
    shop: { cards: Still[]; icons: Still[] };
    menu: ReturnType<typeof buildMenu>;
    splats: Record<string, { sheet: string; n: number }>;
    stills: Record<string, Still[]>;
  } = {
    heroes: {},
    creeps: {},
    towers: {},
    bosses: {},
    anchor: fs.existsSync(path.join(SRC, '_anchor/street-ninja')) ? sheetFor(path.join(SRC, '_anchor/street-ninja'), 'anchor') : null,
    effects: buildEffects(),
    auras: buildAuras(),
    shop: buildShop(),
    menu: buildMenu(),
    splats: {},
    stills: {},
  };
  for (const h of slugsOf('hero')) data.heroes[h] = sheetFor(rawDir('hero', h), `hero-${h}`);
  for (const c of slugsOf('creep')) data.creeps[c] = sheetFor(rawDir('creep', c), `creep-${c}`);
  for (const t of slugsOf('tower')) data.towers[t] = sheetFor(rawDir('tower', t), `tower-${t}`);
  for (const b of slugsOf('boss')) data.bosses[b] = sheetFor(rawDir('boss', b), `boss-${b}`);

  for (const s of ['hit-splat', 'hit-splat-ember', 'hit-splat-tide', 'hit-splat-spark', 'hit-splat-root', 'hit-splat-void']) {
    if (!fs.existsSync(path.join(SRC, 'fx', s))) continue;
    const fr = pngs(path.join(SRC, 'fx', s)).map(read);
    const sheet = new PNG({ width: fr.length * 64, height: 64 });
    fr.forEach((p, i) => PNG.bitblt(p, sheet, 0, 0, 64, 64, i * 64, 0));
    fs.writeFileSync(path.join(OUT, `img/${s}.png`), PNG.sync.write(sheet));
    data.splats[s] = { sheet: `img/${s}.png`, n: fr.length };
  }

  const copyGroup = (group: string, dir: string, sort?: (a: string, b: string) => number) => {
    const files = fs.existsSync(dir) ? pngs(dir) : [];
    if (sort) files.sort(sort);
    data.stills[group] = files.map((f) => {
      const dest = `img/${group}-${path.basename(f)}`;
      fs.copyFileSync(f, path.join(OUT, dest));
      const p = read(f);
      return { src: dest, name: path.basename(f, '.png'), w: p.width, h: p.height };
    });
  };
  const tileNo = (f: string) => Number(/(\d+)\.png$/.exec(f)?.[1] ?? 0);
  copyGroup('map', path.join(SRC, 'map'));
  copyGroup('road', path.join(SRC, 'map/road-path'), (a, b) => tileNo(a) - tileNo(b));
  copyGroup('props', path.join(SRC, 'props'));
  copyGroup('fx', path.join(SRC, 'fx'));
  copyGroup('ui', path.join(SRC, 'ui'));
  copyGroup('icons', path.join(SRC, 'ui/icons'));

  const page = fs
    .readFileSync(path.join(__dirname, 'page.html'), 'utf8')
    .replace('__DATA__', JSON.stringify(data));
  fs.writeFileSync(path.join(OUT, 'streetwear-skin.html'), page);

  const files = fs.readdirSync(path.join(OUT, 'img'));
  const bytes = files.reduce((s, f) => s + fs.statSync(path.join(OUT, 'img', f)).size, 0);
  console.log(`sprite-gallery: ${files.length} images, ${(bytes / 1048576).toFixed(1)}MB -> ${OUT}`);
}

main();
