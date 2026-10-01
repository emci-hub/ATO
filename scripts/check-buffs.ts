/**
 * Medal buffs check (v26, Part C · T-C2).
 *
 *   - a medal gives its buff (Gold beats Silver, Bronze none, a fail none);
 *   - one of each at a time — a new medal refreshes, never stacks;
 *   - uses, not time: the clock can't change them; they carry through
 *     release/rebirth;
 *   - Snack: the shown % includes it, it rides exactly one dive (start → end);
 *   - Hearty: +1 find on a charged surface, a use each, none on free dives;
 *   - Pumped: ×1.25 capped at PET_POUNCE_CAP; a "Maxed aura" when the cap
 *     leaves it nothing to add — no change and NO use spent; a use only per
 *     TD wave where it changed the pounce;
 *   - Focused: the next trip 25% shorter (on top of stage power), one use;
 *   - the in-run TD help stays inside the band (pounce table × cap).
 *
 * Run: npm run check:buffs
 */
import assert from 'node:assert/strict';

import {
  BUFF_USES,
  FOCUSED_TRIP_MULT,
  NO_BUFFS,
  PET_POUNCE_CAP,
  PUMPED_MIN_GAIN,
  PUMPED_MULT,
  SNACK_BUST_PP,
  buffForMedal,
  grantBuff,
  pumpedPounce,
} from '../src/play/play-buffs';
import { EXPEDITION_LADDER_MS } from '../src/play/expedition-ladder';
import { PET_BRANCH_POUNCE, PET_POUNCE_BASE, PET_STAGES, newPet, petPounceBase, type PetState } from '../src/play/pet';
import {
  defaultPlayStore,
  deeperDive,
  finishPetRound,
  playView,
  recordDefendWin,
  rebirthPetDoc,
  sendPetExpedition,
  startDive,
  startFreeDive,
  surfaceDive,
  type PlayStoreDoc,
} from '../src/play/playStore';
import { MEDAL_SCORES } from '../src/play/game-records';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}
const T0 = Date.UTC(2026, 8, 30, 12, 0, 0);
const H = 60 * 60 * 1000;
const pet = (over: Partial<PetState>): PetState => ({ ...newPet(T0), ...over });
const doc = (over: Partial<PlayStoreDoc> = {}): PlayStoreDoc => ({ ...defaultPlayStore(T0), inventory: [], ...over });
const PASS = { pass: true, quality: 0.8, got: 16, of: 20 };

/* ----------------------------------------------------- medal → buff --- */

{
  assert.equal(buffForMedal('catch', 'gold'), 'hearty');
  assert.equal(buffForMedal('catch', 'silver'), 'snack');
  assert.equal(buffForMedal('train', 'gold'), 'pumped');
  assert.equal(buffForMedal('train', 'silver'), 'focused');
  assert.equal(buffForMedal('catch', 'bronze'), null);
  const d = doc({ pet: pet({ stage: 'child' }) });
  const gold = finishPetRound(d, T0, 'catch', PASS, { level: 'normal', score: MEDAL_SCORES.catch.normal[2], daily: false });
  assert.deepEqual(gold.doc.buffs, { ...NO_BUFFS, hearty: BUFF_USES.hearty }, 'Gold gives only the Gold buff');
  const failed = finishPetRound(d, T0, 'catch', { ...PASS, pass: false }, { level: 'normal', score: 999, daily: false });
  assert.deepEqual(failed.doc.buffs, NO_BUFFS, 'a failed round gives no buff');
  // Refresh, never stack.
  const used = { ...gold.doc, buffs: { ...gold.doc.buffs, hearty: 1 } };
  const again = finishPetRound(used, T0, 'catch', PASS, { level: 'normal', score: MEDAL_SCORES.catch.normal[2], daily: false });
  assert.equal(again.doc.buffs.hearty, BUFF_USES.hearty, 'a new Gold refreshes to full');
  const twice = grantBuff(grantBuff(NO_BUFFS, 'pumped'), 'pumped');
  assert.equal(twice.pumped, BUFF_USES.pumped, 'never stacks past full');
}
ok('medal → buff: Catch Silver Snack / Gold Hearty, Train Silver Focused / Gold Pumped; refreshes, never stacks; none on a fail');

