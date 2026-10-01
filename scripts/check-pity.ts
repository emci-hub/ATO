/**
 * Legendary pity + egg pacing checks (v27, Part D · T-D7). Run: npm run check:pity
 *
 *   1. The curve: base odds to egg 29, +1 point each egg from 30 through 39,
 *      egg 40 always Legendary; every table still sums to 100.
 *   2. Odds shown = odds rolled: `rollPet` over many seeds lands on
 *      `gradeOdds` at every pity position (with and without a ticket).
 *   3. Through the store: a Legendary by the 40th egg, every time; the
 *      counter steps +1 per reveal and 0 on a Legendary (a ticket Legendary
 *      too); release / swap / rebirth / old saves / the clock never change
 *      it; the reveal uses the pet's stamp; a resting pet never reveals.
 *   4. Egg pacing: 2 free a day, then 10/20/40/80, at most 6 (the daily egg
 *      included); a ticket egg and a "Change egg" blank are free and don't
 *      count; the clock can't reopen free eggs; the daily-challenge egg is
 *      once a day; short of shells is refused at no cost.
 */
import assert from 'node:assert/strict';

import {
  CARE_BANDS,
  DAILY_EGG_BONUS,
  EGGS_PER_DAY_MAX,
  EXTRA_EGG_PRICES,
  FREE_EGGS_PER_DAY,
  GRADES,
  PITY_HARD,
  PITY_SOFT_FROM,
  eggsUntilLegendary,
  gradeOdds,
  nextEggPrice,
  pityAfterReveal,
  pityEggNumber,
  PITY_SOFT_STEP_PP,
  pityLegendaryPct,
  rollPet,
  seededRng,
  type Grade,
} from '../src/play/pet-eggs';
import type { RoundOutcome } from '../src/play/pet-game-rules';
import { TIDE_PITY_STEP } from '../src/play/tide';
import {
  activateDenPet,
  changeEggDoc,
  chooseEggDoc,
  defaultPlayStore,
  devGrantTide,
  devPetEndStage,
  devPetSetStage,
  eggDayOf,
  eggPickCost,
  finishPetRound,
  localYmd,
  newEggDoc,
  parsePlayStore,
  playView,
  rebirthPetDoc,
  releasePetDoc,
  touchPet,
  type PlayStoreDoc,
} from '../src/play/playStore';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const T0 = new Date(2026, 9, 1, 12, 0, 0).getTime();

/** Streak already claimed today, so shell math below is the egg price alone. */
function claimedToday(doc: PlayStoreDoc, now: number): PlayStoreDoc {
  return { ...doc, streak: { next: 2, ymd: localYmd(new Date(now)), last: 1 } };
}
const MIN = 60_000;
const D = 24 * 60 * MIN;
const close = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;
const rng = seededRng(4040);

/* -------------------------------------------------------------- 1. curve --- */

