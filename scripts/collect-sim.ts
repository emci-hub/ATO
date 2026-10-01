/**
 * Collection sim (v27, Part D · T-D1) — rolls eggs with the REAL rules
 * (`rollPet` with the pity position, `pityAfterReveal`, `nextEggPrice`, the
 * trade-up tickets, `stoneSucceeds` with glimmers) for four players, and
 * prints the days to a first Legendary and a first shiny, before and after
 * Part D's soft pity + daily-challenge egg.
 *
 * Player model (stated, plan §4):
 *   Pro      Perfect care · 2 free + daily egg + 3 bought (6 a day, the most)
 *   Regular  Great care   · 2 free + daily egg + 1 bought (4 a day)
 *   Casual   Good care    · 2 free (2 a day)
 *   Poor     Poor care    · 2 free (2 a day), no Stones (the pity floor)
 * Everyone releases every Common and Rare for its shard and trades 5 shards
 * up for a ticket at once; a ticket egg is extra (never a free/bought egg).
 * "Before" = today's odds with the hard pity at 40 only and no daily egg.
 *
 * Shine Stones, two ways:
 *   plan rate  — one every 2 / 3 / 4 days (Pro / Regular / Casual), plan §4;
 *   sources    — the real sources at stated play: daily-challenge Gold (the
 *                real medal bars + the games-sim player model), the 4h trip
 *                (the real `rollExpeditionReward`), Abyss / Hadal finds (the
 *                real dive-loot weights), every 5th day, the milestones.
 *
 * It also checks the Guide's plain-word timelines (`COLLECT_TIMELINES` in
 * pet-eggs.ts) still match, and exits 1 when they drift.
 *
 * Run: npm run sim:collect
 */
import { findKind, rollTier } from '../src/play/dive-loot';
import { EXPEDITION_STONE_STEP, rollExpeditionReward } from '../src/play/expedition-ladder';
import { DAILY_LEVEL, medalFor } from '../src/play/game-records';
import {
  COLLECT_TIMELINES,
  DAILY_EGG_BONUS,
  EGG_POOLS,
  EGG_TYPES,
  FREE_EGGS_PER_DAY,
  GLIMMER_PITY,
  GRADES,
  PITY_HARD,
  PITY_SOFT_FROM,
  PRISM_STYLES,
  PRISM_STYLE_COST,
  SHARDS_PER_TICKET,
  SHINY_ODDS,
  STONE_EVERY_DAYS,
  STONE_ODDS,
  gradeOdds,
  nextEggPrice,
  nextGrade,
  pityAfterReveal,
  rollPet,
  seededRng,
  stoneSucceeds,
  type CareBand,
  type EggType,
  type Grade,
} from '../src/play/pet-eggs';
import { TIDE_PASS_DAYS, TIDE_PITY_STEP, TIDE_PRISM_GIFT } from '../src/play/tide';
import {
  CATCH,
  EMPTY_CATCH,
  catchFood,
  catchOutcome,
  catchScore,
  catchSpawnGapMs,
  catchSpawnKind,
  missFood,
  seededRng as gameRng,
  startTrain,
  tapBomb,
  trainOutcome,
  trainScore,
  trainTap,
} from '../src/play/pet-game-rules';

type Player = {
  name: 'Pro' | 'Regular' | 'Casual' | 'Poor';
  band: CareBand;
  bought: number;
  dailyEgg: boolean;
  /** Plan §4 Stone rate: one every N days (null = none). */
  stoneEvery: number | null;
  /** Sources: games-sim skill, daily rounds per game, 4h trips a day (0–1),
   * Abyss / Hadal finds a day. */
  skill: number;
  dailyRounds: number;
  trip4h: number;
  abyss: number;
  hadal: number;
};

