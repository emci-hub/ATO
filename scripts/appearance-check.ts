/**
 * Appearance-mode contrast + wiring. Run: npm run check:appearance
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { APPEARANCE_IDS, APPEARANCES } from '../src/constants/appearance';
import {
  FREE_APPEARANCE_IDS,
  isAppearanceUnlocked,
  resolveAllowedAppearance,
} from '../src/lib/subscription';
import { contrastRatio, meetsAa } from '../src/lib/theme/contrast';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

assert.deepEqual([...APPEARANCE_IDS], ['soft', 'zen', 'quest', 'neon', 'anime']);
ok('picker order is Soft / Zen / Quest / Neon / Anime');

for (const id of APPEARANCE_IDS) {
  const t = APPEARANCES[id];
  const pairs: [string, string, string][] = [
    ['text on background', t.text, t.background],
    ['text on surface', t.text, t.backgroundElement.startsWith('#') ? t.backgroundElement : t.background],
    ['secondary on background', t.textSecondary, t.background],
    [
      'secondary on selected',
      t.textSecondary,
      t.backgroundSelected.startsWith('#') ? t.backgroundSelected : t.background,
    ],
    ['onAccent on accentFill', t.onAccent, t.accentFill],
  ];
  for (const [label, fg, bg] of pairs) {
    const ratio = contrastRatio(fg, bg);
    assert.ok(meetsAa(fg, bg), `${id} ${label} ${fg} on ${bg} = ${ratio?.toFixed(2)}`);
  }
  ok(`${id}: body, surface, secondary, and filled-accent pairs meet WCAG AA 4.5:1`);
}

const zen = APPEARANCES.zen;
const zenSecondaryOnSurface = contrastRatio(zen.textSecondary, zen.backgroundElement);
assert.ok(zenSecondaryOnSurface != null && zenSecondaryOnSurface >= 4.5, `Zen secondary on surface ${zenSecondaryOnSurface}`);
assert.equal(zen.textSecondary, '#6B6356');
assert.notEqual(zen.textSecondary, '#7A7062');
ok(`Zen corrected secondary #6B6356 on #EDE9E1 is ${zenSecondaryOnSurface?.toFixed(2)}:1`);

assert.equal(zen.accentFill, zen.text);
ok('Zen moss/sand are not used as a fill behind text');

const neonFill = contrastRatio(APPEARANCES.neon.onAccent, APPEARANCES.neon.accentFill);
assert.ok(neonFill != null && neonFill >= 4.5);
ok(`Neon filled button uses a darker cyan fill (${neonFill?.toFixed(2)}:1), not raw #00FFFF under white`);

const root = path.resolve(__dirname, '..');
const srcFile = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');
const picker = fs.readFileSync(path.join(root, 'src/components/appearance-picker.tsx'), 'utf8');
const you = fs.readFileSync(path.join(root, 'src/app/(tabs)/you.tsx'), 'utf8');
const layout = fs.readFileSync(path.join(root, 'src/app/_layout.tsx'), 'utf8');
const plan = fs.readFileSync(path.join(root, 'docs/archive/OLD_PLAN.md'), 'utf8');
const now = fs.readFileSync(path.join(root, 'docs/NOW.md'), 'utf8');

assert.match(you, /AppearancePicker/);
assert.match(picker, /Soft is the default/);
assert.match(layout, /AppearanceProvider/);
assert.match(plan, /Soft \/ Zen \/ Quest \/ Neon \/ Anime/);
assert.doesNotMatch(plan, /Colors: Ink \/ Paper \/ Steel \/ Bloom/);
assert.match(now, /intentional deviation/i);
ok('You picker, launch provider, and docs are wired');

const tabs = fs.readFileSync(path.join(root, 'src/components/app-tabs.tsx'), 'utf8');
const tabBar = fs.readFileSync(path.join(root, 'src/components/themed-tab-bar.tsx'), 'utf8');
const navTheme = fs.readFileSync(path.join(root, 'src/lib/theme/navigation.ts'), 'utf8');
const ctx = fs.readFileSync(path.join(root, 'src/lib/theme/context.tsx'), 'utf8');

assert.match(layout, /navigationTheme/);
const tabsDecl = layout.indexOf('name="(tabs)"');
const themeLabDecl = layout.indexOf('name="theme-lab"');
assert.ok(tabsDecl > 0 && themeLabDecl > tabsDecl, 'theme-lab must not be the Stack cold-start screen');
assert.match(layout, /<Stack\.Protected guard=\{PRE_LAUNCH_DEV\}>[\s\S]*name="theme-lab"/);
assert.doesNotMatch(layout, /<Stack\.Protected guard=\{PRE_LAUNCH_DEV\}>[\s\S]*name="dev-lab"/);
assert.match(layout, /<Stack\.Protected guard=\{isAuthed && hasMe\}>[\s\S]*name="dev-lab"/);
assert.match(fs.readFileSync(path.join(root, 'src/app/theme-lab.tsx'), 'utf8'), /if \(!PRE_LAUNCH_DEV\)/);
assert.match(fs.readFileSync(path.join(root, 'src/app/theme-lab.tsx'), 'utf8'), /Redirect href="\/"/);
assert.doesNotMatch(fs.readFileSync(path.join(root, 'src/app/theme-lab.tsx'), 'utf8'), /Dev only/);
assert.match(fs.readFileSync(path.join(root, 'src/app/dev-lab.tsx'), 'utf8'), /canSeeDevLab/);
assert.match(fs.readFileSync(path.join(root, 'src/app/dev-lab.tsx'), 'utf8'), /Redirect href="\/"/);
assert.doesNotMatch(fs.readFileSync(path.join(root, 'src/app/dev-lab.tsx'), 'utf8'), /Dev only/);
ok('theme-lab is a PRE_LAUNCH_DEV route, not the production initial screen');
ok('dev-lab is on the authed stack, gated by root/grants, not PRE_LAUNCH_DEV-only');

assert.match(navTheme, /card: theme\.background/);
assert.match(tabs, /backgroundColor: theme\.background/);
assert.match(tabs, /useSafeAreaInsets/);
assert.match(tabBar, /backgroundColor: theme\.background/);
assert.doesNotMatch(tabBar, /backgroundElement/);
assert.match(ctx, /typeof Appearance\.setColorScheme === 'function'/);
assert.match(ctx, /ready: boolean/);
ok('tab bar chrome uses appearance background (opaque, not DefaultTheme white)');


// --- subscription gate (no billing wired; this is the decision layer) -------
assert.deepEqual([...FREE_APPEARANCE_IDS], ['soft', 'quest']);
for (const id of APPEARANCE_IDS) {
  const free = (FREE_APPEARANCE_IDS as readonly string[]).includes(id);
  assert.equal(isAppearanceUnlocked(id, false), free, `${id} unlocked-without-sub should be ${free}`);
  assert.equal(isAppearanceUnlocked(id, true), true, `${id} must unlock with a subscription`);
}
// A lapsed subscriber is moved to the default, never stranded on a locked mode.
assert.equal(resolveAllowedAppearance('neon', false), 'soft');
assert.equal(resolveAllowedAppearance('neon', true), 'neon');
assert.equal(resolveAllowedAppearance('quest', false), 'quest');
ok('Soft + Quest are free; the other three need a subscription and fall back to Soft');

// The picker must gate, and the provider must refuse a locked mode.
assert.match(picker, /isAppearanceUnlocked/);
assert.match(picker, /SUBSCRIPTION_LOCKED_NOTE/);
const themeContext = srcFile('src/lib/theme/context.tsx');
assert.match(themeContext, /resolveAllowedAppearance/);
assert.match(themeContext, /if \(!isAppearanceUnlocked\(next, subscriptionActive\)\) return false;/);
ok('picker shows locked modes without applying them; provider refuses a locked write');

// --- shared token base: modes declare differences, not copies ---------------
const appearanceSrc = srcFile('src/constants/appearance.ts');
assert.match(appearanceSrc, /const BASE_TOKENS = \{/);
assert.equal((appearanceSrc.match(/^ {4}\.\.\.BASE_TOKENS,$/gm) ?? []).length, APPEARANCE_IDS.length);
ok('every appearance mode is built from the one shared BASE_TOKENS');

// --- type scale: the 20 and 24 steps exist ---------------------------------
const themedText = srcFile('src/components/themed-text.tsx');
for (const size of ['fontSize: 20', 'fontSize: 24']) {
  assert.ok(themedText.includes(size), `themed-text is missing ${size}`);
}
assert.match(themedText, /subheading/);
assert.match(themedText, /heading/);
ok('type scale has the 20 (subheading) and 24 (heading) steps');

// --- Soft cards have an edge, controls keep the stronger border ------------
assert.notEqual(APPEARANCES.soft.border, 'transparent');
assert.equal(APPEARANCES.soft.cardBorderWidth, 1);
assert.equal(APPEARANCES.soft.controlBorder, 'rgba(31, 41, 55, 0.22)');
assert.match(srcFile('src/lib/theme/chrome.ts'), /if \(theme\.controlBorder\) return theme\.controlBorder;/);
ok('Soft cards have a hairline; outline controls keep the higher-contrast border');

console.log(`\nappearance-check: ${passed}/${passed} passed`);
