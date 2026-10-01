/**
 * Play floating dev button checks. Run: npm run check:dev-fab
 *
 *   1. Visibility = PRE_LAUNCH_DEV and the Play dev-kit PIN unlock only.
 *   2. The button always stays fully on screen (clamp), rests on a side edge
 *      (snap), and starts clear of the status bar.
 *   3. The drag helpers are worklets (they run on the UI thread).
 *   4. Wiring: mounted from the Play shell only, not the root layout; panel is a
 *      Modal with the Grove Dev kit; uses gesture + reanimated already in the app.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  DEV_FAB_EDGE,
  DEV_FAB_SIZE,
  clampFab,
  defaultFabPosition,
  APP_DEV_EVERYWHERE,
  APP_DEV_HIDDEN_PATHS,
  APP_DEV_SCREENS,
  appDevEverywhere,
  appDevFabVisible,
  appDevScreen,
  playDevFabVisible,
  snapFabX,
} from '../src/lib/dev-fab-model';

const ROOT = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let passed = 0;
const ok = (msg: string) => {
  passed += 1;
  console.log(`  ✓ ${msg}`);
};

/* ---------------------------------------------------------------- 1 --- */
{
  assert.equal(playDevFabVisible({ preLaunchDev: false, playDevUnlocked: true }), false, 'off when not pre-launch');
  assert.equal(playDevFabVisible({ preLaunchDev: true, playDevUnlocked: false }), false, 'off when Play dev kit locked');
  assert.equal(playDevFabVisible({ preLaunchDev: true, playDevUnlocked: true }), true, 'on when both gates pass');
}
ok('visible only for PRE_LAUNCH_DEV + Play dev-kit unlock');

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
  assert.equal((layout.match(/<AppDevFab \/>/g) ?? []).length, 1, 'the app button is mounted once, in the root layout');
  assert.ok(layout.indexOf('</Stack>') < layout.indexOf('<AppDevFab />'), 'after the Stack, so it sits over every app screen');
  const play = read('src/app/play.tsx');
  assert.ok(play.includes('<PlayDevFab'), 'mounted from the Play shell');
  assert.ok(play.includes('playDevFabVisible('), 'gated by the shared Play visibility rule');
  assert.ok(play.includes('groveDevKitPanel'), 'panel is the Grove Dev kit');
  const fab = read('src/components/play-dev-fab.tsx');
  assert.ok(fab.includes("from 'react-native-gesture-handler'") && fab.includes("from 'react-native-reanimated'"), 'built on the gesture + reanimated libraries already in the app');
  assert.ok(/<Modal[^>]*visible=\{open\}/.test(fab), 'the panel is a Modal over the current screen');
  const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string>; devDependencies?: Record<string, string> };
  const all = { ...pkg.dependencies, ...(pkg.devDependencies ?? {}) };
  const bad = Object.keys(all).filter((d) => /dev-menu|api-debugger|shake|flipper|reactotron/i.test(d));
  assert.deepEqual(bad, [], 'no dev-menu / debugger / shake dependency was added');
}
ok('wiring: Play button from the Play shell, app button from the root layout, one Modal shell, existing libraries only');

