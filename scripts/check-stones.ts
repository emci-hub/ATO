/**
 * Shine Stone + shiny style checks (v27, Part D · T-D7). Run: npm run check:stones
 *
 *   1. A Stone is 10%; with 5 glimmers the next one is certain; a hit clears
 *      the glimmers. Glimmers are per player.
 *   2. The roll can't be redone: each Stone's roll comes from the saved
 *      sequence, so reloading the save (killing the app) gives the same result.
 *   3. Only a revealed, non-shiny pet (active or resting) takes a Stone; a
 *      refusal spends nothing. Looks only: no stat changes.
 *   4. Prism styles: odds sum to 100, `prismStyleFor` rolls exactly them,
 *      colours as planned; the Prism Stone is never usable (preview only).
 *   5. Dyes never show on a shiny (a Stone shiny included).
 *   6. Sources: Abyss 2% / Hadal 5% of finds (shell weight only); the 4h
 *      trip 20% with its Power chance unchanged; the first daily Gold each
 *      day; every 5th day played (the clock can't farm it); the three
 *      milestones; the token row (120, one a week); a banked Stone is no Power.
 */
import assert from 'node:assert/strict';

import { DIVE_TIERS, STONE_FIND, diveTierRolls, isPowerFind } from '../src/play/dive-loot';
import { EXPEDITION_POWER_BY_STEP, EXPEDITION_STONE_CHANCE, EXPEDITION_STONE_STEP, EXPEDITION_STEPS, rollExpeditionReward } from '../src/play/expedition-ladder';
import { petBustCutPp, petPounceBase } from '../src/play/pet';
import {
  GLIMMER_PITY,
  HERO_DYE_COLOR,
  PRISM_STYLES,
  PRISM_STYLE_COLOR,
  PRISM_STYLE_ODDS,
  STONE_EVERY_DAYS,
  STONE_ODDS,
  dyeApplies,
  prismStyleFor,
  seededRng,
  shinyColorFor,
  stoneRoll,
  stoneSucceeds,
} from '../src/play/pet-eggs';
import type { RoundOutcome } from '../src/play/pet-game-rules';
import { MILESTONES } from '../src/play/play-settings';
import {
  applyShineStone,
  bankFinds,
  chooseEggDoc,
  claimMilestone,
  defaultPlayStore,
  devGoldAllGames,
  devPetEndStage,
  finishPetRound,
  localWeekYmd,
  newEggDoc,
  parsePlayStore,
  petDyeOn,
  playView,
  purchaseShopRow,
  setHeroDye,
  touchPet,
  type PlayStoreDoc,
} from '../src/play/playStore';
import { getTokenShopRow, paidShopRows } from '../src/play/shop';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const T0 = new Date(2026, 9, 1, 12, 0, 0).getTime();
const MIN = 60_000;
const D = 24 * 60 * MIN;
const rng = seededRng(5150);

function revealed(egg: 'knight' | 'wizard' | 'village' = 'knight', base: PlayStoreDoc = defaultPlayStore(T0)): PlayStoreDoc {
  const picked = chooseEggDoc(base, T0, egg, null, rng)!;
  const doc = devPetEndStage(devPetEndStage(picked, T0 + MIN, 'egg'), T0 + MIN, 'baby');
  assert.equal(doc.pet.stage, 'child');
  return doc;
}
/** A sequence seed whose first `misses` Stones all miss. */
function seqMissing(misses: number): number {
  for (let s = 1; ; s += 1) {
    let all = true;
    for (let i = 0; i < misses && all; i += 1) all = stoneRoll(s, i) >= STONE_ODDS;
    if (all) return s;
  }
}

/* ------------------------------------------------------ 1. odds + glimmers --- */

