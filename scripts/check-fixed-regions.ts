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
  // Stage layout (Phase 1, 2026-10-14): every Street screen is a GameScreen whose regions come from
  // one frame (src/play/stage-layout.tsx, check:stage-bounds). The shell no longer has a flex-leftover
  // body or swappable bar slots; Turf War's setup → wave keeps the same stage (no screen-switch jump).
  const shell = read('src/app/play.tsx');
  assert.match(shell, /useStageFrame\('list'\)/, 'list screens take the list frame');
  assert.ok(!/streetBody|StreetDockOutlet|StreetHudOutlet/.test(shell), 'no flex-leftover shell body or bar slots');
  ok('shell: Street screens are GameScreens (no flex-leftover body, no bar swap)');
}

{
  const scene = read('src/play/dive-scene.tsx');
  const screen = read('src/play/dive-screen.tsx');
  assert.match(scene, /useStageFrame\('dive'\)/, 'Dive takes its frame (fixed dock + stage)');
  assert.ok(!/useGrowOnlyHeight/.test(scene), 'Dive panel is fixed, not grow-only');
  assert.match(scene, /style=\{bustPct == null \? styles\.reserved : undefined\}/, 'Dive Heat row is reserved off a run');
  assert.match(scene, /notice=\{<View style=\{styles\.lane\}>\{laneLine\}<\/View>\}/, 'Dive idle line (away) sits in the NoticeLane');
  assert.match(scene, /notify\(\{ kind: 'notify', title: 'Found'/, 'a Dive find is a notify() notice in the lane');
  assert.match(scene, /notify\(\{ kind: 'celebrate', title: 'Rare find'/, 'a rare find is a celebrate notice');
  assert.match(screen, /const DIVE_DOCK_ROWS = 2;/, 'Dive button area keeps 2 rows');
  assert.match(screen, /minHeight: pixelBodyLine\(PIXEL_CAPTION_PT\) \* 2/, 'Dive status note keeps 2 lines');
  ok('Dive: fixed frame, reserved Heat row, 2 button rows, 2-line note, finds via notify() in the NoticeLane');
}

{
  const defend = read('src/play/defend-screen.tsx');
  assert.match(defend, /useStageFrame\('turf-setup'\)/, 'Turf War: one frame for setup and wave');
  assert.match(defend, /computeStageFrame\('turf-wave', setupFrame\.window, setupFrame\.insets\)/, 'the wave frame shares the setup insets');
  assert.match(defend, /coachLine: \{ flex: 1, justifyContent: 'center'/, 'coach / pause line fills the NoticeLane');
  ok('Turf War: one stage for setup + wave; coach and pause lines live in the NoticeLane');
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
  // Aura + holo are their own layers that follow the pet and are clipped: the pet's stage reserves room
  // for the biggest aura + glint halo and clips there, and the screen's viewport region clips again, so a
  // big aura never draws over a bar, a button or an overlay (aura/holo rework 2026-10-14).
  const figure = read('src/play/pet-figure.tsx');
  assert.match(figure, /export const STAGE_RESERVE = /, 'pet figure reserves room for the aura + glints');
  assert.match(figure, /stage: \{ position: 'absolute', overflow: 'hidden' \}/, 'the pet stage clips its aura and holo');
  assert.ok(!/overflow: 'visible'/.test(figure), 'no overflow: visible escape on the pet');
  const room = read('src/play/pet-room.tsx');
  assert.match(room, /stage: \{ flex: 1, minHeight: 0, overflow: 'hidden' \}/, 'the room viewport region clips the pet layers');
  const card = read('src/play/pet-card.tsx');
  assert.match(card, /art: \{[^}]*overflow: 'hidden'/, "the card's art area clips the pet layers");
  ok('aura + holo: the pet stage and the room / card viewport regions clip them (no overflow escape)');
}

{
  const gotchas = read('docs/GOTCHAS.md');
  assert.match(gotchas, /Game screens use fixed regions/, 'GOTCHAS carries the rule');
  ok('rule documented in docs/GOTCHAS.md');
}

console.log(`\ncheck:fixed-regions — ${passed} groups passed.`);
