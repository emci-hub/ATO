/**
 * Divecore navigation check (Phase 3, 2026-10-14).
 *
 * Hideout is home, the Block is gone. One entry per place, one name per thing, Exit Play in ⚙.
 * Pure rules in `src/play/play-nav.ts` + static pins on how the shell wires them.
 *
 * Run: npm run check:divecore-nav
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { PLAY_TABS, backTarget, modeForTab, tabForMode, type PlayMode } from '../src/play/play-nav';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

// --- pure -----------------------------------------------------------------
assert.deepEqual([...PLAY_TABS], ['hideout', 'turf', 'locker', 'store'], 'tabs: Hideout · Turf War · Locker · Store');
for (const tab of PLAY_TABS) assert.equal(tabForMode(modeForTab(tab)), tab, `${tab} round-trips`);
assert.equal(tabForMode('dive'), null, 'Underground has no tab');
assert.equal(tabForMode('about'), null);
assert.equal(tabForMode('swords'), 'locker', 'Blades lights Locker');
assert.equal(modeForTab('locker'), 'dress', 'Locker lands on Fits');
ok('tabs: Hideout · Turf War · Locker · Store, each mode lights one tab, Underground none');

const subScreens: PlayMode[] = ['dress', 'swords', 'defend', 'shop', 'about', 'sheetlab', 'swordlab'];
for (const m of subScreens) assert.equal(backTarget(m, 'pet'), 'pet', `${m} goes back to the Hideout`);
assert.equal(backTarget('pet', 'pet'), 'pet');
assert.equal(backTarget('dive', 'pet'), 'pet', 'Dive from the hatch returns to the Hideout');
assert.equal(backTarget('dive', 'defend'), 'defend', 'Dive returns to the screen that opened it');
ok('back: every sub-screen → Hideout; Dive → the screen that opened it');

// --- the shell ------------------------------------------------------------
const shell = readFileSync('src/app/play.tsx', 'utf8');
const street = readFileSync('src/play/street-shell.tsx', 'utf8');
const settings = readFileSync('src/play/divecore-settings.tsx', 'utf8');

assert.ok(!/'grove'/.test(shell), "play.tsx has no 'grove' mode (the Block is gone)");
assert.ok(!/CommandHub|StreetBlock/.test(shell + street), 'no Command Hub / Block component in the shell');
assert.ok(!/'block'|nav-tab-block/.test(street), 'no Block tab');
assert.match(shell, /useState<PlayMode>\('pet'\)/, 'the Hideout is home');
ok('no Block: Hideout is home');

assert.equal((shell.match(/setMode\('dive'\)/g) ?? []).length, 1, "Underground opens through one function (openDive)");
assert.match(shell, /onGoDive=\{openDive\}/, 'the Hideout hatch is the Underground entry');
assert.ok(!/label: 'Underground'|'underground'/.test(street), 'no Underground tab');
ok('Underground: one entry (the Hideout hatch), no tab, no tile');

assert.match(street, /claim\?: \{ ready: boolean; label: string; onPress: \(\) => void \}/, 'the resource bar takes a Claim chip');
assert.match(shell, /claim=\{\{ ready: researchReady, label: claimLabel, onPress: handleClaim \}\}/, 'Claim is wired in the top bar');
ok('Claim chip lives in the top bar next to Caps');

assert.match(shell, /onSettings=\{\(\) => setHubSettingsOpen\(true\)\}/, '⚙ opens Settings in place');
assert.ok(!/setMode\('[a-z]+'\);\s*setHubSettingsOpen\(true\)/.test(shell), '⚙ no longer flips screens first');
assert.equal((shell.match(/<DivecoreSettingsSheet/g) ?? []).length, 1, 'one Settings sheet in the shell');
for (const f of readdirSync('src/play').filter((n) => n.endsWith('.tsx') && n !== 'divecore-settings.tsx')) {
  assert.ok(!readFileSync(path.join('src/play', f), 'utf8').includes('<DivecoreSettingsSheet'), `${f} has no second Settings sheet`);
}
const exitAt = settings.indexOf('label="Exit Play"');
const noticesAt = settings.indexOf('<NeonLabel>Notices</NeonLabel>');
const notifAt = settings.indexOf('<NeonLabel>Notifications</NeonLabel>');
assert.ok(exitAt > 0 && exitAt < noticesAt && noticesAt < notifAt, 'Settings: Exit Play first, then Notices, then Notifications');
assert.match(settings, /NOTICE_MODES\.map/, 'Settings: Notices All / Important only');
assert.match(shell, /onExit=\{closePlay\}/, 'Exit Play leaves Play');
ok('⚙ opens one Settings sheet in place; Exit Play is its first row; Notices All / Important only');

// --- names ----------------------------------------------------------------
for (const f of readdirSync('src/play').filter((n) => /\.(tsx?)$/.test(n) && n !== 'command-hub.tsx')) {
  const src = readFileSync(path.join('src/play', f), 'utf8');
  const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/Command Hub/.test(stripped), `${f}: no player-facing "Command Hub"`);
}
assert.match(readFileSync('src/play/neon-ui.tsx', 'utf8'), /label = 'Hideout'/, 'the default back link says Hideout');
ok('names: back links say Hideout; no "Command Hub" left in screens');

assert.ok(existsSync('src/play/play-nav.ts'));
console.log(`\ncheck:divecore-nav — ${passed} groups passed.`);