{
  assert.equal(STONE_ODDS, 0.1);
  assert.equal(GLIMMER_PITY, 5);
  const N = 200_000;
  let hits = 0;
  const seqs = seededRng(9);
  for (let i = 0; i < N; i += 1) if (stoneSucceeds(Math.floor(seqs() * 2 ** 32), i % 50, 0)) hits += 1;
  assert.ok(Math.abs(hits / N - STONE_ODDS) < 0.004, `a Stone works ${((hits / N) * 100).toFixed(2)}% of the time (10%)`);
  for (let i = 0; i < 1000; i += 1) assert.ok(stoneSucceeds(i, i, GLIMMER_PITY), 'certain at 5 glimmers');

  // Through the store: 5 misses → 5 glimmers → the 6th Stone is certain.
  const seq = seqMissing(GLIMMER_PITY + 1);
  let doc: PlayStoreDoc = { ...revealed(), stone_seq: seq, shine_stones: 10 };
  const uid = doc.pet.uid;
  for (let i = 1; i <= GLIMMER_PITY; i += 1) {
    const r = applyShineStone(doc, T0 + 2 * MIN, uid);
    assert.deepEqual(r.result, { ok: true, shiny: false, glimmers: i }, `miss ${i}: a glimmer`);
    assert.equal(r.doc.pet.glimmer, true, 'the pet keeps a glimmer glow');
    assert.equal(r.doc.pet.shiny, false);
    doc = r.doc;
  }
  assert.equal(doc.stones_used, GLIMMER_PITY);
  assert.equal(doc.shine_stones, 10 - GLIMMER_PITY);
  const hit = applyShineStone(doc, T0 + 3 * MIN, uid);
  assert.ok(hit.result.ok && hit.result.shiny, 'with 5 glimmers the next Stone works');
  assert.equal(hit.doc.pet.shiny, true);
  assert.equal(hit.doc.pet.shiny_style, 'classic');
  assert.equal(hit.doc.pet.glimmer, false);
  assert.equal(hit.doc.glimmers, 0, 'a hit clears the glimmers');
  assert.equal(playView(hit.doc, T0 + 3 * MIN).pet.stones.glimmers, 0);

  // Glimmers are the player's: a miss on one pet counts for the next.
  const two = newEggDoc(revealed('wizard', { ...defaultPlayStore(T0), stone_seq: seqMissing(1), shine_stones: 2 }), T0 + 2 * MIN);
  assert.ok(two.result.ok);
  const restingUid = two.doc.pet_den[0].uid;
  const miss = applyShineStone(two.doc, T0 + 3 * MIN, restingUid);
  assert.ok(miss.result.ok && !miss.result.shiny);
  assert.equal(miss.doc.glimmers, 1);
  assert.equal(miss.doc.pet_den[0].glimmer, true, 'the glow sits on the pet it missed');
}
ok('a Stone is 10%; 5 misses → 5 glimmers → the 6th is certain; a hit clears them; glimmers are per player');

/* ------------------------------------------------ 2. can't be redone --- */

{
  const doc: PlayStoreDoc = { ...revealed('village'), shine_stones: 3 };
  const a = applyShineStone(doc, T0 + 2 * MIN, doc.pet.uid);
  const reloaded = parsePlayStore(JSON.stringify(doc), T0 + 2 * MIN)!;
  assert.equal(reloaded.stone_seq, doc.stone_seq, 'the sequence is saved');
  const b = applyShineStone(reloaded, T0 + 2 * MIN, reloaded.pet.uid);
  assert.deepEqual(b.result, a.result, 'the same Stone after a reload rolls the same');
  assert.equal(stoneRoll(doc.stone_seq, 3), stoneRoll(doc.stone_seq, 3));
  // Different Stones in the sequence roll differently (it moves on).
  const rolls = new Set(Array.from({ length: 20 }, (_, i) => stoneRoll(doc.stone_seq, i)));
  assert.equal(rolls.size, 20);
  // A fresh save gets its own sequence.
  assert.notEqual(defaultPlayStore(T0).stone_seq, defaultPlayStore(T0).stone_seq);
}
ok('the roll can’t be redone: the saved sequence gives the same result after a reload; each Stone has its own roll');

/* --------------------------------------------- 3. who can take a Stone --- */

