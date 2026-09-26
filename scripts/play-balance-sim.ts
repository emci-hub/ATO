/**
 * Play balance simulator — runs the real Defend engine (`src/play/defend.ts`)
 * headless, no phone, no rendering.
 *
 * The engine is pure and has no randomness, so one run per setup is exact. For
 * every wave (Trial 1-5, Main 1-10) × strategy × cycle level it answers:
 *
 *   - Does a no-gear player clear it at all (leaks at ×1 damage)?
 *   - "Damage needed": the smallest board-wide damage multiplier (the same
 *     `wavePower` bucket gear feeds) that clears it with ZERO leaks. Under 1×
 *     = clears with no gear; over the gear soft cap (tune gearSoftcapWavePower,
 *     2× Sane) = gear alone barely helps (past the cap it only adds
 *     `diminishingAfterCap` per point).
 *
 * Player model (deliberately simple, stated in the report): each wave starts
 * on a fresh board with the tune's start scrap (as the game does), towers go
 * on the pads that cover the most path first, scrap is spent the moment it can
 * be (build until the 6-tower cap, then upgrade the best-placed tower), the
 * Avatar stands still at the spot covering the most path and never casts its
 * skill, no gear, no type match, no Avatar stars. Default `ato` board only
 * (Main's parked alternate board is not simulated).
 *
 * Every hero tower shares one stat block today (`HERO_TOWER_STATS`), so hero
 * kits change nothing here until EFFECTS_PLAN step 4 wires them into combat —
 * the "+2 hero towers" strategy stands in for all 16.
 *
 * Run: npm run sim:balance   (writes games/grove/BALANCE_REPORT.md)
 */
import fs from 'node:fs';
import path from 'node:path';

import {
  AVATAR_RANGE,
  DEFEND_TICK_MS,
  HERO_TOWER_STATS,
  MAX_TOWERS,
  TOWER_DEFS,
  createDefendLive,
  placeBoundBoss,
  placeTower,
  puffPosition,
  stepDefendLive,
  towerUpgradeCost,
  upgradeTower,
  type DefendLive,
  type TowerKind,
} from '../src/play/defend';
import { BOARD_MAPS } from '../src/play/board-data';
import { getTune } from '../src/play/tune';

type Phase = 'trial' | 'main';
const WAVES: { phase: Phase; wave: number }[] = [
  ...[1, 2, 3, 4, 5].map((wave) => ({ phase: 'trial' as const, wave })),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((wave) => ({ phase: 'main' as const, wave })),
];

type Strategy = { id: string; label: string; towers: TowerKind[]; heroTowers: number };
const STRATEGIES: Strategy[] = [
  { id: 'avatar', label: 'Avatar only', towers: [], heroTowers: 0 },
  { id: 'archer', label: 'Archers', towers: ['archer'], heroTowers: 0 },
  { id: 'vine', label: 'Vines', towers: ['vine'], heroTowers: 0 },
  { id: 'crystal', label: 'Crystals', towers: ['crystal'], heroTowers: 0 },
  { id: 'mixed', label: 'Mixed', towers: ['archer', 'vine', 'crystal'], heroTowers: 0 },
  { id: 'mixed+heroes', label: 'Mixed + 2 hero towers', towers: ['archer', 'vine', 'crystal'], heroTowers: 2 },
];

/** Conquered cycles to test (cycle power = 1 + cycles × tune.cyclePowerStep). */
const CYCLES = [0, 2, 5];
const HERO_ID = 'archangel'; // any hero — all share HERO_TOWER_STATS today
const MAX_SIM_MS = 10 * 60_000;

const map = BOARD_MAPS.ato;
// `puffPosition` works in the path's 0..1 space; pads, ranges and the Avatar
// are board units (0..100), so scale once here.
const PATH_SAMPLES = Array.from({ length: 240 }, (_, i) => {
  const p = puffPosition(i / 239, map);
  return { x: p.x * 100, y: p.y * 100 };
});

function coverage(p: { x: number; y: number }, range: number): number {
  return PATH_SAMPLES.filter((q) => Math.hypot(q.x - p.x, q.y - p.y) <= range).length;
}

