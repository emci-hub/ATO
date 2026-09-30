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
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { ACTION_COOLDOWN_MS, ACTION_SPLASH_MS } from '../src/play/action-pacing';
import {
  GLOW_COLOR,
  HEARTBEAT_OVER_PCT,
  REVEAL_BUDGET_MS,
  ZONE_BANDS,
  findGlow,
  revealMs,
  vignetteFor,
} from '../src/play/dive-fx-model';
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
  'src/play/dive-fx-model.ts',
  'src/play/dive-fx-level.ts',
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
assert.match(screen, /\{run\.bustPct\?\.\[path\]\}%/, 'the button shows run.bustPct[path]');
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

console.log(`\ncheck:dive-fx — ${passed} groups passed.`);