{
  const shinySeq = seqMissing(0);
  const doc: PlayStoreDoc = { ...revealed(), shine_stones: 1, stone_seq: shinySeq };
  const shiny: PlayStoreDoc = { ...doc, pet: { ...doc.pet, shiny: true, shiny_style: 'classic' } };
  const refused = applyShineStone(shiny, T0 + 2 * MIN, doc.pet.uid);
  assert.deepEqual(refused.result, { ok: false, reason: 'shiny' }, 'a shiny can’t take a Stone');
  assert.equal(refused.doc.shine_stones, 1, 'nothing spent');
  const egg = chooseEggDoc({ ...defaultPlayStore(T0), shine_stones: 1 }, T0, 'knight', null, rng)!;
  assert.deepEqual(applyShineStone(egg, T0 + MIN, egg.pet.uid).result, { ok: false, reason: 'not_revealed' });
  assert.deepEqual(applyShineStone({ ...doc, shine_stones: 0 }, T0 + 2 * MIN, doc.pet.uid).result, { ok: false, reason: 'no_stones' });
  assert.deepEqual(applyShineStone(doc, T0 + 2 * MIN, 999).result, { ok: false, reason: 'missing' });
  assert.deepEqual(applyShineStone(doc, T0 + 2 * MIN, 0).result, { ok: false, reason: 'missing' });

  // Looks only: the pounce and bust cut are the same before and after.
  let hitDoc: PlayStoreDoc = { ...doc, glimmers: GLIMMER_PITY };
  const before = touchPet(hitDoc, T0 + 2 * MIN).pet;
  hitDoc = applyShineStone(hitDoc, T0 + 2 * MIN, before.uid).doc;
  assert.equal(hitDoc.pet.shiny, true);
  assert.equal(petPounceBase(hitDoc.pet), petPounceBase(before));
  assert.equal(petBustCutPp(hitDoc.pet), petBustCutPp(before));
  for (const k of ['hero', 'grade', 'stage', 'branch', 'hunger', 'mood', 'total_age_ms'] as const) assert.deepEqual(hitDoc.pet[k], before[k], `a Stone never changes ${k}`);
  // A resting pet takes one without aging.
  const rest = newEggDoc({ ...doc, glimmers: GLIMMER_PITY }, T0 + 2 * MIN);
  const resting = rest.doc.pet_den[0];
  const later = applyShineStone(rest.doc, T0 + 9 * D, resting.uid);
  assert.ok(later.result.ok && later.result.shiny);
  const after = later.doc.pet_den[0];
  assert.deepEqual({ ...after, shiny: false, shiny_style: null, glimmer: resting.glimmer }, resting, 'only the shiny changed — no aging');
  // The Collection keeps a stoned shiny (and its style).
  assert.ok(playView(later.doc, T0 + 9 * D).pet.heroes[resting.hero!].styles.includes('classic'));
}
ok('only a revealed non-shiny pet (active or resting) takes a Stone; refusals spend nothing; no stat changes; the Collection keeps the style');

/* ------------------------------------------------------- 4. Prism styles --- */