/** Pads ranked best-first by how much path a tower of `range` would cover. */
function rankedPads(range: number): number[] {
  return map.pads
    .map((pad, index) => ({ index, score: coverage(pad, range) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((row) => row.index);
}

const AVATAR_SPOT = PATH_SAMPLES.reduce(
  (best, p) => {
    const score = coverage(p, AVATAR_RANGE);
    return score > best.score ? { p, score } : best;
  },
  { p: PATH_SAMPLES[0], score: -1 },
).p;

type RunResult = {
  leaked: number;
  clearSec: number;
  towersBuilt: number;
  avgLevel: number;
  scrapLeft: number;
};

function simulate(
  phase: Phase,
  wave: number,
  strategy: Strategy,
  cyclePower: number,
  damageMult: number,
): RunResult {
  let s: DefendLive = createDefendLive(wave, { mapId: phase, boardId: 'ato', cyclePower });
  const buckets = { wavePower: damageMult, towerSpeed: 1, avatarLevel: 1, typeMatch: 0, avatarStars: 0 };

  // Hero towers first (free), on the pads a 20-range tower covers best.
  const heroPads = rankedPads(HERO_TOWER_STATS.range).slice(0, strategy.heroTowers);
  for (const pad of heroPads) s = placeBoundBoss(s, pad, HERO_ID, 1) ?? s;

  let buildIndex = 0;
  const spend = () => {
    if (strategy.towers.length === 0) return;
    for (;;) {
      if (s.towers.length < MAX_TOWERS) {
        const kind = strategy.towers[buildIndex % strategy.towers.length];
        const taken = new Set([...s.towers.map((t) => t.pad), ...s.boundBosses.map((b) => b.pad)]);
        const pad = rankedPads(TOWER_DEFS[kind].range).find((p) => !taken.has(p));
        if (pad == null) return;
        const next = placeTower(s, pad, kind);
        if (!next) return; // can't afford yet
        s = next;
        buildIndex += 1;
        continue;
      }
      // Board full: upgrade the lowest-level tower (earliest built wins ties).
      const target = [...s.towers].sort((a, b) => a.level - b.level || a.id - b.id)[0];
      const cost = target ? towerUpgradeCost(target) : 0;
      if (!target || cost <= 0 || s.scrap < cost) return;
      const next = upgradeTower(s, target.id);
      if (!next) return;
      s = next;
    }
  };

  let leaked = 0;
  let t = 0;
  spend();
  while (t < MAX_SIM_MS) {
    const step = stepDefendLive(s, DEFEND_TICK_MS, buckets, AVATAR_SPOT);
    s = step.state;
    t += DEFEND_TICK_MS;
    if (step.leak) {
      const out = s.puffs.filter((p) => p.dist >= 1).length;
      leaked += out;
      s = { ...s, puffs: s.puffs.filter((p) => p.dist < 1) };
    }
    if (s.schedule.length === 0 && s.puffs.length === 0) break;
    spend();
  }
  return {
    leaked,
    clearSec: Math.round(t / 100) / 10,
    towersBuilt: s.towers.length,
    avgLevel: s.towers.length ? s.towers.reduce((a, x) => a + x.level, 0) / s.towers.length : 0,
    scrapLeft: s.scrap,
  };
}

/** Smallest damage multiplier (±0.02) that clears with zero leaks, or null if
 * even 8× leaks (e.g. Avatar-only against a boss). */
function damageNeeded(phase: Phase, wave: number, strategy: Strategy, cyclePower: number): number | null {
  const clears = (m: number) => simulate(phase, wave, strategy, cyclePower, m).leaked === 0;
  let hi = 1;
  while (!clears(hi)) {
    hi *= 2;
    if (hi > 8) return null;
  }
  let lo = 0.05;
  if (clears(lo)) return lo;
  while (hi - lo > 0.02) {
    const mid = (lo + hi) / 2;
    if (clears(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

const gearCap = getTune().gearSoftcapWavePower;
const step = getTune().cyclePowerStep;

type Cell = { run: RunResult; need: number | null };
const results = new Map<string, Cell>();
const key = (c: number, w: { phase: Phase; wave: number }, s: Strategy) => `${c}|${w.phase}${w.wave}|${s.id}`;

const started = Date.now();
for (const cycles of CYCLES) {
  const cp = 1 + cycles * step;
  for (const w of WAVES) {
    for (const strat of STRATEGIES) {
      results.set(key(cycles, w, strat), {
        run: simulate(w.phase, w.wave, strat, cp, 1),
        need: damageNeeded(w.phase, w.wave, strat, cp),
      });
    }
  }
}
const secs = ((Date.now() - started) / 1000).toFixed(1);

function fmtNeed(need: number | null): string {
  if (need == null) return '>8×';
  return `${need.toFixed(2)}×`;
}

function cell(c: Cell): string {
  const base = c.run.leaked === 0 ? '✓' : `✗${c.run.leaked}`;
  return `${base} ${fmtNeed(c.need)}`;
}

const waveName = (w: { phase: Phase; wave: number }) => `${w.phase === 'trial' ? 'Trial' : 'Main'} ${w.wave}`;

const lines: string[] = [];
lines.push('# Play balance report');
lines.push('');
lines.push(`Generated by \`npm run sim:balance\` on ${new Date().toISOString().slice(0, 10)} — the real Defend engine, run headless (${secs}s, deterministic).`);
lines.push('');
lines.push('**How to read a cell:** `✓` = a no-gear player clears it; `✗3` = 3 creeps leak at ×1 damage (the wave is lost). The number is the **damage needed** to clear with zero leaks: under 1× is comfortable, 1×–' + gearCap.toFixed(1) + '× needs gear, over ' + gearCap.toFixed(1) + '× is beyond the gear soft cap.');
lines.push('');
lines.push('**Player model:** default ATO board only; fresh board each wave with ' + getTune().startScrap + ' scrap; towers on the pads covering the most path; scrap spent immediately (build to ' + MAX_TOWERS + ', then upgrade); Avatar parked at the best path spot, never casts its skill; no gear, no type match, no Avatar stars. Hero towers all share one stat block today, so one hero stands in for all 16 until effects step 4.');
lines.push('');

for (const cycles of CYCLES) {
  lines.push(`## Cycle ${cycles} (cycle power ${(1 + cycles * step).toFixed(2)})`);
  lines.push('');
  lines.push(`| Wave | ${STRATEGIES.map((s) => s.label).join(' | ')} |`);
  lines.push(`|---|${STRATEGIES.map(() => '---').join('|')}|`);
  for (const w of WAVES) {
    lines.push(`| ${waveName(w)} | ${STRATEGIES.map((s) => cell(results.get(key(cycles, w, s))!)).join(' | ')} |`);
  }
  lines.push('');
}

// Findings — computed, not hand-written.
const findings: string[] = [];
const main = STRATEGIES.find((s) => s.id === 'mixed')!;
for (const cycles of CYCLES) {
  const needs = WAVES.map((w) => ({ w, c: results.get(key(cycles, w, main))! }));
  const hardest = [...needs].sort((a, b) => (b.c.need ?? 99) - (a.c.need ?? 99))[0];
  const lost = needs.filter((n) => n.c.run.leaked > 0).map((n) => waveName(n.w));
  const beyond = needs.filter((n) => (n.c.need ?? 99) > gearCap).map((n) => waveName(n.w));
  findings.push(
    `- **Cycle ${cycles}, Mixed towers:** hardest is ${waveName(hardest.w)} (needs ${fmtNeed(hardest.c.need)}). ` +
      (lost.length ? `Lost with no gear: ${lost.join(', ')}. ` : 'Every wave clears with no gear. ') +
      (beyond.length ? `Beyond the gear cap: ${beyond.join(', ')}.` : 'Nothing is beyond the gear cap.'),
  );
}
// Difficulty should climb: flag any wave that is easier than the one before it.
const dips: string[] = [];
for (let i = 1; i < WAVES.length; i += 1) {
  if (WAVES[i].phase !== WAVES[i - 1].phase) continue;
  const prev = results.get(key(0, WAVES[i - 1], main))!.need ?? 99;
  const cur = results.get(key(0, WAVES[i], main))!.need ?? 99;
  if (cur < prev - 0.1) dips.push(`${waveName(WAVES[i])} (${fmtNeed(cur)}) is easier than ${waveName(WAVES[i - 1])} (${fmtNeed(prev)})`);
}
findings.push(dips.length ? `- **Difficulty dips (cycle 0, Mixed):** ${dips.join('; ')}.` : '- **Difficulty climbs smoothly** wave to wave (cycle 0, Mixed).');
// Strategy ranking by average damage needed at cycle 0, over the waves it can
// clear at all; waves that still leak at 8× are counted separately, not
// averaged in as a made-up number.
const ranking = STRATEGIES.map((s) => {
  const needs = WAVES.map((w) => results.get(key(0, w, s))!.need);
  const clearable = needs.filter((n): n is number => n != null);
  const avg = clearable.length ? clearable.reduce((a, b) => a + b, 0) / clearable.length : Infinity;
  return { s, avg, unclearable: needs.length - clearable.length };
}).sort((a, b) => a.unclearable - b.unclearable || a.avg - b.avg);
findings.push(
  `- **Strategy ranking (cycle 0, avg damage needed over clearable waves, lower = stronger):** ${ranking
    .map(
      (r) =>
        `${r.s.label} ${Number.isFinite(r.avg) ? `${r.avg.toFixed(2)}×` : '—'}` +
        (r.unclearable ? ` (+${r.unclearable} wave${r.unclearable > 1 ? 's' : ''} unclearable even at 8×)` : ''),
    )
    .join(' · ')}.`,
);

lines.splice(6, 0, '## Findings', '', ...findings, '');

const out = path.join('games', 'grove', 'BALANCE_REPORT.md');
fs.writeFileSync(out, `${lines.join('\n')}\n`);
console.log(findings.join('\n'));
console.log(`\nWrote ${out} (${secs}s).`);