{
  assert.equal(PITY_HARD, 40);
  assert.equal(PITY_SOFT_FROM, 30);
  assert.equal(eggsUntilLegendary(0), 40);
  assert.equal(eggsUntilLegendary(39), 1, 'the 40th egg: the next one is certain');
  for (const band of CARE_BANDS) {
    for (const ticket of [null, 'rare', 'epic', 'legendary'] as (Grade | null)[]) {
      let prev = -1;
      for (let since = 0; since <= PITY_HARD + 5; since += 1) {
        const odds = gradeOdds(band, ticket, since);
        assert.ok(close(GRADES.reduce((s, g) => s + odds[g], 0), 100), `${band}/${ticket}/${since}: sums to 100`);
        assert.ok(GRADES.every((g) => odds[g] >= 0));
        assert.ok(odds.legendary >= prev - 1e-9, 'the Legendary share never drops as the count rises');
        prev = odds.legendary;
        const base = gradeOdds(band, ticket, 0).legendary;
        if (since + 1 < PITY_SOFT_FROM) assert.ok(close(odds.legendary, base), 'before egg 30: the normal odds');
        else assert.ok(close(odds.legendary, pityLegendaryPct(base, since)), 'soft pity: the shown curve');
        if (since + 1 >= PITY_HARD) assert.deepEqual(odds, { common: 0, rare: 0, epic: 0, legendary: 100 });
      }
    }
  }
  // Egg 30 is +1 point, each later egg another point, egg 39 is +10, egg 40 is 100%.
  const b = gradeOdds('poor').legendary;
  assert.equal(PITY_SOFT_STEP_PP, 1);
  assert.ok(close(pityLegendaryPct(b, PITY_SOFT_FROM - 1), b + PITY_SOFT_STEP_PP));
  assert.ok(close(pityLegendaryPct(b, PITY_SOFT_FROM), b + 2 * PITY_SOFT_STEP_PP));
  assert.ok(close(pityLegendaryPct(b, PITY_HARD - 2), b + 10 * PITY_SOFT_STEP_PP));
  assert.ok(pityLegendaryPct(b, PITY_HARD - 2) < 100, 'egg 39 is still short of the guarantee');
  assert.ok(close(pityLegendaryPct(b, PITY_HARD - 1), 100));
  assert.equal(pityAfterReveal(5, 'legendary'), 0);
  assert.equal(pityAfterReveal(5, 'epic'), 6);
  assert.equal(pityAfterReveal(39, 'rare'), 39, 'never past the guaranteed egg');
}
ok('curve: normal odds to egg 29, +1 point each egg from 30 through 39, egg 40 = 100% Legendary; every table sums to 100');

/* ---------------------------------------------- 2. odds shown = odds rolled --- */

{
  const N = 30_000;
  const seeds = seededRng(77);
  for (const [band, ticket, since] of [
    ['poor', null, 0],
    ['poor', null, 29],
    ['good', null, 34],
    ['perfect', null, 38],
    ['great', 'rare', 33],
    ['poor', null, 39],
  ] as const) {
    const odds = gradeOdds(band, ticket, since);
    const seen: Record<Grade, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
    for (let i = 0; i < N; i += 1) seen[rollPet(Math.floor(seeds() * 2 ** 32), 'knight', band, ticket, since).grade] += 1;
    for (const g of GRADES) {
      const got = (seen[g] / N) * 100;
      assert.ok(Math.abs(got - odds[g]) < 1.2, `${band}/${ticket}/${since}: ${g} rolled ${got.toFixed(2)}% vs shown ${odds[g].toFixed(2)}%`);
    }
  }
  // Same seed + same position → the same pet, always.
  assert.deepEqual(rollPet(123, 'wizard', 'good', null, 31), rollPet(123, 'wizard', 'good', null, 31));
  // The view shows the odds the next egg would roll with.
  const doc = { ...defaultPlayStore(T0), eggs_since_legendary: 33 };
  const v = playView(doc, T0).pet;
  assert.equal(v.pity.since, 33);
  assert.equal(v.pity.untilLegendary, 7);
  assert.deepEqual(v.pity.nextOdds, gradeOdds('poor', null, 33));
}
ok('odds shown = odds rolled: rollPet matches gradeOdds at every pity position (±1.2pp over 30k seeds); the view shows the same table');

/* --------------------------------------------- 3. through the store --- */

function hatch(doc: PlayStoreDoc, now: number): PlayStoreDoc {
  return devPetEndStage(devPetEndStage(doc, now, 'egg'), now, 'baby');
}

