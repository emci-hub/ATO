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
 * Hero towers fight with their kits (EFFECTS_PLAN step 4), so the report
 * also compares all 16 heroes: "Mixed + 2 of this hero" over every wave at
 * cycle 0. The "+2 hero towers" column uses Archangel.
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
  castPetPounce,
  createDefendLive,
  boardLayoutOf,
  placeBoundBoss,
  placeTower,
  restoreBoardLayout,
  puffPosition,
  stepDefendLive,
  towerUpgradeCost,
  upgradeTower,
  type BoardLayout,
  type DefendLive,
  type TowerKind,
} from '../src/play/defend';
import { BOARD_MAPS } from '../src/play/board-data';
import { KEPT_BOARD_MIN_SCRAP, setupScrapFor } from '../src/play/board-layouts';
import { allHeroes } from '../src/play/heroes-data';
import { waveDefFor } from '../src/play/director';
import { kitLabel, type Element } from '../src/play/kits';
import { PET_BRANCH_POUNCE, PET_POUNCE_BASE, PET_POUNCE_RADIUS, PET_REBIRTH_CAP } from '../src/play/pet';
import { getTune, setKnob } from '../src/play/tune';
import rawItems from '../src/play/data/items.json';
import { bucketMultiplier } from '../src/play/playStore';

type Phase = 'trial' | 'main';
const WAVES: { phase: Phase; wave: number }[] = [
  ...[1, 2, 3, 4, 5].map((wave) => ({ phase: 'trial' as const, wave })),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((wave) => ({ phase: 'main' as const, wave })),
];

type Strategy = {
  id: string;
  label: string;
  towers: TowerKind[];
  heroTowers: number;
  heroId?: string;
  /** The active Legend's element (null = none, the pre-Legend baseline). */
  legend?: Element | null;
  /** The Legend's level (drives effect strength + resist recovery). */
  legendLevel?: number;
  /** Pet pounce base damage (0/undefined = no pet). Cast once per wave the
   * first tick 3+ foes, or a tank/boss, are within reach of the Avatar. */
  petBase?: number;
  /** Pet rebirth bonus (0..0.10) folded into the damage pass. */
  rebirthBonus?: number;
  /** Gear wave_power bucket (1 = no gear) — multiplies the tested damage. */
  gearMult?: number;
};
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
const HERO_ID = 'archangel'; // the default hero for the "+2 hero towers" column
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
  /** What this wave leaves for the next one in campaign mode. */
  endLayout: BoardLayout;
  earned: number;
  /** Scrap left after setup spending (what a lost restage returns). */
  setupLeft: number;
};

/** Campaign carry-over: the previous wave's layout (restored free) + banked
 * kill scrap, exactly as the game does since saved layouts landed. */
type Carry = { layout: BoardLayout; bank: number; noStartScrap?: boolean } | null;

