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
const loose = swKeys.filter((k) => !/^skins\/streetwear\/ui\/(rarity|shop|swords\/baked)\//.test(k));
assert.deepEqual(loose, [], `loose Streetwear frames are bundled: ${loose.slice(0, 5).join(', ')}`);
ok(`only ${swKeys.length} small Streetwear stills are bundled by key (no loose frames)`);

// 2 + 4. Sheets: E/W only, and every referenced frame exists.
const sheetsSrc = fs.readFileSync(path.join(repo, 'src/play/generated-play-sheets.ts'), 'utf8');
const json = sheetsSrc.slice(sheetsSrc.indexOf('{', sheetsSrc.indexOf('PLAY_SHEETS:')), sheetsSrc.indexOf(' as const;'));
const sheets = JSON.parse(json) as Record<string, { sheet: string; frames: Record<string, unknown> }>;
const swSheets = Object.entries(sheets).filter(([k]) => k.startsWith('sheets/streetwear/'));
for (const [key, entry] of swSheets) {
  if (key.endsWith('/rotations') || key.includes('/fx/') || key.includes('/auras/')) continue;
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
let bytes = 0;
for (const [, entry] of swSheets) bytes += fs.statSync(path.join(repo, 'assets/play', entry.sheet)).size;
const stills = path.join(repo, 'assets/play/skins/streetwear/ui');
for (const k of swKeys) bytes += fs.statSync(path.join(repo, 'assets/play', `${k}.png`)).size;
assert.ok(fs.existsSync(stills));
assert.ok(bytes <= BUDGET_BYTES, `Streetwear art is ${(bytes / 1048576).toFixed(1)} MB, over the ${BUDGET_BYTES / 1048576} MB budget`);
ok(`Streetwear art ${(bytes / 1048576).toFixed(1)} MB (budget ${BUDGET_BYTES / 1048576} MB)`);

// 5. Default stays cast.
const settings = fs.readFileSync(path.join(repo, 'src/play/play-settings.ts'), 'utf8');
assert.match(settings, /artSkin: 'cast',/, 'defaultSettings().artSkin must stay cast');
const artSkinSrc = fs.readFileSync(path.join(repo, 'src/play/art-skin.ts'), 'utf8');
assert.match(artSkinSrc, /let active: ArtSkinId = 'cast';/, 'the runtime art style starts as cast');
ok('art style defaults to cast (Streetwear is opt-in)');

console.log(`\ncheck:streetwear-assets — ${passed} groups passed.`);
