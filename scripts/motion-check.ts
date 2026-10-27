/**
 * Motion base + constellation (ATO-BUILD PHASE-03).
 * Run: npm run check:motion
 *
 * Pins: the §1.3 tokens and the haptics map exist; every new primitive reads
 * Reduce Motion; no file under src/components or src/app loops (`withRepeat` /
 * `withSequence`) without reading Reduce Motion (R18); the three older files
 * still read BOTH the phone's setting and the app's (`useAppearance`); loops
 * pause off-screen; the constellation maths (one star per tracked axis, gold
 * above 0.8, strongest-axis label, fixed phases) and its node budget.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { AXIS_SHORT_NAME } from '../src/lib/axis-poles';
import {
  GOLD_COLOR,
  GOLD_STABILITY,
  VARIANT_MOTION,
  constellationLabel,
  constellationModel,
  starPhase,
} from '../src/lib/trait-constellation';
import type { TraitTrack } from '../src/lib/trait-stability';
import { TRAIT_AXES } from '../src/lib/traits';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}
const read = (rel: string) => readFileSync(resolve(rel), 'utf8');

// ── Tokens ───────────────────────────────────────────────────────────────────
const tokens = read('src/lib/motion-tokens.ts');
for (const name of [
  'EASE_OUT', 'EASE_IN_OUT', 'EASE_BACK', 'UI_IN', 'UI_OUT', 'SPRING_POP', 'DUR', 'ENTER', 'PRESS',
  'PLUS_POP', 'SHEEN', 'LIVING_BG', 'BREATH', 'MOTION_GOLD', 'pixelSnap', 'haptic',
]) {
  assert.match(tokens, new RegExp(`export (const|function) ${name}\\b`), `motion-tokens exports ${name}`);
}
assert.match(tokens, /Easing\.bezier\(0\.22, 1, 0\.36, 1\)/, 'EASE_OUT');
assert.match(tokens, /Easing\.bezier\(0\.65, 0, 0\.35, 1\)/, 'EASE_IN_OUT');
assert.match(tokens, /Easing\.bezier\(0\.34, 1\.56, 0\.64, 1\)/, 'EASE_BACK');
assert.match(tokens, /SPRING_POP = \{ damping: 12, stiffness: 220 \}/);
assert.match(tokens, /Math\.round\(x \/ 2\) \* 2/, 'PIXEL_SNAP is whole art pixels (1 art px = 2 pt)');
assert.match(tokens, /BREATH = \{[^}]*low: 0\.85[^}]*high: 1[^}]*cycleMs: 8000/s);
for (const key of ['press', 'commit', 'success', 'reveal', 'stamp', 'fail']) {
  assert.match(tokens, new RegExp(`\\b${key}: \\(\\) =>`), `haptic.${key}`);
}
assert.match(tokens, /selectionAsync/);
assert.match(tokens, /NotificationFeedbackType\.Success/);
assert.match(tokens, /NotificationFeedbackType\.Warning/);
assert.match(tokens, /ImpactFeedbackStyle\.Heavy/);
assert.ok(tokens.includes(`MOTION_GOLD = '${GOLD_COLOR}'`), 'one gold in both files');
ok('motion-tokens: §1.3 easings, springs, durations, BREATH, PIXEL_SNAP and the six-event haptics map');

// ── Every primitive reads Reduce Motion ──────────────────────────────────────
const READS_RM = /useReducedMotion|useMotionReduced|useBreath/;
const primitives = ['press-pop', 'plus-pop', 'sheen', 'living-bg', 'trait-constellation'];
for (const name of primitives) {
  const src = read(`src/components/${name}.tsx`);
  assert.match(src, READS_RM, `${name} must read Reduce Motion`);
  assert.match(src, /forceReduceMotion/, `${name} takes forceReduceMotion for the theme lab`);
}
assert.match(read('src/components/gradient-fill.tsx'), /no motion of its own/, 'gradient-fill is static by design');
assert.match(read('src/hooks/use-motion-reduced.ts'), /useReducedMotion\(\)[\s\S]*useAppearance\(\)/, 'both reads, fixed order');
ok('press-pop, plus-pop, sheen, living-bg and trait-constellation read Reduce Motion; gradient-fill is static');

// ── R18: nothing loops without reading Reduce Motion ─────────────────────────
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(name)) out.push(p);
  }
  return out;
}
const loopers: string[] = [];
for (const file of [...walk(resolve('src/components')), ...walk(resolve('src/app'))]) {
  const src = readFileSync(file, 'utf8');
  if (!/\bwith(Repeat|Sequence)\b/.test(src)) continue;
  loopers.push(file);
  assert.match(src, READS_RM, `${file} uses withRepeat/withSequence without reading Reduce Motion`);
}
assert.ok(loopers.length >= 8, 'the scan sees the files that loop');
ok(`${loopers.length} files under src/components and src/app loop, and every one reads Reduce Motion`);

// ── The older files read both the phone's setting and the app's ──────────────
for (const rel of [
  'src/components/motion.tsx',
  'src/components/check-milestone-badge.tsx',
  'src/components/daily-insights/try-today-card.tsx',
  'src/components/week-strip.tsx',
  'src/components/set-done-moment.tsx',
  'src/components/sage-eight-ball.tsx',
]) {
  const src = read(rel);
  assert.match(src, /useReducedMotion\(\)/, `${rel} reads the phone's Reduce Motion`);
  assert.match(src, /useAppearance\(\)/, `${rel} still reads the app's Reduce Motion`);
  assert.match(src, /systemReduce \|\| appReduce/, `${rel} honours either`);
}
// The toast is told by its caller (the app's setting) and also reads the phone's.
const toast = read('src/components/milestone-toast.tsx');
assert.match(toast, /useReducedMotion\(\)/);
assert.match(toast, /reduceMotionProp \|\| systemReduce/);
const motion = read('src/components/motion.tsx');
assert.match(motion, /FadeIn\.duration\(REDUCED_FADE_MS\)/, 'Appear cross-fades under Reduce Motion');
assert.match(motion, /REDUCED_FADE_MS = 300/, 'a Reduce Motion fade is 300 ms or less');
assert.doesNotMatch(motion, /reduceMotion \? 0\.7/, 'skeletons no longer sit still');
ok('motion.tsx, the milestone badge and the Try today card honour the phone setting and the app setting; Appear cross-fades');

// ── Loops pause off-screen ───────────────────────────────────────────────────
const active = read('src/hooks/use-motion-active.ts');
assert.match(active, /useIsFocused/);
assert.match(active, /AppState/);
for (const name of ['sheen', 'living-bg', 'trait-constellation']) {
  assert.match(read(`src/components/${name}.tsx`), /useMotionActive/, `${name} pauses when unfocused or backgrounded`);
}
assert.match(read('src/hooks/use-breath.ts'), /useMotionActive/, 'the breath loop pauses too');
ok('every looping primitive pauses when the screen is unfocused or the app is backgrounded');

// ── Constellation maths ──────────────────────────────────────────────────────
const track = (axis: (typeof TRAIT_AXES)[number], value: number, stability: number): TraitTrack => ({
  axis,
  track: 'report',
  value,
  stability,
  answerCount: 6,
  lastTouched: new Date().toISOString(),
  lastDepthAt: null,
});
const empty = constellationModel([], 240);
assert.equal(empty.count, 0);
assert.equal(empty.stars.length, 0);
assert.equal(empty.path, null);
ok('no tracks = no stars (the component shows the "light your first stars" card)');

const rows = [
  track('openness', 0.8, 0.3),
  track('extraversion', 0.4, 0.85),
  track('steadiness', 0.6, 0.5),
  { ...track('agreeableness', 0.1, 0.99), track: 'game' as const },
];
const model = constellationModel(rows, 240);
assert.equal(model.stars.length, 3, 'one star per axis with a report track; the game track is ignored');
assert.deepEqual(model.stars.map((s) => s.axis), ['openness', 'extraversion', 'steadiness'], 'TRAIT_AXES order');
assert.ok(model.path, 'three stars make a line');
const [o, e, s] = model.stars;
assert.equal(e.gold, true, 'stability above 0.8 is gold');
assert.equal(o.gold, false);
assert.ok(GOLD_STABILITY === 0.8);
assert.ok(e.radius > o.radius && e.brightness > o.brightness, 'clearer = bigger and brighter');
assert.ok(s.radius > o.radius && s.radius < e.radius);
assert.equal(model.strongest, 'extraversion');
assert.equal(model.label, `Your constellation: 3 traits, strongest ${AXIS_SHORT_NAME.extraversion}`);
assert.equal(constellationLabel(1, 'openness'), `Your constellation: 1 trait, strongest ${AXIS_SHORT_NAME.openness}`);
assert.equal(constellationLabel(0, null), 'Your constellation: no traits yet');
assert.ok(!/\d\.\d|%/.test(model.label), 'no score printed');
ok('stars: one per tracked axis, gold above 0.8, size and brightness follow clarity, label names the strongest');

assert.deepEqual(
  constellationModel(rows, 240).stars.map((x) => x.phase),
  model.stars.map((x) => x.phase),
  'phases do not change on re-render',
);
assert.ok(starPhase(0) >= 0 && starPhase(0) < 1);
assert.notEqual(starPhase(1), starPhase(2));
ok('twinkle phases are fixed per axis and spread out');

assert.deepEqual(Object.keys(VARIANT_MOTION).sort(), ['badge', 'header', 'hero', 'mini']);
assert.equal(VARIANT_MOTION.hero.live && VARIANT_MOTION.header.live, true);
assert.equal(VARIANT_MOTION.mini.live || VARIANT_MOTION.badge.live, false, 'mini and badge sit still');
const full = constellationModel(TRAIT_AXES.map((a) => track(a, 0.5, 0.5)), 240);
assert.equal(full.stars.length, 16);
// Per star: one star circle + one halo circle; one animated line. Count them in the source.
const skySrc = read('src/components/trait-constellation.tsx');
assert.equal((skySrc.match(/<AnimatedCircle\b/g) ?? []).length, 2, 'a star and a halo per axis, nothing else');
assert.equal((skySrc.match(/<AnimatedPath\b/g) ?? []).length, 1, 'one animated line');
assert.ok(16 * 2 + 1 <= 60, 'at most 60 animated nodes');
ok('hero and header move, mini and badge sit still; a full 16-star sky is 35 nodes or fewer');

// ── Constellation motion spec, pinned in source ──────────────────────────────
const sky = read('src/components/trait-constellation.tsx');
assert.match(sky, /duration: 1400, easing: EASE_IN_OUT/, 'line draw 1400 ms');
assert.match(sky, /withDelay\(300/, 'line draw delay 300');
assert.match(sky, /TWINKLE_MS = 4000/, 'twinkle and halos on a 4 s clock');
assert.match(sky, /0\.85 \+ 0\.15 \* Math\.sin/, 'twinkle opacity .7 ↔ 1');
assert.match(sky, /index \* 0\.125/, 'halos are 500 ms apart on the 4 s clock');
assert.match(sky, /BRIGHTEN_DELAY_MS = 1600/, 'brightened delay 1600');
assert.match(sky, /withTiming\(1\.8/);
assert.match(sky, /withSpring\(1\.25, SPRING_POP\)/);
assert.match(sky, /haptic\.commit/, 'brightened buzzes Light');
assert.match(sky, /duration: 1200, easing: EASE_IN_OUT/, 'weekly morph 1200 ms');
assert.match(sky, /duration: rm \? 300 : 600/, 'Reduce Motion colour change is a 300 ms fade');
assert.match(sky, /\/intake-sweep/, 'empty state links to Questions');
assert.match(sky, /Answer a few questions to light your first stars/);
assert.match(sky, /accessibilityLabel=\{model\.label\}/);
assert.doesNotMatch(sky, /useAnimatedProps[\s\S]*runOnJS/, 'no runOnJS in the frame path');
ok('constellation motion matches the spec: draw 1400/300, twinkle 4 s, halos, brighten 1600, morph 1200, Reduce Motion fade');

// ── You carries the header constellation (PHASE-05) ──────────────────────────
const you = read('src/app/(tabs)/you.tsx');
assert.match(
  you,
  /<Appear breathe>[\s\S]*?<TraitConstellation tracks=\{tracks\} size=\{CONSTELLATION_SIZE\} variant="header" \/>/,
  'You renders one header constellation inside Appear breathe',
);
assert.equal((you.match(/<TraitConstellation\b/g) ?? []).length, 1, 'one constellation on You (35 nodes of the 60 cap)');
assert.match(you, /tracksReady && tracksOwned \?\s*\(\s*<Appear breathe>/, 'only once this account\'s tracks have loaded');
assert.ok(
  you.indexOf('<TraitConstellation') < you.indexOf('<ProfileCharacter'),
  'the constellation sits above "This is you so far"',
);
ok('You shows the header constellation once, above "This is you so far", after the tracks load');

// ── Home carries the hero constellation (PHASE-08) ───────────────────────────
const homeHero = read('src/components/home-hero.tsx');
assert.match(
  homeHero,
  /<Appear breathe>[\s\S]*?<TraitConstellation tracks=\{tracks\} size=\{HOME_HERO_SIZE\} variant="hero"/,
  'Home renders one hero constellation inside Appear breathe',
);
assert.equal((homeHero.match(/<TraitConstellation\b/g) ?? []).length, 1, 'one constellation on Home (35 nodes of the 60 cap)');
assert.match(read('src/app/(tabs)/index.tsx'), /<HomeHero userId=\{me\.id\} tracks=\{tracks\} \/>/, 'Home mounts the hero');
ok('Home shows the hero constellation once, inside Appear breathe');

// ── Theme lab previews every primitive ───────────────────────────────────────
const lab = read('src/app/theme-lab.tsx');
for (const tag of ['PressPop', 'PlusPop', 'Sheen', 'LivingBg', 'GradientFill', 'TraitConstellation']) {
  assert.match(lab, new RegExp(`<${tag}\\b`), `theme-lab previews ${tag}`);
}
assert.match(lab, /forceReduceMotion=\{rm\}/, 'each in normal and Reduce Motion');
ok('theme lab shows every primitive, normal and Reduce Motion');

// ── Isolation ────────────────────────────────────────────────────────────────
for (const rel of [
  'src/lib/motion-tokens.ts',
  'src/lib/trait-constellation.ts',
  'src/hooks/use-motion-reduced.ts',
  'src/hooks/use-motion-active.ts',
  'src/hooks/use-breath.ts',
  ...primitives.map((p) => `src/components/${p}.tsx`),
  'src/components/gradient-fill.tsx',
]) {
  const src = read(rel);
  assert.doesNotMatch(src, /from '@\/play\//, `${rel} stays out of src/play`);
  assert.doesNotMatch(src, /generateText|claimAiCall|fetch\(/, `${rel} calls nothing`);
}
ok('no import from src/play and no network or model call');

console.log(`motion-check: ${passed} groups passed`);