{
  assert.deepEqual(PRISM_STYLE_ODDS, { aurora: 24, ember: 22, frost: 22, void: 16, gold: 10, prism: 6 });
  assert.equal(PRISM_STYLES.reduce((s, k) => s + PRISM_STYLE_ODDS[k], 0), 100, 'Prism odds sum to 100');
  assert.deepEqual(
    { aurora: PRISM_STYLE_COLOR.aurora, ember: PRISM_STYLE_COLOR.ember, frost: PRISM_STYLE_COLOR.frost, void: PRISM_STYLE_COLOR.void, gold: PRISM_STYLE_COLOR.gold },
    { aurora: '#4FFFD2', ember: '#FF6A3D', frost: '#9FD8FF', void: '#7B4DFF', gold: '#FFC83D' },
  );
  const N = 100_000;
  const seen: Record<string, number> = {};
  for (let i = 0; i < N; i += 1) {
    const s = prismStyleFor((i + 0.5) / N);
    seen[s] = (seen[s] ?? 0) + 1;
  }
  for (const s of PRISM_STYLES) assert.ok(Math.abs((seen[s] / N) * 100 - PRISM_STYLE_ODDS[s]) < 0.01, `${s}: rolled = shown`);
  assert.equal(prismStyleFor(0), 'aurora');
  assert.equal(prismStyleFor(0.2399), 'aurora');
  assert.equal(prismStyleFor(0.24), 'ember');
  assert.equal(prismStyleFor(0.99999), 'prism');
  // Never usable in this build: the paid row is never on sale, the counter stays 0.
  const prism = paidShopRows().find((r) => r.kind === 'prism_stone');
  assert.ok(prism && prism.available === false, 'the Prism Stone is a preview, not for sale');
  const raw = JSON.parse(JSON.stringify(defaultPlayStore(T0))) as Record<string, unknown>;
  raw.prism_stones = 5;
  assert.equal(parsePlayStore(JSON.stringify(raw), T0)!.prism_stones, 0, 'no Prism Stones can be held yet');
}
ok('Prism: odds sum to 100 and prismStyleFor rolls exactly them; colours as planned; never usable (preview, 0 held)');

/* ------------------------------------------------------------ 5. dyes --- */

{
  for (const stars of [0, 3, 5]) for (const on of [false, true]) assert.equal(dyeApplies(stars, on, true), false, 'never a dye on a shiny');
  const hero = Object.keys(HERO_DYE_COLOR)[0];
  assert.notEqual(shinyColorFor(hero, 'classic'), null);
  // A pet with its dye on turns shiny by a Stone: the dye no longer shows.
  let doc: PlayStoreDoc = { ...revealed(), glimmers: GLIMMER_PITY, shine_stones: 1 };
  doc = { ...doc, dye_unlocked: [doc.pet.hero!] };
  doc = setHeroDye(doc, T0 + 2 * MIN, doc.pet.hero!, true)!;
  assert.equal(petDyeOn(doc), true, 'dye on before');
  doc = applyShineStone(doc, T0 + 2 * MIN, doc.pet.uid).doc;
  assert.equal(doc.pet.shiny, true);
  assert.equal(petDyeOn(doc), false, 'no dye on the shiny');
  assert.equal(playView(doc, T0 + 2 * MIN).pet.dyeOn, false);
}
ok('dyes never show on a shiny (a Stone shiny included)');

/* --------------------------------------------------------- 6. sources --- */

