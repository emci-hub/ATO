/**
 * Shop check (v27 Part D, updated Divecore finish step 3, emci 2026-10-18). Run: npm run check:shop-hidden
 *
 * The Store is open to players, but only its Token shop tab: real, priced rows (no "Coming soon" stubs). The Tide
 * shelf, the Paid shop (price labels, nothing for sale) and the stubs stay behind the dev unlock in a pre-launch
 * build (`shopUnlocked`). No purchase code: the Prism Stone and Tide Pass are previews that are never for sale.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { HUB_TILES, hubTilesFor, shopUnlocked, storeOpen } from '../src/play/neon-viper';
import { paidShopRows, storeTabsFor, storeTokenRows, tideShopRows, tokenShopRows } from '../src/play/shop';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}
const ROOT = path.join(__dirname, '..');
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), 'utf8');

{
  assert.ok(HUB_TILES.some((t) => t.to === 'shop'), 'the Shop tile exists');
  for (const dev of [false, true]) {
    for (const pre of [false, true]) {
      assert.ok(hubTilesFor(dev, pre).some((t) => t.to === 'shop'), `the Shop tile is open to everyone (dev ${dev}, pre-launch ${pre})`);
    }
  }
  assert.equal(storeOpen(), true, 'the Store is open');
  assert.deepEqual(
    [shopUnlocked(false, false), shopUnlocked(true, false), shopUnlocked(false, true), shopUnlocked(true, true)],
    [false, false, false, true],
    'the FULL shop needs both the pre-launch flag and the dev unlock',
  );
  assert.equal(hubTilesFor(false).length, HUB_TILES.length, 'every tile shows');
}
ok('the Store is open to players; the full shop (Tide shelf, Paid shop, stubs) needs PRE_LAUNCH_DEV and the dev unlock');

{
  const hub = read('src/play/command-hub.tsx');
  assert.ok(hub.includes('hubTilesFor(devUnlocked)'), 'the Hub renders hubTilesFor(devUnlocked)');
  assert.ok(!/HUB_TILES\.map/.test(hub), 'the Hub never maps the raw tile list');
  const shell = read('src/app/play.tsx');
  assert.ok(shell.includes('showStore={storeOpen()}'), 'the tab bar shows the Store');
  assert.ok(/mode === 'shop' && view \?/.test(shell), 'the Store renders for a player');
  assert.ok(shell.includes('full={shopUnlocked(devUnlocked)}'), 'only the dev unlock hands the screen the full shop');
  assert.equal((shell.match(/<ShopScreen\b/g) ?? []).length, 1, 'one Shop render');
  assert.ok(!/setMode\('shop'\)/.test(shell), 'nothing routes straight to the Shop');
  const others = fs
    .readdirSync(path.join(ROOT, 'src/play'))
    .filter((f) => f.endsWith('.tsx') && f !== 'shop-screen.tsx')
    .filter((f) => read(`src/play/${f}`).includes('<ShopScreen'));
  assert.deepEqual(others, [], 'no other screen renders the Shop');
}
ok('the Play shell renders the Store for everyone and passes `full` only for the dev unlock; nothing else reaches it');

{
  assert.deepEqual(storeTabsFor(false), ['token'], 'a player sees the Token shop tab only');
  assert.deepEqual(storeTabsFor(true), ['token', 'tide', 'paid'], 'a dev sees all three');
  const player = storeTokenRows(false);
  assert.ok(player.length >= 4, 'the player shelf has real rows');
  assert.ok(player.every((r) => r.kind !== 'stub' && r.price != null && !r.pass_only), 'no stub, unpriced or pass-only row for a player');
  assert.ok(tokenShopRows().some((r) => r.kind === 'stub'), 'the stubs still exist for the dev view');
  assert.ok(storeTokenRows(true).some((r) => r.kind === 'stub'), 'the dev view keeps them');
  const refresh = player.find((r) => r.id === 'shop_dive_refresh');
  assert.ok(refresh && refresh.price === 40 && refresh.daily_limit === 3, 'Dive refresh: 40 tokens, 3 a day');
  const big = player.find((r) => r.id === 'shop_big_crate');
  assert.ok(big && big.kind === 'merge_crate' && big.price === 300 && big.amount === 3 && big.weekly_limit === 1, 'Big crate: 3 Powers, 300 tokens, 1 a week');
  const screen = read('src/play/shop-screen.tsx');
  assert.ok(screen.includes('storeTabsFor(full)') && screen.includes('storeTokenRows(full)'), 'the screen reads the player / dev view');
  assert.ok(screen.includes('Spend tokens on a small boost.'), 'the player lede has no "window-shop"');
}
ok('a player sees only the Token shop tab and its priced rows (Dive refresh 3 a day, Big crate 300 a week); no tab chips, no stubs');

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
  assert.ok(screen.includes('Tide shelf') && screen.includes('Tide Pass only'), 'the Tide shelf is visible and locked with neutral copy (dev view)');
  assert.equal((screen.match(/<ShopScreen\b/g) ?? []).length, 0, 'the Shop screen file does not render itself');
  const tide = tideShopRows();
  assert.ok(tide.length >= 2 && tide.every((r) => r.pass_only), 'Tide shelf rows are pass-only');
  assert.ok(tokenShopRows().every((r) => !r.pass_only), 'the token shelf hides pass-only rows');
  const stone = tokenShopRows().find((r) => r.kind === 'shine_stone');
  assert.ok(stone && stone.weekly_limit === 1, 'the Shine Stone token row has its weekly limit');
}
ok('the Prism Stone and Tide Pass are previews (never for sale); the Tide shelf and Paid shop are dev-view only; no purchase code; no casino words');

console.log(`\ncheck:shop-hidden — ${passed} groups passed.`);
