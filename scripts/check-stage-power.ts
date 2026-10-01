/**
 * Stage power check (v26, Part C · T-C1).
 *
 *   - the stage bust cut (Baby 0 · Child 2 · Teen 4 · Adult 7 · God 10) and the
 *     half-table floor;
 *   - the lucky upgrade never creates or upgrades a Power, and is one step;
 *   - expedition trips: shorter by stage, one step better from Adult — with the
 *     SAME Power chance on every step (expedition Powers stay the same);
 *   - the daily Divecore Power ceiling: never more than it in a day, every Power
 *     past it becomes shells, and a new day starts fresh (clock-back safe);
 *   - the status / Dive Info line.
 *
 * Run: npm run check:stage-power
 */
import assert from 'node:assert/strict';

import {
  DIVECORE_POWERS_PER_DAY,
  POWER_OVERFLOW_SHELLS,
  diveTierRolls,
  isPowerFind,
  luckyUpgrade,
  rollTierLucky,
  DIVE_TIERS,
} from '../src/play/dive-loot';
import { EXPEDITION_LADDER_MS, EXPEDITION_POWER_BY_STEP, rollExpeditionReward } from '../src/play/expedition-ladder';
import { stagePowerLine } from '../src/play/guide-content';
import { rollPowerFind } from '../src/play/items';
import {
  PET_BUST_CUT_PP,
  PET_LUCKY_UPGRADE,
  PET_TRIP_MULT,
  newPet,
  petTripBetter,
  type PetState,
} from '../src/play/pet';
import { seededRng } from '../src/play/pet-game-rules';
import {
  DIVE_BUST_FLOOR,
  bankFinds,
  defaultPlayStore,
  effectiveBustPct,
  playView,
  sendPetExpedition,
  touchPet,
  type PlayStoreDoc,
} from '../src/play/playStore';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}
const T0 = Date.UTC(2026, 8, 30, 12, 0, 0);
const H = 60 * 60 * 1000;
const pet = (over: Partial<PetState>): PetState => ({ ...newPet(T0), ...over });
const doc = (over: Partial<PlayStoreDoc> = {}): PlayStoreDoc => ({ ...defaultPlayStore(T0), inventory: [], ...over });
const bag = (d: PlayStoreDoc) => d.inventory.reduce((a, st) => a + st.count, 0);

/* ------------------------------------------------- bust cut + floor --- */

assert.deepEqual(PET_BUST_CUT_PP, { egg: 0, baby: 0, child: 2, teen: 4, adult: 7, god: 10 });
assert.equal(DIVE_BUST_FLOOR, 0.5);
assert.equal(effectiveBustPct(0.55, {}, null, PET_BUST_CUT_PP.god), 45, 'God: 55 → 45');
assert.equal(effectiveBustPct(0.1, {}, null, PET_BUST_CUT_PP.god), 5, 'God on a 10% Safer #1: held at the 5% floor');
for (const base of [0.05, 0.1, 0.2, 0.32, 0.47, 0.63, 0.9]) {
  for (const cut of [0, 2, 4, 7, 10, 11, 13, 40]) {
    assert.ok(effectiveBustPct(base, {}, null, cut) >= Math.round(base * DIVE_BUST_FLOOR * 100), `floor holds at ${base} −${cut}`);
  }
}
{
  const v = playView(doc({ pet: pet({ stage: 'god' }), dive_run: { deepers: 0, haul: ['food_kelp'], free_n: null, next: null } }), T0);
  assert.deepEqual(v.diveRun.bustPct, { safe: 5, rich: 16 }, 'God: Safer 10 → 5 (floor), Richer 26 → 16');
}
ok('stage bust cut 0/0/2/4/7/10 (Deep +1 on top); never below half the table');

/* ---------------------------------------------------- lucky upgrade --- */

