/**
 * Dive expected-value sim (v22, Part B · T-B0 / T-B9) — exact maths, no dice.
 *
 * Reads the REAL odds and loot (`effectiveBustPct`, `pathBaseBust`,
 * `pathTier`, `dive-loot.json`, gear / shells constants) and prints:
 *   1. finds per charge by stop depth, path, pet stage and gear (Net/Oxygen),
 *      split into Powers / shells / food / cosmetics;
 *   2. the light-player days-to-Lamp targets (emci: ~3 days for a pet-only
 *      light player AND a TD-only light player);
 *   3. what the pet + Dive add inside one TD run (the 3-8% band): Dive gear
 *      never touches TD; the pounce numbers come from `npm run sim:balance`.
 *
 * Light players (stated assumptions):
 *   - pet-only: 4 charged dives + 5 free dives a day, stopping at depth 2 on
 *     the Safer path, plus the daily expedition; no TD;
 *   - TD-only: 5 campaign wave clears a day plus the daily expedition; no Dive.
 *
 * Run: npm run sim:dive
 */
import {
  DIVE_GEAR_COST,
  EXPEDITION_POWER_CHANCE,
  NET_MIN_DEPTH,
  SHELLS_PER_CLEAR,
  diveTierRolls,
  findKind,
  freeDiveShells,
  pathBaseBust,
  pathTier,
  shellsOf,
  tierAt,
  type DivePath,
  type DiveTier,
} from '../src/play/dive-loot';
import { getItemDef } from '../src/play/items';
import { DIVE_BUST_TABLE, effectiveBustPct } from '../src/play/playStore';
import { DIVE_OXYGEN_BUST, DIVECORE_POWERS_PER_DAY } from '../src/play/dive-loot';
import { PET_BUST_CUT_PP, PET_STAGES } from '../src/play/pet';
import { expectedPowersPerDay as expeditionPowersPerDay } from '../src/play/expedition-ladder';

type Vec = { finds: number; powers: number; shells: number; food: number; cosmetics: number };
const ZERO: Vec = { finds: 0, powers: 0, shells: 0, food: 0, cosmetics: 0 };
const add = (a: Vec, b: Vec): Vec => ({
  finds: a.finds + b.finds,
  powers: a.powers + b.powers,
  shells: a.shells + b.shells,
  food: a.food + b.food,
  cosmetics: a.cosmetics + b.cosmetics,
});
const scale = (a: Vec, k: number): Vec => ({
  finds: a.finds * k,
  powers: a.powers * k,
  shells: a.shells * k,
  food: a.food * k,
  cosmetics: a.cosmetics * k,
});

/** Expected contents of ONE find from a tier. */
function tierFind(tier: DiveTier): Vec {
  const rolls = diveTierRolls(tier);
  const total = rolls.reduce((a, r) => a + r.weight, 0);
  let v = { ...ZERO, finds: 1 };
  for (const r of rolls) {
    const p = r.weight / total;
    const kind = findKind(r.id);
    if (kind === 'item' && getItemDef(r.id)?.core.kind === 'power') v = { ...v, powers: v.powers + p };
    if (kind === 'shells') v = { ...v, shells: v.shells + p * shellsOf(r.id) };
    if (kind === 'food') v = { ...v, food: v.food + p };
    if (kind === 'cosmetic') v = { ...v, cosmetics: v.cosmetics + p };
  }
  return v;
}

function tableBust(i: number): number {
  return i < DIVE_BUST_TABLE.length ? DIVE_BUST_TABLE[i] : DIVE_OXYGEN_BUST;
}

type Setup = { cut: number; keep: number; net: boolean; oxygen: boolean };

/** One charged dive: stop after `k` Deepers, every Deeper on `path`. Busted
 * hauls keep `keep` finds (counted as finds only — a conservative read). */
function chargedDive(k: number, path: DivePath, s: Setup): { ev: Vec; survive: number } {
  let haul = tierFind('shallows');
  let surv = 1;
  let rescued = 0;
  for (let i = 0; i < k; i += 1) {
    const b = effectiveBustPct(pathBaseBust(tableBust(i), path), {}, null, s.cut) / 100;
    rescued += surv * b * Math.min(s.keep, i + 1);
    surv *= 1 - b;
    haul = add(haul, tierFind(pathTier(i + 1, path, s.oxygen)));
  }
  if (s.net && k >= NET_MIN_DEPTH) haul = add(haul, tierFind(tierAt(k)));
  return { ev: add(scale(haul, surv), { ...ZERO, finds: rescued }), survive: surv };
}

/** One free dive's shells (the `n`th of the day). */
function freeDive(k: number, path: DivePath, n: number, cut: number): number {
  let surv = 1;
  for (let i = 0; i < k; i += 1) {
    surv *= 1 - effectiveBustPct(pathBaseBust(tableBust(i), path), {}, null, cut) / 100;
  }
  return surv * freeDiveShells(k, n);
}

const f = (x: number) => x.toFixed(2);