const PLAYERS: Player[] = [
  { name: 'Pro', band: 'perfect', bought: 3, dailyEgg: true, stoneEvery: 2, skill: 0.88, dailyRounds: 2, trip4h: 1, abyss: 4, hadal: 2 },
  { name: 'Regular', band: 'great', bought: 1, dailyEgg: true, stoneEvery: 3, skill: 0.75, dailyRounds: 1, trip4h: 0.5, abyss: 2, hadal: 0.5 },
  { name: 'Casual', band: 'good', bought: 0, dailyEgg: false, stoneEvery: 4, skill: 0.6, dailyRounds: 1, trip4h: 0, abyss: 0.5, hadal: 0 },
  { name: 'Poor', band: 'poor', bought: 0, dailyEgg: false, stoneEvery: null, skill: 0.6, dailyRounds: 0, trip4h: 0, abyss: 0, hadal: 0 },
];

const N = 4000;
const MAX_DAYS = 90;

/* ------------------------------------------------- Stone sources (real) --- */

const LEVEL_SHIFT = 0; // the daily challenge plays Normal
function catchRound(skill: number, rng: () => number) {
  let t = EMPTY_CATCH;
  let elapsed = 0;
  while (elapsed < CATCH.roundMs - 800 && !t.over) {
    const kind = catchSpawnKind(elapsed, rng(), DAILY_LEVEL);
    if (kind === 'bomb') {
      if (rng() < 0.12 * (1 - skill) + 0.01) t = tapBomb(t);
    } else {
      const p = Math.max(0.05, Math.min(0.99, skill + LEVEL_SHIFT - 0.12 * (elapsed / CATCH.roundMs)));
      t = rng() < p ? catchFood(t, elapsed, kind === 'golden') : missFood(t);
    }
    elapsed += catchSpawnGapMs(elapsed, DAILY_LEVEL);
  }
  return medalFor('catch', DAILY_LEVEL, catchScore(t, DAILY_LEVEL), catchOutcome(t).pass);
}
function trainRound(skill: number, rng: () => number) {
  let t = startTrain(DAILY_LEVEL);
  while (!t.over) {
    const p = Math.min(0.98, skill * (t.zone / 0.3) * Math.sqrt(0.9 / t.speed));
    const hit = rng() < p;
    t = trainTap(t, hit, DAILY_LEVEL, hit && rng() < 0.35 * skill);
  }
  return medalFor('train', DAILY_LEVEL, trainScore(t, DAILY_LEVEL), trainOutcome(t).pass);
}

/** Chance of at least one daily Gold in a day (either game). */
function dailyGoldChance(skill: number, rounds: number): number {
  if (rounds <= 0) return 0;
  const rng = gameRng(`collect:gold:${skill}`);
  let days = 0;
  const T = 3000;
  for (let i = 0; i < T; i += 1) {
    let gold = false;
    for (let r = 0; r < rounds && !gold; r += 1) gold = catchRound(skill, rng) === 'gold' || trainRound(skill, rng) === 'gold';
    if (gold) days += 1;
  }
  return days / T;
}

function shareOf(draw: () => string, T = 200000): number {
  let n = 0;
  for (let i = 0; i < T; i += 1) if (findKind(draw()) === 'stone') n += 1;
  return n / T;
}
const rng0 = seededRng(0x5eed);
const TRIP_STONE = shareOf(() => rollExpeditionReward(EXPEDITION_STONE_STEP, rng0));
const ABYSS_STONE = shareOf(() => rollTier('abyss', rng0));
const HADAL_STONE = shareOf(() => rollTier('hadal', rng0));

function stonesPerDay(p: Player, gold: number): number {
  return gold + p.trip4h * TRIP_STONE + p.abyss * ABYSS_STONE + p.hadal * HADAL_STONE + 1 / STONE_EVERY_DAYS;
}

/* --------------------------------------------------------------- the run --- */

type Run = { legendary: number[]; shiny: number[]; stonesUsed: number[] };

