/**
 * Shop-hidden check (v27, Part D · T-D5/T-D7). Run: npm run check:shop-hidden
 *
 * Pre-launch (`PLAY_EVERYTHING_FREE`): the Shop tile is on the Hub for
 * everyone. A release build still hides it. The Play shell refuses a locked
 * Shop tap. No purchase code: the Prism Stone is a preview that is never for sale.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { HUB_TILES, hubTilesFor, shopUnlocked } from '../src/play/neon-viper';
import { paidShopRows, tideShopRows, tokenShopRows } from '../src/play/shop';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}
const ROOT = path.join(__dirname, '..');
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), 'utf8');

{
  assert.ok(HUB_TILES.some((t) => t.to === 'shop'), 'the Shop tile exists');
  assert.deepEqual(
    HUB_TILES.map((t) => t.to),
    ['pet', 'dive', 'defend', 'shop', 'dress', 'about'],
    'Hub order is Pet · Dive · Defend · Shop · Dress · More',
  );
  assert.equal(HUB_TILES.find((t) => t.to === 'pet')?.subtitle, 'Tend', 'Pet is tend only');
  assert.equal(HUB_TILES.find((t) => t.to === 'dive')?.subtitle, 'Underwater', 'Dive is the underwater tile');
  assert.ok(HUB_TILES.some((t) => t.label === 'Defend' && t.subtitle === 'Tower map' && t.to === 'defend'), 'Defend is the tower tile');
  assert.ok(!HUB_TILES.some((t) => t.label === 'Divecore'), 'Divecore is not a tile name');
  assert.ok(!HUB_TILES.some((t) => t.to === 'pet' && t.subtitle.includes('Dive')), 'Pet does not list Dive');
  assert.ok(hubTilesFor(false, true).some((t) => t.to === 'shop'), 'pre-launch shows Shop without the dev unlock');
  assert.ok(hubTilesFor(true, true).some((t) => t.to === 'shop'), 'pre-launch + unlock still shows Shop');
  assert.ok(!hubTilesFor(false, false).some((t) => t.to === 'shop'), 'a release build hides Shop');
  assert.ok(!hubTilesFor(true, false).some((t) => t.to === 'shop'), 'a release build hides Shop even if unlocked');
  assert.deepEqual(
    [shopUnlocked(false, false), shopUnlocked(true, false), shopUnlocked(false, true), shopUnlocked(true, true)],
    [false, false, true, true],
    'shopUnlocked follows PLAY_EVERYTHING_FREE, not the dev unlock',
  );
  assert.equal(hubTilesFor(false).length, HUB_TILES.length, 'the pre-launch default shows every tile, including Shop');
}
ok('pre-launch shows the Shop tile for everyone; a release build still hides it');

{
  const hub = read('src/play/command-hub.tsx');
  assert.ok(hub.includes('hubTilesFor(devUnlocked)'), 'the Hub renders hubTilesFor(devUnlocked)');
  assert.ok(!/HUB_TILES\.map/.test(hub), 'the Hub never maps the raw tile list');
  const shell = read('src/app/play.tsx');
  assert.ok(/to === 'shop' && !shopUnlocked\(devUnlocked\)/.test(shell), 'a Shop tap is ignored when locked');
  assert.ok(/mode === 'shop' && view && shopUnlocked\(devUnlocked\)/.test(shell), 'the Shop screen renders only when unlocked');
  assert.equal((shell.match(/<ShopScreen\b/g) ?? []).length, 1, 'one Shop render, the guarded one');
  assert.ok(!/setMode\('shop'\)/.test(shell), 'nothing routes straight to the Shop');
  const others = fs
    .readdirSync(path.join(ROOT, 'src/play'))
    .filter((f) => f.endsWith('.tsx') && f !== 'shop-screen.tsx')
    .filter((f) => read(`src/play/${f}`).includes('<ShopScreen'));
  assert.deepEqual(others, [], 'no other screen renders the Shop');
}
ok('the Play shell ignores a locked Shop tap and only renders the Shop when unlocked; nothing else reaches it');

{
  const prism = paidShopRows().filter((r) => r.kind === 'prism_stone');
  assert.equal(prism.length, 1, 'one Prism Stone preview');
  assert.equal(prism[0].available, false, 'never for sale');
  const pass = paidShopRows().filter((r) => r.kind === 'pass');
  assert.equal(pass.length, 1, 'one Tide Pass card');
  assert.equal(pass[0].available, false, 'the pass card is not for sale');
  assert.ok(paidShopRows().every((r) => r.available === false), 'no paid row is for sale');
  assert.ok(
    read('src/play/shop.ts').includes("available: kind !== 'prism_stone' && kind !== 'pass' && entry.available === true"),
    'the parser forces the Prism Stone and the Tide Pass off sale',
  );
  assert.ok(!/(gamble|casino|jackpot|\bbet\b)/i.test(read('src/play/data/shops/paid.json') + read('src/play/data/shops/token.json')), 'no casino words');
  const screen = read('src/play/shop-screen.tsx');
  assert.ok(!/purchase(Paid|Iap)|requestPurchase|StoreKit|expo-in-app|react-native-iap/i.test(screen), 'no purchase code');
  assert.ok(screen.includes('Tide shelf') && screen.includes('Tide Pass only'), 'the Tide shelf is visible and locked with neutral copy');
  assert.equal((screen.match(/<ShopScreen\b/g) ?? []).length, 0, 'the Shop screen file does not render itself');
  const tide = tideShopRows();
  assert.ok(tide.length >= 2 && tide.every((r) => r.pass_only), 'Tide shelf rows are pass-only');
  assert.ok(tokenShopRows().every((r) => !r.pass_only), 'the token shelf hides pass-only rows');
  const stone = tokenShopRows().find((r) => r.kind === 'shine_stone');
  assert.ok(stone && stone.weekly_limit === 1, 'the Shine Stone token row has its weekly limit');
}
ok('the Prism Stone and Tide Pass are previews (never for sale); the Tide shelf is inside the guarded Shop; no purchase code; no casino words');

console.log(`\ncheck:shop-hidden — ${passed} groups passed.`);