/* ------------------------------------------------------------- Snack --- */

{
  const d = doc({ pet: pet({ stage: 'adult' }), buffs: { ...NO_BUFFS, snack: 1 } });
  const start = startDive(d, T0, () => 0.5)!.doc;
  assert.equal(start.buffs.snack, 0, 'spent when the dive starts');
  assert.equal(start.dive_run!.snack, true, 'and rides this dive');
  const withSnack = playView({ ...start, dive_run: { ...start.dive_run!, deepers: 1 } }, T0).diveRun.bustPct!;
  const without = playView({ ...start, dive_run: { ...start.dive_run!, deepers: 1, snack: undefined } }, T0).diveRun.bustPct!;
  assert.equal(without.safe - withSnack.safe, SNACK_BUST_PP, 'the shown % includes the Snack');
  // The shown % is the rolled %: a roll just under it busts.
  const run = { ...start, dive_run: { ...start.dive_run!, deepers: 1 } };
  assert.ok(deeperDive(run, T0, 'safe', () => withSnack.safe / 100 - 1e-9, withSnack.safe)!.outcome.busted);
  const deeper = deeperDive(run, T0, 'safe', () => 0.99, withSnack.safe)!.doc;
  assert.equal(deeper.dive_run!.snack, true, 'still on after a Deeper');
  const up = surfaceDive(deeper, T0)!.doc;
  const next = startDive(up, T0, () => 0.5)!.doc;
  assert.equal(next.dive_run!.snack, undefined, 'one dive only');
  const free = startFreeDive(doc({ dive_charge: 0, dive_charge_at: T0, buffs: { ...NO_BUFFS, snack: 1 } }), T0, () => 0.5)!.doc;
  assert.equal(free.dive_run!.snack, true, 'a free dive is a dive too');
}
ok('Snack: −2 in the shown (= rolled) %; bound to one dive from start to end');

/* ------------------------------------------------------------ Hearty --- */

{
  const d = doc({ buffs: { ...NO_BUFFS, hearty: 3 }, dive_run: { deepers: 1, haul: ['food_kelp'], free_n: null, next: null } });
  const up = surfaceDive(d, T0, () => 0.3)!;
  assert.ok(up.heartyFind, '+1 find on a charged surface');
  assert.equal(up.banked.length, 2);
  assert.equal(up.doc.buffs.hearty, 2, 'a use per surface');
  const free = surfaceDive({ ...d, dive_run: { ...d.dive_run!, free_n: 0 } }, T0, () => 0.3)!;
  assert.equal(free.heartyFind, null, 'not on a free dive');
  assert.equal(free.doc.buffs.hearty, 3, 'and no use spent');
}
ok('Hearty meal: +1 find on each of 3 charged surfaces; none (and no use) on a free dive');

/* ------------------------------------------------------------ Pumped --- */