function simulate(
  phase: Phase,
  wave: number,
  strategy: Strategy,
  cyclePower: number,
  damageMult: number,
  carry: Carry = null,
): RunResult {
  let s: DefendLive = createDefendLive(wave, { mapId: phase, boardId: 'ato', cyclePower });
  if (carry) {
    const allowed = new Map<string, number>([[strategy.heroId ?? HERO_ID, 1]]);
    s = restoreBoardLayout(s, carry.layout, allowed);
    const kept = s.towers.length + s.boundBosses.length > 0;
    // Shipped rule = the game's own `setupScrapFor` (start scrap only on an
    // empty board; a kept board runs on its bank, floored at one tower).
    s = {
      ...s,
      scrap: carry.noStartScrap
        ? setupScrapFor({ keptBoard: kept, startScrap: s.scrap, bank: carry.bank })
        : s.scrap + carry.bank,
    };
  }
  const buckets = {
    wavePower: damageMult * (strategy.gearMult ?? 1),
    towerSpeed: 1,
    avatarLevel: strategy.legendLevel ?? 1,
    legendElement: (strategy.legend ?? null) as Element | null,
    avatarStars: 0,
    rebirthBonus: strategy.rebirthBonus ?? 0,
  };

  // Hero towers first (free), on the pads a 20-range tower covers best.
  const heroPads = rankedPads(HERO_TOWER_STATS.range).slice(0, strategy.heroTowers);
  for (const pad of heroPads) s = placeBoundBoss(s, pad, strategy.heroId ?? HERO_ID, 1) ?? s;

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
  // Build in setup only — pads lock while a wave runs (emci, 2026-09-26).
  spend();
  const startScrap = s.scrap;
  const endLayout = boardLayoutOf(s);
  while (t < MAX_SIM_MS) {
    const step = stepDefendLive(s, DEFEND_TICK_MS, buckets, AVATAR_SPOT);
    s = step.state;
    t += DEFEND_TICK_MS;
    if (step.leak) {
      const out = s.puffs.filter((p) => p.dist >= 1).length;
      leaked += out;
      s = { ...s, puffs: s.puffs.filter((p) => p.dist < 1) };
    }
    if (strategy.petBase && !s.petPounceUsed) {
      const near = s.puffs.filter((p) => {
        const q = puffPosition(p.dist, map);
        return Math.hypot(q.x * 100 - AVATAR_SPOT.x, q.y * 100 - AVATAR_SPOT.y) <= PET_POUNCE_RADIUS;
      });
      if (near.length >= 3 || near.some((p) => p.kind === 'tank' || p.kind === 'boss')) {
        const cast = castPetPounce(s, AVATAR_SPOT, strategy.petBase, null);
        if (cast) s = cast.state;
      }
    }
    if (s.schedule.length === 0 && s.puffs.length === 0) break;
  }
  return {
    leaked,
    clearSec: Math.round(t / 100) / 10,
    towersBuilt: s.towers.length,
    avgLevel: s.towers.length ? s.towers.reduce((a, x) => a + x.level, 0) / s.towers.length : 0,
    scrapLeft: s.scrap,
    endLayout,
    earned: Math.max(0, s.scrap - startScrap),
    setupLeft: startScrap,
  };
}

/** Smallest damage multiplier (±0.02) that clears with zero leaks, or null if
 * even 8× leaks (e.g. Avatar-only against a boss). */