/* ---------------------------------------------------------------- 5 --- */
{
  // The floating kit follows the mode: in the Pet room it shows the pet / egg /
  // room tools (one shared panel, also the Info sheet's Dev tab).
  const play = read('src/app/play.tsx');
  assert.ok(/mode === 'pet' && view \? \(\s*<PetDevPanel/.test(play), 'Pet mode: the floating kit shows the Pet dev panel');
  assert.ok(play.includes('devFocusForMode(mode)'), 'the general kit opens the current mode’s group');
  assert.ok(play.includes('<View key={mode}'), 'the panel remounts per mode, so the right groups are open');
  const screen = read('src/play/pet-screen.tsx');
  assert.ok(/\) : dev \? \(\s*<PetDevPanel/.test(screen), 'the Info sheet Dev tab renders the same panel');
  assert.ok(!/\bdev(?:Pet|Add|Give|Set|Fill|Grant|End|Gold|Reset)\w*\(/.test(screen), 'no second copy of the pet dev buttons in the Pet screen');
  assert.ok(screen.includes('usePetDevRoom()'), 'room toggles come from the shared store');
  const panel = read('src/play/pet-dev-panel.tsx');
  assert.ok(panel.includes('if (!PRE_LAUNCH_DEV) return null;'), 'the panel renders nothing outside pre-launch');
  for (const title of ['Pet · stage & care', 'Eggs · hatch & grade', 'Collection & stones', 'Tide & streak', 'Pity & Den', 'Room · look & talk']) {
    assert.ok(panel.includes(`title: '${title}'`), `group: ${title}`);
  }
  // Nothing was dropped in the regroup: every pet dev action is still wired.
  for (const fn of ['devPetFinishStage', 'devPetStarve', 'devPetSetStage', 'devPetNewEgg', 'devPetExpeditionReset', 'devAddShells', 'devGrantAllBuffs', 'devGoldAllGames', 'devPetEndStage', 'devPetForce', 'devPetSetBand', 'devGiveShards', 'devResetCollection', 'devAddStones', 'devGrantTide', 'devEndTide', 'devAddPrism', 'devSetStreakDay', 'devSetPity', 'devFillDen']) {
    assert.ok(panel.includes(`${fn}(`), `${fn} is still on the panel`);
  }
  for (const fn of ['cycleDevStatus', 'cycleDevNight', 'cycleShinyLook', 'requestDevSay']) {
    assert.ok(panel.includes(fn), `${fn} is still on the panel`);
  }
}
{
  // Defend's kit acts on the live board, so it is BUILT in the Defend screen
  // and SHOWN in the floating kit through the dev slot.
  const defend = read('src/play/defend-screen.tsx');
  assert.ok(/PRE_LAUNCH_DEV && devUnlocked \? \(\s*<DevSlotFill>/.test(defend), 'Defend hands its Dev kit to the slot, still behind the gate');
  assert.equal((defend.match(/<DevSlotFill>/g) ?? []).length, 1, 'one slot fill in Defend');
  for (const title of ['Heroes', 'Campaign', 'Gear / Stars', 'Board / Misc']) {
    assert.ok(defend.includes(`title="${title}"`), `Defend group kept: ${title}`);
  }
  const play = read('src/app/play.tsx');
  assert.ok(play.includes('<DevSlotOutlet />'), 'the floating kit draws the slot');
  const slot = read('src/play/dev-slot.tsx');
  assert.ok(slot.includes('useEffect(() => () => setSlot(null), [])'), 'the slot empties when its screen leaves');
}
ok('Defend: its Dev kit shows in the floating kit (dev slot), all four groups kept');

ok('mode-aware: Pet mode shows Pet / Eggs / Room tools in six groups, one shared panel, nothing dropped');

/* ---------------------------------------------------------------- 6 --- */
{
  const base = { isAuthed: true, hasMe: true, devAccessLoading: false, canSeeHub: true, pathname: '/' };
  assert.equal(appDevFabVisible(base), true, 'a Hub user sees it on Home');
  assert.equal(appDevFabVisible({ ...base, canSeeHub: false }), false, 'a plain user never sees it');
  assert.equal(appDevFabVisible({ ...base, isAuthed: false }), false, 'never signed out');
  assert.equal(appDevFabVisible({ ...base, hasMe: false }), false, 'never mid-onboarding');
  assert.equal(appDevFabVisible({ ...base, devAccessLoading: true }), false, 'never while access is loading');
  for (const p of APP_DEV_HIDDEN_PATHS) assert.equal(appDevFabVisible({ ...base, pathname: p }), false, `hidden on ${p}`);
  assert.ok(APP_DEV_HIDDEN_PATHS.includes('/play'), 'Play keeps its own button — never two at once');
  for (const p of ['/', '/explore', '/intake-sweep', '/sage', '/you']) {
    const s = appDevScreen(p);
    assert.ok(s && s.sections.length > 0, `${p} has its own tools`);
    assert.equal(new Set(s.sections).size, s.sections.length, `${p}: no section twice`);
    for (const e of appDevEverywhere(p)) assert.ok(!s.sections.includes(e), `${p}: an everywhere tool is not repeated`);
  }
  assert.equal(appDevScreen('/legends'), null, 'a screen with no tools of its own');
  assert.deepEqual([...appDevEverywhere('/legends')], [...APP_DEV_EVERYWHERE], 'it still gets the everywhere tools');
  const fab = read('src/components/app-dev-fab.tsx');
  assert.ok(fab.includes("from '@/app/dev-lab'"), 'the sections are the Hub’s own components, not copies');
  assert.ok(fab.includes('canSeeHubSection(cap, gate)'), 'per-capability gates are the Hub’s');
  assert.ok(fab.includes('appDevFabVisible('), 'gated by the shared rule');
  assert.ok(fab.includes('<PlayDevFab'), 'one bubble shell for Play and the app');
  const used = [...Object.values(APP_DEV_SCREENS).flatMap((x) => [...x.sections]), ...APP_DEV_EVERYWHERE];
  for (const s of used) assert.ok(fab.includes(`case '${s}':`), `the panel can draw ${s}`);
  const hub = read('src/app/dev-lab.tsx');
  for (const n of ['HomeOverrides', 'TraitViewer', 'IntakeStagePresets', 'GrowthPreview', 'QuotaDashboard', 'FenceTester', 'TraceCapture']) {
    assert.ok(new RegExp('export \\{[^}]*\\b' + n + ',').test(hub), `${n} is exported from the Hub`);
    assert.ok(hub.includes(`\nfunction ${n}() {`), `${n} keeps its plain declaration (other checks slice on it)`);
  }
  const exportBlock = hub.slice(hub.lastIndexOf('export {'));
  assert.ok(exportBlock.includes('HomeOverrides'), 'the export list was found');
  for (const rootOnly of ['AccessReview', 'GrantsPanel', 'ProfilesPanel']) {
    assert.ok(hub.includes('<' + rootOnly + ' />') && !exportBlock.includes(rootOnly), rootOnly + ' stays inside the Hub (root-only)');
  }
  // PRE_LAUNCH_DEV alone must not open the app button: every invited tester
  // would get one-tap account resets. Same rule as Home's Hub row.
  assert.ok(!fab.includes('PRE_LAUNCH_DEV'), 'the app button is not opened by PRE_LAUNCH_DEV');
  assert.ok(fab.includes('isDev: __DEV__ || devUnlocked,'), 'isDev = a dev build or the session unlock');
}
ok('app button: root / grant / unlock only (not PRE_LAUNCH_DEV), hidden on Play, per-screen tools from the Hub’s own sections');

console.log(`\ncheck:dev-fab — ${passed} groups passed.`);
