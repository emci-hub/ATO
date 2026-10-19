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
  // Phase 5: the status note left the 152 pt dock; it is one line in the lane's idle slot (never grows).
  assert.ok(!/styles\.note\b/.test(screen), 'Dive dock has no status note any more');
  assert.match(screen, /status=\{dockStatus\(run, charges\)\}/, 'the Dive status line goes to the NoticeLane');
  assert.match(scene, /<PixelBody size="sm" numberOfLines=\{1\} style=\{styles\.laneText\}>\{idleText/, 'the status is one line in the lane');
  ok('Dive: fixed frame, reserved Heat row, 2 button rows, one-line status in the NoticeLane, finds via notify()');
}

{
  const defend = read('src/play/defend-screen.tsx');
  assert.match(defend, /useStageFrame\('turf-setup'\)/, 'Turf War: one frame for setup and wave');
  assert.match(defend, /computeStageFrame\('turf-wave', setupFrame\.window, setupFrame\.insets\)/, 'the wave frame shares the setup insets');
  assert.match(defend, /coachLine: \{ flex: 1, justifyContent: 'center'/, 'coach / pause line fills the NoticeLane');
  ok('Turf War: one stage for setup + wave; coach and pause lines live in the NoticeLane');
}

{
  // P5 (pet team, 2026-10-18): the Turf team picker lives INSIDE the Setup sheet body (a scrolling
  // PlaySheet) — never in the dock, the HUD or over the board — so picking helpers resizes no region.
  const defend = read('src/play/defend-screen.tsx');
  const sheet = defend.indexOf('<PlaySheet open={setupOpen && !live} title="Setup"');
  const sheetEnd = defend.indexOf('</PlaySheet>', sheet);
  const picker = defend.indexOf('<TurfTeamCard');
  assert.ok(sheet > 0 && picker > sheet && picker < sheetEnd, 'the team picker sits inside the Setup sheet body');
  assert.equal(defend.split('<TurfTeamCard').length - 1, 1, 'one picker, nowhere else');
  const card = read('src/play/turf-team-card.tsx');
  assert.ok(!/\bheight: \d/.test(card), 'the picker sets no fixed height (it grows the sheet scroll)');
  ok('Turf team picker: inside the Setup sheet body only, no fixed heights');
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
  // Divecore finish step 4: the Today button lives in the Hideout DOCK (a fixed 64 pt region), opens the existing
  // PlaySheet, and the 56 pt top bar (already full on a 375 pt phone) is untouched. The badge never pulses.
  const pet = read('src/play/pet-screen.tsx');
  const dockAt = pet.indexOf('dock={');
  const todayAt = pet.indexOf('label="Today"');
  assert.ok(dockAt > 0 && todayAt > dockAt, 'the Today button is in the Hideout dock');
  assert.ok(pet.includes("<PlaySheet open={sheet === 'today'}"), 'the list is the existing PlaySheet (no new modal)');
  const btn = pet.slice(todayAt - 60, todayAt + 420);
  assert.ok(btn.includes('pulse={false}') && btn.includes('badge={false}') && btn.includes('badgeCount={todayList.length}'), 'a count badge, no dot, no pulse');
  assert.match(pet, /iconRow: \{[^}]*height: 64,/s, 'the dock row keeps its 64 pt height');
  assert.ok(!/Today/.test(read('src/play/street-shell.tsx')), 'the top bar gets no Today chip');
  assert.ok(!/setInterval|setTimeout|useEffect/.test(read('src/play/today-sheet.tsx') + read('src/play/today.ts')), 'Today adds no timer or effect of its own');
  ok('Today: a dock button + the existing sheet; the top bar and the dock height are untouched; no timer');
}

{
  // Divecore finish step 5: the newbie guide is a fixed 76 pt bubble in a GameScreen's float layer (box-none), never
  // in flow, on the Hideout, the Locker and Turf setup; it adds no region and no timer.
  const bubble = read('src/play/guide-bubble.tsx');
  assert.ok(bubble.includes('GUIDE_BUBBLE_HEIGHT = 76') && bubble.includes("position: 'absolute'") && bubble.includes('pointerEvents="box-none"'), 'a fixed absolute bubble in a box-none wrapper');
  assert.ok(!/setInterval|setTimeout|withRepeat/.test(bubble), 'the guide adds no timer and never pulses');
  const hosts = ['src/play/pet-screen.tsx', 'src/play/defend-screen.tsx', 'src/app/play.tsx'].map((f) => (read(f).match(/<GuideHost\b/g) ?? []).length);
  assert.deepEqual(hosts, [1, 1, 1], 'one host per screen: Hideout, Turf setup, Locker');
  assert.ok(/float=\{[\s\S]{0,200}<GuideHost screen="locker"/.test(read('src/app/play.tsx')), 'the Locker guide rides the float layer, not the scroll body');
  ok('Guide: a fixed float bubble on three screens; no region, no timer');
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
