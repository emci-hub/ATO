/**
 * Streetwear skin asset gate (wired into check:ota-gate like every check:*).
 *
 * The Streetwear art is drawn ONLY from packed sheets (`play-art-pack.ts
 * --skin streetwear`). This fails the gate when:
 *   1. a loose Streetwear frame is require()d into the bundle (only the small
 *      shop / rarity / baked-sword stills may be);
 *   2. a north/south row leaks into a Streetwear sheet (the board draws E/W);
 *   3. the Streetwear sheets + stills exceed the OTA budget;
 *   4. a skin.json role, a hero/tower clip or an effect points at a sheet or
 *      frame that is not packed (it would draw nothing);
 *   5. the art style default is not `cast` (switching is a deliberate choice).
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
const sheetsSrc = fs.readFileSync(path.join(repo, 'src/play/generated-play-sheets.ts'), 'utf8');
const json = sheetsSrc.slice(sheetsSrc.indexOf('{', sheetsSrc.indexOf('PLAY_SHEETS:')), sheetsSrc.indexOf(' as const;'));
const sheets = JSON.parse(json) as Record<string, { sheet: string; frames: Record<string, unknown> }>;
const swSheets = Object.entries(sheets).filter(([k]) => k.startsWith('sheets/streetwear/'));
for (const [key, entry] of swSheets) {
  if (key.endsWith('/rotations') || /\/(fx|auras|swords|ui-kit|board)\//.test(key)) continue;
  const dirs = new Set(Object.keys(entry.frames).map((f) => f.split('/')[0]));
  for (const d of dirs) assert.ok(d === 'east' || d === 'west', `${key} ships a "${d}" row`);
}
ok(`${swSheets.length} Streetwear sheets, every clip sheet east/west only`);

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
    assert.equal(Object.keys(sheet.frames).length, frames * 2, `${char}/${clip}: expected ${frames} frames × E/W`);
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
for (const file of swFiles) bytes += fs.statSync(path.join(repo, 'assets/play', file)).size;
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
const roomPieces = ['hideout', 'underground', 'locker'].map((n) => `room-${n}`);
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
// Every item sticker the art map names is bundled.
const artSrc = fs.readFileSync(path.join(repo, 'src/play/art.ts'), 'utf8');
const stickerBlock = artSrc.slice(artSrc.indexOf('STREET_ICON_BY_ART'), artSrc.indexOf('};', artSrc.indexOf('STREET_ICON_BY_ART')));
for (const [, sticker] of stickerBlock.matchAll(/:\s*'([a-z-]+)'/g)) {
  assert.ok(swKeys.includes(`skins/streetwear/ui/icons/${sticker}`), `sticker ${sticker} is mapped but not bundled`);
}
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

// 5. Default stays cast.
const settings = fs.readFileSync(path.join(repo, 'src/play/play-settings.ts'), 'utf8');
assert.match(settings, /artSkin: 'cast',/, 'defaultSettings().artSkin must stay cast');
const artSkinSrc = fs.readFileSync(path.join(repo, 'src/play/art-skin.ts'), 'utf8');
assert.match(artSkinSrc, /let active: ArtSkinId = 'cast';/, 'the runtime art style starts as cast');
ok('art style defaults to cast (Streetwear is opt-in)');

console.log(`\ncheck:streetwear-assets — ${passed} groups passed.`);
