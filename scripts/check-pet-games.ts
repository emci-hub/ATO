/**
 * Mini-game checks (v25, 2026-09-30). Run: npm run check:pet-games
 *
 *   - Catch: pass = caught ≥ 50% of the food that finished falling; bombs
 *     −3 and a strike, 3 strikes end the round; combo +1 every 3rd quick
 *     catch; golden +3 (still one food for the %); spawns speed up.
 *   - Train: 15 taps, pass = 8+ hits; 3 misses in a row end the round; the
 *     zone shrinks to a 12% minimum.
 *   - A fail pays nothing; a skilled round (pass with 70%+) is what egg care
 *     needs — and random mashing can't get there (simulated).
 */
import assert from 'node:assert/strict';

import { careBand, careScore, roundSkillPoints, CARE_ACT } from '../src/play/pet-eggs';
import {
  CATCH,
  EMPTY_CATCH,
  START_TRAIN,
  TRAIN,
  catchFood,
  catchOutcome,
  catchSpawnGapMs,
  catchSpawnKind,
  catchSpeedMult,
  missFood,
  outcomeLine,
  tapBomb,
  trainOutcome,
  trainTap,
  type CatchTally,
  type TrainTally,
} from '../src/play/pet-game-rules';
import { PET_STAGE_MS } from '../src/play/pet';
import { chooseEggDoc, defaultPlayStore, finishPetRound } from '../src/play/playStore';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

/* --------------------------------------------------------------- Catch --- */

{
  let t: CatchTally = EMPTY_CATCH;
  for (let i = 0; i < 10; i += 1) t = catchFood(t, i * 2000, false); // slow catches: no combo
  for (let i = 0; i < 10; i += 1) t = missFood(t);
  assert.deepEqual(catchOutcome(t), { pass: true, quality: 0.5, got: 10, of: 20, bombs: 0 }, 'exactly 50% passes');
  const under = missFood(t);
  assert.equal(catchOutcome(under).pass, false, 'under 50% fails');
  assert.equal(catchOutcome(EMPTY_CATCH).pass, false, 'doing nothing fails');
  assert.equal(outcomeLine('catch', catchOutcome(t)), 'Caught 10/20 (50%) · PASS');
}
ok('Catch: pass = caught ≥ 50% of the food that fell; doing nothing fails');

{
  let t: CatchTally = catchFood(EMPTY_CATCH, 0, false);
  const before = t.points;
  t = tapBomb(t);
  assert.equal(t.points, before - CATCH.bombPenalty, 'a bomb costs 3 points');
  assert.equal(t.over, false);
  t = tapBomb(tapBomb(t));
  assert.equal(t.strikes, 3);
  assert.equal(t.over, true, '3 bombs end the round');
  assert.deepEqual(catchFood(t, 99_999, true), t, 'nothing counts after the end');
  assert.equal(catchOutcome(t).of, 1, 'bombs never count as food');
  // The shortcut: catch one, tap 3 bombs → 100% of the food that fell, but a FAIL.
  assert.equal(catchOutcome(t).quality, 1);
  assert.equal(catchOutcome(t).pass, false, 'a bomb-out is always a fail');
  assert.equal(roundSkillPoints(catchOutcome(t)), 0, 'and never skilled care');
  const two = tapBomb(tapBomb(catchFood(EMPTY_CATCH, 0, false)));
  assert.equal(catchOutcome(two).pass, true, '2 bombs: the round still counts on its food');
}
ok('Catch: a bomb is −3 and a strike; 3 strikes end the round as a FAIL; bombs are not food');

{
  let t: CatchTally = EMPTY_CATCH;
  t = catchFood(t, 0, false);
  t = catchFood(t, 300, false);
  t = catchFood(t, 600, false); // 3rd quick catch: +1
  assert.equal(t.points, 4, 'a combo of 3 quick catches = +1');
  t = catchFood(t, 5000, false); // chain broken
  assert.equal(t.chain, 1);
  const golden = catchFood(EMPTY_CATCH, 0, true);
  assert.equal(golden.points, CATCH.goldenPoints, 'golden food = +3');
  assert.equal(golden.caught, 1, 'but one food for the %');
  assert.ok(catchSpawnGapMs(0) === 450 && catchSpawnGapMs(CATCH.roundMs) === 250, 'spawns speed up 450 → 250 ms');
  assert.ok(catchSpeedMult(CATCH.roundMs) === 1.8, 'falls up to ×1.8 faster');
  assert.equal(catchSpawnKind(1000, 0.01), 'golden', 'no bombs in the first 3s');
  assert.equal(catchSpawnKind(5000, 0.01), 'bomb');
  let bombs = 0;
  let golds = 0;
  let s = 3;
  for (let i = 0; i < 100_000; i += 1) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const k = catchSpawnKind(10_000, s / 4294967296);
    if (k === 'bomb') bombs += 1;
    if (k === 'golden') golds += 1;
  }
  assert.ok(Math.abs(bombs / 100_000 - 0.15) < 0.01, '15% bombs');
  assert.ok(Math.abs(golds / (100_000 - bombs) - 0.05) < 0.01, '5% of food is golden');
}
ok('Catch: combo +1 every 3rd quick catch; golden +3; spawns and falls speed up; 15% bombs after 3s');

