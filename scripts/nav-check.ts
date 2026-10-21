/**
 * Nav layout + edit-mode checks. Run: npm run check:nav
 *
 * Verifies the layout model (Home + Insights always on the bar–4, two pool
 * tabs, More fixed), that the custom tab bar is wired to the persisted layout
 * with edit-mode / More surfaces, and that the pool is an extensible registry.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  DEFAULT_NAV_LAYOUT,
  NAV_TABS,
  NAV_TAB_IDS,
  PARKED_PINNED_IDS,
  PINNED_IDS,
  POOL_SLOTS,
  SLOT_COUNT,
  VISIBLE_SLOT_COUNT,
  isTabParked,
  isTabUnlocked,
  lockedTabIds,
  normalizeNavLayout,
  poolIdsInLayout,
  type NavLayout,
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

// Home/Insights are pinned slot items, never pool tabs.
for (const id of NAV_TAB_IDS) {
  assert.notEqual(id, 'home', 'home must not be a pool tab id');
  assert.notEqual(id as string, 'insights', 'insights must not be a pool tab id');
}
assert.deepEqual(PINNED_IDS, ['home', 'insights']);
ok('Home and Insights are pinned ids, never pool tabs');

// REPINNED 2026-10-14 (emci): Insights replaced the parked Sage tab and sits
// on the bar. The bar keeps five buttons: Home + Insights + 2 pool tabs + More.
assert.equal(SLOT_COUNT, 4);
assert.equal(POOL_SLOTS, 2);
assert.deepEqual(PARKED_PINNED_IDS, []);
assert.equal(VISIBLE_SLOT_COUNT, 4);
assert.deepEqual(DEFAULT_NAV_LAYOUT, { slots: ['home', 'insights', 'questions', 'explore'] });
assert.deepEqual(
  DEFAULT_NAV_LAYOUT.slots.filter((id) => !isTabParked(id)),
  ['home', 'insights', 'questions', 'explore'],
  'what the bar actually shows: Home, Insights, Questions, Explore',
);
assert.ok(!isTabParked('legends') && !poolIdsInLayout(DEFAULT_NAV_LAYOUT).includes('legends'), 'Legends is in More');
assert.ok(!poolIdsInLayout(DEFAULT_NAV_LAYOUT).includes('you'), 'You is in More');
assert.equal(DEFAULT_NAV_LAYOUT.slots.length, SLOT_COUNT);
ok('bar shows Home / Insights / Questions / Explore + fixed More; You and Legends are in More');

// The default layout carries home + insights exactly once and exactly POOL_SLOTS pool ids.
const defaultPool = poolIdsInLayout(DEFAULT_NAV_LAYOUT);
assert.equal(defaultPool.length, POOL_SLOTS);
assert.equal(DEFAULT_NAV_LAYOUT.slots.filter((s) => s === 'home').length, 1);
assert.equal(DEFAULT_NAV_LAYOUT.slots.filter((s) => s === 'insights').length, 1);
assert.ok(defaultPool.every((id) => NAV_TAB_IDS.includes(id)));
ok('default layout has home + insights once each and 2 registry pool tabs');

// normalizeNavLayout: null/empty → the exact default.
assert.deepEqual(normalizeNavLayout(null).slots, DEFAULT_NAV_LAYOUT.slots);
assert.deepEqual(normalizeNavLayout(undefined).slots, DEFAULT_NAV_LAYOUT.slots);
assert.deepEqual(normalizeNavLayout({ slots: [] }).slots, DEFAULT_NAV_LAYOUT.slots);
assert.deepEqual(normalizeNavLayout(['nope', 7]).slots, DEFAULT_NAV_LAYOUT.slots);
ok('normalizeNavLayout(null/empty/invalid) yields the exact default layout');

// Interleaving is preserved (home/insights can sit anywhere).
const interleaved = normalizeNavLayout({ slots: ['explore', 'home', 'insights', 'you'] });
assert.deepEqual(interleaved.slots, ['explore', 'home', 'insights', 'you']);
const insightsFirst = normalizeNavLayout({ slots: ['insights', 'you', 'home', 'legends'] });
assert.deepEqual(insightsFirst.slots, ['insights', 'you', 'home', 'legends']);
ok('normalizeNavLayout preserves home/insights interleaving');

// Bare array shape is accepted too.
assert.deepEqual(normalizeNavLayout(['home', 'insights', 'legends', 'questions']).slots, [
  'home',
  'insights',
  'legends',
  'questions',
]);
ok('normalizeNavLayout accepts a bare array as well as { slots }');

// Saved layouts that say "sage" migrate to "insights" in place (check:tab-rename
// pins the details). A layout with fewer than POOL_SLOTS pool tabs resets ONCE
// on read; a fuller layout keeps the user's first two picks.
assert.deepEqual(normalizeNavLayout({ slots: ['home', 'explore', 'sage'] }).slots, DEFAULT_NAV_LAYOUT.slots);
assert.deepEqual(
  normalizeNavLayout({ slots: ['home', 'legends', 'explore', 'you', 'sage'] }).slots,
  ['home', 'legends', 'explore', 'insights'],
  'a saved choice keeps its order; the third pool tab moves to More',
);
// The reset is a READ rule. A layout the user just edited down to 1 tab is
// PADDED on write, never thrown away.
const edited = normalizeNavLayout({ slots: ['home', 'legends', 'insights'] }, { resetShort: false });
assert.deepEqual(edited.slots.slice(0, 3), ['home', 'legends', 'insights'], 'the user’s order is kept on write');
assert.equal(poolIdsInLayout(edited).length, POOL_SLOTS, 'and padded back to a full bar');
assert.match(read('src/lib/me.ts'), /normalizeNavLayout\(layout, \{ resetShort: false \}\)/, 'saveNavLayout writes without the reset rule');
ok('a short saved layout resets once; a full one keeps its order; an edited one is padded');

// Duplicates dropped; invalid ids dropped; too many pool ids trimmed to POOL_SLOTS.
const duped = normalizeNavLayout({ slots: ['home', 'home', 'insights', 'explore', 'explore', 'you', 'around', 'nope'] });
assert.equal(duped.slots.length, SLOT_COUNT);
assert.equal(duped.slots.filter((s) => s === 'home').length, 1);
assert.equal(poolIdsInLayout(duped).length, POOL_SLOTS);
assert.ok(!duped.slots.includes('nope' as never));
ok('normalizeNavLayout drops duplicates/invalid ids and caps the pool at 2');

// Gaps backfill from default first, then registry — result is always complete.
const empty = normalizeNavLayout({ slots: [] });
assert.equal(empty.slots.length, SLOT_COUNT);
assert.equal(empty.slots.filter((s) => s === 'home').length, 1);
assert.equal(empty.slots.filter((s) => s === 'insights').length, 1);
assert.equal(poolIdsInLayout(empty).length, POOL_SLOTS);
ok('normalizeNavLayout backfills missing slots to a complete valid layout');

// The pool is the extensible registry — a future tab is just another entry.
for (const id of NAV_TAB_IDS) {
  assert.ok(NAV_TABS[id].href, `${id} has a route`);
  assert.ok(NAV_TABS[id].label, `${id} has a label`);
}
ok('pool is the NAV_TABS registry — extensible, no hardcoded slot ids');

assert.deepEqual(lockedTabIds({ hasCircle: false }), []);
assert.deepEqual(lockedTabIds({ hasCircle: true }), []);
assert.equal(isTabUnlocked('explore', { hasCircle: false }), true);
assert.equal(isTabUnlocked('circle', { hasCircle: false }), true);
assert.equal(isTabUnlocked('circle', { hasCircle: true }), true);
ok('Circle is never locked (Add by handle lives in the tab, so a friend gate would block the first friend)');

// --- wiring ----------------------------------------------------------------

const tabs = read('src/components/app-tabs.tsx');
assert.match(tabs, /TabList/);
assert.match(tabs, /TabTrigger/);
assert.match(tabs, /useNavOrder/);
assert.match(tabs, /NavMoreSheet/);
assert.match(tabs, /NavEditOverlay/);
assert.match(tabs, /startEditing/);
assert.doesNotMatch(tabs, /unstable-native-tabs/);
assert.match(tabs, /lockedTabs=\{lockedTabs\}/);
assert.match(tabs, /isTabUnlocked/);
assert.match(tabs, /visibleSlots\.map\(renderSlot\)/);
assert.match(tabs, /hidden-\$\{id\}/);
assert.match(tabs, /name="home"/);
assert.match(tabs, /name="insights"/);
assert.doesNotMatch(tabs, /homeFirst/);
assert.doesNotMatch(tabs, /id !== 'circle'/);
ok('tab bar renders home/insights/pool in slot order + fixed More, driven by NavOrder');

// Hidden TabTriggers for pool tabs not on the bar MUST render inside <TabList> —
// expo-router/ui's Tabs only registers TabTriggers that are descendants of
// TabList as real routes, so a trigger placed outside it is silently never
// wired up and taps on that tab from the More sheet become a no-op.
const tabListOpen = tabs.indexOf('<TabList');
const tabListClose = tabs.indexOf('</TabList>');
const hiddenTriggerIdx = tabs.indexOf('hidden-${id}');
assert.ok(
  tabListOpen !== -1 && tabListClose !== -1 && hiddenTriggerIdx !== -1,
  'expected <TabList>, </TabList>, and a hidden-${id} trigger to all be present'
);
assert.ok(
  hiddenTriggerIdx > tabListOpen && hiddenTriggerIdx < tabListClose,
  'hidden TabTriggers for More-parked tabs must render inside <TabList>, or expo-router/ui will not register them as routes and More-sheet taps will silently no-op (regression of the You-tab bug)'
);
ok('hidden TabTriggers for un-slotted pool tabs stay inside TabList, so they remain registered routes');

// Same rule for `(tabs)` routes that are never a bar/More destination and are
// pushed from inside another tab (`/roll`, from Legends). `/roll` shipped with
// NO trigger at all — only an `as Href` cast at the push site, which typecheck
// does not enforce here (a deliberately bogus route string also compiles), so
// nothing caught it. It must stay inside <TabList> for the same reason as the
// More-parked triggers above, and must stay OUT of NAV_TABS or it becomes a
// user-placeable bar slot and shows up in More and the edit pool.
const hiddenRouteIdx = tabs.indexOf('HIDDEN_TAB_ROUTES.map');
assert.notEqual(hiddenRouteIdx, -1, 'expected a HIDDEN_TAB_ROUTES trigger loop in app-tabs.tsx');
assert.ok(
  hiddenRouteIdx > tabListOpen && hiddenRouteIdx < tabListClose,
  'HIDDEN_TAB_ROUTES triggers must render inside <TabList>, or expo-router/ui never registers those routes and pushes to them silently no-op (this is exactly how /roll shipped unreachable)'
);
assert.match(tabs, /\{ name: 'roll', href: '\/roll' \}/);
assert.ok(
  !(NAV_TAB_IDS as readonly string[]).includes('roll'),
  'roll must not be a NAV_TABS pool id — it is pushed from Legends, never a bar/More destination'
);
assert.doesNotMatch(read('src/app/(tabs)/legends.tsx'), /as Href/);
ok('/roll is registered by a hidden TabList trigger, stays out of the nav pool, and needs no Href cast');

const overlay = read('src/components/nav-edit-overlay.tsx');
assert.match(overlay, /Sortable\.Flex/);
assert.match(overlay, /customHandle/);
assert.match(overlay, /onDragEnd/);
assert.match(overlay, /commitLayout/);
assert.match(overlay, /POOL_SLOTS/);
assert.match(overlay, /SLOT_COUNT/);
assert.match(overlay, /SafeAreaProvider/);
assert.match(overlay, /The bar is full/);
assert.match(overlay, /Not unlocked yet/);
assert.match(overlay, /lockedTabs/);
assert.match(overlay, /unlockReason/);
assert.match(overlay, /draftPool\.length >= POOL_SLOTS/);
assert.match(overlay, /Pinned/);
assert.doesNotMatch(overlay, /id !== 'circle'/);
assert.doesNotMatch(overlay, /main\.push|more\.push/);
assert.doesNotMatch(overlay, /homeFirst/);
ok('edit overlay drags the visible slots via Sortable.Flex, enforces the 3-pool cap, and commits atomically');

const sheet = read('src/components/nav-more-sheet.tsx');
assert.match(sheet, /moreIds/);
assert.match(sheet, /router\.push\(NAV_TABS\[id\]\.href[\s\S]*?onClose\(\)/);
assert.match(sheet, /backdropDismiss/);
assert.match(sheet, /SafeAreaProvider/);
assert.ok(!sheet.includes("'/sage'") && !tabs.includes('showSage'), 'More has no Sage row (Insights is on the bar)');
ok('More sheet lists pool leftovers, navigates on tap, and uses SafeAreaProvider');

// Long-pressing a More row must not call onClose() and startEditing() in the
// same tick — two sibling RN Modals toggling together desyncs the native
// modal host until a screen focus event forces a resync (the "bar vanishes
// until I leave and come back" bug). startEditing must be deferred.
assert.doesNotMatch(
  sheet,
  /onClose\(\);\s*startEditing\(\);/,
  'onLongPress must not call onClose() and startEditing() synchronously — defer startEditing so only one Modal transitions at a time'
);
assert.match(sheet, /onClose\(\);[\s\S]*?setTimeout\(startEditing/, 'startEditing must be deferred with setTimeout after onClose()');
ok('More-row long-press defers startEditing so two Modals never toggle in the same tick');

// Edit overlay must have a non-committing exit path — "Done" alone commits
// the draft, so a stuck/hidden overlay had no way out without saving.
assert.match(overlay, /cancelEditing/);
assert.match(overlay, /Cancel/);
ok('Edit navigation overlay has a Cancel path independent of Done');

// The bar overlays the screen (like the native tab bar did), so screens keep
// their existing BottomTabInset padding and no per-screen change was needed.
assert.match(tabs, /position: 'absolute'/);
assert.match(tabs, /bottom: 0/);
ok('custom bar is an absolute bottom overlay, matching the native tab bar layout contract');

const layout = read('src/app/(tabs)/_layout.tsx');
assert.match(layout, /NavOrderProvider/);
ok('NavOrderProvider wraps the tab shell');

// Persistence lives on me.nav_layout; a migration adds the column.
const meSrc = read('src/lib/me.ts');
assert.match(meSrc, /saveNavLayout/);
assert.match(meSrc, /nav_layout/);
assert.match(meSrc, /normalizeNavLayout/);
const migration = read('supabase/migrations/wave37_nav_layout.sql');
assert.match(migration, /alter table public\.me add column if not exists nav_layout jsonb/);
ok('layout persists to me.nav_layout (wave37 migration) via saveNavLayout');

// nav-context derives the layout from the loaded me row.
const context = read('src/lib/nav/nav-context.tsx');
assert.match(context, /useMeContext/);
assert.match(context, /me\?\.nav_layout/);
assert.doesNotMatch(context, /AsyncStorage/);
ok('nav context reads the layout from me (no AsyncStorage)');

console.log(`\nnav-check: ${passed}/${passed} passed`);
