/**
 * Fixed regions gate (emci 2026-10-13: "stuff keeps going big and small").
 * Run: npm run check:fixed-regions  (part of check:ota-gate)
 *
 * Game screens are fixed REGIONS (top bar · viewport · bottom panel) plus a floating
 * overlay; content may change inside a region but never its size. Rule text:
 * src/play/fixed-region.tsx and docs/GOTCHAS.md (UI). This pins every place that was
 * fixed so the jump can't quietly come back, and a few general bans.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repo = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(repo, rel), 'utf8');
let passed = 0;
const ok = (msg: string) => {
  passed += 1;
  console.log(`  ✓ ${msg}`);
};

{
  const kit = read('src/play/fixed-region.tsx');
  for (const name of ['useGrowOnlyHeight', 'ReservedRegion', 'Reserve']) {
    assert.match(kit, new RegExp(`export function ${name}\\b`), `fixed-region exports ${name}`);
  }
  assert.match(kit, /h > m \? h : m/, 'ReservedRegion only ever grows');
  assert.match(kit, /fixed-regions: screen switch/, 'kit documents the screen-switch exception');
  ok('fixed-region kit: useGrowOnlyHeight / ReservedRegion (grow-only) / Reserve');
}

{
  const shell = read('src/app/play.tsx');
  // Only Turf War swaps the shell bars, at setup → run — a documented screen switch. A
  // grow-only shell region left a blank band on every tab after one run, so it is not used.
  assert.match(shell, /only Turf War swaps these bars, at setup → run — a screen switch/, 'shell documents the screen switch');
  ok('shell: bar swap is the documented Turf War screen switch (no grow-only band on other tabs)');
}

{
  const scene = read('src/play/dive-scene.tsx');
  const screen = read('src/play/dive-screen.tsx');
  assert.match(scene, /useGrowOnlyHeight\(\)/, 'Dive panel is grow-only');
  assert.match(scene, /style=\{bustPct == null \? styles\.reserved : undefined\}/, 'Dive Heat row is reserved off a run');
  assert.match(scene, /toast: \{ position: 'absolute'/, 'Dive find / caption toast floats');
  assert.match(screen, /const DIVE_DOCK_ROWS = 2;/, 'Dive button area keeps 2 rows');
  assert.match(screen, /minHeight: pixelBodyLine\(PIXEL_CAPTION_PT\) \* 2/, 'Dive status note keeps 2 lines');
  ok('Dive: grow-only panel, reserved Heat row, 2 button rows, 2-line note, floating toast');
}

{
  const defend = read('src/play/defend-screen.tsx');
  assert.match(defend, /style=\{\[styles\.coachLine, paused && styles\.streetReserved\]\}/, 'Turf War coach line is one fixed box');
  assert.match(defend, /coachLine: \{ minHeight: 58/, 'Turf War coach line reserves 3 lines');
  ok('Turf War: in-run coach line is one fixed box (pause no longer shifts the board)');
}

{
  const room = read('src/play/street-room.tsx');
  assert.match(room, /flexWrap: 'nowrap',\s*height: 36,/, 'Hideout status strip is one fixed row');
  const games = read('src/play/pet-games.tsx');
  assert.match(games, /hint: \{ textAlign: 'center', minHeight: pixelBodyLine\(PIXEL_CAPTION_PT\) \* 2 \}/, 'pet game hint keeps 2 lines');
  const dress = read('src/play/dress-screen.tsx');
  assert.match(dress, /useState\(legendTipSeen === false\)/, 'Locker tip is decided before first paint');
  const forge = read('src/play/sword-forge-screen.tsx');
  assert.match(forge, /\{notice \?\? ' '\}/, 'sword notice keeps its line');
  assert.match(room, /stripMain: \{ flexGrow: 1, flexShrink: 0,/, 'Hideout meters never get clipped (the name truncates)');
  ok('Hideout strip, pet-game hint, Locker tip, sword notice hold their space');
}

{
  // General ban: no game screen collapses a row (display:none style or inline) keyed on the
  // run phase — unless the line above marks a deliberate `fixed-regions: screen switch`.
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.tsx')) {
        const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/);
        lines.forEach((line, i) => {
          const collapse =
            /(phase|running|active).{0,40}&& styles\.\w*[Hh]idden\b/.test(line) ||
            /(phase|running|active).{0,60}display: 'none'/.test(line);
          if (collapse && !/fixed-regions: screen switch/.test(lines[i - 1] ?? '')) {
            offenders.push(`${path.relative(repo, full)}:${i + 1}`);
          }
        });
      }
    }
  };
  walk(path.join(repo, 'src/play'));
  assert.deepEqual(offenders, [], `run-phase collapse without a screen-switch marker (use Reserve): ${offenders.join(', ')}`);
  ok('no unmarked run-phase collapse in src/play (screen switches are marked)');
}

{
  const gotchas = read('docs/GOTCHAS.md');
  assert.match(gotchas, /Game screens use fixed regions/, 'GOTCHAS carries the rule');
  ok('rule documented in docs/GOTCHAS.md');
}

console.log(`\ncheck:fixed-regions — ${passed} groups passed.`);
