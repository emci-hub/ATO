/**
 * Streetwear skin asset gate (wired into check:ota-gate like every check:*).
 *
 * The Streetwear art is drawn ONLY from packed sheets (`play-art-pack.ts
 * --skin streetwear`). This fails the gate when:
 *   1. a loose Streetwear frame is require()d into the bundle (only the small
 *      shop / rarity / baked-sword stills may be);
 *   2. a north/south row leaks into a Streetwear sheet that is not hero Walk
 *      (path walkers / towers stay E/W; hero Walk packs N/E/S/W);
 *   3. the Streetwear sheets + stills exceed the OTA budget;
 *   4. a skin.json role, a hero/tower clip or an effect points at a sheet or
 *      frame that is not packed (it would draw nothing);
 *   5. Streetwear is not the only art style (Classic retired 2026-10-12);
 *   6. app.json filters the OTA's assets (`updates.assetPatternsToBeBundled`);
 *   7. the painted Turf War board loses its road/kerb contrast or a pad centre misses the pad art (T3) — on every map
 *      theme, each baked at 512 with all 15 pads (T8).
 *
 * Run: npm run check:streetwear-assets
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repo = path.resolve(__dirname, '..');
const BUDGET_BYTES = 10 * 1024 * 1024;
let passed = 0;
const ok = (msg: string) => {
  passed += 1;
  console.log(`  ✓ ${msg}`);
};

// 1. Nothing loose from Streetwear in the PLAY_ART registry.
const assets = fs.readFileSync(path.join(repo, 'src/play/generated-play-assets.ts'), 'utf8');
const swKeys = [...assets.matchAll(/'(skins\/streetwear\/[^']+)'/g)].map((m) => m[1]);
const loose = swKeys.filter((k) => !/^skins\/streetwear\/ui\/(rarity|shop|icons)\//.test(k));
assert.deepEqual(loose, [], `loose Streetwear frames are bundled: ${loose.slice(0, 5).join(', ')}`);
ok(`only ${swKeys.length} small Streetwear stills are bundled by key (no loose frames)`);

// 2 + 4. Sheets: E/W only, and every referenced frame exists.
function loadPlaySheets(): Record<string, { sheet: string; frames: Record<string, unknown> }> {
  const legacy = path.join(repo, 'assets/art/legacy-play-sheets.json');
  if (fs.existsSync(legacy)) {
    return JSON.parse(fs.readFileSync(legacy, 'utf8')) as Record<string, { sheet: string; frames: Record<string, unknown> }>;
  }
  const sheetsSrc = fs.readFileSync(path.join(repo, 'src/play/generated-play-sheets.ts'), 'utf8');
  const json = sheetsSrc.slice(sheetsSrc.indexOf('{', sheetsSrc.indexOf('PLAY_SHEETS:')), sheetsSrc.indexOf(' as const;'));
  return JSON.parse(json) as Record<string, { sheet: string; frames: Record<string, unknown> }>;
}
const sheets = loadPlaySheets();
const swSheets = Object.entries(sheets).filter(([k]) => k.startsWith('sheets/streetwear/'));
const HERO_WALK = /^sheets\/streetwear\/heroes\/[^/]+\/Walk$/;
const CARDINALS = new Set(['north', 'east', 'south', 'west']);
for (const [key, entry] of swSheets) {
  if (key.endsWith('/rotations') || /\/(fx|hideout-fx|auras|swords|ui-kit|board)\//.test(key)) continue;
  const dirs = new Set(Object.keys(entry.frames).map((f) => f.split('/')[0]));
  if (HERO_WALK.test(key)) {
    for (const d of dirs) assert.ok(CARDINALS.has(d), `${key} ships a "${d}" row`);
  } else {
    for (const d of dirs) assert.ok(d === 'east' || d === 'west', `${key} ships a "${d}" row`);
  }
}
ok(`${swSheets.length} Streetwear sheets, clip sheets E/W (hero Walk may add N/S)`);

const skin = JSON.parse(fs.readFileSync(path.join(repo, 'assets/play/skins/streetwear/skin.json'), 'utf8')) as {
  roles: Record<string, { keys: string[]; walk?: Clip; anims?: Record<string, Clip> }>;
};
type Clip = { order: string[]; frames: number; base: string };
const clipSheet = (base: string) => base.replace(/^skins\/streetwear\/(.+)\/animations\/(.+)$/, 'sheets/streetwear/$1/$2');
for (const [role, def] of Object.entries(skin.roles)) {
  for (const key of def.keys) {
    const m = /^skins\/streetwear\/(.+)\/rotations\/(.+)$/.exec(key);
    assert.ok(m, `${role}: key ${key} is not a Streetwear rotation`);
    assert.ok(sheets[`sheets/streetwear/${m[1]}/rotations`]?.frames[m[2]], `${role}: ${key} not packed`);
  }
  for (const clip of [def.walk, ...Object.values(def.anims ?? {})].filter((c): c is Clip => !!c)) {
    const sheet = sheets[clipSheet(clip.base)];
    assert.ok(sheet, `${role}: clip ${clip.base} not packed`);
    for (const dir of clip.order) {
      for (let f = 0; f < clip.frames; f += 1) {
        assert.ok(sheet.frames[`${dir}/frame_${String(f).padStart(3, '0')}`], `${role}: ${clip.base} ${dir} frame ${f} missing`);
      }
    }
  }
}
ok(`all ${Object.keys(skin.roles).length} skin roles resolve to packed rotations + clips`);

const meta = JSON.parse(fs.readFileSync(path.join(repo, 'assets/play/sheets/streetwear/meta.json'), 'utf8')) as {
  chars: Record<string, { clips: Record<string, number> }>;
  fx: Record<string, { frames: number }>;
  auras: Record<string, { frames: number }>;
};
for (const [char, m] of Object.entries(meta.chars)) {
  for (const [clip, frames] of Object.entries(m.clips)) {
    const sheet = sheets[`sheets/streetwear/${char}/${clip}`];
    assert.ok(sheet, `${char}/${clip} not packed`);
    const dirCount = new Set(Object.keys(sheet.frames).map((f) => f.split('/')[0])).size;
    assert.equal(
      Object.keys(sheet.frames).length,
      frames * dirCount,
      `${char}/${clip}: expected ${frames} frames × ${dirCount} dirs`,
    );
  }
}
for (const [key, m] of Object.entries(meta.fx)) {
  assert.equal(Object.keys(sheets[`sheets/streetwear/fx/${key}`]?.frames ?? {}).length, m.frames, `fx ${key} frames`);
}
for (const [style, m] of Object.entries(meta.auras)) {
  assert.equal(Object.keys(sheets[`sheets/streetwear/auras/${style}/behind`]?.frames ?? {}).length, m.frames, `aura ${style}`);
}
const auraIds = JSON.parse(fs.readFileSync(path.join(repo, 'src/play/data/auras.json'), 'utf8')).styles.map((s: { id: string }) => s.id);
for (const id of auraIds) assert.ok(meta.auras[id], `aura style ${id} has no Streetwear art`);
for (const tower of ['viper', 'ghost', 'lux']) {
  for (const clip of ['Idle', 'Attack']) assert.ok(meta.chars[`towers/${tower}`]?.clips[clip], `tower ${tower} ${clip}`);
}
ok(`meta matches the sheets: ${Object.keys(meta.chars).length} characters, ${Object.keys(meta.fx).length} effects, ${auraIds.length} auras`);

// 3. Budget.
// Clips share atlases, so count each image file once.
const swFiles = new Set(swSheets.map(([, entry]) => entry.sheet));
let bytes = 0;
const sheetFilePath = (file: string) =>
  file.startsWith('art/') ? path.join(repo, 'assets', file) : path.join(repo, 'assets/play', file);
for (const file of swFiles) bytes += fs.statSync(sheetFilePath(file)).size;
for (const k of swKeys) bytes += fs.statSync(path.join(repo, 'assets/play', `${k}.png`)).size;
assert.ok(bytes <= BUDGET_BYTES, `Streetwear art is ${(bytes / 1048576).toFixed(1)} MB, over the ${BUDGET_BYTES / 1048576} MB budget`);
ok(`Streetwear art ${(bytes / 1048576).toFixed(1)} MB (budget ${BUDGET_BYTES / 1048576} MB)`);

// EAS refuses an update with more than 1000 assets. Every require()d image is
// one: the PLAY_ART stills + one per distinct sheet file. Keep headroom for fonts etc.
const sheetFiles = new Set(Object.values(sheets).map((e) => e.sheet)).size;
const stillCount = [...assets.matchAll(/require\(/g)].length;
const MAX_PLAY_IMAGES = 900;
assert.ok(sheetFiles + stillCount <= MAX_PLAY_IMAGES, `${stillCount} stills + ${sheetFiles} sheet files is over ${MAX_PLAY_IMAGES} (EAS caps an update at 1000 assets)`);
ok(`${swFiles.size} Streetwear image files; Play bundles ${stillCount + sheetFiles} images (cap ${MAX_PLAY_IMAGES})`);
const swordTiers = JSON.parse(fs.readFileSync(path.join(repo, 'src/play/data/swords.json'), 'utf8')) as { tiers: string[]; elements: { id: string }[] };
for (const tier of swordTiers.tiers) {
  for (const el of swordTiers.elements) assert.ok(sheets[`sheets/streetwear/swords/${tier}`]?.frames[el.id], `sword ${el.id}-${tier} not packed`);
}

// Menu UI kit: every piece the street chrome draws is packed with its insets.
const uiMeta = (meta as unknown as { ui: Record<string, { inset: number[]; scale: number }> }).ui ?? {};
const shellPieces = ['resbar', 'tabbar', 'sheet', 'sheet-handle', 'toast', 'pause', 'alert', 'portrait'];
const navPieces = ['tab-block', 'tab-turf', 'tab-hideout', 'tab-locker', 'tab-store', 'cur-caps', 'cur-token', 'cur-shine', 'cur-prism', 'settings'].map((n) => `nav-${n}`);
const roomPieces = ['hideout-iso', 'hideout-iso-front', 'hideout-iso-manhole', 'underground', 'locker'].map(
  (n) => `room-${n}`,
);
for (const piece of [
  'panel',
  'header',
  'back',
  'chip-on',
  'chip-off',
  ...['primary', 'secondary', 'danger'].flatMap((v) => [`button-${v}`, `button-${v}-pressed`]),
  ...shellPieces,
  ...navPieces,
  ...roomPieces,
]) {
  assert.ok(uiMeta[piece]?.inset.length === 4 && uiMeta[piece].scale > 0, `ui kit piece ${piece} has no meta`);
  assert.ok(sheets[`sheets/streetwear/ui-kit/${piece}`]?.frames.img, `ui kit piece ${piece} not packed`);
}
// Item icons come from the art library since Divecore finish step 7 (`check:locker-icons` pins them),
// so art.ts no longer names the old shared stickers.
const artSrc = fs.readFileSync(path.join(repo, 'src/play/art.ts'), 'utf8');
assert.ok(!artSrc.includes('STREET_ICON_BY_ART') && !artSrc.includes('skins/streetwear/ui/icons/'), 'art.ts no longer maps item stand-in stickers');
for (const font of ['PixelifySans-Regular.ttf', 'PixelifySans-Bold.ttf', 'OFL-PixelifySans.txt']) {
  assert.ok(fs.existsSync(path.join(repo, 'assets/play/fonts', font)), `font file ${font} missing`);
}
ok(`menu UI kit (${Object.keys(uiMeta).length} pieces), item stickers and Pixelify Sans are in place`);

// Turf War boards: one baked 512×512 picture per map, pads counted from board-data.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { BOARD_MAPS } = require('../src/play/board-data') as typeof import('../src/play/board-data');
const boardsMeta = (meta as unknown as { boards: Record<string, { pads: number }> }).boards ?? {};
for (const map of Object.values(BOARD_MAPS)) {
  const frame = sheets[`sheets/streetwear/board/${map.id}`]?.frames.img as { w: number; h: number } | undefined;
  assert.ok(frame && frame.w === 512 && frame.h === 512, `board ${map.id} is not baked at 512×512`);
  assert.equal(boardsMeta[map.id]?.pads, map.pads.length, `board ${map.id}: baked pads differ from board-data`);
}
ok(`${Object.keys(BOARD_MAPS).length} Turf War boards baked, pads match board-data`);

// T8 map themes: every theme is its own baked 512×512 painting of the ato board, with the same 15 pads.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { TURF_THEME_IDS, turfBoardArtId } = require('../src/play/turf-theme') as typeof import('../src/play/turf-theme');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { TURF_THEMES } = require('./turf-board-art') as typeof import('./turf-board-art');
for (const theme of TURF_THEME_IDS) {
  const id = turfBoardArtId('ato', theme);
  const frame = sheets[`sheets/streetwear/board/${id}`]?.frames.img as { w: number; h: number } | undefined;
  assert.ok(frame && frame.w === 512 && frame.h === 512, `theme ${theme}: board ${id} is not baked at 512×512`);
  assert.equal(boardsMeta[id]?.pads, BOARD_MAPS.ato.pads.length, `theme ${theme}: board ${id} baked pads differ from board-data`);
}
ok(`${TURF_THEME_IDS.length} Turf War themes baked, ${BOARD_MAPS.ato.pads.length} pads each`);

// Turf War T3 pixel test, on every theme (T8): the road reads darker than the kerb, and every pad centre lands on that
// theme's pad art (a pad tap always hits a drawn cover).
for (const theme of TURF_THEME_IDS) {
  const id = turfBoardArtId('ato', theme);
  const padName = TURF_THEMES[theme].pad;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PNG } = require('pngjs') as typeof import('pngjs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { TILE } = require('../src/play/board-data') as typeof import('../src/play/board-data');
  const ato = BOARD_MAPS.ato;
  const entry = sheets[`sheets/streetwear/board/${id}`] as unknown as { sheet: string; frames: { img: { x: number; y: number } } };
  const atlas = PNG.sync.read(fs.readFileSync(path.join(repo, 'assets/play', entry.sheet)));
  const { x: ox, y: oy } = entry.frames.img;
  const px = (x: number, y: number) => {
    const i = ((oy + y) * atlas.width + ox + x) * 4;
    return [atlas.data[i]!, atlas.data[i + 1]!, atlas.data[i + 2]!] as const;
  };
  const luma = ([r, g, b]: readonly [number, number, number]) => 0.299 * r + 0.587 * g + 0.114 * b;
  const N = ato.grid.length;
  const road = (c: number, r: number) => r >= 0 && c >= 0 && r < N && c < N && (ato.grid[r]![c] === TILE.PATH || ato.grid[r]![c] === TILE.START);
  const cellLuma = (c: number, r: number) => {
    let s = 0;
    for (let y = r * 32 + 8; y < r * 32 + 24; y += 1) for (let x = c * 32 + 8; x < c * 32 + 24; x += 1) s += luma(px(x, y));
    return s / 256;
  };
  const roadL: number[] = [];
  const kerbL: number[] = [];
  for (let r = 0; r < N; r += 1) {
    for (let c = 0; c < N; c += 1) {
      if (road(c, r)) roadL.push(cellLuma(c, r));
      else if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => road(c + dx!, r + dy!))) kerbL.push(cellLuma(c, r));
    }
  }
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const CONTRAST_FLOOR = 30;
  assert.ok(mean(kerbL) - mean(roadL) >= CONTRAST_FLOOR, `${id} board: road (${mean(roadL).toFixed(1)}) is not ${CONTRAST_FLOOR} luma darker than the kerb (${mean(kerbL).toFixed(1)})`);
  const lightRoad = roadL.filter((l) => l >= mean(kerbL) - 10).length;
  assert.equal(lightRoad, 0, `${id} board: ${lightRoad} road cell(s) are nearly as light as the kerb`);
  // Pad centres: the 17×17 px around each centre matches the pad cover (art-src raw, trimmed) within a small tolerance.
  assert.ok(!padName.startsWith('theme:'), `${id}: pixel test expects a library pad`);
  const padArt = PNG.sync.read(fs.readFileSync(path.join(repo, `art-src/pixellab/streetwear-pack/migrated/raw/props/${padName}.png`)));
  let bx0 = padArt.width;
  let by0 = padArt.height;
  let bx1 = 0;
  let by1 = 0;
  for (let y = 0; y < padArt.height; y += 1) {
    for (let x = 0; x < padArt.width; x += 1) {
      if (padArt.data[(y * padArt.width + x) * 4 + 3]! > 8) [bx0, by0, bx1, by1] = [Math.min(bx0, x), Math.min(by0, y), Math.max(bx1, x), Math.max(by1, y)];
    }
  }
  const pw = bx1 - bx0 + 1;
  const ph = by1 - by0 + 1;
  for (const pad of ato.pads) {
    const left = Math.round(pad.x * 5.12 - pw / 2);
    const top = Math.round(pad.y * 5.12 - ph / 2);
    let hit = 0;
    let n = 0;
    for (let dy = -8; dy <= 8; dy += 1) {
      for (let dx = -8; dx <= 8; dx += 1) {
        const bx = Math.round(pad.x * 5.12) + dx;
        const by = Math.round(pad.y * 5.12) + dy;
        const ai = ((by - top + by0) * padArt.width + (bx - left + bx0)) * 4;
        if (padArt.data[ai + 3]! < 250) continue;
        const b = px(bx, by);
        n += 1;
        if (Math.abs(b[0] - padArt.data[ai]!) + Math.abs(b[1] - padArt.data[ai + 1]!) + Math.abs(b[2] - padArt.data[ai + 2]!) <= 30) hit += 1;
      }
    }
    assert.ok(n > 200 && hit / n >= 0.9, `${id} board: pad (${pad.x}, ${pad.y}) centre is not on the pad art (${hit}/${n} px match)`);
  }
  ok(`${id} board pixels: road ${mean(roadL).toFixed(0)} vs kerb ${mean(kerbL).toFixed(0)} luma (floor ${CONTRAST_FLOOR}), all ${ato.pads.length} pad centres on pad art`);
}

// 5. Classic retired (emci 2026-10-12): Streetwear is the only look, in every build.
const settings = fs.readFileSync(path.join(repo, 'src/play/play-settings.ts'), 'utf8');
assert.match(settings, /artSkin: 'streetwear',/, 'defaultSettings().artSkin is streetwear');
const artSkinSrc = fs.readFileSync(path.join(repo, 'src/play/art-skin.ts'), 'utf8');
assert.match(artSkinSrc, /export const ART_SKINS: readonly ArtSkinId\[\] = \['streetwear'\];/, 'streetwear is the only art style');
assert.match(artSkinSrc, /const active: ArtSkinId = 'streetwear';/, 'the runtime art style is streetwear');
assert.doesNotMatch(artSkinSrc, /PRE_LAUNCH_DEV/, 'Streetwear is not gated to pre-launch builds');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { parseSettings } = require('../src/play/play-settings') as typeof import('../src/play/play-settings');
assert.equal(parseSettings({ artSkin: 'cast' }, null).artSkin, 'streetwear', 'an old Classic save loads as streetwear');
ok('Classic retired: Streetwear is the only art style, old Classic saves load as Streetwear');

// 6. The OTA ships every image and font. `updates.assetPatternsToBeBundled` filters the
// export: on Windows it matched nothing and OTA 9089184e went out with zero assets (no art,
// no Pixelify). It also left out assets/play/sheets. Keep it out of app.json.
const appJson = JSON.parse(fs.readFileSync(path.join(repo, 'app.json'), 'utf8')) as { expo: { updates?: Record<string, unknown> } };
assert.equal(appJson.expo.updates?.assetPatternsToBeBundled, undefined, 'app.json must not set updates.assetPatternsToBeBundled (it drops OTA assets)');
ok('app.json does not filter OTA assets');

console.log(`\ncheck:streetwear-assets — ${passed} groups passed.`);
