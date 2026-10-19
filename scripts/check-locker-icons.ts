/**
 * Locker icons (Divecore finish step 7, emci 2026-10-19). Run: npm run check:locker-icons
 *
 * - Every item in `items.json` has its OWN Streetwear icon: 13 items, 13 different pictures, named through
 *   the art library (`ART.icon.items.streetwear.<name>`), never a typed id string or a loose path.
 * - Each live icon is a 32×32 PNG with a transparent corner and the set's warm-white sticker rim.
 * - The two other looks per item are kept in the library (`icons/unused/items/alt`), registered and
 *   unused; there is no player switch (no setting, no save field).
 * - The old shared stand-ins and the Kenney item fallback are gone from `art.ts`; the Locker draws the
 *   icon at 32 pt (one point per source pixel) inside its 34 pt frame.
 * - The save stays v33.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { PNG } from 'pngjs';

import registry from '../assets/art/registry.json';
import { HIDEOUT_SAVE_VERSION } from '../src/play/hideout-progress';
import rawItems from '../src/play/data/items.json';

const repo = resolve(__dirname, '..');
const read = (rel: string) => readFileSync(resolve(repo, rel), 'utf8');
let passed = 0;
const ok = (msg: string) => {
  passed += 1;
  console.log(`  ✓ ${msg}`);
};

type Asset = { id: string; path: string; inUse?: boolean; status?: string; usedBy?: string[]; size?: { w: number; h: number } };
const assets = (registry as unknown as { assets: Asset[] }).assets;
const byId = new Map(assets.map((a) => [a.id, a]));

const itemList = (Array.isArray(rawItems) ? rawItems : Object.values(rawItems)) as unknown as { id: string; core: { art: string; name: string } }[];
const artSrc = read('src/play/art.ts');

// The generated tree requires PNGs (tsx cannot load them), so read its text: `ART.icon.items.streetwear`.
const generated = read('src/art/generated-art.ts');
const treeAt = generated.indexOf('items: {', generated.indexOf('export const ART = {'));
const liveAt = generated.indexOf('streetwear: {', treeAt);
const liveTree: Record<string, string> = {};
for (const m of generated.slice(liveAt, generated.indexOf('}', liveAt)).matchAll(/(\w+): '(icon\.items\.streetwear\.[a-z-]+)'/g)) liveTree[m[1]] = m[2];

// 1. one icon per item, all different, all through ART.icon.items.streetwear.
const mapBlock = artSrc.slice(artSrc.indexOf('ITEM_ICON_ID_BY_ART'), artSrc.indexOf('};', artSrc.indexOf('ITEM_ICON_ID_BY_ART')));
const mapped = new Map<string, string>();
for (const m of mapBlock.matchAll(/(\w+): ART\.icon\.items\.streetwear\.(\w+)/g)) mapped.set(m[1], m[2]);
{
  assert.equal(itemList.length, 13, '13 items in items.json');
  for (const item of itemList) assert.ok(mapped.has(item.core.art), `${item.core.name} (${item.core.art}) has its own icon`);
  assert.equal(mapped.size, 13, 'the map names 13 items');
  assert.equal(new Set(mapped.values()).size, 13, '13 different icons (no shared stand-in)');
  for (const key of mapped.values()) assert.ok(liveTree[key], `ART.icon.items.streetwear.${key} exists in the generated tree`);
  ok('13 items → 13 different icons, all named through ART.icon.items.streetwear');
}

// 2. the live files: 32×32, registered, in use, transparent corner, sticker rim, all different pixels.
{
  const hashes = new Set<string>();
  assert.equal(Object.keys(liveTree).length, 13, '13 live icons in the generated tree');
  for (const [key, id] of Object.entries(liveTree)) {
    const a = byId.get(id);
    assert.ok(a, `${id} is registered`);
    assert.equal(a.inUse, true, `${id} is marked in use`);
    assert.ok(a.usedBy?.includes('src/play/art.ts'), `${id} is used by src/play/art.ts`);
    assert.match(a.path, /^assets\/art\/icons\/in-use\/items\/streetwear\//, `${id} sits in in-use/items/streetwear`);
    const png = PNG.sync.read(readFileSync(resolve(repo, a.path)));
    assert.equal(`${png.width}x${png.height}`, '32x32', `${key} is 32×32`);
    assert.equal(png.data[3], 0, `${key}: the corner is transparent`);
    let rim = 0;
    for (let i = 0; i < png.data.length; i += 4) if (png.data[i + 3] === 255 && png.data[i] === 250 && png.data[i + 1] === 247 && png.data[i + 2] === 235) rim += 1;
    assert.ok(rim >= 40, `${key}: the 1 px warm-white sticker rim is there (${rim} px)`);
    for (let i = 3; i < png.data.length; i += 4) assert.ok(png.data[i] === 0 || png.data[i] === 255, `${key}: alpha is 0 or 255 only`);
    hashes.add(createHash('md5').update(png.data).digest('hex'));
  }
  assert.equal(hashes.size, 13, '13 different pictures');
  ok('live icons: 32×32, registered + in use, sticker rim, hard alpha, 13 different pictures');
}

// 3. the alternates are kept, unused, with no switch.
{
  const alts = assets.filter((a) => /^icon\.items\.[a-z-]+-[bc]$/.test(a.id));
  assert.equal(alts.length, 26, '26 alternates (two per item) are in the library');
  for (const a of alts) {
    assert.equal(a.inUse, false, `${a.id} is unused`);
    assert.match(a.path, /^assets\/art\/icons\/unused\/items\/alt\//, `${a.id} sits in unused/items/alt`);
    assert.ok(a.status !== 'approved', `${a.id} is not approved (only emci approves)`);
  }
  const src = read('src/play/art.ts');
  assert.ok(!/\.(\w+)(B|C)\b/.test(mapBlock), 'no live code reads an alternate');
  assert.ok(!/itemIconStyle|iconLook|icon_look/i.test(src + read('src/play/dress-screen.tsx')), 'no player switch in code');
  ok('26 alternates kept in icons/unused/items/alt, unused, not approved, no player switch');
}

// 4. the old stand-ins and Kenney item fallback are gone; the Locker draws at 32 pt in the 34 pt frame.
{
  assert.ok(!artSrc.includes('STREET_ICON_BY_ART') && !artSrc.includes('ITEM_ICON_BY_ART'), 'the old maps are gone');
  assert.ok(!/artSkin|art-skin/.test(artSrc), 'item icons do not depend on the art skin');
  const itemFn = artSrc.slice(artSrc.indexOf('export function itemArtSource'), artSrc.indexOf('}', artSrc.indexOf('export function itemArtSource')));
  assert.ok(!itemFn.includes('kenney'), 'itemArtSource no longer falls back to Kenney');
  const dress = read('src/play/dress-screen.tsx');
  assert.match(dress, /<NeonIconFrame size=\{34\}/, 'the Locker icon frame is 34 pt');
  assert.match(dress, /itemIconArt: \{\s*width: 32,\s*height: 32,/, 'the icon art is 32 pt (1 pt per source pixel)');
  ok('old stand-ins + Kenney item fallback gone; Locker art 32 pt in the 34 pt frame');
}

// 5. save untouched.
{
  assert.equal(HIDEOUT_SAVE_VERSION, 33, 'save stays v33');
  assert.match(read('src/play/playStore.ts'), /version: 33/, 'play save stays v33');
  ok('save stays v33');
}

console.log(`\ncheck:locker-icons — ${passed} groups passed.`);