{
  // Dive loot: Abyss 2, Hadal 5 — taken from shell weight; each tier still sums to 100.
  for (const t of DIVE_TIERS) {
    const rolls = diveTierRolls(t);
    assert.equal(rolls.reduce((s, r) => s + r.weight, 0), 100, `${t} sums to 100`);
    const stone = rolls.filter((r) => r.id === STONE_FIND).reduce((s, r) => s + r.weight, 0);
    assert.equal(stone, t === 'abyss' ? 2 : t === 'hadal' ? 5 : 0, `${t}: Stone weight`);
  }
  const w = (t: 'abyss' | 'hadal', id: string) => diveTierRolls(t).find((r) => r.id === id)?.weight ?? 0;
  assert.equal(w('abyss', 'shells_5') + w('abyss', STONE_FIND), 8, 'Abyss: the Stone replaced shell weight (shells_5 8 → 6)');
  assert.equal(w('hadal', 'shells_12') + w('hadal', STONE_FIND), 20, 'Hadal: shells_12 20 → 15');
  for (const t of ['abyss', 'hadal'] as const) {
    assert.ok(!isPowerFind(STONE_FIND), 'a Stone is no Power');
    assert.ok(diveTierRolls(t).filter((r) => isPowerFind(r.id)).length > 0, `${t} still has its Powers`);
  }

  // The 4h trip: 20% a Stone, the Power chance exactly as before; no other trip gives one.
  const N = 200_000;
  for (const better of [false, true]) {
    let power = 0;
    let stone = 0;
    const r = seededRng(better ? 2 : 1);
    for (let i = 0; i < N; i += 1) {
      const id = rollExpeditionReward(EXPEDITION_STONE_STEP, r, better);
      if (isPowerFind(id)) power += 1;
      if (id === STONE_FIND) stone += 1;
    }
    assert.ok(Math.abs(power / N - EXPEDITION_POWER_BY_STEP[EXPEDITION_STONE_STEP]) < 0.004, `4h trip Power ${(power / N).toFixed(3)} (unchanged)`);
    assert.ok(Math.abs(stone / N - EXPEDITION_STONE_CHANCE) < 0.004, `4h trip Stone ${(stone / N).toFixed(3)}`);
  }
  assert.equal(EXPEDITION_STONE_STEP, EXPEDITION_STEPS - 1, 'the Stone rides on the last (4h) trip');
  for (let step = 0; step < EXPEDITION_STONE_STEP; step += 1) {
    const r = seededRng(step + 10);
    for (let i = 0; i < 20_000; i += 1) assert.notEqual(rollExpeditionReward(step, r, i % 2 === 0), STONE_FIND, `no Stone on trip ${step + 1}`);
  }

  // A banked Stone goes to the Stone count, never the bag or the Power ceiling.
  const bank = bankFinds(defaultPlayStore(T0), [STONE_FIND], T0);
  assert.equal(bank.doc.shine_stones, 1);
  assert.deepEqual(bank.doc.inventory, defaultPlayStore(T0).inventory);
  assert.equal(bank.doc.powers_today.n, 0, 'it never counts toward the Power ceiling');
  assert.equal(bank.powersConverted, 0);
}
ok('dive loot Abyss 2% / Hadal 5% from shell weight; the 4h trip 20% with its Power share unchanged; a banked Stone is no Power');

{
  // The first daily-challenge Gold of the day (either game): one Stone.
  const pass: RoundOutcome = { pass: true, quality: 0.9, got: 45, of: 50 };
  const doc = revealed();
  const plain = finishPetRound(doc, T0 + 2 * MIN, 'catch', pass, { level: 'normal', score: 60, daily: true });
  assert.equal(plain.result.dailyStone, false, 'a daily Bronze: no Stone');
  assert.equal(plain.result.dailyEgg, true);
  const gold = finishPetRound(plain.doc, T0 + 3 * MIN, 'catch', pass, { level: 'normal', score: 200, daily: true });
  assert.equal(gold.result.medal, 'gold');
  assert.equal(gold.result.dailyStone, true, 'the first daily Gold: a Stone (after the egg the same day)');
  assert.equal(gold.doc.shine_stones, doc.shine_stones + 1);
  const again = finishPetRound(gold.doc, T0 + 4 * MIN, 'train', pass, { level: 'normal', score: 999, daily: true });
  assert.equal(again.result.dailyStone, false, 'once a day, either game');
  assert.equal(finishPetRound(doc, T0 + 2 * MIN, 'catch', pass, { level: 'normal', score: 200, daily: false }).result.dailyStone, false, 'a normal Gold: no Stone');
  const insaneGold = finishPetRound(devGoldAllGames(doc), T0 + 2 * MIN, 'catch', pass, { level: 'insane', score: 999, daily: true });
  assert.equal(insaneGold.result.level, 'normal', 'the daily is always on its own (Normal) rules');
  assert.equal(finishPetRound(gold.doc, T0 + D, 'catch', pass, { level: 'normal', score: 200, daily: true }).result.dailyStone, true, 'tomorrow, again');
  assert.equal(finishPetRound(gold.doc, T0 - D, 'catch', pass, { level: 'normal', score: 200, daily: true }).result.dailyStone, false, 'the clock set back can’t earn it again');
}
ok('the first daily-challenge Gold each day gives one Stone (either game; not a normal round; not by setting the clock back)');