console.log('# Dive sim (v22)\n');
console.log('## 1. Per charged dive — finds (Powers / shells / food / cosmetics)\n');
const PETS: [string, number, number][] = [
  ['no pet', 0, 0],
  ['Teen', 1, 0],
  ['Adult', 2, 1],
  ['God', 3, 2],
  ['God Deep', 4, 2],
];
for (const gear of [
  { label: 'no gear', net: false, oxygen: false },
  { label: 'Net', net: true, oxygen: false },
  { label: 'Net + Oxygen', net: true, oxygen: true },
]) {
  console.log(`### ${gear.label}`);
  for (const [label, cut, keep] of PETS) {
    for (const path of ['safe', 'rich'] as const) {
      const max = gear.oxygen ? 5 : 4;
      const cells: string[] = [];
      let best = { k: 0, finds: 0 };
      for (let k = 0; k <= max; k += 1) {
        const { ev } = chargedDive(k, path, { cut, keep, net: gear.net, oxygen: gear.oxygen });
        if (ev.finds > best.finds) best = { k, finds: ev.finds };
        cells.push(`@${k} ${f(ev.finds)} (P ${f(ev.powers)} · S ${f(ev.shells)} · F ${f(ev.food)} · C ${f(ev.cosmetics)})`);
      }
      console.log(`${label.padEnd(8)} ${path.padEnd(4)} | ${cells.join(' | ')} | best stop @${best.k}`);
    }
  }
  console.log('');
}

console.log('## 2. Light players — shells a day and days to the Lamp\n');
const expeditionShells = (1 - EXPEDITION_POWER_CHANCE) * tierFind('shallows').shells;
const expeditionPowers = EXPEDITION_POWER_CHANCE + (1 - EXPEDITION_POWER_CHANCE) * tierFind('shallows').powers;
const petSetup: Setup = { cut: 0, keep: 0, net: false, oxygen: false };
const charged = 4 * chargedDive(2, 'safe', petSetup).ev.shells;
let free = 0;
for (let n = 0; n < 5; n += 1) free += freeDive(2, 'safe', n, 0);
const petOnly = charged + free + expeditionShells;
const tdOnly = 5 * SHELLS_PER_CLEAR + expeditionShells;
console.log(`pet-only light: 4 charged @2 Safer = ${f(charged)} + 5 free @2 Safer = ${f(free)} + expedition ${f(expeditionShells)} = ${f(petOnly)} shells/day`);
console.log(`TD-only light : 5 clears × ${SHELLS_PER_CLEAR} + expedition ${f(expeditionShells)} = ${f(tdOnly)} shells/day`);
for (const gear of ['lamp', 'net', 'oxygen'] as const) {
  const cost = DIVE_GEAR_COST[gear];
  console.log(`${gear.padEnd(6)} ${String(cost).padStart(3)} shells → pet-only ${f(cost / petOnly)} days · TD-only ${f(cost / tdOnly)} days`);
}
console.log(`expedition: ${f(expeditionPowers)} Powers a day (was 0.20 with the old table)`);
let tail = 0;
for (let n = 0; n < 40; n += 1) tail += freeDive(2, 'safe', n, 0);
console.log(`free-dive fall-off: 40 free dives @2 Safer in one day = ${f(tail)} shells (the first 10 = ${f(free * 2)})`);
console.log('\n## 3. TD band (inside one run)\n');
console.log('Dive gear and shells never enter TD maths. Powers from Dive only fill the same 4 gear slots,');
console.log('under the same gear soft cap — they reach the cap sooner, never past it. The pet’s in-run');
console.log('TD power is the pounce alone: see `npm run sim:balance` (Child 3.0% → God 5.9%, Battle God 6.7%).');
console.log('Rebirth (+10% max) is long-term progress, outside the band (emci, Part B).');

console.log('\n## 4. Stage power (v26) — Powers a day by stage, and the daily ceiling\n');
console.log(`Bust cut by stage: ${PET_STAGES.map((st) => `${st} −${PET_BUST_CUT_PP[st]}`).join(' · ')}; ceiling ${DIVECORE_POWERS_PER_DAY}/day.`);
console.log('(best stop per stage, Safer or Richer; + the expedition ladder 0.55; before = the v25 cuts 0/0/0/1/2/3)');
const OLD_CUT: Record<string, number> = { egg: 0, baby: 0, child: 0, teen: 1, adult: 2, god: 3 };
for (const net of [false, true]) {
  console.log(net ? '### with Net' : '### no Net');
  for (const st of PET_STAGES.filter((x) => x !== 'egg')) {
    const bestFor = (cut: number) => {
      let b = { finds: 0, powers: 0 };
      for (const path of ['safe', 'rich'] as const)
        for (let k = 0; k <= 4; k += 1) {
          const { ev } = chargedDive(k, path, { cut, keep: 0, net, oxygen: false });
          if (ev.finds > b.finds) b = { finds: ev.finds, powers: ev.powers };
        }
      return b;
    };
    const before = bestFor(OLD_CUT[st]);
    const after = bestFor(PET_BUST_CUT_PP[st]);
    const day = (p: number, n: number) => n * p + expeditionPowersPerDay();
    const cells = [4, 15, 40].map(
      (n) => `${n} dives ${f(day(before.powers, n))} → ${f(day(after.powers, n))} (cap ${f(Math.min(DIVECORE_POWERS_PER_DAY, day(after.powers, n)))})`,
    );
    console.log(`${st.padEnd(6)} ${cells.join(' | ')}`);
  }
}