{
  // 150 eggs, poor care, one a day: the gap between Legendaries never passes 40.
  let doc = defaultPlayStore(T0);
  let gap = 0;
  let worst = 0;
  let legends = 0;
  for (let i = 0; i < 150; i += 1) {
    const now = T0 + i * D;
    const before = doc.eggs_since_legendary;
    doc = chooseEggDoc(doc, now, 'knight', null, rng)!;
    assert.equal(doc.pet.pity_from, before, 'the pick stamps the counter');
    doc = hatch(doc, now + MIN);
    gap += 1;
    const grade = doc.pet.grade!;
    const step = doc.pet.pity_step;
    assert.ok(step === 1 || step === 2);
    assert.equal(doc.eggs_since_legendary, grade === 'legendary' ? 0 : before + step, 'counter moves by the stamped step, or 0 on a Legendary');
    if (before + step >= PITY_HARD) assert.equal(grade, 'legendary', 'a step that lands on egg 40 is Legendary');
    if (grade === 'legendary') {
      legends += 1;
      worst = Math.max(worst, gap);
      gap = 0;
    }
    if (before === PITY_HARD - 1) assert.equal(grade, 'legendary', 'the 40th egg is Legendary');
    const released = releasePetDoc(doc, now + 2 * MIN)!;
    assert.equal(released.eggs_since_legendary, doc.eggs_since_legendary, 'release never changes the counter');
    doc = released;
  }
  assert.ok(gap <= PITY_HARD && worst <= PITY_HARD, `a Legendary by the 40th egg (worst gap ${worst})`);
  assert.ok(legends >= 3);

  // Forced to the edge: egg 40 is Legendary through the store.
  let edge = chooseEggDoc({ ...defaultPlayStore(T0), eggs_since_legendary: PITY_HARD - 1 }, T0, 'village', null, rng)!;
  edge = hatch(edge, T0 + MIN);
  assert.equal(edge.pet.grade, 'legendary');
  assert.equal(edge.eggs_since_legendary, 0);
}
ok('store: a Legendary by the 40th egg over 150 poor-care eggs; +1 per reveal, 0 on a Legendary; release keeps it');

{
  // A ticket Legendary resets it too.
  let doc: PlayStoreDoc = { ...defaultPlayStore(T0), eggs_since_legendary: 20, pet_tickets: { common: 0, rare: 0, epic: 0, legendary: 1 } };
  doc = hatch(chooseEggDoc(doc, T0, 'wizard', 'legendary', rng)!, T0 + MIN);
  assert.equal(doc.pet.grade, 'legendary');
  assert.equal(doc.eggs_since_legendary, 0, 'a ticket Legendary resets the counter');

  // Swap, rebirth, clock: never change it. A resting pet never reveals.
  let s: PlayStoreDoc = { ...defaultPlayStore(T0), eggs_since_legendary: 12 };
  s = chooseEggDoc(s, T0, 'knight', null, rng)!;
  s = devPetEndStage(s, T0 + MIN, 'egg'); // a Baby, not yet revealed
  assert.equal(s.pet.stage, 'baby');
  const rest = newEggDoc(s, T0 + 2 * MIN);
  assert.ok(rest.result.ok);
  let r = rest.doc;
  assert.equal(r.eggs_since_legendary, 12, 'a swap never changes it');
  for (let t = T0 + D; t <= T0 + 10 * D; t += D) r = touchPet(r, t);
  assert.equal(r.pet_den[0].stage, 'baby', 'a resting Baby never reaches Child');
  assert.equal(r.eggs_since_legendary, 12, 'so it never moves the counter');
  // Its stamp is renewed on waking; the reveal then uses it.
  r = { ...r, eggs_since_legendary: PITY_HARD - 1 };
  const woke = activateDenPet(r, T0 + 10 * D, r.pet_den[0].uid);
  assert.ok(woke.result.ok);
  assert.equal(woke.doc.pet.pity_from, PITY_HARD - 1);
  const revealed = devPetEndStage(woke.doc, T0 + 10 * D + MIN, 'baby');
  assert.equal(revealed.pet.grade, 'legendary', 'the reveal uses the stamp');
  assert.equal(revealed.eggs_since_legendary, 0);

  // Rebirth keeps it.
  const god = devPetSetStage({ ...revealed, eggs_since_legendary: 9 }, T0 + 10 * D + 2 * MIN, 'god');
  const reborn = rebirthPetDoc(god, T0 + 10 * D + 3 * MIN)!;
  assert.ok(reborn);
  assert.equal(reborn.eggs_since_legendary, 9, 'rebirth never changes it');

  // The clock: forward and back again changes nothing by itself.
  const c = { ...defaultPlayStore(T0), eggs_since_legendary: 15 };
  assert.equal(touchPet(touchPet(c, T0 + 40 * D), T0).eggs_since_legendary, 15);

  // Old saves start at 0; a broken value is clamped.
  const raw = JSON.parse(JSON.stringify(defaultPlayStore(T0))) as Record<string, unknown>;
  delete raw.eggs_since_legendary;
  raw.version = 26;
  assert.equal(parsePlayStore(JSON.stringify(raw), T0)!.eggs_since_legendary, 0, 'old saves start at 0');
  raw.version = 27;
  raw.eggs_since_legendary = 999;
  assert.equal(parsePlayStore(JSON.stringify(raw), T0)!.eggs_since_legendary, PITY_HARD - 1);
  raw.eggs_since_legendary = -4;
  assert.equal(parsePlayStore(JSON.stringify(raw), T0)!.eggs_since_legendary, 0);
  raw.eggs_since_legendary = 21;
  assert.equal(parsePlayStore(JSON.stringify(raw), T0)!.eggs_since_legendary, 21, 'and survives a reload');
}
ok('a ticket Legendary resets it; swap / rebirth / the clock / old saves never do; a resting pet never reveals; the reveal uses the stamp');

