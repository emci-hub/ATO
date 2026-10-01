/**
 * Play dev-UI gating check (v24, 2026-09-30). Run: npm run check:play-dev-hidden
 *
 * Every Play screen that renders dev tooling (dev* store transitions, the Dev
 * kit / unlock row / FX stress / dump / Tune panel / Sheet lab) must gate it on
 * `PRE_LAUNCH_DEV` (always `&& devUnlocked` for in-screen panels), so none of
 * it can render in a release build — `check:release-mode` forces the flag to
 * `false` on production builds. This is a source scan, not a render test:
 * it fails the moment a new file uses dev tooling without referencing the
 * gate, and pins the known gates' exact shape.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';


let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : p.endsWith('.tsx') ? [p] : [];
  });
}

const DEV_UI = /\bdev(?:Pet|Add|Give|Reset|Set|Own|Clear|Unlock|Jump|Force|EquipSword)\w*\(|<(?:DevUnlockRow|GroveDevKit|DevFxStress|DevDump|TunePanel|SheetLabScreen|SwordLabScreen)\b/;
const DEV_COMPONENT_FILES = ['dev-unlock-row.tsx', 'dev-dump.tsx', 'dev-fx-stress.tsx', 'sheet-lab-screen.tsx', 'sword-lab-screen.tsx'];

const files = [...walk('src/play'), 'src/app/play.tsx'].map((f) => f.replace(/\\/g, '/'));
const offenders: string[] = [];
for (const file of files) {
  if (DEV_COMPONENT_FILES.some((d) => file.endsWith(d))) continue; // the dev components themselves
  const src = fs.readFileSync(file, 'utf8');
  if (DEV_UI.test(src) && !src.includes('PRE_LAUNCH_DEV')) offenders.push(file);
}
assert.deepEqual(offenders, [], `dev tooling without a PRE_LAUNCH_DEV gate: ${offenders.join(', ')}`);
ok(`every Play screen that renders dev tooling references the PRE_LAUNCH_DEV gate (${files.length} files scanned)`);

// The dev components are only imported by gated files.
for (const comp of DEV_COMPONENT_FILES) {
  const mod = comp.replace('.tsx', '');
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    if (src.includes(`/${mod}'`) && !DEV_COMPONENT_FILES.some((d) => file.endsWith(d))) {
      assert.ok(src.includes('PRE_LAUNCH_DEV'), `${file} imports ${mod} without the gate`);
    }
  }
}
ok('dev components are only imported where the gate is');

// The known gates, exactly.
const pet = fs.readFileSync('src/play/pet-screen.tsx', 'utf8');
assert.match(pet, /const dev = PRE_LAUNCH_DEV && devUnlocked;/, 'Pet: dev = PRE_LAUNCH_DEV && devUnlocked');
assert.match(pet, /infoTabs\(dev\)/, 'Pet: the Dev tab only through infoTabs(dev)');
assert.match(pet, /\) : dev \? \(/, 'Pet: the Dev tab body renders only when dev');
const sheets = fs.readFileSync('src/play/pet-sheets.tsx', 'utf8');
assert.ok(sheets.includes("return dev ? [...tabs, { id: 'dev', label: 'Dev' }] : tabs;"), 'infoTabs adds the Dev tab only when dev');
assert.equal((sheets.match(/id: 'dev'/g) ?? []).length, 1, 'the Dev tab is added in one place only');
const shell = fs.readFileSync('src/app/play.tsx', 'utf8');
assert.match(shell, /PRE_LAUNCH_DEV && devUnlocked \? \(\s*<GroveDevKit/, 'hub: the Dev kit only when PRE_LAUNCH_DEV && devUnlocked');
assert.match(shell, /PRE_LAUNCH_DEV && !devUnlocked \? <DevUnlockRow/, 'hub: the unlock row only pre-launch');
ok('known gates pinned: Pet Dev tab, hub Dev kit and unlock row');

// The new player-facing surfaces carry no dev tooling at all.
for (const file of ['src/play/divecore-settings.tsx', 'src/play/pet-menu.tsx', 'src/play/divecore-tutorial.tsx']) {
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(!DEV_UI.test(src) && !src.includes('devUnlocked'), `${file} has no dev tooling`);
}
ok('Settings, the Pet menu and the tutorial contain no dev tooling');

// And release builds force the flag off.
const mode = fs.readFileSync('src/lib/dev-mode.ts', 'utf8');
assert.match(mode, /export const PRE_LAUNCH_DEV = (true|false);/, 'the flag is a plain literal (check:release-mode reads it)');
assert.ok(fs.existsSync('scripts/release-mode-check.ts'), 'check:release-mode exists to force it off in production');
ok('PRE_LAUNCH_DEV is a literal that check:release-mode forces to false in production');

console.log(`\ncheck:play-dev-hidden — ${passed} groups passed.`);