function run(p: Player, after: boolean, stoneMode: 'plan' | 'sources', gold: number): Run {
  const rng = seededRng(`${p.name}:${after}:${stoneMode}`.split('').reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261));
  const out: Run = { legendary: [], shiny: [], stonesUsed: [] };
  for (let t = 0; t < N; t += 1) {
    let since = 0;
    const shards: Record<Grade, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
    const tickets: Grade[] = [];
    let firstLeg = Infinity;
    let firstShiny = Infinity;
    let stones = 0;
    let glimmers = 0;
    let used = 0;
    let hatched = 0;
    let legMilestone = false;
    let eggsMilestone = false;
    const seq = (rng() * 2 ** 32) >>> 0;
    for (let day = 1; day <= MAX_DAYS && (firstLeg === Infinity || firstShiny === Infinity); day += 1) {
      const dailyEgg = after && p.dailyEgg;
      const free = FREE_EGGS_PER_DAY + (dailyEgg ? DAILY_EGG_BONUS : 0);
      let eggs = 0;
      while (true) {
        const price = nextEggPrice(eggs, dailyEgg);
        if (price == null || (price > 0 && eggs >= free + p.bought)) break;
        eggs += 1;
      }
      const hatchOne = (minGrade: Grade | null) => {
        const egg = EGG_TYPES[Math.floor(rng() * EGG_TYPES.length)];
        // Before Part D the roll had no soft pity: only the 40th egg moved.
        const pos = after || since >= PITY_HARD - 1 ? since : 0;
        const roll = rollPet((rng() * 2 ** 32) >>> 0, egg, p.band, minGrade, pos);
        hatched += 1;
        since = pityAfterReveal(since, roll.grade);
        if (roll.grade === 'legendary') firstLeg = Math.min(firstLeg, day);
        if (roll.shiny) firstShiny = Math.min(firstShiny, day);
        if (roll.grade === 'common' || roll.grade === 'rare') {
          shards[roll.grade] += 1;
          if (shards[roll.grade] >= SHARDS_PER_TICKET) {
            shards[roll.grade] -= SHARDS_PER_TICKET;
            tickets.push(nextGrade(roll.grade) as Grade);
          }
        }
      };
      for (let e = 0; e < eggs; e += 1) hatchOne(null);
      while (tickets.length > 0) hatchOne(tickets.shift() as Grade);
      // Stones arrive, then are used on a non-shiny pet at once.
      if (p.stoneEvery != null) {
        if (stoneMode === 'plan') {
          if (day % p.stoneEvery === 0) stones += 1;
        } else {
          if (rng() < gold) stones += 1;
          if (rng() < p.trip4h * TRIP_STONE) stones += 1;
          for (let k = 0; k < Math.floor(p.abyss) + (rng() < p.abyss % 1 ? 1 : 0); k += 1) if (rng() < ABYSS_STONE) stones += 1;
          for (let k = 0; k < Math.floor(p.hadal) + (rng() < p.hadal % 1 ? 1 : 0); k += 1) if (rng() < HADAL_STONE) stones += 1;
          if (day % STONE_EVERY_DAYS === 0) stones += 1;
          if (!legMilestone && firstLeg <= day) {
            legMilestone = true;
            stones += 1;
          }
          if (!eggsMilestone && hatched >= 10) {
            eggsMilestone = true;
            stones += 1;
          }
        }
      }
      while (stones > 0 && firstShiny === Infinity) {
        stones -= 1;
        const hit = stoneSucceeds(seq, used, glimmers);
        used += 1;
        glimmers = hit ? 0 : glimmers + 1;
        if (hit) firstShiny = day;
      }
    }
    out.legendary.push(firstLeg);
    out.shiny.push(firstShiny);
    out.stonesUsed.push(used);
  }
  return out;
}

const q = (a: number[], f: number) => [...a].sort((x, y) => x - y)[Math.floor(f * (a.length - 1))];
const d = (n: number) => (Number.isFinite(n) ? `${n}d` : `>${MAX_DAYS}d`);

console.log('# Collection sim (v27, Part D)\n');
console.log(`pity: hard ${PITY_HARD} · soft from ${PITY_SOFT_FROM} · Stone ${STONE_ODDS * 100}% · glimmer pity ${GLIMMER_PITY}`);
console.log(`Stone sources: 4h trip ${(TRIP_STONE * 100).toFixed(1)}% · Abyss find ${(ABYSS_STONE * 100).toFixed(1)}% · Hadal find ${(HADAL_STONE * 100).toFixed(1)}% · every ${STONE_EVERY_DAYS}th day\n`);

