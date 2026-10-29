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
import { accentFromShowUp } from '../src/lib/color';
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

  // PHASE-24: the flavour tokens draw frames, glow and bars in these colours, so they are
  // graphics (WCAG 1.4.11, 3:1) against the page, not text.
  const graphics: [string, string][] = [];
  if (t.hudFrames === 'ornament') graphics.push(['ornament frame (accentSecondary)', t.accentSecondary]);
  if (t.hudFrames === 'bracket') graphics.push(['bracket frame (accent)', t.accent], ['bracket frame (accentTertiary)', t.accentTertiary]);
  if (t.glowPulse) graphics.push(['glow (accent)', t.accent]);
  if (t.hpMpBars) graphics.push(['bar fill (accentTertiary)', t.accentTertiary], ['bar fill (accentSecondary)', t.accentSecondary]);
  for (const [label, color] of graphics) {
    const ratio = contrastRatio(color, t.background);
    assert.ok(ratio != null && ratio >= 3, `${id} ${label} ${color} on ${t.background} = ${ratio?.toFixed(2)}`);
  }
  // Bars sit on backgroundSelected inside a card: the fill must still separate from its track.
  if (t.hpMpBars) {
    for (const fill of [t.accentTertiary, t.accentSecondary]) {
      const ratio = contrastRatio(fill, t.backgroundSelected);
      assert.ok(ratio != null && ratio >= 3, `${id} bar fill ${fill} on track ${t.backgroundSelected} = ${ratio?.toFixed(2)}`);
    }
  }
  ok(`${id}: frame, glow and bar colours meet 3:1 graphics contrast`);
}

// --- PHASE-24: flavour tokens are wired, each mode gets its look, Reduce Motion holds still ---
assert.equal(APPEARANCES.quest.hpMpBars, true);
assert.equal(APPEARANCES.quest.hudFrames, 'ornament');
assert.equal(APPEARANCES.neon.glowPulse, true);
assert.equal(APPEARANCES.anime.glowPulse, true);
assert.equal(APPEARANCES.anime.hudFrames, 'bracket');
for (const id of ['soft', 'zen'] as const) {
  assert.equal(APPEARANCES[id].glowPulse, false);
  assert.equal(APPEARANCES[id].hpMpBars, false);
  assert.equal(APPEARANCES[id].hudFrames, 'none');
}
const glowSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/glow-pulse.tsx'), 'utf8');
assert.match(glowSrc, /theme\.glowPulse/);
assert.match(glowSrc, /useMotionReduced\(\)/);
assert.match(glowSrc, /useMotionActive\(\)/);
assert.match(glowSrc, /const run = theme\.glowPulse && active;/);
assert.match(glowSrc, /const amp = rm \? 0\.5 : 1;/);
assert.match(glowSrc, /const cycle = rm \? CYCLE_MS \* 4 : CYCLE_MS;/);
const heroSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/home-hero.tsx'), 'utf8');
assert.match(heroSrc, /<GlowPulse/);
assert.match(heroSrc, /<QuestSkyBars/);
assert.match(fs.readFileSync(path.resolve(__dirname, '../src/app/(tabs)/insights.tsx'), 'utf8'), /<GlowPulse>/);
assert.match(fs.readFileSync(path.resolve(__dirname, '../src/components/quest-growth-bars.tsx'), 'utf8'), /if \(!theme\.hpMpBars/);
ok('glow loop runs only for glowPulse modes, stops under Reduce Motion / unfocused; bars only for hpMpBars; both sit on Home, glow on Insights');

// --- PHASE-24: the share poster draws the sender's still constellation, on its fixed palette ---
const posterSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/share-poster.tsx'), 'utf8');
assert.match(posterSrc, /variant="poster"/);
assert.match(posterSrc, /ring=\{FIELD_RING\}/);
assert.doesNotMatch(posterSrc, /useTheme|useAppearance/, 'the poster stays off the app theme');
assert.match(fs.readFileSync(path.resolve(__dirname, '../src/app/[handle].tsx'), 'utf8'), /<SharePoster me=\{profile\} \/>/, 'the public page passes no tracks');
for (const [label, fg] of [
  ['name', '#F5F1E9'],
  ['handle', '#A6A3AF'],
  ['caption', '#C9C5BC'],
] as const) {
  const ratio = contrastRatio(fg, '#1A1B20');
  assert.ok(ratio != null && ratio >= 4.5, `poster ${label} ${fg} on #1A1B20 = ${ratio?.toFixed(2)}`);
}
// The sender's share image (ShareCard) draws the same still sky from the sender's own tracks.
const cardSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/share-card.tsx'), 'utf8');
assert.match(cardSrc, /variant="poster"/);
assert.match(cardSrc, /accent=\{accent\.dark\}/);
assert.match(fs.readFileSync(path.resolve(__dirname, '../src/components/identity-card.tsx'), 'utf8'), /shape: traitShapePoints\(me, tracks\), tracks \}/);
// The ring is decorative (the stars and line carry the meaning), so it has no contrast floor;
// the star colour (the sender's accent.light) is what must read on the field.
// The poster draws the stars in accent.dark (the brighter pair); sweep every hue show_up can give.
assert.match(posterSrc, /accent=\{accent\.dark\}/);
const SKY_STAR_MIN = 3;
for (let i = 0; i < 4000; i += 1) {
  const star = accentFromShowUp(`phrase ${i}`).dark;
  const ratio = contrastRatio(star, '#1A1B20');
  assert.ok(ratio != null && ratio >= SKY_STAR_MIN, `poster star ${star} (phrase ${i}) = ${ratio?.toFixed(2)}`);
}
assert.match(posterSrc, /ring is decorative|FIELD_RING = /);
ok('poster: constellation still, public page passes no tracks, text clears AA and sample star colours clear 3:1 on the field');

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
const you = fs.readFileSync(path.join(root, 'src/app/settings.tsx'), 'utf8');
const layout = fs.readFileSync(path.join(root, 'src/app/_layout.tsx'), 'utf8');
const plan = fs.readFileSync(path.join(root, 'docs/archive/OLD_PLAN.md'), 'utf8');
const now = fs.readFileSync(path.join(root, 'docs/NOW.md'), 'utf8');

// Parked 2026-09-15 (Card F), RESTORED 2026-10-04 (emci: "bring those back"):
// the picker is mounted on Settings (moved off You in IA P1), right after the build line.
assert.match(you, /import \{ AppearancePicker \} from '@\/components\/appearance-picker';/);
assert.match(you, /<AppearancePicker \/>/);
assert.match(you, /<RunningUpdateLine \/>/);
assert.ok(you.indexOf('<AppearancePicker />') < you.indexOf('<RunningUpdateLine />'), 'picker sits above the build line on Settings');
assert.match(picker, /Soft is the default/);
assert.match(layout, /AppearanceProvider/);
assert.match(plan, /Soft \/ Zen \/ Quest \/ Neon \/ Anime/);
assert.doesNotMatch(plan, /Colors: Ink \/ Paper \/ Steel \/ Bloom/);
assert.match(now, /intentional deviation/i);
ok('Settings picker, launch provider, and docs are wired');

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
assert.match(fs.readFileSync(path.join(root, 'src/app/dev-lab.tsx'), 'utf8'), /hubAccess\(\{/);
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
