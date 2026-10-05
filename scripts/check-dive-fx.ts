/**
 * Dive FX checks (overhaul, 2026-09-29). Run: npm run check:dive-fx
 *
 * The Dive overhaul is LOOKS ONLY. This pins that:
 *   1. Odds isolation — the Dive UI files (screen, scene, HUD, FX model,
 *      FX level) never import or call the odds / roll code (`pathBaseBust`,
 *      `tierAt`, `diveTierRolls`, `nextDeeperBustPct`, the luck math, the
 *      store's roll transitions) and never roll their own randomness; the %
 *      on the Deeper buttons is `run.bustPct[path]`, and that same value is
 *      what Deeper sends as the shown %.
 *   2. Pacing — the beat and cooldown stay 950 / 650 ms, and every find
 *      reveal (rise, rare hold, fly) ends inside the cooldown, so no
 *      animation delays Surface or Deeper.
 *   3. Look rules — tension (vignette/heartbeat) reads only the shown %,
 *      heartbeat only above 40%; zone colours have no mustard/olive; rarity
 *      glow is rare-or-better for Powers, rings and auras.
 *   4. Wording — no gamble / casino / jackpot / bet in any Dive or Pet UI copy
 *      (GAME_SPEC §7).
 *   5. Hub — the Dive tile is gone; Dive opens from the Pet room.
 *   6. The sunken ruin (v25) — every prop / wall / chest / shark is an art
 *      key that is actually bundled; the shark only in the Reef and Trench;
 *      Effects Low cuts shark → dragon → parallax first; reduced motion drops
 *      everything that moves on its own; the find chest never picks by a roll.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { ACTION_COOLDOWN_MS, ACTION_SPLASH_MS } from '../src/play/action-pacing';
import {
  GLOW_COLOR,
  HEARTBEAT_OVER_PCT,
  DIVE_CUT_ORDER,
  DIVE_DEPTH_INK,
  DIVE_PROPS,
  DRAGON_DEPTH,
  REVEAL_BUDGET_MS,
  SHARK_DEPTHS,
  ZONE_BANDS,
  diveWorldCuts,
  findBoxArt,
  findGlow,
  revealMs,
  vignetteFor,
} from '../src/play/dive-fx-model';
import { diveButtons } from '../src/play/dive-buttons';
import { COSMETICS } from '../src/play/pet-cosmetics';
import { HUB_TILES } from '../src/play/neon-viper';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const read = (p: string) => fs.readFileSync(p, 'utf8');
const UI_FILES = [
  'src/play/dive-screen.tsx',
  'src/play/dive-scene.tsx',
  'src/play/dive-hud.tsx',
  'src/play/dive-buttons.ts',
  'src/play/dive-fx-model.ts',
  'src/play/dive-fx-level.ts',
  'src/play/dive-world.tsx',
];
const ODDS_NAMES = [
  'pathBaseBust',
  'tierAt',
  'diveTierRolls',
  'nextDeeperBustPct',
  'dive_luck',
  'luck_bucket',
  'pushDeeper',
  'rollPowerFind',
];
for (const file of UI_FILES) {
  const src = read(file);
  for (const name of ODDS_NAMES) {
    assert.ok(!new RegExp(`\\b${name}\\b`).test(src), `${file} must not touch the odds (${name})`);
  }
  assert.ok(!/Math\.random/.test(src), `${file} must not roll its own randomness`);
}
const screen = read('src/play/dive-screen.tsx');
assert.match(screen, /const shown = run\.bustPct \? run\.bustPct\[path\] : null;/, 'Deeper sends the shown % from the view');
assert.match(screen, /onDeeper\(path, shown\)/, 'Deeper passes the shown % to the store');
assert.match(screen, /bustPct: run\.bustPct,/, 'the buttons are built from run.bustPct');
{
  // Every button state has a real, non-empty label; the % shown is the input % exactly.
  const pct = { safe: 20, rich: 36 };
  const states = {
    before: diveButtons({ active: false, canDeeper: false, bustPct: null, charges: 3, nextChargeInMs: null }),
    during: diveButtons({ active: true, canDeeper: true, bustPct: pct, charges: 2, nextChargeInMs: 60_000 }),
    max: diveButtons({ active: true, canDeeper: false, bustPct: null, charges: 2, nextChargeInMs: null }),
    empty: diveButtons({ active: false, canDeeper: false, bustPct: null, charges: 0, nextChargeInMs: 7 * 60_000 }),
  };
  for (const [name, list] of Object.entries(states)) {
    assert.ok(list.length > 0, `${name}: at least one button`);
    for (const b of list) assert.ok(b.label.trim().length >= 4, `${name}/${b.id}: a real label`);
  }
  assert.deepEqual(states.before.map((b) => b.label), ['DIVE · 1 CHARGE']);
  assert.deepEqual(states.during.map((b) => b.label), ['DEEPER · SAFER 20%', 'DEEPER · RICHER 36%', 'SURFACE']);
  assert.deepEqual(states.max.map((b) => b.label), ['SURFACE'], 'max depth: Surface only');
  assert.deepEqual(
    states.empty.map((b) => [b.label, b.enabled]),
    [
      ['NO CHARGES · NEXT IN 7M', false],
      ['FREE DIVE · SHELLS + MOOD', true],
    ],
    'out of charges: greyed + free dive',
  );
  // The button layout never uses a bare flex:1 (that could collapse the label).
  assert.ok(!screen.includes('button: { flex: 1'), 'no flex:1 button outside a row');
  assert.ok(screen.includes('minHeight: 50'), 'buttons keep room for their text');
  // iOS Yoga: flexBasis 0 + minWidth 0 collapses the face to ~0 width. The row
  // keeps its height, so the dock shows an empty ink gap and no DIVE / DEEPER / SURFACE.
  assert.ok(!/button:\s*\{[^}]*flexBasis:\s*0[,}]/.test(screen), 'buttons do not use flexBasis 0');
  assert.ok(!/button:\s*\{[^}]*minWidth:\s*0[,}]/.test(screen), 'buttons do not use minWidth 0');
  assert.ok(screen.includes("flexBasis: '0%'"), 'buttons use a percent basis so iOS keeps a width');
  assert.ok(!screen.includes('numberOfLines={4}'), 'the dock does not keep a 4-line help block');
  assert.ok(screen.includes('One charge starts you with one find'), 'the long rules live in the Info sheet');
}
assert.match(screen, /bustPct=\{run\.active \? run\.bustPctNext : null\}/, 'the scene reads the shown % only');
ok('odds isolation: Dive UI never touches the rolls; the % shown is the % sent');

assert.equal(ACTION_SPLASH_MS, 950, 'beat pinned at 950ms');
assert.equal(ACTION_COOLDOWN_MS, 650, 'cooldown pinned at 650ms');
assert.equal(REVEAL_BUDGET_MS, ACTION_COOLDOWN_MS);
for (const glow of ['common', 'rare', 'epic'] as const) {
  assert.ok(revealMs(glow) <= REVEAL_BUDGET_MS, `${glow} reveal (${revealMs(glow)}ms) fits in the cooldown`);
}
assert.ok(!/await .*(setTimeout|withTiming)/.test(screen), 'no action waits on an animation');
// Every surface / bust replays: scene-event keys only ever go up (a reset
// to null between dives must not reuse key 1 — the scene skips seen keys).
assert.match(screen, /eventSeq\.current \+= 1;/, 'scene-event keys come from a counter that only goes up');
assert.ok(!/key: \(prev\?\.key \?\? 0\) \+ 1 \}\)\)/.test(screen.split('setReveal')[0]), 'no prev-based event key');
ok('pacing: 950 / 650 ms unchanged; every reveal ends inside the cooldown');

assert.equal(vignetteFor(null).pulse, false);
assert.equal(vignetteFor(HEARTBEAT_OVER_PCT).pulse, false, 'exactly 40% = no pulse');
assert.equal(vignetteFor(HEARTBEAT_OVER_PCT + 1).pulse, true, 'over 40% pulses');
assert.ok(vignetteFor(55).edge > vignetteFor(18).edge, 'edges close in as the % climbs');
assert.ok(vignetteFor(55).clear < vignetteFor(18).clear);
// No mustard / olive: every zone colour is blue-ish, teal, navy, black or violet (red never dominates green+blue).
for (const band of ZONE_BANDS) {
  for (const hex of [band.top, band.bottom]) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    assert.ok(!(r > b && g > b), `${hex} is yellow/olive-ish`);
  }
}
assert.ok(!read('src/play/dive-scene.tsx').includes("skinArt('map.grass')"), 'no grass tiles under the water');
const ring = COSMETICS.find((c) => c.slot === 'ring');
const tint = COSMETICS.find((c) => c.slot === 'tint');
if (ring) assert.equal(findGlow(ring.id), 'epic');
if (tint) assert.equal(findGlow(tint.id), 'rare');
assert.ok(GLOW_COLOR.common && GLOW_COLOR.rare && GLOW_COLOR.epic);
ok('looks: tension reads the shown %, heartbeat over 40%, neon zones, rarity glow');

const banned = /\b(gamble|gambling|casino|jackpot|bet|bets|betting)\b/i;
for (const file of [
  ...UI_FILES,
  'src/play/pet-screen.tsx',
  'src/play/pet-room.tsx',
  'src/play/pet-sheets.tsx',
  'src/play/pet-talk.ts',
  'src/play/coach.ts',
]) {
  // Strings only: comments may name the rule itself.
  // The banned-word list itself (pet-talk.ts) is the one allowed mention.
  const source = read(file).replace(/export const PET_BANNED_WORDS[^;]*;/, '');
  const strings = source.match(/(['"`])(?:\\.|(?!\1).)*\1/g) ?? [];
  for (const s of strings) assert.ok(!banned.test(s), `${file}: banned word in ${s}`);
}
const jsxText = screen.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
assert.ok(!banned.test(jsxText), 'dive-screen copy has no banned words');
ok('wording: no gamble / casino / jackpot / bet in Dive or Pet copy');

assert.ok(!HUB_TILES.some((t) => t.to === 'dive'), 'no Dive tile on the hub');
assert.ok(HUB_TILES.some((t) => t.to === 'pet'), 'the Pet tile stays');
assert.match(read('src/play/command-hub.tsx'), /Dive in progress/, 'the Pet tile shows a dive in progress');
ok('hub: Dive tile gone, Pet tile shows a dive in progress');

{
  const atlas = read('src/play/pixel-atlas.tsx');
  const world = read('src/play/dive-world.tsx');
  const frames = [
    ...DIVE_PROPS.flat().map((pr) => pr.frame),
    ...[0, 1, 2, 3, 4, 5].map(findBoxArt),
    'fish-big',
  ];
  for (const frame of frames) assert.ok(atlas.includes(`'${frame}':`), `${frame} is a dive atlas frame`);
  assert.ok(world.includes('fish-big'), 'the glide uses the pack fish');
  assert.ok(!world.includes('tintColor'), 'no tint over the dive pixels');
  assert.ok(!world.includes('<CausticWash'), 'baked plate caustics only — no teal wash bars');
  assert.equal(DIVE_PROPS.length, ZONE_BANDS.length, 'props for every zone');
  assert.equal(DIVE_DEPTH_INK.length, ZONE_BANDS.length, 'an ink for every zone');
  assert.deepEqual([...SHARK_DEPTHS], [1, 2, 3], 'the shark: Reef (1-2) and Trench (3) only');
  assert.equal(DRAGON_DEPTH, 4, 'the dragon: the Abyss');
  const lum = (hex: string) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);
  for (let i = 1; i < 5; i += 1) assert.ok(lum(DIVE_DEPTH_INK[i]) < lum(DIVE_DEPTH_INK[i - 1]), `water darkens at depth ${i}`);
  // Cut order: Low drops shark, dragon, parallax first; props stay.
  assert.deepEqual([...DIVE_CUT_ORDER], ['shark', 'dragon', 'parallax', 'props', 'trail']);
  const full = diveWorldCuts('full', false);
  const low = diveWorldCuts('low', false);
  const still = diveWorldCuts('full', true);
  assert.ok(full.shark && full.dragon && full.parallax && full.props && full.trail && full.motion, 'full draws it all');
  assert.ok(!low.shark && !low.dragon && !low.parallax && low.props, 'Low cuts shark, dragon, parallax; keeps props');
  assert.ok(!still.shark && !still.parallax && !still.trail && !still.motion && still.props, 'reduced motion: scenery only');
  const scene = read('src/play/dive-scene.tsx');
  assert.match(scene, /cuts\.shark && !atSurface && SHARK_DEPTHS\.includes\(depth\)/, 'the shark obeys the cut and the zones');
  assert.match(scene, /findBoxArt\(depth\)/, 'the chest is picked by depth, not a roll');
  assert.match(read('src/play/dive-screen.tsx'), /atSurface=\{!run\.active\}/, 'the surface start shows before a dive');
}
ok('sunken ruin: bundled art only, shark in Reef/Trench, Low cuts shark → dragon → parallax');

console.log(`\ncheck:dive-fx — ${passed} groups passed.`);