{
  // Every 5th day played: a Stone. Days are counted by the day rule.
  let doc = defaultPlayStore(T0);
  for (let d = 0; d < 10; d += 1) doc = touchPet(doc, T0 + d * D);
  assert.equal(doc.play_stats.days_played, 10);
  assert.equal(doc.shine_stones, 2, `days ${STONE_EVERY_DAYS} and ${2 * STONE_EVERY_DAYS}: a Stone each`);
  // Back and forth a day or two: no new days counted, no Stones.
  let wobble = doc;
  for (let i = 0; i < 20; i += 1) wobble = touchPet(wobble, T0 + (i % 2 === 0 ? 8 : 9) * D);
  assert.equal(wobble.play_stats.days_played, 10, 'toggling the clock counts no extra days');
  assert.equal(wobble.shine_stones, 2);
}
ok(`every ${STONE_EVERY_DAYS}th day played gives a Stone; toggling the clock can’t farm days`);

{
  // Milestones: first Legendary, 10 eggs, first Insane Gold — one Stone each.
  const withStones = MILESTONES.filter((m) => m.reward.kind === 'stone' || (m.stones ?? 0) > 0).map((m) => m.id);
  assert.deepEqual(withStones.sort(), ['eggs_10', 'first_legendary', 'insane_gold']);
  let legend = chooseEggDoc({ ...defaultPlayStore(T0), pet_tickets: { common: 0, rare: 0, epic: 0, legendary: 1 } }, T0, 'knight', 'legendary', rng)!;
  legend = devPetEndStage(devPetEndStage(legend, T0 + MIN, 'egg'), T0 + MIN, 'baby');
  const l = claimMilestone(legend, T0 + 2 * MIN, 'first_legendary')!;
  assert.equal(l.shine_stones, legend.shine_stones + 1);
  const ten = { ...defaultPlayStore(T0), play_stats: { ...defaultPlayStore(T0).play_stats, eggs_hatched: 10 } };
  assert.equal(claimMilestone(ten, T0, 'eggs_10')!.shine_stones, 1);
  assert.equal(claimMilestone(defaultPlayStore(T0), T0, 'insane_gold'), null, 'not before an Insane Gold');
  assert.equal(claimMilestone(devGoldAllGames(defaultPlayStore(T0)), T0, 'insane_gold')!.shine_stones, 1);
  assert.equal(claimMilestone(claimMilestone(ten, T0, 'eggs_10')!, T0, 'eggs_10'), null, 'claimed once');
}
ok('milestones: first Legendary, 10 eggs, first Insane Gold — a Stone each, once');

{
  // Token Shop (hidden): 120 tokens, one a week (Monday start; the clock can't reopen it).
  const row = getTokenShopRow('shop_shine_stone')!;
  assert.ok(row && row.kind === 'shine_stone' && row.price === 120 && row.weekly_limit === 1 && row.amount === 1);
  const doc = { ...defaultPlayStore(T0), tokens: 1000 };
  const a = purchaseShopRow(doc, row, T0, rng);
  assert.ok(a.result.ok);
  assert.equal(a.doc.shine_stones, 1);
  assert.equal(a.doc.tokens, 880);
  const b = purchaseShopRow(a.doc, row, T0 + D, rng);
  const sameWeek = localWeekYmd(T0 + D) === localWeekYmd(T0);
  if (sameWeek) assert.deepEqual(b.result, { ok: false, reason: 'weekly_cap' }, 'one a week');
  const nextWeek = T0 + 7 * D;
  assert.notEqual(localWeekYmd(nextWeek), localWeekYmd(T0));
  const c = purchaseShopRow(a.doc, row, nextWeek, rng);
  assert.ok(c.result.ok, 'next week, again');
  assert.deepEqual(purchaseShopRow(c.doc, row, T0, rng).result, { ok: false, reason: 'weekly_cap' }, 'a week back can’t reopen it');
  assert.deepEqual(purchaseShopRow({ ...doc, tokens: 100 }, row, T0, rng).result, { ok: false, reason: 'insufficient' });
}
ok('token row: 120 tokens, one a week; next week again; setting the clock back a week can’t reopen it');

console.log(`\ncheck:stones — ${passed} groups passed.`);