const rows: string[] = [];
const results: Record<string, { leg90: number; legMax: number; shiny50: number; shiny90: number }> = {};
for (const p of PLAYERS) {
  const gold = dailyGoldChance(p.skill, p.dailyRounds);
  const before = run(p, false, 'plan', gold);
  const after = run(p, true, 'plan', gold);
  const src = run(p, true, 'sources', gold);
  const eggsDay = FREE_EGGS_PER_DAY + (p.dailyEgg ? DAILY_EGG_BONUS : 0) + p.bought;
  let cost = 0;
  for (let e = 0; e < eggsDay; e += 1) cost += nextEggPrice(e, p.dailyEgg) ?? 0;
  results[p.name] = {
    leg90: q(after.legendary, 0.9),
    legMax: Math.max(...after.legendary),
    shiny50: q(after.shiny, 0.5),
    shiny90: q(after.shiny, 0.9),
  };
  rows.push(
    `| ${p.name} | ${eggsDay} (${cost} shells) | ${d(q(before.legendary, 0.9))} (${d(Math.max(...before.legendary))}) | ${d(q(after.legendary, 0.9))} (${d(Math.max(...after.legendary))}) | ` +
      `${p.stoneEvery == null ? '—' : `${d(q(before.shiny, 0.5))} / ${d(q(before.shiny, 0.9))}`} | ` +
      `${p.stoneEvery == null ? `${d(q(after.shiny, 0.5))} / ${d(q(after.shiny, 0.9))} (no Stones)` : `${d(q(after.shiny, 0.5))} / ${d(q(after.shiny, 0.9))}`} | ` +
      `${p.stoneEvery == null ? '—' : `${stonesPerDay(p, gold).toFixed(2)}/day (gold ${Math.round(gold * 100)}%) → shiny ${d(q(src.shiny, 0.5))} / ${d(q(src.shiny, 0.9))}`} |`,
  );
}
console.log('| Player | Eggs a day | Legendary 90% (worst) before | after | Shiny median / 90% before | after (plan Stone rate) | Stones from sources |');
console.log('|---|---|---|---|---|---|---|');
for (const r of rows) console.log(r);

// The Guide's plain words (COLLECT_TIMELINES) must name the measured day, and
// the plan's targets are two-sided: faster than the band fails as well as slower.
let ok = true;
const check = (label: string, cond: boolean) => {
  console.log(`${cond ? '✓' : '✗'} ${label}`);
  if (!cond) ok = false;
};
const inBand = (n: number, lo: number, hi: number) => n >= lo && n <= hi;
console.log('');
check(
  `Guide: playing every day, 90% of Regular players find a Legendary in ${COLLECT_TIMELINES.legendaryRegularDays} days`,
  results.Regular.leg90 === COLLECT_TIMELINES.legendaryRegularDays,
);
check(
  `Guide: with the free eggs only, a Legendary is certain within ${COLLECT_TIMELINES.legendaryCertainDays} days`,
  results.Casual.legMax <= COLLECT_TIMELINES.legendaryCertainDays && results.Poor.legMax <= COLLECT_TIMELINES.legendaryCertainDays,
);
check(
  `Guide: with a Stone every few days, most players get a shiny in ${COLLECT_TIMELINES.shinyRegularDays} days`,
  results.Regular.shiny50 === COLLECT_TIMELINES.shinyRegularDays,
);
check('target: Pro Legendary 90% in 4–6d (~5d)', inBand(results.Pro.leg90, 4, 6));
check('target: Regular Legendary 90% in 5–7d (~6d)', inBand(results.Regular.leg90, 5, 7));
check('target: Regular worst Legendary ≤ ~10d', results.Regular.legMax <= 10);
check('target: Casual Legendary 90% ≤ 20d', results.Casual.leg90 <= 20);
check(
  'target: nobody’s worst Legendary is over 20d',
  PLAYERS.every((p) => results[p.name].legMax <= 20),
);
check('target: shiny 90% Casual ≤ ~24d', results.Casual.shiny90 <= 25);

/* ------------------------------------------------- Tide Pass (v28) --- */
/** Rejected comparison: the same pity, with the Legendary share doubled. */

