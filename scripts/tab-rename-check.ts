/**
 * Sage → Insights tab rename (emci 2026-10-14): saved layouts migrate, old
 * links redirect, and the bar shows Insights with a normal icon.
 * Run: npm run check:tab-rename
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  DEFAULT_NAV_LAYOUT,
  LEGACY_TAB_ID_MAP,
  NAV_LAYOUT_VERSION,
  normalizeNavLayout,
  PARKED_PINNED_IDS,
  PINNED_IDS,
  POOL_SLOTS,
  SLOT_COUNT,
} from '../src/lib/nav/nav-order';
import { legacyRedirect } from '../src/lib/nav/legacy-routes';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}
const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
assert.equal(pkg.scripts['check:tab-rename'], 'tsx ./scripts/tab-rename-check.ts');
ok('wired as check:tab-rename (check:ota-gate runs every check:* script)');

assert.deepEqual(PINNED_IDS, ['home', 'insights']);
assert.deepEqual(PARKED_PINNED_IDS, [], 'Insights is a real tab, never parked');
assert.deepEqual(LEGACY_TAB_ID_MAP, { sage: 'insights' });
assert.equal(SLOT_COUNT, 4);
assert.equal(POOL_SLOTS, 2);
assert.deepEqual(DEFAULT_NAV_LAYOUT.slots, ['home', 'insights', 'you', 'play']);
ok('Home + Insights pinned, nothing parked, five buttons with More');

// Saved layouts that say "sage" migrate in place, keeping the user's order. Since IA P3 every layout saved
// before NAV_LAYOUT_VERSION resets once on read, so the migration is exercised on current-version layouts
// (and on the write path); an unversioned legacy layout resets to the default.
const V = NAV_LAYOUT_VERSION;
assert.deepEqual(normalizeNavLayout({ slots: ['home', 'sage', 'explore', 'you'] }).slots, DEFAULT_NAV_LAYOUT.slots, 'an unversioned legacy layout resets once');
assert.deepEqual(normalizeNavLayout({ slots: ['home', 'questions', 'explore', 'you', 'sage'], version: V }).slots, [
  'home',
  'questions',
  'explore',
  'insights',
]);
assert.deepEqual(normalizeNavLayout({ slots: ['sage', 'home', 'legends', 'you'], version: V }).slots, [
  'insights',
  'home',
  'legends',
  'you',
]);
assert.deepEqual(normalizeNavLayout(['home', 'explore', 'sage', 'you'], { resetShort: false }).slots, ['home', 'explore', 'insights', 'you']);
// "sage" and "insights" both present → one Insights, never two.
const both = normalizeNavLayout({ slots: ['home', 'sage', 'insights', 'explore', 'you'], version: V }).slots;
assert.equal(both.filter((id) => id === 'insights').length, 1);
assert.ok(!(both as string[]).includes('sage'));
// Writes migrate too (the edit screen commits with resetShort: false).
assert.deepEqual(
  normalizeNavLayout({ slots: ['home', 'sage', 'legends'] }, { resetShort: false }).slots.slice(0, 3),
  ['home', 'insights', 'legends'],
);
// Junk never wins, including prototype keys.
assert.deepEqual(normalizeNavLayout({ slots: ['toString', 'constructor', 'sage'], version: V }).slots, DEFAULT_NAV_LAYOUT.slots);
assert.deepEqual(normalizeNavLayout(null).slots, DEFAULT_NAV_LAYOUT.slots);
ok('saved "sage" layouts migrate to "insights" on read and write, in place, once');

// Old /sage links redirect through the cold-start helper; the /sage route file
// itself was dropped at the launch flip (2026-10-20).
assert.ok(!existsSync(resolve(root, 'src/app/(tabs)/sage.tsx')), 'the Sage tab route is gone');
assert.ok(!existsSync(resolve(root, 'src/app/sage.tsx')), 'the /sage redirect route is gone (launch flip)');
assert.doesNotMatch(read('src/app/_layout.tsx'), /<Stack\.Screen name="sage" \/>/);
for (const path of ['sage', '/sage', '/sage/']) {
  assert.equal(legacyRedirect(path), '/insights', `${path} → /insights`);
}
assert.equal(legacyRedirect('/explore'), null);
assert.equal(legacyRedirect('/sage-lab'), null);
assert.ok(read('src/app/+native-intent.ts').includes('const moved = legacyRedirect(path);'), 'cold-start links use the helper');
ok('/sage (cold-start deep link) redirects to /insights; the route file is gone');

// The bar draws Insights with a normal icon; no Sage icon, no Sage row in More.
const tabs = read('src/components/app-tabs.tsx');
assert.match(tabs, /name="insights" href="\/insights"/);
assert.match(tabs, /label="Insights" icon="lightbulb-on-outline"/);
assert.doesNotMatch(tabs, /SageTabIcon|name="sage"/);
assert.ok(!existsSync(resolve(root, 'src/components/sage-tab-icon.tsx')), 'the Sage tab icon is deleted');
assert.doesNotMatch(read('src/components/nav-more-sheet.tsx'), /showSage|'\/sage'/);
assert.doesNotMatch(read('src/components/nav-edit-overlay.tsx'), /SageTabIcon|'sage'/);
assert.ok(existsSync(resolve(root, 'src/app/(tabs)/insights.tsx')));
ok('the bar shows Insights with a normal icon; More and the editor carry no Sage');

// Home's link in, and nothing pushes the old route.
assert.match(read('src/app/(tabs)/index.tsx'), /router\.push\('\/insights'\)/);
assert.match(read('src/app/(tabs)/index.tsx'), /See today’s Insights →/);
ok('Home links to Insights');

console.log(`\ntab-rename: ${passed} checks passed`);