/* ------------------------------------------------------- 4. egg pacing --- */

{
  assert.equal(FREE_EGGS_PER_DAY, 2);
  assert.deepEqual([...EXTRA_EGG_PRICES], [10, 20, 40, 80]);
  assert.equal(EGGS_PER_DAY_MAX, 6);
  assert.equal(DAILY_EGG_BONUS, 1);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map((n) => nextEggPrice(n, false)), [0, 0, 10, 20, 40, 80, null]);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map((n) => nextEggPrice(n, true)), [0, 0, 0, 10, 20, 40, null], 'the daily egg counts toward 6');

  // Six eggs in a day through the store: 0, 0, 10, 20, 40, 80, then none.
  const day = (start: PlayStoreDoc, now: number) => {
    let doc = start;
    const paid: number[] = [];
    for (let i = 0; i < EGGS_PER_DAY_MAX; i += 1) {
      const before = doc.shells;
      const next = chooseEggDoc(doc, now + i * MIN, 'knight', null, rng);
      assert.ok(next, `egg ${i + 1} today`);
      paid.push(before - next.shells);
      const rested = newEggDoc(next, now + i * MIN + 1);
      assert.ok(rested.result.ok);
      doc = rested.doc;
    }
    return { doc, paid };
  };
  const first = day(claimedToday({ ...defaultPlayStore(T0), shells: 1000, den_slots: 12 }, T0), T0);
  assert.deepEqual(first.paid, [0, 0, 10, 20, 40, 80]);
  assert.deepEqual(eggPickCost(first.doc, T0 + 10 * MIN, null), { ok: false, reason: 'no_eggs_left' });
  assert.equal(chooseEggDoc(first.doc, T0 + 10 * MIN, 'knight', null, rng), null, 'a 7th egg is refused');
  // Next day: free again.
  assert.deepEqual(eggDayOf(first.doc, T0 + D), { used: 0, free: 2, dailyEgg: false, nextPrice: 0, max: 6, prepaid: false });

  // The clock can't reopen free eggs: set it back a day or two, or forward and back.
  assert.equal(eggDayOf(first.doc, T0 - D).used, 6, 'a day back: still used up');
  assert.equal(eggDayOf(first.doc, T0 - 2 * D).used, 6);
  let fwd = chooseEggDoc(claimedToday({ ...defaultPlayStore(T0), shells: 0 }, T0 + D), T0 + D, 'knight', null, rng)!;
  fwd = newEggDoc(fwd, T0 + D + 1).doc;
  fwd = chooseEggDoc(fwd, T0 + D + 2, 'knight', null, rng)!;
  fwd = newEggDoc(fwd, T0 + D + 3).doc;
  assert.equal(eggDayOf(fwd, T0).used, 2, 'forward a day, two free, back again: no new free eggs');
  assert.deepEqual(eggPickCost(fwd, T0, null), { ok: false, reason: 'shells' });

  // Short of shells: refused, nothing spent.
  const poor = { ...first.doc, eggs_today: 2, shells: 5 };
  assert.deepEqual(eggPickCost(poor, T0 + 11 * MIN, null), { ok: false, reason: 'shells' });
}
ok('pacing: 2 free, then 10/20/40/80, 6 max; resets next day; the clock (back, or forward and back) can’t reopen eggs');