function rollOddsDoubled(seed: number, egg: EggType, band: CareBand, minGrade: Grade | null, since: number): Grade {
  const rng = seededRng(seed);
  const pool = EGG_POOLS[egg];
  void pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
  const odds = gradeOdds(band, minGrade, since, 1);
  const legend = Math.min(100, odds.legendary * 2);
  const rest = 100 - odds.legendary;
  const k = rest > 0 ? (100 - legend) / rest : 0;
  let u = rng() * 100;
  let grade: Grade = GRADES[GRADES.length - 1];
  for (const g of GRADES) {
    const share = g === 'legendary' ? legend : odds[g] * k;
    if (share <= 0) continue;
    if (u < share) {
      grade = g;
      break;
    }
    u -= share;
  }
  void (rng() < SHINY_ODDS);
  return grade;
}

type PassMode = 'free' | 'one' | 'always' | 'odds';

function passStep(mode: PassMode, day: number): number {
  if (mode === 'always') return TIDE_PITY_STEP;
  if (mode === 'one' && day <= TIDE_PASS_DAYS) return TIDE_PITY_STEP;
  return 1;
}

/** Days to the first Legendary, and Legendaries over 30 days, with a pass mode. */
function passRun(p: Player, mode: PassMode): { days: number[]; per30: number[] } {
  const seed = `tide:${p.name}:${mode}`.split('').reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
  const rng = seededRng(seed);
  const days: number[] = [];
  const per30: number[] = [];
  for (let t = 0; t < N; t += 1) {
    let since = 0;
    const shards: Record<Grade, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
    const tickets: Grade[] = [];
    let first = Infinity;
    let legends = 0;
    for (let day = 1; day <= 30; day += 1) {
      const dailyEgg = p.dailyEgg;
      const free = FREE_EGGS_PER_DAY + (dailyEgg ? DAILY_EGG_BONUS : 0);
      let eggs = 0;
      while (true) {
        const price = nextEggPrice(eggs, dailyEgg);
        if (price == null || (price > 0 && eggs >= free + p.bought)) break;
        eggs += 1;
      }
      const step = passStep(mode, day);
      const hatchOne = (minGrade: Grade | null) => {
        const egg = EGG_TYPES[Math.floor(rng() * EGG_TYPES.length)];
        const seed = (rng() * 2 ** 32) >>> 0;
        const grade = mode === 'odds' ? rollOddsDoubled(seed, egg, p.band, minGrade, since) : rollPet(seed, egg, p.band, minGrade, since, step).grade;
        since = pityAfterReveal(since, grade, step);
        if (grade === 'legendary') {
          legends += 1;
          first = Math.min(first, day);
        }
        if (grade === 'common' || grade === 'rare') {
          shards[grade] += 1;
          if (shards[grade] >= SHARDS_PER_TICKET) {
            shards[grade] -= SHARDS_PER_TICKET;
            tickets.push(nextGrade(grade) as Grade);
          }
        }
      };
      for (let e = 0; e < eggs; e += 1) hatchOne(null);
      while (tickets.length > 0) hatchOne(tickets.shift() as Grade);
    }
    days.push(first);
    per30.push(legends);
  }
  return { days, per30 };
}

const mean = (a: number[]) => a.reduce((s, n) => s + n, 0) / a.length;
const passRows: string[] = [];
const one: Record<string, { leg90: number; legMax: number }> = {};
const always: Record<string, { legMax: number; per30: number }> = {};
const odds: Record<string, { leg90: number; legMax: number; per30: number }> = {};
const free30: Record<string, number> = {};
console.log('\n# Tide Pass (v28) — ×2 progress vs the rejected ×2 odds\n');
for (const p of PLAYERS) {
  const freePace = passRun(p, 'free');
  const onePass = passRun(p, 'one');
  const alwaysPass = passRun(p, 'always');
  const oddsPass = passRun(p, 'odds');
  free30[p.name] = mean(freePace.per30);
  one[p.name] = { leg90: q(onePass.days, 0.9), legMax: Math.max(...onePass.days) };
  always[p.name] = { legMax: Math.max(...alwaysPass.days), per30: mean(alwaysPass.per30) };
  odds[p.name] = { leg90: q(oddsPass.days, 0.9), legMax: Math.max(...oddsPass.days), per30: mean(oddsPass.per30) };
}

