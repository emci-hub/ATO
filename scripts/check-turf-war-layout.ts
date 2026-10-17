/**
 * Turf War layout gate (T1, 2026-10-16).
 * Run: npm run check:turf-war-layout  (part of check:ota-gate)
 * Rules: docs/turf-war-layout.md. Pure math from src/play/turf-layout.ts + stage-frame.ts, plus
 * source assertions on defend-screen.tsx.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { ATO_PADS } from '../src/play/board-data';
import { computeStageFrame, TAP_MIN, type Insets } from '../src/play/stage-frame';
import {
  BUILD_CARD_FLIP_BELOW,
  BUILD_CARD_MAX_H,
  buildCardPlacement,
  padTapRadiusPt,
  turfBoardRect,
  turfBoardSide,
} from '../src/play/turf-layout';

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

console.log(`\ncheck:turf-war-layout — ${passed} groups passed.`);