{
  // A ticket egg: free and never counts.
  const doc: PlayStoreDoc = {
    ...defaultPlayStore(T0),
    eggs_today: 6,
    eggs_ymd: localYmd(new Date(T0)),
    pet_tickets: { common: 0, rare: 2, epic: 0, legendary: 0 },
  };
  const used = eggDayOf(doc, T0).used;
  assert.equal(used, 6);
  const t = chooseEggDoc(claimedToday({ ...doc, shells: 0 }, T0), T0, 'wizard', 'rare', rng)!;
  assert.ok(t, 'a ticket egg works even with no eggs left today');
  assert.equal(t.shells, 0);
  assert.equal(t.eggs_today, doc.eggs_today, 'and doesn’t count');
  assert.equal(eggDayOf(t, T0).used, used);

  // "Change egg": the blank is prepaid — picking again is free and doesn't count.
  const one = chooseEggDoc(claimedToday({ ...defaultPlayStore(T0), shells: 100 }, T0), T0, 'knight', null, rng)!;
  const two = chooseEggDoc(newEggDoc(one, T0 + 1).doc, T0 + 2, 'knight', null, rng)!;
  const three = chooseEggDoc(newEggDoc(two, T0 + 3).doc, T0 + 4, 'knight', null, rng)!;
  assert.equal(three.shells, 90, 'the 3rd egg cost 10');
  const changed = changeEggDoc(three, T0 + 5)!;
  assert.equal(eggDayOf(changed, T0 + 5).prepaid, true);
  const again = chooseEggDoc(changed, T0 + 6, 'village', null, rng)!;
  assert.equal(again.shells, 90, 'Change egg costs no new egg');
  assert.equal(again.eggs_today, three.eggs_today);
  assert.equal(again.pet.uid, three.pet.uid + 1, 'a fresh pet id for the new egg');
}
ok('a ticket egg and a "Change egg" pick are free and never count');

{
  // The daily-challenge egg: once a day, then again tomorrow.
  const pass: RoundOutcome = { pass: true, quality: 0.8, got: 40, of: 50 };
  let doc = hatch(chooseEggDoc(defaultPlayStore(T0), T0, 'knight', null, rng)!, T0 + MIN);
  const a = finishPetRound(doc, T0 + 2 * MIN, 'catch', pass, { level: 'normal', score: 40, daily: true });
  assert.equal(a.result.dailyEgg, true, 'a daily pass gives the egg');
  assert.equal(eggDayOf(a.doc, T0 + 2 * MIN).free, FREE_EGGS_PER_DAY + DAILY_EGG_BONUS);
  const b = finishPetRound(a.doc, T0 + 3 * MIN, 'train', pass, { level: 'normal', score: 10, daily: true });
  assert.equal(b.result.dailyEgg, false, 'only once a day (either game)');
  const notDaily = finishPetRound(doc, T0 + 2 * MIN, 'catch', pass, { level: 'normal', score: 40, daily: false });
  assert.equal(notDaily.result.dailyEgg, false, 'a normal round gives no egg');
  const fail = finishPetRound(doc, T0 + 2 * MIN, 'catch', { ...pass, pass: false }, { level: 'normal', score: 40, daily: true });
  assert.equal(fail.result.dailyEgg, false, 'a failed daily gives no egg');
  doc = b.doc;
  assert.equal(finishPetRound(doc, T0 + D, 'catch', pass, { level: 'normal', score: 40, daily: true }).result.dailyEgg, true, 'tomorrow, again');
  assert.equal(finishPetRound(doc, T0 - D, 'catch', pass, { level: 'normal', score: 40, daily: true }).result.dailyEgg, false, 'the clock set back can’t earn it again');
}
ok('the daily-challenge egg: once a day on a pass (either game), not on a fail or a normal round, not by setting the clock back');

/* ------------------------------------------------- step 2 (Tide Pass) --- */

