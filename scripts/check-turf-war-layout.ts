/**
 * Turf War layout gate (T1, 2026-10-16).
 * Run: npm run check:turf-war-layout  (part of check:ota-gate)
 * Rules: docs/turf-war-layout.md. Pure math from src/play/turf-layout.ts + stage-frame.ts, plus
 * source assertions on defend-screen.tsx.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { ATO_PADS, BOARD_MAPS, TILE } from '../src/play/board-data';
import { computeStageFrame, TAP_MIN, type Insets } from '../src/play/stage-frame';
import {
  BUILD_CARD_FLIP_BELOW,
  BUILD_CARD_MAX_H,
  buildCardPlacement,
  padTapRadiusPt,
  turfBoardRect,
  turfBoardSide,
} from '../src/play/turf-layout';
import { TURF_ART_PX, ambientShare, ambientSpriteBoxes, pigeonScared, turfAmbientMeta } from '../src/play/turf-ambient-layout';
import {
  DEATH_POP_FX,
  DEATH_POP_MS,
  EFFECT_DURATIONS,
  FLASH_COOLDOWN_MS,
  HIT_STOP_MS,
  HIT_STOP_TIMER_MS,
  IMPACT_FRAMES,
  TOWER_FX,
  chipValue,
  combatFxFlags,
  jitter,
  nextChip,
  showHealthBar,
} from '../src/play/turf-combat-fx-rules';
import {
  BOSS_ABILITIES,
  BOSS_DEATH_MS,
  BOSS_EFFECT_DURATIONS,
  BOSS_FX,
  BOSS_SUMMON_MS,
  BOSS_TELEGRAPHS,
  ENRAGE_WINDUP_MS,
  TELEGRAPH_MIN_MS,
  WAVE_CHIP_BOX,
  bossBar,
  bossFxFlags,
  enrageWarning,
  telegraphStart,
} from '../src/play/turf-boss-fx-rules';
import { allBoundBossDefs } from '../src/play/engine/bound-boss';
import { allBossBands } from '../src/play/engine/bands';

const repo = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(repo, rel), 'utf8');
let passed = 0;
const ok = (msg: string) => {
  passed += 1;
  console.log(`  ✓ ${msg}`);
};

const DEVICES: { name: string; window: { width: number; height: number }; insets: Insets; side: number }[] = [
  { name: '430x932', window: { width: 430, height: 932 }, insets: { top: 59, bottom: 34, left: 0, right: 0 }, side: 414 },
  { name: '375x667', window: { width: 375, height: 667 }, insets: { top: 20, bottom: 0, left: 0, right: 0 }, side: 359 },
];

for (const d of DEVICES) {
  for (const id of ['turf-setup', 'turf-wave'] as const) {
    const stage = computeStageFrame(id, d.window, d.insets).stage;
    const rect = turfBoardRect(stage);
    assert.equal(rect.size, d.side, `${id} @ ${d.name}: board side = stage width − 16`);
    assert.equal(turfBoardSide(stage), Math.min(stage.width - 16, stage.height), `${id} @ ${d.name}: width − 16, capped by the stage height`);
    assert.ok(rect.x >= 0 && rect.y >= 0 && rect.x + rect.size <= stage.width && rect.y + rect.size <= stage.height, `${id} @ ${d.name}: board inside the stage`);
    assert.equal(rect.x, (stage.width - rect.size) / 2, `${id} @ ${d.name}: centred across`);
    assert.equal(rect.y, (stage.height - rect.size) / 2, `${id} @ ${d.name}: centred down`);
  }
  // Setup and wave share one stage, so one board.
  const a = turfBoardRect(computeStageFrame('turf-setup', d.window, d.insets).stage);
  const b = turfBoardRect(computeStageFrame('turf-wave', d.window, d.insets).stage);
  assert.deepEqual(a, b, `${d.name}: the board does not move between setup and wave`);
}
ok('board fills the stage width − 16 (414 / 359 pt), inside and centred, identical in setup and wave');

for (const d of DEVICES) {
  const stage = computeStageFrame('turf-setup', d.window, d.insets).stage;
  const { size, x, y } = turfBoardRect(stage);
  const r = padTapRadiusPt(size);
  assert.ok(r * 2 >= TAP_MIN, `${d.name}: pad hit circle ${(r * 2).toFixed(1)} pt ≥ ${TAP_MIN}`);
  const centres = ATO_PADS.map((p) => ({ cx: x + (p.x / 100) * size, cy: y + (p.y / 100) * size }));
  centres.forEach((c, i) => {
    assert.ok(c.cx - r >= x - 1 && c.cx + r <= x + size + 1 && c.cy - r >= y - 1 && c.cy + r <= y + size + 1, `${d.name}: pad ${i} hit circle inside the board`);
    centres.forEach((o, j) => {
      if (j > i) assert.ok(Math.hypot(c.cx - o.cx, c.cy - o.cy) >= r * 2 - 0.01, `${d.name}: pads ${i} and ${j} hit circles do not overlap`);
    });
  });
}
ok(`all ${ATO_PADS.length} pad hit circles ≥ 44 pt, inside the board, never overlapping`);

for (const d of DEVICES) {
  const stage = computeStageFrame('turf-setup', d.window, d.insets).stage;
  const board = turfBoardRect(stage);
  const card = { width: 280, height: BUILD_CARD_MAX_H };
  ATO_PADS.forEach((pad, i) => {
    const p = buildCardPlacement(stage, pad, card);
    assert.equal(p.side, pad.y < BUILD_CARD_FLIP_BELOW ? 'below' : 'above', `${d.name}: pad ${i} card side (preferred side fits at ${BUILD_CARD_MAX_H} pt)`);
    assert.ok(p.x >= 0 && p.y >= 0 && p.x + card.width <= stage.width && p.y + card.height <= stage.height, `${d.name}: pad ${i} card inside the stage`);
    const cy = board.y + (pad.y / 100) * board.size;
    const r = padTapRadiusPt(board.size);
    const covers = p.y < cy + r && p.y + card.height > cy - r;
    assert.ok(!covers, `${d.name}: pad ${i} card does not cover its own pad`);
  });
}
ok('build-card rule: above the pad (below for the top 30 %), clamped inside the stage, never over its pad (15 pads × 2 phones)');

{
  const src = read('src/play/defend-screen.tsx');
  assert.ok(!/TURF_HEADER_PT/.test(src), 'no in-stage header constant');
  assert.ok(!/styles\.turfHeader/.test(src), 'no in-stage title + lede');
  assert.match(src, /const boardSide = turfBoardSide\(setupFrame\.stage\);/, 'board side comes from turf-layout');
  assert.match(src, /padTapRadiusUnits\(/, 'pad taps use the ≥ 44 pt radius');
  assert.ok(!/PAD_TAP_RADIUS\b/.test(src), 'no fixed pad radius left in defend-screen');
  // Leave: only in the pause menu (and the confirm it opens). No Leave button in a dock or HUD.
  const leaveButtons = src.match(/label="Leave"/g) ?? [];
  assert.equal(leaveButtons.length, 1, 'exactly one Leave button (the pause menu)');
  assert.match(src, /pauseMenuOpen \? \([\s\S]{0,900}label="Leave"[\s\S]{0,200}onPress=\{requestLeaveRun\}/, 'the pause menu holds Resume + Leave');
  const dockStart = src.indexOf('dock={');
  const dockEnd = src.indexOf('float={', dockStart);
  assert.ok(dockStart > 0 && dockEnd > dockStart, 'dock prop found');
  assert.ok(!/requestLeaveRun/.test(src.slice(dockStart, dockEnd)), 'no Leave in the dock');
  assert.ok(!/styles\.leaveButton/.test(src), 'no classic HUD Leave pill');
  assert.match(src, /defendBackStep\(phase, leaveConfirmOpen\)/, 'back-swipe still opens the Leave confirm');
  assert.ok(!/Leave from the bar below/.test(src), 'the pause line no longer points at a bar');
  // Pause is in the top bar with a ≥ 44 pt hit area (40 + hitSlop 8 each side).
  assert.match(src, /accessibilityLabel=\{paused \? 'Resume wave' : 'Pause wave'\}\s*hitSlop=\{8\}/, 'pause sits in the top bar with hitSlop');
  assert.match(src, /streetPause: \{ width: 40, height: 40/, 'pause is 40 pt + 8 slop = 56');
  ok('Leave only in the pause menu; pause in the top bar; back-swipe confirm kept; title + lede out of the stage');
}

{
  // Dock buttons: ≥ 44 high, ≥ 8 apart (gap).
  const src = read('src/play/defend-screen.tsx');
  assert.match(src, /streetSpeed: \{ minWidth: 52, minHeight: 48 \}/, 'speed buttons ≥ 44 × 44');
  assert.match(src, /streetSkill:\s*\{[^}]*minHeight: 52/, 'Cast button ≥ 44 high');
  assert.match(src, /streetDockRow: \{[^}]*gap: 8/, 'dock row gap ≥ 8');
  assert.match(src, /turfPauseButton: \{ minHeight: 48 \}/, 'pause menu buttons 48 pt');
  ok('dock buttons ≥ 44 × 44 and ≥ 8 pt apart; pause menu buttons 48');
}

{
  // T2: the real build card (fixed width per phone, fixed height per mode) fits every pad, never covers it.
  const card = read('src/play/turf-build-card.tsx');
  const width = Number(/BUILD_CARD_WIDTH = (\d+)/.exec(card)?.[1]);
  const heights = /BUILD_CARD_HEIGHT = \{ build: (\d+), tower: (\d+), boss: (\d+) \}/.exec(card);
  assert.ok(width > 0 && heights, 'build card width + heights are literal constants');
  const modes = { build: Number(heights![1]), tower: Number(heights![2]), boss: Number(heights![3]) };
  for (const [mode, h] of Object.entries(modes)) assert.ok(h <= BUILD_CARD_MAX_H, `${mode} card ${h} pt ≤ ${BUILD_CARD_MAX_H}`);
  for (const d of DEVICES) {
    const stage = computeStageFrame('turf-setup', d.window, d.insets).stage;
    const w = Math.min(width, stage.width - 16);
    const board = turfBoardRect(stage);
    const r = padTapRadiusPt(board.size);
    for (const [mode, h] of Object.entries(modes)) {
      ATO_PADS.forEach((pad, i) => {
        const p = buildCardPlacement(stage, pad, { width: w, height: h });
        assert.ok(p.x >= 0 && p.y >= 0 && p.x + w <= stage.width && p.y + h <= stage.height, `${d.name}: ${mode} card for pad ${i} inside the stage`);
        const cy = board.y + (pad.y / 100) * board.size;
        assert.ok(!(p.y < cy + r && p.y + h > cy - r), `${d.name}: ${mode} card for pad ${i} does not cover its pad`);
      });
    }
  }
  // Taps ≥ 44: choice tiles, the close ✕ (32 + hitSlop 6 each side), Remove, Upgrade (TurfButton min 48).
  assert.match(card, /tile: \{\s*width: 100,\s*height: 60,/, 'choice tiles are 100 × 60');
  assert.match(card, /close: \{\s*width: 32,\s*height: 32,/, 'close ✕ is 32 pt …');
  assert.match(card, /hitSlop=\{6\}/, '… plus 6 pt slop each side = 44');
  assert.match(card, /remove: \{ minHeight: SHEET\.tap, minWidth: 96 \}/, 'Remove ≥ 44 high');
  const ui = read('src/play/turf-ui.tsx');
  assert.match(ui, /minHeight: SHEET\.tap \+ 4,/, 'TurfButton is ≥ 48 high');
  assert.match(card, /armed === choice\.key[\s\S]{0,400}choice\.onBuy\(\)/, 'two taps to buy: the second tap on the armed choice buys');
  ok(`build card (${width} wide; ${heights![1]} / ${heights![2]} / ${heights![3]} pt) fits all 15 pads at both phones, taps ≥ 44, two-tap buy`);
}

{
  // T2: Turf cards are on sheet-kit, not the old styles.card; the bottom panel only carries results.
  const src = read('src/play/defend-screen.tsx');
  const from = src.indexOf('const padCard = (() => {');
  const to = src.indexOf('\n  return (', from);
  assert.ok(from > 0 && to > from, 'padCard / resultCard / floatCards block found');
  const block = src.slice(from, to);
  assert.ok(!/styles\.card\b|ThemedView/.test(block), 'no styles.card / ThemedView in the Turf float cards');
  assert.ok(!/styles\.hudButton|styles\.primaryButton/.test(block), 'no old hud / primary buttons in the Turf float cards');
  assert.match(block, /<TurfBuildCard/, 'the build card is used');
  assert.match(block, /<TurfResultCard/, 'result cards use the kit');
  assert.ok(!/TOWER_LETTER/.test(src), 'no tower letter badge (level pips instead)');
  assert.match(src, /TOWER_PIP_R/, 'level pips on the board');
  const ui = read('src/play/turf-ui.tsx');
  assert.match(ui, /from '@\/play\/sheet-kit'/, 'turf-ui is built on sheet-kit');
  // Prices, stats and rules are not touched here: the card only reads TOWER_DEFS / towerUpgradeCost.
  assert.ok(!/placeCost\s*[:=]\s*\d/.test(read('src/play/turf-build-card.tsx') + ui), 'no prices in the UI files');
  ok('Turf float cards are on sheet-kit (no styles.card), result cards on TurfResultCard, level pips on the board');
}

{
  // T4: the ambient layer — placement is clear of pads and road; it lives outside the sim SVG, under the units;
  // it honours fx-quality and Reduce Motion; it never re-renders per tick and never changes a size.
  const meta = JSON.parse(read('assets/play/sheets/streetwear/meta.json')) as { boards?: unknown };
  const amb = turfAmbientMeta(meta.boards, 'ato');
  assert.ok(amb, 'meta.boards.ato.ambient is packed (npm run art:pack -- --skin streetwear --boards-only)');
  assert.ok(amb.barrels.length >= 1 && amb.cones.length >= 1 && amb.pigeons.length >= 1 && amb.vent, 'all five loops have a site: barrel fire, cone lamp, pigeons, vent steam, neon pools');
  assert.ok(amb.pools.length >= 1 && amb.fires.length === amb.barrels.length, 'neon pools + one firelight per barrel');
  const map = BOARD_MAPS.ato;
  const isRoad = (cx: number, cy: number) => {
    const v = map.grid[cy]?.[cx];
    return v === TILE.PATH || v === TILE.START;
  };
  const padR = Math.max(...DEVICES.map((d) => {
    const size = turfBoardRect(computeStageFrame('turf-setup', d.window, d.insets).stage).size;
    return padTapRadiusPt(size) / size;
  })) * TURF_ART_PX;
  const TOL = 8; // a wisp may clip the board edge by a few px; it never leaves a sprite hanging over the road
  for (const b of ambientSpriteBoxes(amb)) {
    const tag = `${b.kind} at ${Math.round(b.x)},${Math.round(b.y)}`;
    assert.ok(b.x >= -TOL && b.y >= -TOL && b.x + b.w <= TURF_ART_PX + TOL && b.y + b.h <= TURF_ART_PX + TOL, `${tag} inside the board`);
    for (const p of ATO_PADS) {
      const px = (p.x / 100) * TURF_ART_PX;
      const py = (p.y / 100) * TURF_ART_PX;
      const nx = Math.max(b.x, Math.min(px, b.x + b.w));
      const ny = Math.max(b.y, Math.min(py, b.y + b.h));
      assert.ok(Math.hypot(px - nx, py - ny) > padR, `${tag} is clear of the pad hit circle at ${p.x},${p.y}`);
    }
    if (b.kind !== 'lamp') {
      for (let cy = Math.floor(Math.max(0, b.y) / 32); cy <= Math.floor(Math.min(TURF_ART_PX - 1, b.y + b.h) / 32); cy += 1) {
        for (let cx = Math.floor(Math.max(0, b.x) / 32); cx <= Math.floor(Math.min(TURF_ART_PX - 1, b.x + b.w) / 32); cx += 1) {
          assert.ok(!isRoad(cx, cy), `${tag} is off the road (cell ${cx},${cy})`);
        }
      }
    }
  }
  // pure rules
  assert.equal(pigeonScared(amb.pigeons[0]!, []), false, 'no creep, no scare');
  const p0 = { x: (amb.pigeons[0]!.x / TURF_ART_PX) * 100, y: (amb.pigeons[0]!.y / TURF_ART_PX) * 100 };
  assert.equal(pigeonScared(amb.pigeons[0]!, [{ x: p0.x + 5, y: p0.y }]), true, 'a creep near a pigeon scares it');
  assert.equal(pigeonScared(amb.pigeons[0]!, [{ x: p0.x + 40, y: p0.y }]), false, 'a far creep does not');
  assert.deepEqual(ambientShare('off'), { animate: false, everyOther: false, smokeSteam: false }, 'Off = still frame');
  assert.deepEqual(ambientShare('minimal'), { animate: true, everyOther: true, smokeSteam: false }, 'Minimal = half');
  assert.deepEqual(ambientShare('full'), { animate: true, everyOther: false, smokeSteam: true }, 'Full = all');

  const ui = read('src/play/turf-ambient.tsx');
  assert.ok(!/react-native-svg/.test(ui), 'the ambient layer is not an SVG (nothing inside the sim <Svg>)');
  assert.match(ui, /useFxQuality\(\)/, 'honours fx-quality');
  assert.match(ui, /usePlayMotion\(\)/, 'honours Reduce Motion / Motion Off');
  assert.match(ui, /motion\.cosmeticsStill/, 'Motion Off = still frame');
  assert.match(ui, /motion\.vestibularSafe \? 0\.5 : 1/, 'Reduce Motion = half speed');
  assert.match(ui, /useSharedValue/, 'loops run on the UI thread');
  assert.ok(!/useState/.test(ui), 'no React state in the ambient layer (nothing re-renders per tick)');
  assert.match(ui, /pointerEvents="none" style=\{styles\.fill\}/, 'the layer never takes a touch');
  assert.match(ui, /export const TurfAmbient = memo\(/, 'the layer is memoised (the sim ticks every 100 ms, the layer does not)');
  assert.match(ui, /t\.value = 0;\s+t\.value = withDelay/, 'an animated loop starts at frame 0 (withRepeat restarts from the start value)');
  const src = read('src/play/defend-screen.tsx');
  const board = src.indexOf("<ClipImage drawable={{ kind: 'sheet', sheetKey: streetBoardKey, frameKey: 'img' }} />");
  const ambient = src.indexOf('<TurfAmbient ');
  const units = src.indexOf('<Svg width="100%" height="100%" viewBox="0 0 100 100">');
  assert.ok(board > 0 && ambient > board && units > ambient, 'order: baked board, ambient layer, then the units SVG');
  assert.match(src, /const ambientCreeps = useCallback\(/, 'a stable creep reader keeps the memoised layer from re-rendering');
  assert.equal((src.match(/<TurfAmbient /g) ?? []).length, 1, 'one mount');
  ok(`ambient layer: ${ambientSpriteBoxes(amb).length} sprites clear of pads and road, outside the sim SVG, fx-quality Off / Minimal / Full, Reduce Motion half speed, pigeon scare rule`);
}

{
  // T5: combat effects — every tower has a projectile + an impact, timings inside the table, Off / calm motion
  // = no flash / shake / hit stop, the effects layer is outside the sim SVG, numbers merge per creep.
  const meta = JSON.parse(read('assets/play/sheets/streetwear/meta.json')) as { fx: Record<string, { frames: number; loop: boolean }> };
  for (const [kind, keys] of Object.entries(TOWER_FX)) {
    const shot = meta.fx[keys.shot];
    const hit = meta.fx[keys.hit];
    assert.ok(shot && shot.loop, `${kind}: projectile ${keys.shot} is packed and loops`);
    assert.ok(hit && !hit.loop, `${kind}: impact ${keys.hit} is packed and plays once`);
    assert.ok(hit.frames >= IMPACT_FRAMES.min, `${kind}: impact has ≥ ${IMPACT_FRAMES.min} frames`);
  }
  // New T5 art is 3–6 frames; vine / crystal keep the library root / spark hits emci picked (8 frames, same life window).
  assert.ok(meta.fx['archer/hit']!.frames <= IMPACT_FRAMES.max, 'the new archer impact is ≤ 6 frames');
  const pop = meta.fx[DEATH_POP_FX];
  assert.ok(pop && !pop.loop && Math.abs((pop.frames / 12) * 1000 - DEATH_POP_MS) <= 100, 'death pop is packed, one-shot, ~1.1 s');
  for (const [name, d] of Object.entries(EFFECT_DURATIONS)) {
    assert.ok(d.ms >= d.min && d.ms <= d.max, `${name}: ${d.ms} ms inside [${d.min}, ${d.max}]`);
  }
  const src = read('src/play/defend-screen.tsx');
  const corpse = /const CREEP_CORPSE_MS = ([\d_]+);/.exec(src);
  assert.ok(corpse && Number(corpse[1]!.replace(/_/g, '')) === DEATH_POP_MS, 'the death pop keeps the corpse timing');
  const calm = [
    combatFxFlags('off', { vestibularSafe: false, cosmeticsStill: false }),
    combatFxFlags('full', { vestibularSafe: true, cosmeticsStill: false }),
    combatFxFlags('full', { vestibularSafe: true, cosmeticsStill: true }),
    combatFxFlags('minimal', { vestibularSafe: true, cosmeticsStill: false }),
  ];
  for (const f of calm) assert.ok(!f.flash && !f.shake && !f.hitStop, 'Effects Off / Reduce Motion / Motion Off: no flash, no shake, no hit stop');
  assert.deepEqual(combatFxFlags('off', { vestibularSafe: false, cosmeticsStill: false }), { flash: false, shake: false, hitStop: false, pop: false, leakPulse: false }, 'Off = no effect at all');
  assert.deepEqual(combatFxFlags('minimal', { vestibularSafe: false, cosmeticsStill: false }), { flash: true, shake: false, hitStop: false, pop: true, leakPulse: true }, 'Minimal = core only');
  assert.deepEqual(combatFxFlags('full', { vestibularSafe: false, cosmeticsStill: false }), { flash: true, shake: true, hitStop: true, pop: true, leakPulse: true }, 'Full = all');
  assert.equal(showHealthBar(10, 10), false, 'full HP: no bar');
  assert.equal(showHealthBar(9, 10), true, 'hurt: bar');
  assert.equal(chipValue({ from: 1, to: 0.5, at: 0 }, 0.5, 40), 1, 'chip holds first');
  assert.ok(chipValue({ from: 1, to: 0.5, at: 0 }, 0.5, 190) < 1 && chipValue({ from: 1, to: 0.5, at: 0 }, 0.5, 190) > 0.5, 'then drains');
  assert.equal(chipValue({ from: 1, to: 0.5, at: 0 }, 0.5, 400), 0.5, 'and is gone');
  assert.ok(Math.abs(jitter(7, 1, 6)) <= 6 && jitter(7, 1, 6) === jitter(7, 1, 6), 'number nudge is small and stable');

  const fx = read('src/play/turf-combat-fx.tsx');
  assert.ok(!/react-native-svg/.test(fx), 'the combat-effects layer is not an SVG (nothing new inside the sim <Svg>)');
  assert.ok(!/withRepeat/.test(fx), 'no looping animation in the combat-effects layer (one-shots only)');
  assert.match(fx, /useSharedValue/, 'effects run on the UI thread');
  assert.match(fx, /pointerEvents="none" style=\{styles\.fill\}/, 'the layer never takes a touch');
  assert.match(fx, /export const TurfCombatFx = memo\(/, 'the layer is memoised (the sim ticks every 100 ms, the layer does not)');
  const units = src.indexOf('<Svg width="100%" height="100%" viewBox="0 0 100 100">');
  const unitsEnd = src.indexOf('</Svg>', units);
  const layer = src.indexOf('<TurfCombatFx ');
  assert.ok(layer > unitsEnd && unitsEnd > units, 'the combat-effects layer mounts after (above) the units SVG, not inside it');
  assert.equal((src.match(/<TurfCombatFx /g) ?? []).length, 1, 'one mount');
  assert.match(src, /const combatFlags = combatFxFlags\(fxQuality, playMotion\)/, 'flags come from Effects Quality + Motion');
  assert.match(src, /if \(flags\.flash && fxLayer && drawn && now - lastFlash >= FLASH_COOLDOWN_MS\)/, 'flash only when allowed, at most once per cooldown (a DoT never strobes)');
  assert.ok(FLASH_COOLDOWN_MS >= 200, 'flash cooldown ≥ 200 ms (≤ 5 flashes a second)');
  assert.ok(HIT_STOP_TIMER_MS + 15 <= HIT_STOP_MS, 'hit-stop timer + a commit stays ≤ 60 ms');
  assert.match(src, /setTimeout\(\(\) => setHitStop\(false\), HIT_STOP_TIMER_MS\)/, 'hit stop uses the short timer');
  const c1 = nextChip(undefined, 1, 0.9, 0);
  const c2 = nextChip(c1, 1, 0.8, 100);
  assert.ok(c2.from === 1 && c2.at === 0 && c2.to === 0.8, 'steady damage keeps the draining chip (no held pile-up)');
  assert.equal(nextChip(c2, 0.8, 0.7, 1000).at, 1000, 'a hit after the chip drained starts a new one');
  assert.match(src, /if \(flags\.shake && streetRef\.current\) shakeBoard\(\)/, 'shake only when allowed');
  assert.match(src, /if \(flags\.hitStop && !step\.leak\)/, 'hit stop only when allowed');
  assert.match(src, /hit\.ultimate && hit\.puffIds\.some/, 'hit stop only on a kill by an ultimate');
  assert.match(src, /if \(phase !== 'running' \|\| paused \|\| hitStop\) return;/, 'hit stop pauses the sim ticker only');
  assert.match(src, /boardShake\.style\]\}>/, 'the shake moves the board box (stage content), not a region');
  assert.match(src, /now - f\.bornAt < FLOATER_MERGE_MS/, 'damage numbers merge per creep within the window');
  assert.match(src, /const MAX_FLOATERS = 8;/, 'number cap stays 8');
  assert.match(src, /skin: archer \? TOWER_FX\.archer/, 'the plain Archer draws its own dart + star (no Kenney shot in Streetwear)');
  ok('combat effects: every tower has a projectile + impact, timings inside the table, Off / Reduce Motion = no flash / shake / hit stop, layer outside the sim SVG');
}

{
  // T6: boss effects — entrance in the NoticeLane + a sigil at the spawn (no in-stage banner), a telegraph ≥ 600 ms for
  // every boss ability, the boss bar inside the top bar's wave chip box (stage frame unchanged), death blast + shake +
  // hit stop only when allowed, Off / calm motion = no flash / shake / hit stop.
  const meta = JSON.parse(read('assets/play/sheets/streetwear/meta.json')) as { fx: Record<string, { frames: number; fps: number; loop: boolean }> };
  const lengthMs = (key: string) => (meta.fx[key]!.frames / meta.fx[key]!.fps) * 1000;
  for (const [name, key] of Object.entries(BOSS_FX)) {
    const fx = meta.fx[key];
    assert.ok(fx && !fx.loop, `${name}: ${key} is packed and plays once (only "shot" loops)`);
  }
  assert.ok(Math.abs(lengthMs(BOSS_FX.summon) - BOSS_SUMMON_MS) <= 50, 'entrance sigil timing matches its sheet');
  assert.ok(Math.abs(lengthMs(BOSS_FX.death) - BOSS_DEATH_MS) <= 50, 'boss death timing matches its sheet');
  assert.ok(Math.abs(lengthMs(BOSS_FX.enrage) - ENRAGE_WINDUP_MS) <= 50, 'enrage sigil timing matches its sheet');
  for (const [name, d] of Object.entries(BOSS_EFFECT_DURATIONS)) {
    assert.ok(d.ms >= d.min && d.ms <= d.max, `${name}: ${d.ms} ms inside [${d.min}, ${d.max}]`);
  }

  // Every boss ability has a telegraph with a wind-up ≥ 600 ms: the enemy enrage + the Bound Boss echo skills (closed set).
  assert.deepEqual([...BOSS_ABILITIES].sort(), ['burst', 'enrage', 'focus_beam', 'slow_pulse'], 'abilities = enrage + the closed echo-skill set');
  assert.equal(new Set(Object.values(BOSS_TELEGRAPHS).map((t) => t.look)).size, BOSS_ABILITIES.length, 'a different look per ability');
  for (const def of allBoundBossDefs()) assert.ok(BOSS_TELEGRAPHS[def.skill.skill_id], `${def.boss_id}: its ${def.skill.skill_id} skill has a telegraph`);
  for (const band of allBossBands()) {
    if (band.boss.burst) assert.ok(BOSS_TELEGRAPHS.enrage, `${band.label}: its enrage has a telegraph`);
  }
  assert.ok(ENRAGE_WINDUP_MS >= TELEGRAPH_MIN_MS && TELEGRAPH_MIN_MS >= 600, 'enrage wind-up ≥ 600 ms');
  // Skill telegraphs: walk a cooldown down tick by tick at 1x and 2x from every phase; the wind-up the player sees is ≥ 600 ms.
  const TICK = 100;
  for (const speed of [1, 2]) {
    for (const cooldown of [6_750, 9_000]) {
      for (let phase = 0; phase < TICK * speed; phase += 7) {
        let showing = false;
        let seen: number | null = null;
        for (let cd = cooldown - phase; cd > -TICK * speed; cd -= TICK * speed) {
          const start = telegraphStart(showing, Math.max(0, cd), TICK, speed);
          if (start != null && seen == null) {
            seen = start;
            showing = true;
          }
        }
        assert.ok(seen != null && seen >= TELEGRAPH_MIN_MS, `speed ${speed}, cooldown ${cooldown}, phase ${phase}: wind-up ${seen} ms ≥ ${TELEGRAPH_MIN_MS}`);
      }
    }
  }
  assert.equal(telegraphStart(true, 0, TICK, 1), null, 'one telegraph at a time per ability');
  assert.equal(enrageWarning(60, 100, 0.5, false), true, 'enrage warning near the line (≤ 65 % for a 50 % line)');
  assert.equal(enrageWarning(90, 100, 0.5, false), false, 'no warning far above the line');
  assert.equal(enrageWarning(40, 100, 0.5, true), false, 'no warning once the enrage fired');
  const fx = read('src/play/turf-combat-fx.tsx');
  assert.match(fx, /Math\.max\(0, TELEGRAPH_MIN_MS - \(Date\.now\(\) - bornAt\)\)/, 'a telegraph never ends before TELEGRAPH_MIN_MS');

  // Boss bar: inside the top bar, in the wave chip's own fixed box; the stage frame never depends on it.
  const src = read('src/play/defend-screen.tsx');
  const topStart = src.indexOf('topBar={');
  const topEnd = src.indexOf('tabBar={', topStart);
  const top = src.slice(topStart, topEnd);
  assert.ok(topStart > 0 && topEnd > topStart, 'top bar prop found');
  assert.match(top, /liveBoss \? \(\s*<View\s+style=\{\[styles\.streetWave, styles\.bossBarBox\]\}/, 'the boss bar is drawn in the wave chip box inside the top bar');
  assert.match(src, /streetWave: \{ width: WAVE_CHIP_BOX\.width, height: WAVE_CHIP_BOX\.height,/, 'the wave chip and the boss bar share one fixed box');
  assert.equal((src.match(/styles\.bossBarBox/g) ?? []).length, 1, 'the boss bar renders in one place only');
  for (const d of DEVICES) {
    const f = computeStageFrame('turf-wave', d.window, d.insets);
    assert.ok(WAVE_CHIP_BOX.height + 8 <= f.topBar.height, `${d.name}: the boss bar box fits the ${f.topBar.height} pt top bar`);
    assert.ok(WAVE_CHIP_BOX.width <= f.topBar.width * 0.4, `${d.name}: the boss bar box leaves room for caps + pause`);
  }
  const frameProp = /frame=\{([^}]*)\}/.exec(src.slice(src.indexOf('<GameScreen'), topStart));
  assert.ok(frameProp && !/liveBoss|boss/i.test(frameProp[1]!), 'the stage frame does not depend on a boss (identical with and without one)');
  const bar = bossBar([{ id: 4, kind: 'boss', hp: 30, maxHp: 120, burstHpPct: 0.5 }, { id: 5, kind: 'puff', hp: 9, maxHp: 9 }], 'Ember Sovereign');
  assert.deepEqual(bar, { id: 4, name: 'Ember Sovereign', pct: 0.25, enrageAt: 0.5 }, 'boss bar reads the live boss');
  assert.equal(bossBar([{ id: 5, kind: 'puff', hp: 9, maxHp: 9 }], 'x'), null, 'no boss: the wave chip shows');

  // No in-stage banner: the warn is a NoticeLane notice with the same words.
  assert.ok(!/bossAlert|BOSS_WARN_MS/.test(src), 'no in-stage boss pill');
  assert.match(src, /notify\(\{ kind: 'notify', title: 'BOSS INCOMING'/, '"BOSS INCOMING" goes through notify() into the NoticeLane');
  assert.equal((src.match(/BOSS INCOMING/g) ?? []).length, 2, '"BOSS INCOMING" only in the notify call (+ its comment)');

  // What plays, per Effects Quality and Motion.
  const calmFlags = [
    bossFxFlags('off', { vestibularSafe: false, cosmeticsStill: false }),
    bossFxFlags('full', { vestibularSafe: true, cosmeticsStill: false }),
    bossFxFlags('full', { vestibularSafe: false, cosmeticsStill: true }),
    bossFxFlags('minimal', { vestibularSafe: true, cosmeticsStill: true }),
  ];
  for (const f of calmFlags) assert.ok(!f.flash && !f.shake && !f.hitStop, 'Effects Off / Reduce Motion / Motion Off: no boss flash, shake or hit stop');
  assert.deepEqual(bossFxFlags('off', { vestibularSafe: false, cosmeticsStill: false }), { summon: null, telegraph: 'still', death: null, flash: false, shake: false, hitStop: false }, 'Off = no boss effect (telegraphs stay as still shapes)');
  assert.deepEqual(bossFxFlags('minimal', { vestibularSafe: false, cosmeticsStill: false }), { summon: 'anim', telegraph: 'anim', death: 'full', flash: true, shake: false, hitStop: false }, 'Minimal = no shake, no hit stop');
  assert.deepEqual(bossFxFlags('full', { vestibularSafe: false, cosmeticsStill: false }), { summon: 'anim', telegraph: 'anim', death: 'full', flash: true, shake: true, hitStop: true }, 'Full = all');
  assert.match(src, /const bossFlags = bossFxFlags\(fxQuality, playMotion\)/, 'boss flags come from Effects Quality + Motion');
  assert.match(src, /if \(bossFlagsNow\.shake\) shakeBoard\('bossDeath'\);/, 'boss death shake only when allowed');
  assert.match(src, /if \(bossFlagsNow\.hitStop\) setHitStop\(true\);/, 'boss death hit stop only when allowed (the same ≤ 60 ms timer)');
  assert.match(src, /if \(old\.kind === 'boss' && !step\.leak\)/, 'the boss blast plays on a kill, never on a leak');
  ok('boss effects: notice-lane warn (no in-stage banner), every ability telegraphed ≥ 600 ms at 1x / 2x, boss bar in the top bar box, Off / Reduce Motion = no flash / shake / hit stop');
}

console.log(`\ncheck:turf-war-layout — ${passed} groups passed.`);
