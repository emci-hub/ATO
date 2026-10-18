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
import { computeStageFrame, REGIONS, TAP_MIN, type Insets } from '../src/play/stage-frame';
import { waveDefFor } from '../src/play/director';
import { nextWavePeek, nextWaveSeat, WAVE_PEEK_FIGURE } from '../src/play/turf-wave-peek';
import {
  BUILD_CARD_FLIP_BELOW,
  BUILD_CARD_MAX_H,
  buildCardPlacement,
  padTapRadiusPt,
  turfBoardRect,
  turfBoardSide,
  WAVE_PEEK,
  wavePeekRect,
} from '../src/play/turf-layout';
import { TURF_ART_PX, ambientShare, ambientSpriteBoxes, pigeonScared, turfAmbientMeta } from '../src/play/turf-ambient-layout';
import { DEFAULT_TURF_THEME, TURF_THEME_IDS, themedBoardArtIds, turfBoardArtId } from '../src/play/turf-theme';
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
import { BOUND_BOSS_PLACE_SKILL_CD_MS, DEFEND_TICK_MS, createDefendLive, placeBoundBoss, retryDefendLive } from '../src/play/defend';
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
  telegraphLeadSimMs,
  telegraphStart,
} from '../src/play/turf-boss-fx-rules';
import {
  BEAT_DURATIONS,
  BEAT_FX,
  CELL_UNITS,
  LEAK_REPLAY_CELLS,
  LOSE_BEAT_MS,
  PORTAL_CLOSE_FROM,
  PORTAL_MS,
  WAVE_CLEAR_MS,
  WIN_SPARK_MAX,
  WIN_SPARK_MS,
  beatFxFlags,
  leakReplayPath,
  portalPoint,
  sparkPoint,
  waveStartNotice,
  winBeatMs,
} from '../src/play/turf-beat-fx-rules';
import { noticeAllowed, noticeCopyProblem } from '../src/play/notify/queue';
import { PNG } from 'pngjs';
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
  // Pause is in the top bar (T2b: the kit's TurfPauseButton, 44 pt + hitSlop 6 each side = 56 pt target).
  const kit = read('src/play/turf-ui.tsx');
  assert.match(src, /<TurfPauseButton paused=\{paused\} onPress=\{\(\) => setPaused\(\(value\) => !value\)\} \/>/, 'pause sits in the top bar');
  assert.match(kit, /accessibilityLabel=\{paused \? 'Resume wave' : 'Pause wave'\}\s*hitSlop=\{6\}/, 'pause has hitSlop 6');
  assert.match(kit, /pause: \{\s*width: SHEET\.tap,\s*height: SHEET\.tap,/, 'pause is 44 pt + 6 slop = 56');
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
  // T8: the same placement rules hold on every map theme's painting of the board.
  const themed = themedBoardArtIds('ato').map((id) => {
    const m = turfAmbientMeta(meta.boards, id);
    assert.ok(m, `meta.boards.${id}.ambient is packed`);
    assert.equal(m.fires.length, m.barrels.length, `${id}: one firelight per barrel`);
    return { id, m };
  });
  for (const { id, m } of themed) for (const b of ambientSpriteBoxes(m)) {
    const tag = `${id}: ${b.kind} at ${Math.round(b.x)},${Math.round(b.y)}`;
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
  // Art loose ends (emci 2026-10-18): the alley's two wall neon signs are baked off the road and clear of every pad,
  // inside their pool's flicker crop (so they flicker with it); no other theme paints one.
  const signs = amb.signs ?? [];
  assert.equal(signs.length, 2, 'the alley board has its two neon signs (bolt by the cyan pool, heart by the magenta pool)');
  for (const s of signs) {
    const tag = `neon sign at ${s.x},${s.y}`;
    const crop: { x: number; y: number; w: number; h: number } | undefined = amb.pools[s.pool];
    assert.ok(crop && s.x >= crop.x && s.y >= crop.y && s.x + s.w <= crop.x + crop.w && s.y + s.h <= crop.y + crop.h, `${tag} is inside pool ${s.pool}'s flicker crop`);
    assert.ok(s.x >= 0 && s.y >= 0 && s.x + s.w <= TURF_ART_PX && s.y + s.h <= TURF_ART_PX, `${tag} inside the board`);
    assert.ok(s.w <= 24 && s.h <= 24, `${tag} stays on the 24 px canvas (0.6 m at the 62 px board hero)`);
    for (const p of ATO_PADS) {
      const px = (p.x / 100) * TURF_ART_PX;
      const py = (p.y / 100) * TURF_ART_PX;
      assert.ok(Math.hypot(px - Math.max(s.x, Math.min(px, s.x + s.w)), py - Math.max(s.y, Math.min(py, s.y + s.h))) > padR, `${tag} is clear of the pad at ${p.x},${p.y}`);
    }
    for (let cy = Math.floor(s.y / 32); cy <= Math.floor((s.y + s.h - 1) / 32); cy += 1) {
      for (let cx = Math.floor(s.x / 32); cx <= Math.floor((s.x + s.w - 1) / 32); cx += 1) assert.ok(!isRoad(cx, cy), `${tag} is off the road (cell ${cx},${cy})`);
    }
  }
  for (const { id, m } of themed) if (id !== 'ato') assert.equal(m.signs?.length ?? 0, 0, `${id}: no neon sign (alley only)`);
  // The pigeon flaps real wings: frame 0 = perched, frames 1.. only while it flies off (never under Reduce Motion: fly stays 0).
  assert.ok(amb.clips.pigeon.frames >= 3, 'the pigeon sheet has a perch frame + wing frames');
  // turf-ambient.tsx slides the strip by (frame_001.x − frame_000.x): every frame must sit on one row at that stride.
  const pigeonSheet = (JSON.parse(read('assets/art/legacy-play-sheets.json')) as Record<string, { frames: Record<string, { x: number; y: number }> }>)['sheets/streetwear/board/ato-pigeon'];
  assert.ok(pigeonSheet, 'sheets/streetwear/board/ato-pigeon is packed');
  const pf = Array.from({ length: amb.clips.pigeon.frames }, (_, i) => pigeonSheet.frames[`frame_${String(i).padStart(3, '0')}`]);
  assert.ok(pf.every((f) => f), 'every pigeon frame is packed');
  const stride = pf[1]!.x - pf[0]!.x;
  pf.forEach((f, i) => assert.ok(f!.y === pf[0]!.y && f!.x === pf[0]!.x + i * stride, `pigeon frame ${i} is on the strip's row at the shared stride`));

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
  assert.match(ui, /t > 0 && wingFrames > 0 \? 1 \+/, 'pigeon wing frames play only while it flies off (perched = frame 0)');
  assert.match(ui, /const t = flap\.value;/, 'wing frames follow the linear flap clock, not the eased arc (steady flap)');
  assert.match(ui, /flap\.value = reduced \? 0 : withTiming\(1, \{ duration: PIGEON_FLY_MS, easing: Easing\.linear \}\)/, 'the flap clock is linear over the flight');
  assert.match(ui, /fly\.value = reduced \? 0 :/, 'Reduce Motion: the pigeon only fades (no arc, no wing frames)');
  assert.ok(!/scaleY/.test(ui), 'no squash-for-a-flap left in the ambient layer');
  const src = read('src/play/defend-screen.tsx');
  // T7: the baked board image is the memoised `TurfBoardBase` layer (same image, same place in the stack).
  const board = src.indexOf('<TurfBoardBase sheetKey={streetBoardKey} />');
  const ambient = src.indexOf('<TurfAmbient ');
  const units = src.indexOf('<Svg width="100%" height="100%" viewBox="0 0 100 100">');
  assert.ok(board > 0 && ambient > board && units > ambient, 'order: baked board, ambient layer, then the units SVG');
  assert.match(src, /const ambientCreeps = useCallback\(/, 'a stable creep reader keeps the memoised layer from re-rendering');
  assert.equal((src.match(/<TurfAmbient /g) ?? []).length, 1, 'one mount');
  ok(`ambient layer: ${themed.map(({ id, m }) => `${id} ${ambientSpriteBoxes(m).length}`).join(', ')} sprites clear of pads and road, outside the sim SVG, fx-quality Off / Minimal / Full, Reduce Motion half speed, pigeon scare rule`);
}

{
  // T8: map themes — paint only. The pick lives in the Setup sheet (no new region, nothing floats), is device-local,
  // defaults to the alley, swaps the board image + its light layers together, and never reaches rules or rewards.
  assert.deepEqual([...TURF_THEME_IDS], ['alley', 'rooftop', 'underpass', 'court', 'docks'], 'five themes, alley first');
  assert.equal(DEFAULT_TURF_THEME, 'alley', 'the alley stays the default');
  assert.equal(turfBoardArtId('ato', 'alley'), 'ato', 'alley paints the T3 board');
  assert.equal(turfBoardArtId('ato', 'docks'), 'ato-docks', 'a theme paints its own board');
  assert.equal(turfBoardArtId('neon-maze', 'docks'), 'neon-maze', 'Neon Maze has no themes');
  const store = read('src/play/turf-theme-store.ts');
  assert.match(store, /TURF_THEME_KEY = 'ato\.play\.boardTheme\.v1'/, 'the pick is the device-local ato.play.boardTheme.v1');
  assert.ok(!/supabase|cloud/i.test(store.replace(/\/\*\*[\s\S]*?\*\//, '')), 'no server or cloud save for the theme');
  const src = read('src/play/defend-screen.tsx');
  assert.match(src, /const boardArtId = boardSheet\(themedArtId\) \? themedArtId : boardMap\.id;/, 'unpacked theme falls back to the plain board');
  assert.match(src, /const streetBoardKey = street \? boardSheet\(boardArtId\) : undefined;/, 'the board image follows the theme');
  assert.match(src, /<TurfAmbient mapId=\{boardArtId\} /, 'the ambient layer follows the same theme');
  assert.equal((src.match(/<TurfThemePicker \/>/g) ?? []).length, 2, 'the picker sits in the Setup sheet: Maps card (Main) and its own card (Trial)');
  const picker = read('src/play/turf-theme-picker.tsx');
  assert.ok(!/FloatLayer|position: 'absolute'/.test(picker), 'the picker never floats over a region');
  assert.match(picker, /minHeight: SHEET\.tap/, 'theme chips are ≥ 44 pt taps');
  // Rules, economy and rewards never read the theme.
  for (const f of ['src/play/defend.ts', 'src/play/playStore.ts', 'src/play/board-data.ts', 'src/play/board-layouts.ts']) {
    assert.ok(!/turf-theme/.test(read(f)), `${f} does not read the map theme`);
  }
  ok(`map themes: ${TURF_THEME_IDS.length} paintings of one board, device-local pick in the Setup sheet, rules and rewards untouched`);
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
  // A newly placed Bound Boss starts on a cooldown, so even its first cast shows a full wind-up at 1x and 2x.
  assert.equal(TICK, DEFEND_TICK_MS, 'check tick = defend tick');
  for (const speed of [1, 2]) {
    let first: number | null = null;
    for (let cd = BOUND_BOSS_PLACE_SKILL_CD_MS; first == null && cd >= 0; cd -= DEFEND_TICK_MS * speed) {
      first = telegraphStart(false, cd, DEFEND_TICK_MS, speed);
    }
    assert.ok(first != null && first >= TELEGRAPH_MIN_MS, `placed boss, speed ${speed}: first wind-up ${first} ms ≥ ${TELEGRAPH_MIN_MS}`);
  }
  assert.equal(BOUND_BOSS_PLACE_SKILL_CD_MS, telegraphLeadSimMs(DEFEND_TICK_MS, 2), 'placement cooldown = the 2x telegraph lead');
  {
    const cycle = allBoundBossDefs()[0];
    const board = createDefendLive(1, { boardId: 'ato', scrap: 100_000 });
    const placed = placeBoundBoss(board, 0, cycle.boss_id, 1);
    assert.equal(placed?.boundBosses[0]?.skillCooldownMs, BOUND_BOSS_PLACE_SKILL_CD_MS, 'placeBoundBoss: a cycle boss starts on the placement cooldown');
    const hero = placeBoundBoss(board, 0, 'archangel', 1);
    assert.equal(hero?.boundBosses[0]?.skillCooldownMs, 0, 'placeBoundBoss: a hero tower still starts at 0');
    // Retry restarts the wave, so the cycle boss winds up again (not 0); a hero tower still starts at 0.
    const both = placeBoundBoss(placed!, 1, 'archangel', 1)!;
    const spent = { ...both, boundBosses: both.boundBosses.map((bb) => ({ ...bb, skillCooldownMs: 0 })) };
    const retried = retryDefendLive(spent);
    assert.equal(retried.boundBosses.find((bb) => bb.bossId === cycle.boss_id)?.skillCooldownMs, BOUND_BOSS_PLACE_SKILL_CD_MS, 'retryDefendLive: a cycle boss winds up again');
    assert.equal(retried.boundBosses.find((bb) => bb.bossId === 'archangel')?.skillCooldownMs, 0, 'retryDefendLive: a hero tower still starts at 0');
  }
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

{
  // T7: polish beats — wave start (lane line + portal), wave clear (portal closes at the exit), win sparks, leak replay.
  // Sheets packed as one-shots with the timings in the table, every beat drawn inside the board, Off / calm motion =
  // no beat motion and never a flash / shake / hit stop, the lane line fits the notice limits, BOSS INCOMING shows on
  // "Important only", and the static board layers are memoised (the perf pass).
  const meta = JSON.parse(read('assets/play/sheets/streetwear/meta.json')) as { fx: Record<string, { frames: number; fps: number; loop: boolean }> };
  const lengthMs = (key: string, from = 0) => ((meta.fx[key]!.frames - from) / meta.fx[key]!.fps) * 1000;
  for (const [name, key] of Object.entries(BEAT_FX)) {
    const fx = meta.fx[key];
    assert.ok(fx && !fx.loop, `${name}: ${key} is packed and plays once (only "shot" loops)`);
  }
  assert.ok(Math.abs(lengthMs(BEAT_FX.portal) - PORTAL_MS) <= 50, 'portal timing matches its sheet');
  assert.ok(Math.abs(lengthMs(BEAT_FX.portal, PORTAL_CLOSE_FROM) - WAVE_CLEAR_MS) <= 50, 'wave-clear close timing matches the portal frames it plays');
  assert.ok(Math.abs(lengthMs(BEAT_FX.sparks) - WIN_SPARK_MS) <= 50, 'win spark timing matches its sheet');
  for (const [name, d] of Object.entries(BEAT_DURATIONS)) assert.ok(d.ms >= d.min && d.ms <= d.max, `${name}: ${d.ms} ms inside [${d.min}, ${d.max}]`);
  assert.equal(winBeatMs(0), WAVE_CLEAR_MS, 'no tower: the card waits only for the clear');
  assert.ok(winBeatMs(99) === winBeatMs(WIN_SPARK_MAX), 'the spark wait is capped');

  // Every beat is drawn inside the board: the opaque pixels of every frame, around each sheet's anchor, at the real points.
  const ART = 512 / 100; // art px per board unit
  const reach = (el: string) => {
    const dir = path.join(repo, 'art-src/pixellab/streetwear-pack/migrated/raw/fx/elements', el);
    const png = PNG.sync.read(fs.readFileSync(path.join(dir, 'burst.png')));
    const j = JSON.parse(fs.readFileSync(path.join(dir, 'burst.json'), 'utf8')) as { frames: { frame: { x: number; y: number; w: number; h: number } }[]; meta: { anchor: { x: number; y: number } } };
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (const { frame } of j.frames) {
      for (let y = 0; y < frame.h; y += 1) for (let x = 0; x < frame.w; x += 1) {
        if (png.data[((frame.y + y) * png.width + frame.x + x) * 4 + 3]! < 16) continue;
        l = Math.min(l, x); r = Math.max(r, x + 1); t = Math.min(t, y); b = Math.max(b, y + 1);
      }
    }
    const { x: ax, y: ay } = j.meta.anchor;
    return { left: (ax - l) / ART, right: (r - ax) / ART, up: (ay - t) / ART, down: (b - ay) / ART };
  };
  const inside = (name: string, p: { x: number; y: number }, k: ReturnType<typeof reach>) => {
    assert.ok(p.x - k.left >= 0 && p.x + k.right <= 100 && p.y - k.up >= 0 && p.y + k.down <= 100, `${name} at (${p.x.toFixed(1)}, ${p.y.toFixed(1)}) stays inside the board`);
  };
  const gate = reach('gate');
  const cheer = reach('cheer');
  for (const map of Object.values(BOARD_MAPS)) {
    inside(`${map.id}: wave-start portal`, portalPoint(map.path[0]!), gate);
    inside(`${map.id}: wave-clear portal`, portalPoint(map.path[map.path.length - 1]!), gate);
    for (const pad of map.pads) inside(`${map.id}: win sparks over pad (${pad.x}, ${pad.y})`, sparkPoint(pad), cheer);
    const replay = leakReplayPath(map.path);
    const end = map.path[map.path.length - 1]!;
    const last = replay[replay.length - 1]!;
    assert.ok(Math.hypot(last.x - end.x * 100, last.y - end.y * 100) < 1e-6, `${map.id}: the replay ends at the exit`);
    let len = 0;
    for (let i = 1; i < replay.length; i += 1) len += Math.hypot(replay[i]!.x - replay[i - 1]!.x, replay[i]!.y - replay[i - 1]!.y);
    assert.ok(Math.abs(len - LEAK_REPLAY_CELLS * CELL_UNITS) <= 0.5, `${map.id}: the replay walks the last ${LEAK_REPLAY_CELLS} cells (${len.toFixed(2)} units)`);
    for (const pt of replay) assert.ok(pt.x >= 0 && pt.x <= 100 && pt.y >= 0 && pt.y <= 100, `${map.id}: replay point inside the board`);
  }

  // What plays, per Effects Quality and Motion: Off = no beat; Reduce Motion / Motion Off = still frames only.
  const still = { vestibularSafe: true, cosmeticsStill: false };
  const motionOff = { vestibularSafe: true, cosmeticsStill: true };
  const fullMotion = { vestibularSafe: false, cosmeticsStill: false };
  assert.deepEqual(beatFxFlags('off', fullMotion), { portal: null, clear: null, sparks: null, sparkEvery: 1, replay: null }, 'Off = no beat');
  assert.deepEqual(beatFxFlags('minimal', fullMotion), { portal: 'anim', clear: 'anim', sparks: 'anim', sparkEvery: 2, replay: 'anim' }, 'Minimal = every beat, sparks on every other tower');
  assert.deepEqual(beatFxFlags('full', fullMotion), { portal: 'anim', clear: 'anim', sparks: 'anim', sparkEvery: 1, replay: 'anim' }, 'Full = every beat');
  for (const m of [still, motionOff]) {
    for (const q of ['full', 'minimal'] as const) {
      const f = beatFxFlags(q, m);
      assert.ok(f.portal === 'still' && f.clear === 'still' && f.sparks === 'still' && f.replay === 'still', `${q} + calm motion: every beat is a still frame`);
    }
  }
  const beatsUi = read('src/play/turf-beat-fx.tsx');
  assert.ok(!/react-native-svg/.test(beatsUi), 'the beats are not an SVG (nothing new inside the sim <Svg>)');
  assert.ok(!/withRepeat/.test(beatsUi), 'no looping animation in the beats (one-shots only)');
  assert.ok(!/shakeBoard|useBoardShake|setHitStop|tintColor="#FFFFFF"/.test(beatsUi), 'no beat shakes, stops the sim or flashes white');

  // Motion audit across T4–T7 (one table): under Reduce Motion / Motion Off nothing flashes, shakes or stops the sim.
  for (const m of [still, motionOff]) {
    for (const q of ['full', 'minimal', 'off'] as const) {
      const c = combatFxFlags(q, m);
      const b = bossFxFlags(q, m);
      assert.ok(!c.flash && !c.shake && !c.hitStop && !b.flash && !b.shake && !b.hitStop, `${q} + calm motion: no flash / shake / hit stop (T5 / T6)`);
      assert.ok(b.summon !== 'anim' && b.telegraph === 'still' && b.death !== 'full', `${q} + calm motion: boss effects still / soft (T6)`);
    }
  }

  const src = read('src/play/defend-screen.tsx');
  assert.match(src, /const beatFlags = beatFxFlags\(fxQuality, playMotion\)/, 'beat flags come from Effects Quality + Motion');
  assert.match(src, /calmRef\.current = playMotion\.vestibularSafe \|\| playMotion\.cosmeticsStill;/, 'calm motion is read for the exit ring');
  assert.match(src, /fxLayer\.leak\([^;]*calmRef\.current\)/, 'the T5 exit ring is fade-only under calm motion');
  assert.match(src, /fxLayer\.leakReplay\(leakReplayPath\(mapNow\.path\)/, 'a leak plays the replay along the real path');
  assert.match(src, /holdResult\(LOSE_BEAT_MS\)/, 'the lost card waits for the replay (display only)');
  assert.match(src, /holdResult\(winBeatMs\(over\.length\)\)/, 'the won card waits for the sparks (display only)');
  assert.match(src, /fxLayer\.portal\(at\.x, at\.y, beats\.clear, true\)/, 'the wave clear closes the portal at the exit');
  assert.match(src, /combatFxRef\.current\?\.portal\(at\.x, at\.y, portalMode, false\)/, 'the wave start opens the portal at the spawn');
  {
    // The win is still paid on the same tick: inside the `step.done` branch the beats start, then `winWave()` runs
    // straight after — no timer, no early return in between (only the result CARD waits).
    const doneAt = src.indexOf('if (step.done) {');
    const holdAt = src.indexOf('holdResult(winBeatMs', doneAt);
    const winAt = src.indexOf('winWave();', holdAt);
    const between = src.slice(doneAt, winAt);
    assert.ok(doneAt > 0 && holdAt > doneAt && winAt > holdAt, 'step.done → beats → winWave() in that order');
    assert.ok(!/setTimeout|later\(|return;/.test(between), 'nothing delays or skips winWave() in the step.done branch');
  }
  assert.match(src, /notify\(\{ kind: 'notify', \.\.\.waveStartNotice\(/, 'the wave-start line goes through notify() into the NoticeLane');
  assert.ok(!/LEAK_PULSE_MS|resultHold\s*\?/.test(src.slice(src.indexOf('frame={'), src.indexOf('topBar={'))), 'no beat changes the stage frame');
  for (const wave of [1, 9, 20]) {
    for (const n of [1, 14, 120]) {
      const line = waveStartNotice(wave, 'Main', n);
      assert.equal(noticeCopyProblem(line), null, `wave-start line fits the notice limits ("${line.title} · ${line.body}")`);
    }
  }
  // BOSS INCOMING on "Important only" (emci 2026-10-17): the notice is marked important, which the queue lets through.
  assert.match(src, /title: 'BOSS INCOMING', .*priority: 'high', important: true \}\);/, 'BOSS INCOMING is marked important');
  assert.ok(noticeAllowed('notify', 'important', true) && !noticeAllowed('notify', 'important'), 'Important only shows an important NOTIFY, still drops the rest');

  // Perf pass: the static board layers are memoised and stable per board (the sim re-renders every 100 ms).
  const base = read('src/play/turf-board-base.tsx');
  for (const name of ['TurfBoardBase', 'BoardDecorTiles', 'StaticRoad']) {
    assert.match(base, new RegExp(`export const ${name} = memo\\(`), `${name} is memoised`);
    assert.equal((src.match(new RegExp(`<${name} `, 'g')) ?? []).length, 1, `${name}: one mount`);
  }
  assert.ok(!/sheetKey: streetBoardKey, frameKey: 'img'/.test(src), 'the board image is no longer drawn inline (it re-rendered every tick)');
  assert.match(src, /const decor = useMemo\(/, 'decor is memoised (stable memo props)');
  assert.match(src, /const roadStamps = useMemo\(/, 'road stamps are memoised (stable memo props)');
  assert.match(src, /const roadD = useMemo\(/, 'road path is memoised (stable memo props)');
  ok('polish beats: sheets + timings, every beat inside the board, Off / calm = no beat motion, no flash / shake / hit stop (T4–T7 audit), lane line limits, BOSS INCOMING on Important only, static layers memoised');
}

// ---------------------------------------------------------------- T2b: top bar + next-wave preview
{
  const src = read('src/play/defend-screen.tsx');
  const kit = read('src/play/turf-ui.tsx');
  // Top bar: still 56 pt in both phones, REGIONS unchanged; built from kit pieces on sheet-kit tokens (no StreetFrame resbar).
  for (const d of DEVICES) {
    for (const id of ['turf-setup', 'turf-wave'] as const) {
      const f = computeStageFrame(id, d.window, d.insets);
      assert.equal(f.topBar.height, 56, `${d.name} ${id}: top bar stays 56 pt`);
      assert.equal(f.notice.height, 40, `${d.name} ${id}: NoticeLane stays 40 pt`);
    }
  }
  assert.deepEqual(REGIONS['turf-wave'].topBar, 56, 'REGIONS turf-wave top bar = 56');
  assert.deepEqual(REGIONS['turf-setup'].topBar, 56, 'REGIONS turf-setup top bar = 56');
  assert.match(src, /streetHud: \{[^}]*height: 56,/, 'the HUD row is the 56 pt top bar');
  assert.ok(!/StreetFrame|StreetBackdrop/.test(src), 'the Turf top bar no longer draws the resbar art frame');
  assert.match(kit, /SHEET\.tap/, 'top bar pieces use the sheet-kit tap size');
  assert.match(kit, /chipTap: \{ height: SHEET\.tap,/, 'the wave chip tap target is 44 pt');
  assert.match(kit, /caps: \{[^}]*height: SHEET\.tap,/, 'the caps pill is 44 pt');
  // The boss bar still replaces the chip inside the chip's own fixed box.
  assert.match(src, /<TurfWaveChip[\s\S]{0,260}width=\{WAVE_CHIP_BOX\.width\}\s*height=\{WAVE_CHIP_BOX\.height\}/, 'the wave chip uses WAVE_CHIP_BOX (same box as the boss bar)');
  assert.ok(WAVE_CHIP_BOX.height <= TAP_MIN, 'the chip box fits inside its 44 pt tap target');

  // The preview card: inside the lane + the empty strip above the board, never over the board, taps ≥ 44.
  for (const d of DEVICES) {
    const f = computeStageFrame('turf-wave', d.window, d.insets);
    const stage = { width: f.stage.width, height: f.stage.height };
    const rect = wavePeekRect(stage);
    const board = turfBoardRect(stage);
    const free = f.notice.height + board.y; // float coordinates start at the lane's top edge
    assert.ok(rect.x >= 0 && rect.x + rect.width <= f.stage.width, `${d.name}: peek card inside the stage width`);
    assert.ok(rect.y >= 0 && rect.y + rect.height <= free, `${d.name}: peek card (${rect.y}+${rect.height}) stays above the board (${free} pt free)`);
    assert.ok(rect.height >= TAP_MIN, `${d.name}: peek card is a ≥ 44 pt tap (it closes on tap)`);
    assert.ok(f.stage.width - (rect.x + rect.width) >= TAP_MIN, `${d.name}: ≥ 44 pt stays free at the right for the help (?) button`);
  }
  assert.equal(WAVE_PEEK.height, 64, 'peek card is 64 pt');
  // Data: counts come from the director table (no new data); order Trial → Main → Main 1.
  const counts = { trial: 5, main: 10 };
  assert.deepEqual(nextWaveSeat('trial', 5, counts), { phase: 'main', wave: 1 }, 'after Trial 5 comes Main 1');
  assert.deepEqual(nextWaveSeat('main', 10, counts), { phase: 'main', wave: 1 }, 'after Main 10 the cycle restarts at Main 1');
  assert.deepEqual(nextWaveSeat('main', 4, counts), { phase: 'main', wave: 5 }, 'Main 4 → Main 5');
  for (const phase of ['trial', 'main'] as const) {
    for (let w = 1; w <= counts[phase]; w += 1) {
      const peek = nextWavePeek(phase, w, counts);
      assert.ok(peek && peek.rows.length > 0, `${phase} ${w}: the next wave has a preview`);
      const def = waveDefFor(peek!.phase, peek!.wave)!;
      assert.equal(peek!.total, def.groups.reduce((n, g) => n + g.count, 0), `${phase} ${w}: total = the director's creep count`);
      assert.ok(peek!.rows.length <= 4, 'at most four role chips');
    }
  }
  const boss = nextWavePeek('main', 4, counts)!;
  assert.deepEqual(boss.rows, [{ role: 'swarm', count: 5 }, { role: 'boss', count: 1 }], 'Main 5 previews 5 swarm + 1 boss');
  assert.equal(boss.element, 'root', 'the preview carries the stage element');
  // Wiring: only the wave chip opens it; boss bar / pause hide it; the card is on the FloatLayer.
  assert.match(src, /const wavePeek = live && street && !liveBoss && fight\.mode !== 'replay' \? nextWavePeek\(/, 'the preview is only for a live street campaign wave with no boss bar');
  assert.match(src, /const wavePeekShown = wavePeekOpen && wavePeek != null && !paused;/, 'pause hides the preview');
  assert.match(src, /\{floatCards\}\s*\{wavePeekCard\}/, 'the preview card is a FloatLayer child');
  assert.match(src, /if \(!live\) setWavePeekOpen\(false\);/, 'the preview closes when the run ends');
  assert.match(src, /right: HELP_COLUMN, top: 0, height: setupFrame\.notice\.height \+ turfBoardRect\(setupFrame\.stage\)\.y/, 'the outside-tap strip never reaches the board or the help (?) column');
  assert.match(src, /!liveBoss && fight\.mode !== 'replay' \? nextWavePeek\(/, 'no preview in a replay (the seat does not advance) or under the boss bar');
  assert.match(src, /const wavePeekHidden = liveBoss != null \|\| paused;\s*useEffect\(\(\) => \{\s*if \(wavePeekHidden\) setWavePeekOpen\(false\);/, 'a boss bar or a pause closes the card (it never pops back open)');
  assert.match(src, /useNoticePause\(wavePeekShown\)/, 'notices wait while the next-wave card is open (T9)');
  assert.ok(!/styles\.card|ThemedView/.test(kit.slice(kit.indexOf('export function TurfWavePeekCard'), kit.indexOf('const styles'))), 'the preview card is a sheetCard, not styles.card');
  // Art loose ends (emci 2026-10-18, icons A): each chip shows the role's own board creep (head + shoulders, role-colour
  // underline); unpacked art keeps the swatch; the role word stays (colour is never the only clue); the icon fits the chip.
  const peekCard = kit.slice(kit.indexOf('export function TurfWavePeekCard'), kit.indexOf('const styles'));
  assert.match(peekCard, /row\.art && row\.figure && drawableFrame\(row\.art\) \? \(\s*<PeekCreepIcon/, 'chips draw the creep icon when its frame is packed');
  assert.match(peekCard, /styles\.swatch,/, 'the swatch stays as the fallback');
  assert.match(peekCard, /\{row\.name\}/, 'the role word is still written in every chip');
  assert.match(src, /\.\.\.wavePeekArt\(row\.role, wavePeek\.phase, wavePeek\.wave\)/, 'rows carry the board sprite (boss = that seat\'s band)');
  // The figure table matches the packed Streetwear south frames (a repack that moves a figure fails here, not on the phone).
  const swSkin = JSON.parse(read('assets/play/skins/streetwear/skin.json')) as { roles: Record<string, { keys: string[] }> };
  const swSheets = JSON.parse(read('assets/art/legacy-play-sheets.json')) as Record<string, { sheet: string; frames: Record<string, { x: number; y: number; w: number; h: number }>; sourceW?: number; sourceH?: number; offsetX?: number; offsetY?: number }>;
  for (const [unit, fig] of Object.entries(WAVE_PEEK_FIGURE)) {
    const key = (swSkin.roles[unit]?.keys ?? []).find((k) => k.endsWith('/rotations/south'));
    const m = key && /^skins\/streetwear\/(.+)\/rotations\/south$/.exec(key);
    assert.ok(m, `${unit}: the Streetwear skin has a packed south frame`);
    const sheet = swSheets[`sheets/streetwear/${m[1]}/rotations`];
    const r = sheet?.frames.south;
    assert.ok(sheet && r, `${unit}: sheets/streetwear/${m[1]}/rotations has a south frame`);
    const file = [path.join(repo, 'assets/play', sheet.sheet), path.join(repo, 'assets', sheet.sheet)].find((f) => fs.existsSync(f));
    assert.ok(file, `${unit}: atlas ${sheet.sheet} exists`);
    const png = PNG.sync.read(fs.readFileSync(file));
    let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
    for (let y = 0; y < r.h; y += 1) for (let x = 0; x < r.w; x += 1) {
      if (png.data[((r.y + y) * png.width + r.x + x) * 4 + 3]! > 20) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    }
    const W = sheet.sourceW ?? r.w;
    const H = sheet.sourceH ?? r.h;
    const got = { cx: ((sheet.offsetX ?? 0) + (x0 + x1 + 1) / 2) / W, top: ((sheet.offsetY ?? 0) + y0) / H, h: (y1 - y0 + 1) / H };
    for (const k of ['cx', 'top', 'h'] as const) assert.ok(Math.abs(got[k] - fig[k]) <= 0.02, `${unit}: figure ${k} ${fig[k]} matches the atlas (${got[k].toFixed(3)})`);
  }
  const peekIcon = Number(/const PEEK_ICON = (\d+);/.exec(kit)?.[1]);
  const chipH = Number(/peekChip: \{\s*height: (\d+),/.exec(kit)?.[1]);
  const sheetBorder = Number(/^\s*border: (\d+),/m.exec(read('src/play/sheet-kit.tsx'))?.[1]);
  assert.ok(sheetBorder > 0, 'SHEET.border read from sheet-kit');
  assert.ok(peekIcon + 2 <= chipH - 2 * sheetBorder, `the ${peekIcon} pt icon + 2 pt underline fits inside the ${chipH} pt chip's borders`);
  ok('T2b top bar: 56 pt, REGIONS unchanged, kit pieces ≥ 44; next-wave preview inside lane + board margin on both phones, director data, boss bar still in the chip box, creep icons');
}

console.log(`\ncheck:turf-war-layout — ${passed} groups passed.`);
