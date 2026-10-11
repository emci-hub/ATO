/**
 * Sprite gallery builder — the "Streetwear Skin" artifact.
 *
 * Packs every character in assets/play/skins/streetwear/ into one sheet per
 * character, copies the stills (map, props, fx, ui, icons), and writes a
 * ready-to-publish page. Nothing here touches the app or its bundle.
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
const SRC = path.join(REPO, 'assets/play/skins/streetwear');
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
  const rows = [{ key: 'rotations', files: ROT.map((r) => path.join(dir, 'rotations', `${r}.png`)) }];
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

function main() {
  fs.rmSync(path.join(OUT, 'img'), { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'img'), { recursive: true });

  const data: {
    heroes: Record<string, Sheet>;
    creeps: Record<string, Sheet>;
    towers: Record<string, Sheet>;
    bosses: Record<string, Sheet>;
    anchor: Sheet;
    splats: Record<string, { sheet: string; n: number }>;
    stills: Record<string, Still[]>;
  } = {
    heroes: {},
    creeps: {},
    towers: {},
    bosses: {},
    anchor: sheetFor(path.join(SRC, '_anchor/street-ninja'), 'anchor'),
    splats: {},
    stills: {},
  };
  for (const h of fs.readdirSync(path.join(SRC, 'heroes'))) {
    data.heroes[h] = sheetFor(path.join(SRC, 'heroes', h), `hero-${h}`);
  }
  for (const c of fs.readdirSync(path.join(SRC, 'creeps'))) {
    data.creeps[c] = sheetFor(path.join(SRC, 'creeps', c), `creep-${c}`);
  }
  for (const t of fs.readdirSync(path.join(SRC, 'towers'))) {
    data.towers[t] = sheetFor(path.join(SRC, 'towers', t), `tower-${t}`);
  }
  for (const b of fs.readdirSync(path.join(SRC, 'boss'))) {
    data.bosses[b] = sheetFor(path.join(SRC, 'boss', b), `boss-${b}`);
  }

  for (const s of ['hit-splat', 'hit-splat-ember', 'hit-splat-tide', 'hit-splat-spark', 'hit-splat-root', 'hit-splat-void']) {
    const fr = pngs(path.join(SRC, 'fx', s)).map(read);
    const sheet = new PNG({ width: fr.length * 64, height: 64 });
    fr.forEach((p, i) => PNG.bitblt(p, sheet, 0, 0, 64, 64, i * 64, 0));
    fs.writeFileSync(path.join(OUT, `img/${s}.png`), PNG.sync.write(sheet));
    data.splats[s] = { sheet: `img/${s}.png`, n: fr.length };
  }

  const copyGroup = (group: string, files: string[]) => {
    data.stills[group] = files.map((f) => {
      const dest = `img/${group}-${path.basename(f)}`;
      fs.copyFileSync(f, path.join(OUT, dest));
      const p = read(f);
      return { src: dest, name: path.basename(f, '.png'), w: p.width, h: p.height };
    });
  };
  const tileNo = (f: string) => Number(/(\d+)\.png$/.exec(f)?.[1] ?? 0);
  copyGroup('map', pngs(path.join(SRC, 'map')));
  copyGroup('road', pngs(path.join(SRC, 'map/road-path')).sort((a, b) => tileNo(a) - tileNo(b)));
  copyGroup('props', pngs(path.join(SRC, 'props')));
  copyGroup('fx', pngs(path.join(SRC, 'fx')));
  copyGroup('ui', pngs(path.join(SRC, 'ui')));
  copyGroup('icons', pngs(path.join(SRC, 'ui/icons')));

  const page = fs
    .readFileSync(path.join(__dirname, 'page.html'), 'utf8')
    .replace('__DATA__', JSON.stringify(data));
  fs.writeFileSync(path.join(OUT, 'streetwear-skin.html'), page);

  const files = fs.readdirSync(path.join(OUT, 'img'));
  const bytes = files.reduce((s, f) => s + fs.statSync(path.join(OUT, 'img', f)).size, 0);
  console.log(`sprite-gallery: ${files.length} images, ${(bytes / 1048576).toFixed(1)}MB -> ${OUT}`);
}

main();
