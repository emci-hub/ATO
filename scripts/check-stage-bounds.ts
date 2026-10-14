/**
 * Stage bounds gate (Divecore Phase 1, emci 2026-10-14).
 * Run: npm run check:stage-bounds  (part of check:ota-gate)
 *
 * Rule: .cursor/rules/stage-bounds.mdc · spec: docs/divecore-layout-spec.md.
 *   1. Every game screen is a <GameScreen> with a frame from useStageFrame.
 *   2. The stage has no flex-leftover sizing: its size comes from the frame, never from layout.
 *   3. No notice, banner, coach, toast, hint or sheet component sits inside a stage subtree.
 *   4. Pure: the stage frame is identical with or without a notice, tip, pause or loading,
 *      at 430×932 and 375×667, and Turf War's setup and wave share one stage.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { computeStageFrame, layoutRegions, REGIONS, type GameScreenId, type Insets } from '../src/play/stage-frame';
import { hideoutCameraTop, hideoutCoverRestTop, hideoutCoverScale } from '../src/play/hideout-iso';

const repo = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(repo, rel), 'utf8');
let passed = 0;
const ok = (msg: string) => {
  passed += 1;
  console.log(`  ✓ ${msg}`);
};

/** Game screens and the frame each one takes. A new game screen adds a row here. */
const SCREENS: { file: string; frames: GameScreenId[] }[] = [
  { file: 'src/play/pet-screen.tsx', frames: ['hideout'] },
  { file: 'src/play/defend-screen.tsx', frames: ['turf-setup'] },
  { file: 'src/play/dive-scene.tsx', frames: ['dive'] },
  { file: 'src/play/pet-games.tsx', frames: ['pet-game'] },
  { file: 'src/app/play.tsx', frames: ['list'] },
];

