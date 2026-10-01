/**
 * Shop-hidden check (v27, Part D · T-D5/T-D7). Run: npm run check:shop-hidden
 *
 * The Shop stays hidden until the owner turns it on: the Command Hub shows
 * its tile only with the dev unlock in a pre-launch build, and the Play shell
 * refuses to route to (or render) the Shop otherwise. No purchase code: the
 * Prism Stone is a preview that is never for sale.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { HUB_TILES, hubTilesFor, shopUnlocked } from '../src/play/neon-viper';
import { paidShopRows, tokenShopRows } from '../src/play/shop';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}
const ROOT = path.join(__dirname, '..');
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), 'utf8');

{
  assert.ok(HUB_TILES.some((t) => t.to === 'shop'), 'the Shop tile exists (to hide)');
  for (const pre of [false, true]) {
    assert.ok(!hubTilesFor(false, pre).some((t) => t.to === 'shop'), `no Shop tile without the dev unlock (pre-launch ${pre})`);
  }
  assert.ok(!hubTilesFor(true, false).some((t) => t.to === 'shop'), 'no Shop tile in a release build, even unlocked');
  assert.ok(hubTilesFor(true, true).some((t) => t.to === 'shop'), 'pre-launch + dev unlock shows it');
  assert.deepEqual(
    [shopUnlocked(false, false), shopUnlocked(true, false), shopUnlocked(false, true), shopUnlocked(true, true)],
    [false, false, false, true],
    'shopUnlocked needs both the pre-launch flag and the dev unlock',
  );
  assert.equal(hubTilesFor(false).length, HUB_TILES.length - 1, 'every other tile stays');
}
ok('the Hub shows the Shop tile only with PRE_LAUNCH_DEV and the dev unlock');

{
  const hub = read('src/play/command-hub.tsx');
  assert.ok(hub.includes('hubTilesFor(devUnlocked)'), 'the Hub renders hubTilesFor(devUnlocked)');
  assert.ok(!/HUB_TILES\.map/.test(hub), 'the Hub never maps the raw tile list');
  const shell = read('src/app/play.tsx');
  assert.ok(/to !== 'shop' \|\| shopUnlocked\(devUnlocked\)/.test(shell), 'a Shop tap is ignored when locked');
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
  assert.ok(paidShopRows().every((r) => r.available === false), 'no paid row is for sale');
  assert.ok(read('src/play/shop.ts').includes("available: kind !== 'prism_stone' && entry.available === true"), 'the parser forces the Prism Stone off sale');
  assert.ok(!/(gamble|casino|jackpot|\bbet\b)/i.test(read('src/play/data/shops/paid.json') + read('src/play/data/shops/token.json')), 'no casino words');
  const screen = read('src/play/shop-screen.tsx');
  assert.ok(!/purchase(Paid|Iap)|requestPurchase|StoreKit|expo-in-app|react-native-iap/i.test(screen), 'no purchase code');
  const stone = tokenShopRows().find((r) => r.kind === 'shine_stone');
  assert.ok(stone && stone.weekly_limit === 1, 'the Shine Stone token row has its weekly limit');
}
ok('the Prism Stone is a preview (never for sale); no purchase code; no casino words; the Stone row is one a week');

console.log(`\ncheck:shop-hidden — ${passed} groups passed.`);