{
  const power = rollPowerFind(() => 0);
  for (const tier of DIVE_TIERS) {
    for (const r of diveTierRolls(tier)) {
      const up = luckyUpgrade(r.id, tier, () => 0.5);
      if (isPowerFind(r.id)) assert.equal(up, r.id, `${r.id}: a Power is never upgraded`);
      else assert.ok(!isPowerFind(up), `${r.id} → ${up}: never becomes a Power`);
    }
  }
  assert.equal(luckyUpgrade(power, 'abyss', () => 0), power);
  assert.equal(luckyUpgrade('shells_3', 'shallows', () => 0), 'shells_5');
  assert.equal(luckyUpgrade('shells_12', 'hadal', () => 0), 'shells_12', '12 stays 12');
  assert.equal(luckyUpgrade('food_kelp', 'reef', () => 0), 'food_shrimp');
  assert.ok(['item_glowveil_cloak_01', 'item_salt_helm_01', 'item_deep_pearl_01'].includes(luckyUpgrade('item_leaf_cape_01', 'shallows', () => 0)), 'a common Look → a rare Look');
  // Over many rolls, a God pet's finds hold Powers at exactly the table's own
  // share (the upgrade only ever touches non-Powers).
  for (const tier of DIVE_TIERS) {
    const rolls = diveTierRolls(tier);
    const want = rolls.filter((r) => isPowerFind(r.id)).reduce((a, r) => a + r.weight, 0) / rolls.reduce((a, r) => a + r.weight, 0);
    const rng = seededRng(`lucky:${tier}`);
    let n = 0;
    const N = 40_000;
    for (let i = 0; i < N; i += 1) if (isPowerFind(rollTierLucky(tier, PET_LUCKY_UPGRADE.god, rng))) n += 1;
    assert.ok(Math.abs(n / N - want) < 0.01, `${tier}: God-pet Power share ${(n / N).toFixed(3)} = table ${want.toFixed(3)}`);
  }
  assert.deepEqual(PET_LUCKY_UPGRADE, { egg: 0, baby: 0, child: 0, teen: 0.1, adult: 0.25, god: 0.45 });
}
ok('lucky upgrade: Teen 10% · Adult 25% · God 45%, one step, non-Powers only — the Power share is unchanged');

/* -------------------------------------------------------- expeditions --- */

{
  assert.deepEqual(PET_TRIP_MULT, { egg: 1, baby: 1, child: 1, teen: 0.9, adult: 0.8, god: 0.7 });
  for (const [stage, mult] of [['child', 1], ['teen', 0.9], ['adult', 0.8], ['god', 0.7]] as const) {
    const out = sendPetExpedition(doc({ pet: pet({ stage, total_age_ms: 300 * H }) }), T0).doc;
    assert.equal(out.pet_expedition!.len_ms, Math.max(1000, Math.round(EXPEDITION_LADDER_MS[0] * mult)), `${stage}: ${mult * 100}% length`);
    assert.equal(out.pet_expedition!.better === true, petTripBetter(pet({ stage })), `${stage}: better = ${petTripBetter(pet({ stage }))}`);
  }
  // The screen's "next trip" is the real one, and the notice follows the ladder step.
  {
    const teen = doc({ pet: pet({ stage: 'teen', total_age_ms: 300 * H }), pet_expedition_steps: 3, pet_expedition_ymd: '2026-09-30' });
    const shown = playView(teen, T0).pet.nextTripMs;
    const out = sendPetExpedition(teen, T0).doc;
    assert.equal(shown, out.pet_expedition!.len_ms, 'the next-trip line = the real trip');
    assert.equal(playView(out, T0).pet.expeditionStepMs, EXPEDITION_LADDER_MS[3], 'a Teen 30m step (27m) still counts as the 30m step for its notice');
  }
  assert.equal(petTripBetter(pet({ stage: 'teen' })), false);
  assert.equal(petTripBetter(pet({ stage: 'adult' })), true);
  // The Power chance is the same normal or better, on every step.
  for (let step = 0; step < EXPEDITION_LADDER_MS.length; step += 1) {
    const share = (better: boolean) => {
      const rng = seededRng(`trip:${step}`);
      let n = 0;
      for (let i = 0; i < 20_000; i += 1) if (isPowerFind(rollExpeditionReward(step, rng, better))) n += 1;
      return n / 20_000;
    };
    const want = EXPEDITION_POWER_BY_STEP[step] ?? 0;
    assert.ok(Math.abs(share(true) - want) < 0.015 && Math.abs(share(false) - want) < 0.015, `step ${step + 1}: Power chance ${want} either way`);
  }
  assert.equal(rollExpeditionReward(1, () => 0.9, true), 'shells_4', 'step 2 better: shrimp / 4 shells');
  assert.equal(rollExpeditionReward(2, () => 0.9, true), 'shells_6', 'step 3 better: shrimp / 6 shells');
}
ok('expeditions: Teen 90% · Adult 80% · God 70% length; Adult/God one step better; the Power chance never changes');