{
  // Every pet: Pumped never goes past the cap; a tiny gain is a Maxed aura.
  for (const stage of PET_STAGES) {
    for (const branch of ['standard', 'battle', 'scruffy', 'deep', 'bright'] as const) {
      const base = petPounceBase(pet({ stage, branch }));
      const p = pumpedPounce(base, 5);
      assert.ok(p.pounce <= Math.max(base, PET_POUNCE_CAP), `${stage}/${branch}: never past the cap`);
      if (base > 0) assert.ok(p.boosted !== p.maxed, `${stage}/${branch}: boosted or maxed, not both`);
      if (p.boosted) assert.ok(p.pounce - base >= PUMPED_MIN_GAIN);
    }
  }
  const godBattle = PET_POUNCE_BASE.god * PET_BRANCH_POUNCE.battle;
  assert.equal(pumpedPounce(godBattle, 5).maxed, true, 'a God Battle pet: Maxed aura');
  assert.equal(pumpedPounce(PET_POUNCE_BASE.child, 5).pounce, PET_POUNCE_BASE.child * PUMPED_MULT, 'a Child: ×1.25');
  assert.equal(pumpedPounce(PET_POUNCE_BASE.god, 5).pounce, PET_POUNCE_CAP, 'a God: up to the cap');
  assert.equal(pumpedPounce(0, 5).maxed, false, 'no pounce, no aura');

  // TD: a use per cleared wave only when it changed the pounce.
  const child = doc({ pet: pet({ stage: 'child' }), buffs: { ...NO_BUFFS, pumped: 5 } });
  assert.equal(playView(child, T0).pet.pounceBase, PET_POUNCE_BASE.child * PUMPED_MULT, 'TD reads the Pumped pounce');
  const won = recordDefendWin(child, { phase: 'trial', wave: 1, mode: 'campaign' }, T0, () => 0.99).doc;
  assert.equal(won.buffs.pumped, 4, 'a cleared wave spends one');
  const battleGod = doc({ pet: pet({ stage: 'god', branch: 'battle' }), buffs: { ...NO_BUFFS, pumped: 5 } });
  const v = playView(battleGod, T0).pet;
  assert.equal(v.pumped.maxed, true);
  assert.equal(v.pounceBase, godBattle, 'Maxed aura: the pounce is unchanged');
  const wonMaxed = recordDefendWin(battleGod, { phase: 'trial', wave: 1, mode: 'campaign' }, T0, () => 0.99).doc;
  assert.equal(wonMaxed.buffs.pumped, 5, 'Maxed aura: no use spent');
  const egg = recordDefendWin(doc({ buffs: { ...NO_BUFFS, pumped: 5 } }), { phase: 'trial', wave: 1, mode: 'campaign' }, T0, () => 0.99).doc;
  assert.equal(egg.buffs.pumped, 5, 'no pounce (an egg): no use spent');
}
ok(`Pumped: ×${PUMPED_MULT} capped at ${PET_POUNCE_CAP}; "Maxed aura" when it adds < ${PUMPED_MIN_GAIN} — no change, no use; a use only on a wave it changed`);

/* ----------------------------------------------------------- Focused --- */

{
  const d = doc({ pet: pet({ stage: 'god', total_age_ms: 300 * H }), buffs: { ...NO_BUFFS, focused: 1 } });
  const out = sendPetExpedition(d, T0).doc;
  assert.equal(out.pet_expedition!.len_ms, Math.max(1000, Math.round(EXPEDITION_LADDER_MS[0] * 0.7 * FOCUSED_TRIP_MULT)), 'God 70% × Focused 75%');
  assert.equal(out.buffs.focused, 0, 'one trip');
  const eggSend = sendPetExpedition(doc({ buffs: { ...NO_BUFFS, focused: 1 } }), T0).doc;
  assert.equal(eggSend.buffs.focused, 1, 'no trip sent (an egg can’t go): no use spent');
}
ok('Focused: the next trip 25% shorter (stacks with stage power), spent only when a trip is sent');

/* ------------------------------------------------ clock + rebirth safe --- */

{
  const d = doc({ pet: pet({ stage: 'god' }), buffs: { hearty: 3, snack: 1, pumped: 5, focused: 1 } });
  for (const t of [T0 - 30 * 24 * H, T0 + 365 * 24 * H]) {
    assert.deepEqual(playView(d, t).pet.buffs, d.buffs, 'the clock never changes buffs');
  }
  const reborn = rebirthPetDoc(d, T0)!;
  assert.deepEqual(reborn.buffs, d.buffs, 'buffs carry through a rebirth');
}
ok('buffs count uses, not time (clock-safe), and carry through release / rebirth');

console.log(`\ncheck:buffs — ${passed} groups passed.`);
