/**
 * Nav order + edit-mode checks. Run: npm run check:nav
 *
 * Verifies the order model never lets Home/Sage into More, always reconstructs
 * a valid order, and that the custom tab bar is wired to the persisted order
 * with edit-mode / More surfaces.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  DEFAULT_NAV_ORDER,
  NAV_TABS,
  NAV_TAB_IDS,
  normalizeNavOrder,
  type NavOrder,
} from '../src/lib/nav/nav-order';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

// --- model invariants -------------------------------------------------------

// Home/Sage are pinned and never appear in main/more (they aren't ReorderableTabId).
for (const id of NAV_TAB_IDS) {
  assert.notEqual(id, 'home', 'home must not be a reorderable id');
  assert.notEqual(id, 'sage', 'sage must not be a reorderable id');
}
ok('Home and Sage are not reorderable ids — they can never enter main/more');

assert.deepEqual(DEFAULT_NAV_ORDER, { homeFirst: true, main: ['explore', 'around', 'you'], more: ['circle'] });
ok('default order: Explore/Around/You on the bar, Circle in More');

// Every tab appears exactly once in a normalized order.
const norm = normalizeNavOrder(DEFAULT_NAV_ORDER);
assert.deepEqual([...norm.main, ...norm.more].sort(), [...NAV_TAB_IDS].sort());
assert.equal(new Set([...norm.main, ...norm.more]).size, NAV_TAB_IDS.length);
ok('normalizeNavOrder guarantees every tab appears exactly once');

// Duplicates: main wins, more loses the dup.
const dup = normalizeNavOrder({ homeFirst: true, main: ['you'], more: ['you', 'circle', 'explore', 'around'] });
assert.equal(dup.main.includes('you'), true);
assert.equal(dup.more.includes('you'), false);
assert.equal(new Set([...dup.main, ...dup.more]).size, NAV_TAB_IDS.length);
ok('duplicate across main+more resolves to main; no tab is lost or doubled');

// Unknown ids dropped; missing ids backfilled into More.
const junk = normalizeNavOrder({ homeFirst: true, main: ['you', 'nope' as never], more: [] });
assert.equal(junk.main.includes('nope' as never), false);
assert.equal([...junk.main, ...junk.more].length, NAV_TAB_IDS.length);
ok('unknown ids dropped and missing ids backfilled into More');

// homeFirst is preserved; a non-boolean/absent homeFirst defaults true.
assert.equal(normalizeNavOrder({ homeFirst: false, main: [], more: [] }).homeFirst, false);
assert.equal(normalizeNavOrder({ homeFirst: 'yes' as never, main: [], more: [] }).homeFirst, true);
assert.equal(normalizeNavOrder(null).homeFirst, true);
ok('homeFirst is a boolean, defaulting true; Home/Sage swap is the only pinned reorder');

// --- wiring ----------------------------------------------------------------

const tabs = read('src/components/app-tabs.tsx');
assert.match(tabs, /TabList/);
assert.match(tabs, /TabTrigger/);
assert.match(tabs, /useNavOrder/);
assert.match(tabs, /NavMoreSheet/);
assert.match(tabs, /NavEditOverlay/);
assert.match(tabs, /startEditing/);
assert.doesNotMatch(tabs, /unstable-native-tabs/);
ok('tab bar is the custom JS bar driven by NavOrder, with More + edit mode');

const overlay = read('src/components/nav-edit-overlay.tsx');
assert.match(overlay, /Sortable\.Flex/);
assert.match(overlay, /customHandle/);
assert.match(overlay, /onDragEnd/);
assert.match(overlay, /commitOrder/);
assert.doesNotMatch(overlay, /main\.push|more\.push/);
ok('edit overlay drags via Sortable.Flex and commits atomically');

const sheet = read('src/components/nav-more-sheet.tsx');
assert.match(sheet, /moreIds/);
assert.match(sheet, /router\.push/);
ok('More sheet lists more[] items and navigates on tap');

const layout = read('src/app/(tabs)/_layout.tsx');
assert.match(layout, /NavOrderProvider/);
ok('NavOrderProvider wraps the tab shell');

console.log(`\nnav-check: ${passed}/${passed} passed`);