/* --------------------------------------------------- the Power ceiling --- */

{
  const power = rollPowerFind(() => 0);
  let d = doc();
  const many = Array.from({ length: DIVECORE_POWERS_PER_DAY + 3 }, () => power);
  const r = bankFinds(d, many, T0);
  assert.equal(bag(r.doc), DIVECORE_POWERS_PER_DAY, `at most ${DIVECORE_POWERS_PER_DAY} Powers a day`);
  assert.equal(r.powersConverted, 3);
  assert.equal(r.shells, 3 * POWER_OVERFLOW_SHELLS, 'each extra Power = shells');
  assert.equal(playView(r.doc, T0).diveRun.powersToday, DIVECORE_POWERS_PER_DAY);
  d = r.doc;
  const more = bankFinds(d, [power, 'food_kelp'], T0 + H);
  assert.equal(more.powersConverted, 1, 'still capped later the same day');
  assert.equal(more.doc.pet_pantry.food_kelp, 1, 'other finds are never capped');
  const back = bankFinds(d, [power], T0 - 20 * H);
  assert.equal(back.powersConverted, 1, 'a clock set back does not reopen the day');
  const tomorrow = bankFinds(d, [power], T0 + 24 * H);
  assert.equal(tomorrow.powersConverted, 0, 'a new day starts fresh');
  // An expedition Power past the ceiling comes back as shells, and the note says so.
  const full = doc({ pet: pet({ stage: 'god', total_age_ms: 300 * H }), powers_today: { ymd: d.powers_today.ymd, n: DIVECORE_POWERS_PER_DAY } });
  const sent = sendPetExpedition({ ...full, pet_expedition_steps: 6, pet_expedition_ymd: d.powers_today.ymd }, T0).doc;
  const home = touchPet(sent, T0 + 4 * H, () => 0);
  assert.equal(home.pet_expedition_note, `shells_${POWER_OVERFLOW_SHELLS}`, 'the note shows the shells it became');
}
ok(`daily Power ceiling ${DIVECORE_POWERS_PER_DAY}: dives, rescues, Net, Hearty and expeditions together; past it each = ${POWER_OVERFLOW_SHELLS} shells; clock-back safe`);

/* ------------------------------------------------------------ the line --- */

assert.equal(
  stagePowerLine(playView(doc({ pet: pet({ stage: 'god' }) }), T0).pet.stagePower),
  'Your pet’s stage gives: −10 bust points, rarer finds (45% lucky upgrades), trips 30% shorter, trip rewards one step better.',
);
assert.match(stagePowerLine(playView(doc({ pet: pet({ stage: 'baby' }) }), T0).pet.stagePower), /nothing extra yet/);
ok('status card / Dive Info line: "Your pet’s stage gives: −X bust points, rarer finds, trips Y% shorter"');

console.log(`\ncheck:stage-power — ${passed} groups passed.`);