/* --------------------------------------------------------------- Train --- */

{
  let t: TrainTally = START_TRAIN;
  for (let i = 0; i < 8; i += 1) t = trainTap(t, true);
  for (let i = 0; i < 2; i += 1) t = trainTap(t, false);
  assert.equal(t.over, false, 'two misses in a row: still going');
  t = trainTap(t, false);
  assert.equal(t.over, true, '3 misses in a row end the round');
  assert.deepEqual(trainOutcome(t), { pass: true, quality: 8 / 15, got: 8, of: 15 }, '8 hits pass');
  let seven: TrainTally = START_TRAIN;
  for (let i = 0; i < 15; i += 1) seven = trainTap(seven, i % 2 === 0 && i < 14);
  assert.equal(seven.hits, 7);
  assert.equal(trainOutcome(seven).pass, false, '7 hits fail');
  let zone: TrainTally = START_TRAIN;
  for (let i = 0; i < 15; i += 1) zone = trainTap(zone, true);
  assert.ok(Math.abs(zone.zone - TRAIN.zoneMin) < 1e-9 || zone.zone > TRAIN.zoneMin, 'the zone shrinks…');
  assert.ok(zone.zone >= TRAIN.zoneMin, '…never below 12%');
  assert.ok(zone.speed > START_TRAIN.speed, 'the marker speeds up');
  assert.equal(zone.over, true, '15 taps end the round');
}
ok('Train: 15 taps, pass = 8+ hits, 3 misses in a row end it, the zone shrinks (min 12%)');

/* -------------------------------------------- mashing can't be skilled --- */

{
  // Random taps: a hit is as likely as the zone is wide.
  let s = 11;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  let passes = 0;
  let skilled = 0;
  const N = 20_000;
  for (let i = 0; i < N; i += 1) {
    let t: TrainTally = START_TRAIN;
    while (!t.over) t = trainTap(t, rnd() < t.zone);
    const o = trainOutcome(t);
    if (o.pass) passes += 1;
    if (roundSkillPoints(o) === 25) skilled += 1;
  }
  assert.ok(passes / N < 0.02, `mashing Train rarely passes (${((passes / N) * 100).toFixed(2)}%)`);
  assert.ok(skilled / N < 0.001, `and almost never reaches 70% (${((skilled / N) * 100).toFixed(3)}%)`);
  assert.equal(roundSkillPoints({ pass: true, quality: 0.7 }), 25, 'a pass with 70%+ is skilled');
  assert.equal(roundSkillPoints({ pass: true, quality: 0.55 }), 12, 'a plain pass');
  assert.equal(roundSkillPoints({ pass: false, quality: 0.49 }), 0, 'a fail gives nothing');
  // Egg care: without a skilled round Perfect is out of reach.
  const EGG = PET_STAGE_MS.egg;
  const noSkill = careScore({ warmMs: EGG, eggMs: EGG, skill: 12, acts: CARE_ACT.fed | CARE_ACT.trained | CARE_ACT.dived });
  assert.equal(careBand(noSkill), 'great', `warm + a plain pass + every activity = ${noSkill} (Great), not Perfect`);
  assert.equal(careBand(careScore({ warmMs: EGG * 0.9, eggMs: EGG, skill: 25, acts: CARE_ACT.fed | CARE_ACT.dived })), 'perfect');
}
ok('mashing: Train passes < 2% and is almost never skilled; Perfect still needs a 70%+ round');

/* ------------------------------------------------------ fail pays nothing --- */

{
  const egg = chooseEggDoc(defaultPlayStore(0), 0, 'knight', null)!;
  const baby = { ...egg, pet: { ...egg.pet, stage: 'baby' as const, stage_age_ms: 0, seen_at: 0 } };
  const fail = finishPetRound(baby, 1000, 'catch', { pass: false, quality: 0.3, got: 3, of: 10 });
  assert.equal(fail.result.counted, false);
  assert.equal(fail.result.tokensGranted, 0, 'a fail pays nothing');
  assert.equal(fail.doc.pet.care_skill, 0, 'and gives no care');
  assert.equal(fail.doc.pet.hunger, baby.pet.hunger, 'and no food');
  const pass = finishPetRound(baby, 1000, 'catch', { pass: true, quality: 0.75, got: 15, of: 20 });
  assert.equal(pass.result.counted, true);
  assert.equal(pass.doc.pet.care_skill, 25, 'a 75% pass is skilled');
}
ok('a fail pays nothing (no tokens, care or food); a pass counts as before');

console.log(`\ncheck:pet-games — ${passed} groups passed.`);