function damageNeeded(
  phase: Phase,
  wave: number,
  strategy: Strategy,
  cyclePower: number,
  carry: Carry = null,
): number | null {
  const clears = (m: number) => simulate(phase, wave, strategy, cyclePower, m, carry).leaked === 0;
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
// Hero comparison (cycle 0): Mixed towers + 2 copies of each hero.
const heroRows = allHeroes().map((hero) => {
  const strat: Strategy = {
    id: `hero:${hero.id}`,
    label: hero.name,
    towers: ['archer', 'vine', 'crystal'],
    heroTowers: 2,
    heroId: hero.id,
  };
  const cells = WAVES.map((w) => ({
    w,
    run: simulate(w.phase, w.wave, strat, 1, 1),
    need: damageNeeded(w.phase, w.wave, strat, 1),
  }));
  const clearable = cells.filter((c) => c.need != null).map((c) => c.need as number);
  const avg = clearable.length ? clearable.reduce((a, b) => a + b, 0) / clearable.length : Infinity;
  const lost = cells.filter((c) => c.run.leaked > 0).length;
  const hardest = [...cells].sort((a, b) => (b.need ?? 99) - (a.need ?? 99))[0];
  return { hero, avg, lost, unclearable: cells.length - clearable.length, hardest };
}).sort((a, b) => a.unclearable - b.unclearable || a.avg - b.avg);

// Campaign mode (cycle 0): play Trial 1-5 then Main 1-10 in order, keeping
// the board per map (free restore) and banking won-wave kill scrap — the game
// since saved layouts. A wave's "damage needed" is measured from the board the
// ×1 run actually had going into it.
const campaignStrats = STRATEGIES.filter((st) => st.id === 'mixed' || st.id === 'mixed+heroes');
// Shipped rule (emci, 2026-09-27): start scrap only on an empty board; a kept
// board runs on the whole balance banked from the last win. The old rule (+start
// scrap every wave on top of a free kept board) stays for comparison.
const campaignVariants = campaignStrats.flatMap((strat) => [
  { strat, noStartScrap: true, label: `${strat.label} (shipped rule)` },
  { strat, noStartScrap: false, label: `${strat.label}, old rule: start scrap every wave` },
]);
const campaign = campaignVariants.map(({ strat, noStartScrap, label }) => {
  const rows: { w: (typeof WAVES)[number]; fresh: number | null; kept: number | null; towers: number; avgLevel: number }[] = [];
  let carry: Carry = null;
  let lastPhase: Phase | null = null;
  for (const w of WAVES) {
    if (w.phase !== lastPhase) carry = null; // each map keeps its own board
    lastPhase = w.phase;
    const run = simulate(w.phase, w.wave, strat, 1, 1, carry);
    rows.push({
      w,
      fresh: results.get(key(0, w, strat))!.need,
      kept: damageNeeded(w.phase, w.wave, strat, 1, carry),
      towers: run.towersBuilt,
      avgLevel: run.avgLevel,
    });
    // A lost wave keeps the board but banks nothing (only wins bank scrap).
    // Shipped rule: bank = this wave's kill scrap. The variant has no fresh
    // start scrap, so it must carry the whole leftover balance to be fair.
    // Shipped: a win banks max(end balance, 40); a loss restages at max(scrap
    // the wave started with, 40) — the game's one-tower floor. Old rule: kills
    // only on a win.
    const bank = noStartScrap
      ? Math.max(run.leaked > 0 ? run.setupLeft : run.scrapLeft, KEPT_BOARD_MIN_SCRAP)
      : run.leaked > 0
        ? 0
        : run.earned;
    carry = { layout: run.endLayout, bank, noStartScrap };
  }
  return { strat, label, rows };
});

// Legends (2026-09-28). Validates the three numbers emci asked about:
//  1. stage matchup — damage needed per elemental stage with each Legend;
//  2. hero affinity (+15%) — each hero with its matching Legend vs the same
//     hero with a Legend that is neutral on these stages;
//  3. a maxed Legend recovering half of a resisted stage.
const ELEMENTAL_WAVES = WAVES.filter((w) => w.phase === 'main' && w.wave >= 4);
const NEUTRAL_WAVES = WAVES.filter((w) => !(w.phase === 'main' && w.wave >= 4));
const LEGEND_ELEMENTS: Element[] = ['ember', 'tide', 'spark', 'root', 'void'];
const legendStrat = (legend: Element, heroId = HERO_ID, level = 1): Strategy => ({
  id: `legend:${legend}:${heroId}:${level}`,
  label: legend,
  towers: ['archer', 'vine', 'crystal'],
  heroTowers: 2,
  heroId,
  legend,
  legendLevel: level,
});
const stageRows = ELEMENTAL_WAVES.map((w) => ({
  w,
  needs: LEGEND_ELEMENTS.map((legend) => damageNeeded(w.phase, w.wave, legendStrat(legend), 1)),
}));
const avgNeed = (strat: Strategy, waves: typeof WAVES) => {
  const vals = waves.map((w) => damageNeeded(w.phase, w.wave, strat, 1)).filter((n): n is number => n != null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : Infinity;
};
// Isolated: the SAME hero with its OWN (matching) Legend, bonus on vs off (the
// tune knob set to 0). Comparing against a different Legend would mix in that
// element's own rider (Void's shred alone is worth about as much), which is
// what the first version of this table did.
const affinityBonus = getTune().heroAffinityBonus;
const affinityRows = allHeroes().map((hero) => {
  const own = hero.kit.element;
  const withBonus = avgNeed(legendStrat(own, hero.id), NEUTRAL_WAVES);
  setKnob('heroAffinityBonus', 0);
  const withoutBonus = avgNeed(legendStrat(own, hero.id), NEUTRAL_WAVES);
  setKnob('heroAffinityBonus', affinityBonus);
  return { hero, own, other: 'off' as const, matchedNeed: withBonus, otherNeed: withoutBonus, gain: withoutBonus / withBonus - 1 };
});

// Gear match: a full loadout of four average-strength Powers (from items.json),
// then the same loadout with ONE / ALL FOUR pieces matching the Legend. The
// wave_power bucket feeds board damage directly, so the board-damage change is
// the bucket ratio.
type RawMult = { stat: string; value: number } | null;
type RawItem = { core: { kind: string }; mult_a: RawMult; mult_b: RawMult };
const itemList = (Array.isArray(rawItems) ? rawItems : Object.values(rawItems)) as unknown as RawItem[];
const powers = itemList.filter((item) => item.core.kind === 'power');
const avgWavePower =
  powers
    .flatMap((item) => [item.mult_a, item.mult_b])
    .filter((m): m is { stat: string; value: number } => m != null && m.stat === 'wave_power')
    .reduce((acc, m, _i, arr) => acc + m.value / arr.length, 0);
const gearBonus = getTune().gearMatchBonus;
const bucketFor = (matched: number) => {
  const sum = avgWavePower * (4 - matched) + avgWavePower * (1 + gearBonus) * matched;
  return bucketMultiplier('wave_power', {
    wave_power: sum,
    tower_speed: 0,
    token_earn: 0,
    dive_luck: 0,
    research_yield: 0,
  });
};
const gearNone = bucketFor(0);
const gearOne = bucketFor(1);
const gearAll = bucketFor(4);
const resistWave = ELEMENTAL_WAVES[0];
const resistEl = waveDefFor(resistWave.phase, resistWave.wave)?.element as Element;
const resistLv1 = damageNeeded(resistWave.phase, resistWave.wave, legendStrat(resistEl, HERO_ID, 1), 1);
const resistLv20 = damageNeeded(resistWave.phase, resistWave.wave, legendStrat(resistEl, HERO_ID, 20), 1);
const neutralLv1 = damageNeeded(resistWave.phase, resistWave.wave, legendStrat('void', HERO_ID, 1), 1);

// Pet (v20, 2026-09-29): the once-per-wave pounce per stage (Standard form,
// and a Battle God), on the "Mixed + 2 hero towers" board over every wave.
// Target: about 3-8% less damage needed — helps, never mandatory.
const mixedHeroes = STRATEGIES.find((st) => st.id === 'mixed+heroes') as Strategy;
const perWaveGain = (base: Strategy, boosted: Strategy, waves: typeof WAVES) => {
  const ratios: number[] = [];
  for (const w of waves) {
    const a = damageNeeded(w.phase, w.wave, base, 1);
    const b = damageNeeded(w.phase, w.wave, boosted, 1);
    if (a != null && b != null) ratios.push(a / b);
  }
  return ratios.length ? ratios.reduce((x, y) => x + y, 0) / ratios.length : 1;
};
const petStages = ['child', 'teen', 'adult', 'god'] as const;
const petRows = [
  ...petStages.map((stage) => ({ label: stage, base: PET_POUNCE_BASE[stage] })),
  { label: 'god (battle)', base: PET_POUNCE_BASE.god * PET_BRANCH_POUNCE.battle },
].map((row) => ({
  ...row,
  gain: perWaveGain(mixedHeroes, { ...mixedHeroes, id: `pet:${row.label}`, petBase: row.base }, WAVES) - 1,
}));

// Every PERMANENT boost stacked at its max, vs a fresh player — emci asked for
// the combined total, not just each alone (2026-09-29). Per Legend, with a
// hero whose affinity matches it, over every wave (Trial 1-5 + Main 1-10):
//   base  = Legend Lv1, affinity off, the same 4 Powers UNMATCHED, no pet,
//           no rebirth;
//   max   = Legend Lv20 + affinity + fully matched gear + a Battle God pet +
//           rebirth +10%.
// "Board strength" = base damage needed ÷ max damage needed, averaged per wave
// (×1.50 = the same board clears waves needing 50% more damage).
const GOD_BATTLE = PET_POUNCE_BASE.god * PET_BRANCH_POUNCE.battle;
const withAffinity = <T,>(on: boolean, fn: () => T): T => {
  const keep = getTune().heroAffinityBonus;
  setKnob('heroAffinityBonus', on ? affinityBonus : 0);
  try {
    return fn();
  } finally {
    setKnob('heroAffinityBonus', keep);
  }
};
const stackRows = LEGEND_ELEMENTS.map((legend) => {
  const hero = allHeroes().find((h) => h.kit.element === legend) ?? allHeroes()[0];
  const base: Strategy = { ...legendStrat(legend, hero.id, 1), id: `stack:${legend}:base`, gearMult: gearNone };
  const max: Strategy = {
    ...legendStrat(legend, hero.id, 20),
    id: `stack:${legend}:max`,
    gearMult: gearAll,
    petBase: GOD_BATTLE,
    rebirthBonus: PET_REBIRTH_CAP,
  };
  const need = (st: Strategy, affinity: boolean) =>
    withAffinity(affinity, () => WAVES.map((w) => damageNeeded(w.phase, w.wave, st, 1)));
  const baseNeeds = need(base, false);
  const ratio = (needs: (number | null)[]) => {
    const r: number[] = [];
    needs.forEach((n, i) => {
      const b = baseNeeds[i];
      if (n != null && b != null) r.push(b / n);
    });
    return r.length ? r.reduce((x, y) => x + y, 0) / r.length : 1;
  };
  const singles = {
    legendLv20: ratio(need({ ...base, legendLevel: 20 }, false)),
    affinity: ratio(need(base, true)),
    matchedGear: ratio(need({ ...base, gearMult: gearAll }, false)),
    godPet: ratio(need({ ...base, petBase: GOD_BATTLE }, false)),
    rebirth: ratio(need({ ...base, rebirthBonus: PET_REBIRTH_CAP }, false)),
  };
  const stacked = ratio(need(max, true));
  const product = Object.values(singles).reduce((a, b) => a * b, 1);
  return { legend, hero: hero.name, singles, stacked, product };
});

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
lines.push('**Player model:** default ATO board only; fresh board each wave with ' + getTune().startScrap + ' scrap (the Campaign section keeps boards instead); building happens in setup only — pads lock during a wave; towers on the pads covering the most path; setup scrap spent in full (build to ' + MAX_TOWERS + ', then upgrade); Avatar parked at the best path spot, never casts its skill; no gear, no type match, no Avatar stars. Hero towers all share one stat block today, so one hero stands in for all 16 until effects step 4.');
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

const heroAvgs = heroRows.filter((r) => Number.isFinite(r.avg)).map((r) => r.avg);
const spread = heroAvgs.length ? Math.max(...heroAvgs) / Math.min(...heroAvgs) : 1;
findings.push(
  `- **Heroes (cycle 0, Mixed + 2 of the hero):** strongest ${heroRows[0].hero.name} ` +
    `(${kitLabel(heroRows[0].hero.kit)}, ${heroRows[0].avg.toFixed(2)}×), weakest ${heroRows[heroRows.length - 1].hero.name} ` +
    `(${kitLabel(heroRows[heroRows.length - 1].hero.kit)}, ${heroRows[heroRows.length - 1].avg.toFixed(2)}×) — ` +
    `a ${spread.toFixed(2)}× spread${spread > 1.5 ? ' (worth tuning: over 1.5×)' : ''}.`,
);

lines.push('## Heroes (cycle 0, Mixed towers + 2 of the hero)');
lines.push('');
lines.push('Lower damage needed = stronger. Ranked strongest first.');
lines.push('');
lines.push('| Hero | Kit | Avg damage needed | Waves lost at ×1 | Hardest wave |');
lines.push('|---|---|---|---|---|');
for (const r of heroRows) {
  lines.push(
    `| ${r.hero.name} | ${kitLabel(r.hero.kit)} | ${Number.isFinite(r.avg) ? `${r.avg.toFixed(2)}×` : '—'}` +
      `${r.unclearable ? ` (+${r.unclearable} unclearable)` : ''} | ${r.lost} | ${waveName(r.hardest.w)} (${fmtNeed(r.hardest.need)}) |`,
  );
}
lines.push('');

lines.push('## Legends (cycle 0, Mixed + 2 Archangel)');
lines.push('');
lines.push('Damage needed on each elemental stage with each Legend at Lv1. Lower = better; the best Legend for a stage is the one its element is weak to.');
lines.push('');
lines.push(`| Stage | Element | ${LEGEND_ELEMENTS.map((e) => e).join(' | ')} |`);
lines.push(`|---|---|${LEGEND_ELEMENTS.map(() => '---').join('|')}|`);
for (const row of stageRows) {
  const el = waveDefFor(row.w.phase, row.w.wave)?.element ?? '—';
  lines.push(`| ${waveName(row.w)} | ${el} | ${row.needs.map(fmtNeed).join(' | ')} |`);
}
lines.push('');
lines.push('### Hero affinity (neutral stages, so the stage matchup cannot confound it)');
lines.push('');
lines.push(`Same hero, same (matching) Legend — affinity bonus on (+${Math.round(affinityBonus * 100)}%) vs off.`);
lines.push('');
lines.push('| Hero | Affinity | Need, bonus on | Need, bonus off | Gain |');
lines.push('|---|---|---|---|---|');
for (const r of affinityRows) {
  lines.push(`| ${r.hero.name} | ${r.own} | ${r.matchedNeed.toFixed(2)}× | ${r.otherNeed.toFixed(2)}× | ${(r.gain * 100).toFixed(0)}% |`);
}
lines.push('');
lines.push(`### Gear match (+${Math.round(gearBonus * 100)}% on a matching Power's own stats)`);
lines.push('');
lines.push(`Four average Powers (avg wave power ${(avgWavePower * 100).toFixed(1)}% each). Board damage multiplier: none matching ×${gearNone.toFixed(3)}, one matching ×${gearOne.toFixed(3)} (+${((gearOne / gearNone - 1) * 100).toFixed(1)}%), all four ×${gearAll.toFixed(3)} (+${((gearAll / gearNone - 1) * 100).toFixed(1)}%).`);
lines.push('');

const legendBest = stageRows.map((row) => {
  const best = row.needs.reduce<{ i: number; v: number }>(
    (acc, v, i) => (v != null && v < acc.v ? { i, v } : acc),
    { i: -1, v: Infinity },
  );
  const worst = row.needs.reduce<number>((acc, v) => (v != null && v > acc ? v : acc), 0);
  return { w: row.w, best: LEGEND_ELEMENTS[best.i], spread: worst / best.v };
});
const avgSpread = legendBest.reduce((a, b) => a + b.spread, 0) / legendBest.length;
findings.push(
  `- **Legend choice matters on elemental stages:** best vs worst Legend differs by ${avgSpread.toFixed(2)}× damage needed on average (Main 4-10). Best picks: ${legendBest
    .map((b) => `${waveName(b.w)} ${b.best}`)
    .join(', ')}.`,
);
const gains = affinityRows.map((r) => r.gain);
const avgGain = gains.reduce((a, b) => a + b, 0) / gains.length;
findings.push(
  `- **Hero affinity (+${Math.round(affinityBonus * 100)}% damage, measured bonus on vs off) is worth ${(avgGain * 100).toFixed(0)}% less damage needed on average** (range ${(Math.min(...gains) * 100).toFixed(0)}% to ${(Math.max(...gains) * 100).toFixed(0)}%) — ` +
    (avgGain > 0.03 && avgGain < 0.2 ? 'noticeable but not mandatory, as intended.' : 'outside the 3-20% target band; retune.'),
);
findings.push(
  `- **Gear match (+${Math.round(gearBonus * 100)}% on a matching Power):** one matching piece lifts board damage ${((gearOne / gearNone - 1) * 100).toFixed(1)}%, a fully matched loadout ${((gearAll / gearNone - 1) * 100).toFixed(1)}% (the old +20% type match gave +20% for ONE matching piece) — ` +
    ((gearAll / gearNone - 1) < 0.2 ? 'a deliberate step down from the old flat bonus; gear matching is a nudge, Legend choice is the lever.' : 'comparable to the old bonus.'),
);
if (resistLv1 != null && resistLv20 != null && neutralLv1 != null) {
  findings.push(
    `- **Resisted stage (${waveName(resistWave)}, ${resistEl}):** a Lv1 ${resistEl} Legend needs ${resistLv1.toFixed(2)}×, a Lv20 one ${resistLv20.toFixed(2)}× (neutral Void: ${neutralLv1.toFixed(2)}×) — levelling recovers part of the penalty but never erases it.`,
  );
}

lines.push('## Campaign with kept boards (cycle 0)');
lines.push('');
lines.push('Damage needed per wave on a fresh board vs. with the board kept from the previous wave (+ banked kill scrap). Towers/level = the board the ×1 run built by that wave.');
lines.push('');
for (const c of campaign) {
  lines.push(`### ${c.label}`);
  lines.push('');
  lines.push('| Wave | Fresh board | Kept board | Towers · avg level |');
  lines.push('|---|---|---|---|');
  for (const r of c.rows) {
    lines.push(`| ${waveName(r.w)} | ${fmtNeed(r.fresh)} | ${fmtNeed(r.kept)} | ${r.towers} · ${r.avgLevel.toFixed(1)} |`);
  }
  lines.push('');
  const pairs = c.rows.filter((r) => r.fresh != null && r.kept != null);
  const easier = pairs.length
    ? pairs.reduce((a, r) => a + (r.fresh as number) / (r.kept as number), 0) / pairs.length
    : 1;
  findings.push(
    `- **Kept boards, ${c.label}:** waves need on average ${easier.toFixed(2)}× less damage than on a fresh board; ` +
      `by Main 10 the board is ${c.rows[c.rows.length - 1].towers} towers at avg level ${c.rows[c.rows.length - 1].avgLevel.toFixed(1)}.`,
  );
}

lines.push('## Pet (v20)');
lines.push('');
lines.push('Once-per-wave pounce on the "Mixed + 2 hero towers" board, every wave, cycle 0. Gain = average per-wave drop in damage needed.');
lines.push('');
lines.push('| Pet | Pounce base | Less damage needed |');
lines.push('|---|---|---|');
for (const r of petRows) lines.push(`| ${r.label} | ${r.base} | ${(r.gain * 100).toFixed(1)}% |`);
lines.push('');
lines.push('## All permanent boosts stacked at max');
lines.push('');
lines.push('Board strength vs a fresh player (Legend Lv1, affinity off, same 4 Powers unmatched, no pet, no rebirth), averaged over all 15 waves. ×1.50 = clears waves needing 50% more damage.');
lines.push('');
lines.push('| Legend (hero) | Lv20 | Affinity | Matched gear | God pet (battle) | Rebirth +10% | Product of singles | **All stacked** |');
lines.push('|---|---|---|---|---|---|---|---|');
for (const r of stackRows) {
  const s = r.singles;
  lines.push(
    `| ${r.legend} (${r.hero}) | ×${s.legendLv20.toFixed(2)} | ×${s.affinity.toFixed(2)} | ×${s.matchedGear.toFixed(2)} | ×${s.godPet.toFixed(2)} | ×${s.rebirth.toFixed(2)} | ×${r.product.toFixed(2)} | **×${r.stacked.toFixed(2)}** |`,
  );
}
lines.push('');
const petGod = petRows.find((r) => r.label === 'god') as (typeof petRows)[number];
const petChild = petRows.find((r) => r.label === 'child') as (typeof petRows)[number];
findings.push(
  `- **Pet pounce (once per wave):** Child ${(petChild.gain * 100).toFixed(1)}% → God ${(petGod.gain * 100).toFixed(1)}% less damage needed (Battle God ${(petRows[petRows.length - 1].gain * 100).toFixed(1)}%) — ` +
    (petChild.gain >= 0.025 && petRows.every((r) => r.gain <= 0.08)
      ? 'inside the 3-8% target at every stage and form: helps, never mandatory.'
      : 'outside the 3-8% target; retune PET_POUNCE_BASE / PET_BRANCH_POUNCE.'),
);
const stackAvg = stackRows.reduce((a, r) => a + r.stacked, 0) / stackRows.length;
const stackMin = Math.min(...stackRows.map((r) => r.stacked));
const stackMax = Math.max(...stackRows.map((r) => r.stacked));
const productAvg = stackRows.reduce((a, r) => a + r.product, 0) / stackRows.length;
findings.push(
  `- **All permanent boosts stacked at max (Legend Lv20 + affinity + fully matched gear + Battle God pet + rebirth +10%):** ×${stackAvg.toFixed(2)} board strength on average (range ×${stackMin.toFixed(2)}-×${stackMax.toFixed(2)} across the 5 Legends) — ` +
    `the product of each alone would be ×${productAvg.toFixed(2)}, so the boosts ${stackAvg < productAvg * 0.97 ? 'overlap (stacking is weaker than multiplying)' : stackAvg > productAvg * 1.03 ? 'compound (stacking is stronger than multiplying)' : 'stack about multiplicatively'}.`,
);

lines.splice(6, 0, '## Findings', '', ...findings, '');

const out = path.join('games', 'grove', 'BALANCE_REPORT.md');
fs.writeFileSync(out, `${lines.join('\n')}\n`);
console.log(findings.join('\n'));
console.log(`\nWrote ${out} (${secs}s).`);