/** The text of each `stage={...}` prop (balanced braces). */
function stageProps(src: string): string[] {
  const out: string[] = [];
  let from = 0;
  for (;;) {
    const at = src.indexOf('stage={', from);
    if (at < 0) return out;
    let depth = 0;
    let i = at + 'stage='.length;
    for (; i < src.length; i += 1) {
      if (src[i] === '{') depth += 1;
      else if (src[i] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    out.push(src.slice(at, i + 1));
    from = i + 1;
  }
}

const FORBIDDEN_IN_STAGE = /<(PlayBanner|PlaySheet|\w*Notice\w*|\w*Toast\w*|\w*Coach\w*|\w*Hint\w*|\w*Banner\w*)\b/;

{
  for (const { file, frames } of SCREENS) {
    const src = read(file);
    assert.match(src, /<GameScreen\b/, `${file} renders a GameScreen`);
    for (const id of frames) assert.ok(src.includes(`useStageFrame('${id}')`), `${file} takes the '${id}' frame`);
  }
  ok(`every game screen is a GameScreen with its frame (${SCREENS.length} files)`);
}

{
  const layout = read('src/play/stage-layout.tsx');
  assert.match(layout, /height: r\.stage\.height/, 'GameScreen sizes the stage from the frame');
  assert.ok(!/stage:\s*\{[^}]*flex:\s*1/.test(layout), 'the stage region has no flex: 1');
  const frameSrc = read('src/play/stage-frame.ts');
  assert.match(frameSrc, /export function computeStageFrame\(\s*id: GameScreenId,\s*window: \{ width: number; height: number \},\s*insets: Insets,\s*\)/, 'the frame reads only the window + safe area');
  const room = read('src/play/pet-room.tsx');
  assert.match(room, /const real = stageSize \?\? measured;/, 'the room uses the frame size, not a measure pass');
  assert.match(room, /styles\.stageFixed, \{ width: stageSize\.width, height: stageSize\.height \}/, 'the room stage is the frame size');
  const screen = read('src/play/pet-screen.tsx');
  assert.match(screen, /stageSize=\{street \? \{ width: frame\.stage\.width, height: frame\.stage\.height \} : undefined\}/, 'Hideout passes the frame size');
  const dive = read('src/play/dive-scene.tsx');
  assert.match(dive, /const \{ width, height \} = frame\.stage;/, 'Dive picture size = frame stage');
  assert.ok(!/setSize\(\{ width: e\.nativeEvent/.test(dive), 'Dive no longer measures its stage');
  const defend = read('src/play/defend-screen.tsx');
  assert.match(defend, /const boardSide = Math\.max\(160, Math\.min\(setupFrame\.stage\.width - 24, setupFrame\.stage\.height - TURF_HEADER_PT\)\);/, 'the Turf War board is sized from the frame');
  assert.ok(!/<ScrollView[^>]*>\s*\{?\/?\*?\s*Board/.test(defend), 'the board is not in a scroll view');
  ok('no flex-leftover stage: sizes come from the frame (Hideout, Dive, Turf War board)');
}

{
  const offenders: string[] = [];
  for (const { file } of SCREENS) {
    for (const prop of stageProps(read(file))) {
      const m = FORBIDDEN_IN_STAGE.exec(prop);
      if (m) offenders.push(`${file}: ${m[0]}`);
    }
  }
  assert.deepEqual(offenders, [], `notice / banner / coach / toast / hint / sheet inside a stage: ${offenders.join(', ')}`);
  const room = read('src/play/pet-room.tsx');
  assert.match(room, /hideoutStage && hideoutScale && !roomOutside \? \(\s*<HideoutStageControls/, 'the room row + swipe hint are not drawn in the stage');
  assert.match(room, /\{roomOutside \? null : \(\s*<View style=\{styles\.metersSlot\}/, 'the status strip is not drawn in the stage');
  ok('nothing but stage content inside a stage (notices, coach, hints, sheets live elsewhere)');
}

{
  const DEVICES: { name: string; window: { width: number; height: number }; insets: Insets }[] = [
    { name: '430x932', window: { width: 430, height: 932 }, insets: { top: 59, bottom: 34, left: 0, right: 0 } },
    { name: '375x667', window: { width: 375, height: 667 }, insets: { top: 20, bottom: 0, left: 0, right: 0 } },
  ];
  const STATES = [{}, { notice: true }, { tip: true }, { paused: true }, { loading: true }, { notice: true, tip: true, paused: true, loading: true }];
  for (const d of DEVICES) {
    for (const id of Object.keys(REGIONS) as GameScreenId[]) {
      const frame = computeStageFrame(id, d.window, d.insets);
      const base = layoutRegions(frame, {}).stage;
      for (const st of STATES) assert.deepEqual(layoutRegions(frame, st).stage, base, `${id} @ ${d.name}: stage changed with ${JSON.stringify(st)}`);
      const sum = frame.insets.top + frame.topBar.height + frame.notice.height + frame.stage.height + frame.dock.height + frame.bottom.height;
      assert.equal(sum, d.window.height, `${id} @ ${d.name}: regions fill the window exactly`);
      assert.ok(frame.stage.height > 0, `${id} @ ${d.name}: stage has room`);
    }
    const setup = computeStageFrame('turf-setup', d.window, d.insets).stage;
    const wave = computeStageFrame('turf-wave', d.window, d.insets).stage;
    assert.deepEqual(wave, setup, `Turf War @ ${d.name}: setup and wave share one stage`);
  }
  const max = computeStageFrame('hideout', DEVICES[0].window, DEVICES[0].insets).stage;
  assert.equal(max.height, 563, 'Hideout stage on 430×932 is 563 pt (spec §2, Phase 1)');
  ok('frame is identical with / without notice, tip, pause, loading at 430×932 + 375×667; Turf setup = wave');
}

{
  // The Hideout room fills the stage and the camera keeps the pet in view, inside the room.
  for (const [w, h] of [
    [430, 563],
    [375, 365],
  ] as const) {
    const sc = hideoutCoverScale({ availW: w, availH: h, pixelRatio: 3 });
    assert.ok(sc.canvasW >= w - 0.5 && sc.canvasH >= h - 0.5, `room covers the ${w}×${h} stage`);
    const rest = hideoutCoverRestTop(h, sc.canvasH);
    assert.equal(rest, h - sc.canvasH, 'at rest the floor sits on the stage bottom');
    for (const feet of [0, sc.canvasH * 0.3, sc.canvasH * 0.6, sc.canvasH]) {
      const top = hideoutCameraTop(h, sc.canvasH, feet, rest);
      assert.ok(top <= 0 && top >= h - sc.canvasH, 'camera never shows past the room');
      const y = feet + top;
      assert.ok(y >= -0.5 && y <= h + 0.5, `pet feet at ${Math.round(feet)} stay on screen`);
    }
  }
  ok('Hideout room fills the stage; the camera keeps the pet on screen and never shows past the room');
}

console.log(`\ncheck:stage-bounds — ${passed} groups passed.`);