for (const p of PLAYERS) {
  const eggsDay = FREE_EGGS_PER_DAY + (p.dailyEgg ? DAILY_EGG_BONUS : 0) + p.bought;
  const pct = (n: number) => `${n >= 0 ? '+' : ''}${Math.round((n / free30[p.name]) * 100)}%`;
  passRows.push(
    `| ${p.name} | ${d(results[p.name].leg90)} (${d(results[p.name].legMax)}) | ${d(one[p.name].leg90)} (${d(one[p.name].legMax)}) | ${d(odds[p.name].leg90)} (${d(odds[p.name].legMax)}) | ` +
      `${free30[p.name].toFixed(1)} → ${always[p.name].per30.toFixed(1)} (${pct(always[p.name].per30 - free30[p.name])}) → ${odds[p.name].per30.toFixed(1)} (${pct(odds[p.name].per30 - free30[p.name])}) | ${eggsDay} |`,
  );
}
console.log('| Player | Free 90% (worst) | One pass ×2 progress | One pass ×2 odds (rejected) | Legendaries/30d free → always-on ×2 progress → always-on ×2 odds | Eggs/day |');
console.log('|---|---|---|---|---|---|');
for (const r of passRows) console.log(r);
console.log('');

const cheapestPrism = Math.min(...PRISM_STYLES.map((s) => PRISM_STYLE_COST[s]));
check('pass gift: a Prism shiny is possible on day 1', TIDE_PRISM_GIFT >= cheapestPrism);
// The planning sim's "≤ 60% of free" assumed a longer free tail (Regular ~7d → ~4d).
// On the accepted free pace (Regular 90% = 6d, already inside the 5 pass days),
// one pass shortens that 90% by a day. Lock the measured day in the Guide, and
// fail if a pass stops being strictly faster than free.
check(
  `one pass: Regular 90% ${one.Regular.leg90}d is at least a day under free ${results.Regular.leg90}d`,
  one.Regular.leg90 <= results.Regular.leg90 - 1,
);
for (const p of PLAYERS) {
  const shorter = Math.floor(results[p.name].legMax * 0.8);
  check(
    `one pass: ${p.name} worst ${one[p.name].legMax}d ≤ ${shorter}d (20% shorter than free ${results[p.name].legMax}d)`,
    one[p.name].legMax <= shorter,
  );
  const eggsDay = FREE_EGGS_PER_DAY + (p.dailyEgg ? DAILY_EGG_BONUS : 0) + p.bought;
  const cap = Math.ceil(Math.ceil(PITY_HARD / TIDE_PITY_STEP) / eggsDay) + 1;
  check(`always-on: ${p.name} worst ${always[p.name].legMax}d ≤ ${cap}d`, always[p.name].legMax <= cap);
}
for (const name of ['Pro', 'Regular'] as const) {
  const bump = (always[name].per30 - free30[name]) / free30[name];
  check(`always-on: ${name} Legendaries/30d ${Math.round(bump * 100)}% ≤ +35%`, bump <= 0.35);
}
check(
  `Guide: one Tide Pass, Regular Legendary 90% is ${COLLECT_TIMELINES.legendaryTideDays}d (measured ${one.Regular.leg90}d)`,
  one.Regular.leg90 === COLLECT_TIMELINES.legendaryTideDays,
);

if (!ok) {
  console.log('\nFIX: a target or a Guide timeline drifted — retune, or update COLLECT_TIMELINES and the Guide words.');
  if (!inBand(results.Regular.leg90, 5, 7) || results.Regular.legMax > 10) {
    console.log(
      `Regular 90% is ${results.Regular.leg90}d (worst ${results.Regular.legMax}d), outside 5–7d / worst ≤ 10d. Emci accepted ~6d on 2026-09-30; do not widen this band to hide a drift.`,
    );
  }
  process.exit(1);
}