{
  assert.equal(TIDE_PITY_STEP, 2);
  assert.equal(pityEggNumber(0, 1), 1, 'step 1 is still Part D');
  assert.equal(pityEggNumber(0, 2), 2);
  assert.equal(eggsUntilLegendary(0, 2), 20, 'from zero, egg 20 is the guarantee');
  assert.equal(eggsUntilLegendary(38, 2), 1);
  assert.equal(pityAfterReveal(38, 'rare', 2), 39, 'step 2 from 38 clamps at 39');
  assert.equal(pityAfterReveal(38, 'rare', 1), 39);
  assert.equal(pityAfterReveal(pityAfterReveal(0, 'epic', 2), 'rare', 1), 3, 'mixed steps add, they do not restart');
  const base = gradeOdds('poor', null, 0, 1).legendary;
  assert.ok(close(gradeOdds('poor', null, 0, 2).legendary, base), 'step 2 does not change the odds table before soft pity');
  assert.ok(close(gradeOdds('poor', null, 28, 1).legendary, base), 'step 1 at 28 is still egg 29');
  assert.ok(close(gradeOdds('poor', null, 28, 2).legendary, base + 1), 'step 2 at 28 is egg 30, the first soft step');
  assert.equal(gradeOdds('poor', null, 38, 2).legendary, 100);
  assert.equal(gradeOdds('poor', null, 39, 2).legendary, 100);
  let since = 0;
  for (let egg = 1; egg <= 19; egg += 1) {
    assert.ok(gradeOdds('poor', null, since, 2).legendary < 100, `egg ${egg} is not yet certain`);
    since = pityAfterReveal(since, 'epic', 2);
  }
  assert.equal(since, 38);
  assert.equal(gradeOdds('poor', null, since, 2).legendary, 100, 'the 20th egg is Legendary');
  for (let seed = 1; seed <= 40; seed += 1) {
    assert.equal(rollPet(seed, 'knight', 'poor', null, 38, 2).grade, 'legendary');
    assert.equal(rollPet(seed, 'knight', 'poor', null, 39, 1).grade, 'legendary');
  }

  const N = 8_000;
  const seeds = seededRng(909);
  for (const step of [1, 2] as const) {
    for (let pos = 0; pos < PITY_HARD; pos += 1) {
      const odds = gradeOdds('poor', null, pos, step);
      const seen: Record<Grade, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
      for (let i = 0; i < N; i += 1) seen[rollPet(Math.floor(seeds() * 2 ** 32), 'knight', 'poor', null, pos, step).grade] += 1;
      for (const g of GRADES) {
        if (odds[g] === 0 || odds[g] === 100) {
          assert.equal(seen[g], odds[g] === 100 ? N : 0, `step ${step} at ${pos}: ${g} is certain`);
        } else {
          const got = (seen[g] / N) * 100;
          assert.ok(Math.abs(got - odds[g]) < 2, `step ${step} at ${pos}: ${g} rolled ${got.toFixed(2)}% vs shown ${odds[g].toFixed(2)}%`);
        }
      }
    }
  }

  let tideDoc = devGrantTide({ ...defaultPlayStore(T0), eggs_since_legendary: 10 }, T0);
  const view = playView(tideDoc, T0).pet;
  assert.equal(view.pity.step, TIDE_PITY_STEP);
  assert.deepEqual(view.pity.nextOdds, gradeOdds('poor', null, 10, TIDE_PITY_STEP), 'the picker shows the step it will roll');
  tideDoc = chooseEggDoc(tideDoc, T0, 'knight', null, rng)!;
  assert.equal(tideDoc.pet.pity_step, TIDE_PITY_STEP, 'the pick stamps the live step');
  const stamped = tideDoc.pet.pity_from;
  tideDoc = hatch(tideDoc, T0 + MIN);
  assert.equal(
    tideDoc.eggs_since_legendary,
    tideDoc.pet.grade === 'legendary' ? 0 : stamped + TIDE_PITY_STEP,
    'the reveal spends the stamped step',
  );
}
ok('step 2: egg 20 is guaranteed, step 2 from 38 still guarantees the next egg, shown odds are the rolled odds at every position 0–39');

console.log(`\ncheck:pity — ${passed} groups passed.`);
