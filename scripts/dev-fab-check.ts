/**
 * Floating dev button checks. Run: npm run check:dev-fab
 *
 *   1. Visibility = the Dev Tools Hub rule: never signed out / mid-onboarding /
 *      while access is loading; root, a granted capability, or PRE_LAUNCH_DEV /
 *      the session unlock opens it; a plain user never sees it.
 *   2. The button always stays fully on screen (clamp), rests on a side edge
 *      (snap), and starts clear of the status bar.
 *   3. The drag helpers are worklets (they run on the UI thread).
 *   4. Wiring: mounted once in the root layout, panel is a Modal (nothing
 *      navigates away), uses the gesture + reanimated libraries already in the
 *      app, and no dev-menu / debugger dependency was added.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  DEV_FAB_EDGE,
  DEV_FAB_SIZE,
  clampFab,
  defaultFabPosition,
  devFabVisible,
  snapFabX,
} from '../src/lib/dev-fab-model';

const ROOT = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let passed = 0;
const ok = (msg: string) => {
  passed += 1;
  console.log(`  ✓ ${msg}`);
};

const base = { isAuthed: true, hasMe: true, devAccessLoading: false, isDev: false, isRoot: false, capabilities: [] as string[] };

/* ---------------------------------------------------------------- 1 --- */
{
  assert.equal(devFabVisible(base), false, 'a plain user never sees it');
  assert.equal(devFabVisible({ ...base, isDev: true }), true, 'PRE_LAUNCH_DEV / session unlock opens it');
  assert.equal(devFabVisible({ ...base, isRoot: true }), true, 'root opens it');
  assert.equal(devFabVisible({ ...base, capabilities: ['quota'] }), true, 'a granted capability opens it');
  assert.equal(devFabVisible({ ...base, capabilities: ['nonsense'] }), false, 'an unknown capability does not');
  assert.equal(devFabVisible({ ...base, isDev: true, isAuthed: false }), false, 'never signed out');
  assert.equal(devFabVisible({ ...base, isDev: true, hasMe: false }), false, 'never mid-onboarding');
  assert.equal(devFabVisible({ ...base, isRoot: true, devAccessLoading: true }), false, 'never while access is loading');
}
ok('visible exactly when the Dev Tools Hub would open; never signed out, onboarding or loading');

/* ---------------------------------------------------------------- 2 --- */
{
  const b = { width: 390, height: 844, top: 47, bottom: 34 };
  for (const p of [
    { x: -500, y: -500 },
    { x: 9999, y: 9999 },
    { x: 100, y: 300 },
    { x: 0, y: 0 },
  ]) {
    const c = clampFab(p, b);
    assert.ok(c.x >= DEV_FAB_EDGE && c.x + DEV_FAB_SIZE <= b.width - DEV_FAB_EDGE + 0.001, `x on screen for ${JSON.stringify(p)}`);
    assert.ok(c.y >= b.top + DEV_FAB_EDGE && c.y + DEV_FAB_SIZE <= b.height - b.bottom - DEV_FAB_EDGE + 0.001, `y clear of bars for ${JSON.stringify(p)}`);
  }
  assert.deepEqual(clampFab({ x: 100, y: 300 }, b), { x: 100, y: 300 }, 'a spot already on screen is untouched');
  assert.equal(snapFabX(10, 390), DEV_FAB_EDGE, 'left half snaps left');
  assert.equal(snapFabX(300, 390), 390 - DEV_FAB_SIZE - DEV_FAB_EDGE, 'right half snaps right');
  const d = defaultFabPosition(b);
  assert.ok(d.y >= b.top + DEV_FAB_EDGE, 'starts below the status bar');
  assert.equal(d.x, 390 - DEV_FAB_SIZE - DEV_FAB_EDGE, 'starts on the right edge');
  const tiny = clampFab({ x: 50, y: 50 }, { width: 40, height: 40, top: 0, bottom: 0 });
  assert.ok(Number.isFinite(tiny.x) && Number.isFinite(tiny.y), 'a tiny window does not produce NaN');
}
ok('the button stays on screen, snaps to a side edge, starts clear of the status bar');

/* ---------------------------------------------------------------- 3 --- */
{
  const model = read('src/lib/dev-fab-model.ts');
  for (const fn of ['clampFab', 'snapFabX']) {
    const from = model.indexOf(`export function ${fn}(`);
    assert.ok(from >= 0, `${fn} exists`);
    const rest = model.slice(from + 1);
    const next = rest.indexOf('\nexport ');
    const body = rest.slice(0, next === -1 ? undefined : next);
    assert.ok(body.includes("\n  'worklet';"), `${fn} is a worklet (called from the drag gesture on the UI thread)`);
  }
}
ok('clampFab and snapFabX are worklets');

/* ---------------------------------------------------------------- 4 --- */
{
  const layout = read('src/app/_layout.tsx');
  assert.equal((layout.match(/<DevFab \/>/g) ?? []).length, 1, 'mounted exactly once, in the root layout');
  assert.ok(layout.indexOf('</Stack>') < layout.indexOf('<DevFab />'), 'rendered after the Stack so it sits over every screen');
  const fab = read('src/components/dev-fab.tsx');
  assert.ok(fab.includes("from 'react-native-gesture-handler'") && fab.includes("from 'react-native-reanimated'"), 'built on the gesture + reanimated libraries already in the app');
  assert.ok(/<Modal[^>]*visible=\{open\}/.test(fab), 'the panel is a Modal over the current screen');
  assert.ok(fab.includes('devFabVisible('), 'gated by the shared visibility rule');
  assert.ok(fab.includes('fetchSageUsage()'), 'shows real AI usage in place');
  const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string>; devDependencies?: Record<string, string> };
  const all = { ...pkg.dependencies, ...(pkg.devDependencies ?? {}) };
  const bad = Object.keys(all).filter((d) => /dev-menu|api-debugger|shake|flipper|reactotron/i.test(d));
  assert.deepEqual(bad, [], 'no dev-menu / debugger / shake dependency was added');
}
ok('wiring: mounted once over every screen, Modal panel, existing libraries only');

console.log(`\ncheck:dev-fab — ${passed} groups passed.`);
