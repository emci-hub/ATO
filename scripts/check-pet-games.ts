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
import {
  CATCH_LEVELS,
  DIFFICULTIES,
  SCORE_MULT,
  TRAIN_LEVELS,
  catchScore,
  comboMult,
  dailySeed,
  seededRng,
  startTrain,
  trainScore,
} from '../src/play/pet-game-rules';
import {
  DAILY_BONUS_SHELLS,
  MEDAL_SCORES,
  RANK_TITLES,
  emptyRecords,
  levelUnlocked,
  medalFor,
  rankIndex,
  rankTitle,
  recordDaily,
  recordRound,
  unlockHint,
  EMPTY_DAILY,
} from '../src/play/game-records';

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
  // v26: the combo is a streak multiplier (×1 → ×2 at 5 → ×3 at 10 → ×5 at
  // 20); only a miss or a bomb breaks it — time gaps no longer do.
  for (let i = 0; i < 5; i += 1) t = catchFood(t, i * 5000, false);
  assert.equal(t.points, 4 + 2, 'four catches at ×1, the 5th at ×2');
  assert.equal(t.chain, 5, 'slow catches still keep the streak');
  t = missFood(t);
  assert.equal(t.chain, 0, 'a miss resets it');
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
ok('Catch: the streak combo (v26); golden +3; spawns and falls speed up; 15% bombs after 3s');

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


/* ============================================== v26 — Part C games ===== */

{
  // Normal is exactly the v25 round.
  assert.deepEqual(CATCH_LEVELS.normal, {
    spawnStartMs: CATCH.spawnStartMs,
    spawnEndMs: CATCH.spawnEndMs,
    speedEndMult: CATCH.speedEndMult,
    bombShare: CATCH.bombShare,
  });
  assert.equal(TRAIN_LEVELS.normal.zoneStart, TRAIN.zoneStart);
  assert.equal(TRAIN_LEVELS.normal.zoneMin, TRAIN.zoneMin);
  assert.equal(TRAIN_LEVELS.normal.speedUp, TRAIN.speedUp);
  assert.deepEqual(startTrain('normal'), START_TRAIN);
  // Harder = faster, more bombs, smaller zone, bigger multiplier.
  for (let i = 1; i < DIFFICULTIES.length; i += 1) {
    const lo = DIFFICULTIES[i - 1];
    const hi = DIFFICULTIES[i];
    assert.ok(CATCH_LEVELS[hi].spawnEndMs < CATCH_LEVELS[lo].spawnEndMs, `${hi}: spawns faster`);
    assert.ok(CATCH_LEVELS[hi].bombShare > CATCH_LEVELS[lo].bombShare, `${hi}: more bombs`);
    assert.ok(TRAIN_LEVELS[hi].zoneStart < TRAIN_LEVELS[lo].zoneStart, `${hi}: smaller zone`);
    assert.ok(SCORE_MULT.catch[hi] > SCORE_MULT.catch[lo] && SCORE_MULT.train[hi] > SCORE_MULT.train[lo], `${hi}: bigger multiplier`);
    for (let m = 0; m < 3; m += 1) {
      assert.ok(MEDAL_SCORES.catch[hi][m] >= MEDAL_SCORES.catch[lo][m], `catch ${hi} medal bars rise`);
      assert.ok(MEDAL_SCORES.train[hi][m] >= MEDAL_SCORES.train[lo][m], `train ${hi} medal bars rise`);
    }
  }
  assert.equal(catchSpawnGapMs(0, 'insane'), CATCH_LEVELS.insane.spawnStartMs);
  assert.equal(catchSpawnKind(5000, 0.2, 'insane'), 'bomb', '25% bombs on Insane');
  assert.equal(catchSpawnKind(5000, 0.2, 'normal'), 'food', 'not on Normal');
}
ok('levels: Normal = the v25 round exactly; each harder level is faster, has more bombs / a smaller zone, a bigger multiplier, and higher medal bars');

{
  assert.deepEqual([0, 4, 5, 9, 10, 19, 20, 99].map((n) => comboMult('catch', n)), [1, 1, 2, 2, 3, 3, 5, 5]);
  assert.deepEqual([0, 2, 3, 5, 6, 9, 10].map((n) => comboMult('train', n)), [1, 1, 2, 2, 3, 3, 5]);
  let t = EMPTY_CATCH;
  for (let i = 0; i < 6; i += 1) t = catchFood(t, i, false);
  t = tapBomb(t);
  assert.equal(t.chain, 0, 'a bomb resets the combo');
  assert.equal(t.bestChain, 6);
  assert.equal(catchScore(t, 'normal'), Math.round((4 + 2 * 2 - 3) * 1.5), 'score = points × level multiplier');
  assert.equal(catchScore(tapBomb(EMPTY_CATCH), 'hard'), 0, 'a score is never below 0');
  let tr = startTrain('normal');
  for (let i = 0; i < 3; i += 1) tr = trainTap(tr, true, 'normal', i === 2);
  assert.equal(tr.points, 10 + 10 + (10 + 5) * 2, 'hits 10, a perfect +5, the 3rd in a row ×2');
  tr = trainTap(tr, false);
  assert.equal(tr.streak, 0, 'a miss resets the Train combo');
  assert.equal(trainScore(tr, 'hard'), Math.round(tr.points * SCORE_MULT.train.hard));
}
ok('combo: ×1 → ×2 → ×3 → ×5 by streak (Catch 5/10/20, Train 3/6/10); a miss or bomb resets it; score = points × level');

{
  // Pass / fail is the share rule on every level — nothing about the level changes it.
  for (const level of DIFFICULTIES) {
    let t = EMPTY_CATCH;
    for (let i = 0; i < 10; i += 1) t = catchFood(t, i, false);
    for (let i = 0; i < 10; i += 1) t = missFood(t);
    assert.equal(catchOutcome(t).pass, true, `${level}: 50% passes`);
    let tr = startTrain(level);
    for (let i = 0; i < TRAIN.taps; i += 1) tr = trainTap(tr, i % 2 === 0, level);
    assert.equal(trainOutcome(tr).pass, true, `${level}: 8 hits pass`);
  }
  // Easy can't farm the egg care score: 70%+ on Easy is a plain pass.
  const egg = chooseEggDoc(defaultPlayStore(0), 0, 'knight', null)!;
  const baby = { ...egg, pet: { ...egg.pet, stage: 'baby' as const, stage_age_ms: 0, seen_at: 0 } };
  const great = { pass: true, quality: 0.9, got: 18, of: 20 };
  const easy = finishPetRound(baby, 1000, 'catch', great, { level: 'easy', score: 50, daily: false });
  assert.equal(easy.doc.pet.care_skill, 12, 'Easy 90%: a plain pass (12), never skilled');
  const normal = finishPetRound(baby, 1000, 'catch', great, { level: 'normal', score: 50, daily: false });
  assert.equal(normal.doc.pet.care_skill, 25, 'Normal 90%: skilled (25) as before');
  const insane = finishPetRound(baby, 1000, 'catch', great, { level: 'insane', score: 500, daily: false });
  assert.equal(insane.doc.pet.care_skill, 25, 'Insane never gives more than Normal');
  assert.equal(easy.result.tokensGranted, normal.result.tokensGranted, 'tokens are the same on every level');
}
ok('care: pass/fail unchanged on every level; only Normal+ can be skilled (Easy can’t farm care); harder never gives more care');

{
  let r = emptyRecords();
  assert.deepEqual(DIFFICULTIES.map((d) => levelUnlocked(r, 'catch', d)), [true, true, false, false], 'a new save: Easy + Normal open');
  assert.equal(unlockHint('hard'), 'Get Silver on Normal to unlock');
  assert.equal(unlockHint('insane'), 'Get Gold on Hard to unlock');
  const [, silver, gold] = MEDAL_SCORES.catch.normal;
  const failed = recordRound(r, 'catch', 'normal', gold + 100, false);
  assert.equal(failed.records, r, 'a failed round sets nothing');
  const bronze = recordRound(r, 'catch', 'normal', MEDAL_SCORES.catch.normal[0], true);
  assert.equal(bronze.medal, 'bronze');
  assert.equal(levelUnlocked(bronze.records, 'catch', 'hard'), false, 'Bronze does not open Hard');
  const sil = recordRound(bronze.records, 'catch', 'normal', silver, true);
  assert.equal(sil.unlocked, 'hard', 'Silver on Normal opens Hard');
  assert.equal(sil.newRecord, true);
  assert.equal(sil.prevBest, MEDAL_SCORES.catch.normal[0]);
  assert.equal(levelUnlocked(sil.records, 'train', 'hard'), false, 'per game');
  const lower = recordRound(sil.records, 'catch', 'normal', 1, true);
  assert.equal(lower.records.catch.normal.best, silver, 'a lower score never lowers the best');
  assert.equal(lower.records.catch.normal.medal, 'silver', 'nor the medal');
  assert.equal(lower.newRecord, false);
  assert.equal(levelUnlocked(sil.records, 'catch', 'insane'), false);
  const hardGold = recordRound(sil.records, 'catch', 'hard', MEDAL_SCORES.catch.hard[2], true);
  assert.equal(hardGold.unlocked, 'insane', 'Gold on Hard opens Insane');
  r = hardGold.records;
  assert.equal(rankTitle(r, 'catch'), RANK_TITLES.catch[2], 'Silver Normal + Gold Hard = third rank');
  assert.equal(rankIndex(emptyRecords(), 'train'), 0);
  const top = recordRound(r, 'catch', 'insane', MEDAL_SCORES.catch.insane[2], true);
  assert.equal(top.rankUp, true);
  assert.equal(rankTitle(top.records, 'catch'), 'Legendary Chef');
  assert.equal(medalFor('train', 'normal', 99_999, false), null, 'no medal without a pass');
  // A locked level (e.g. after Reset Divecore) earns no record, medal or buff.
  const egg = chooseEggDoc(defaultPlayStore(0), 0, 'knight', null)!;
  const child = { ...egg, pet: { ...egg.pet, stage: 'child' as const, stage_age_ms: 0, seen_at: 0 } };
  const locked = finishPetRound(child, 1000, 'catch', { pass: true, quality: 0.9, got: 18, of: 20 }, { level: 'insane', score: 9999, daily: false });
  assert.equal(locked.result.counted, true, 'it still counts as a pass (care, tokens)');
  assert.equal(locked.result.medal, null, 'but no medal on a locked level');
  assert.equal(locked.doc.game_records.catch.insane.best, 0, 'and no record');
  assert.equal(locked.doc.buffs.hearty, 0, 'and no buff');
}
ok('records: best only rises; medals by score (pass only); Hard needs Silver on Normal, Insane Gold on Hard, per game; ranks from medals');

{
  const a = seededRng(dailySeed('2026-09-30', 'catch'));
  const b = seededRng(dailySeed('2026-09-30', 'catch'));
  const seqA = Array.from({ length: 50 }, a);
  assert.deepEqual(seqA, Array.from({ length: 50 }, b), 'the same date = the same pattern');
  const other = Array.from({ length: 50 }, seededRng(dailySeed('2026-10-01', 'catch')));
  assert.notDeepEqual(seqA, other, 'the next day is a new pattern');
  const train = Array.from({ length: 50 }, seededRng(dailySeed('2026-09-30', 'train')));
  assert.notDeepEqual(seqA, train, 'each game has its own');
  assert.ok(seqA.every((x) => x >= 0 && x < 1));

  let d = { ...EMPTY_DAILY };
  const first = recordDaily(d, '2026-09-30', 'catch', 40, true);
  assert.equal(first.bonusShells, DAILY_BONUS_SHELLS, 'beating your daily best the first time today: the bonus');
  d = first.daily;
  const again = recordDaily(d, '2026-09-30', 'catch', 60, true);
  assert.equal(again.newBest, true);
  assert.equal(again.bonusShells, 0, 'only once a day');
  const lowerDaily = recordDaily(again.daily, '2026-09-30', 'catch', 10, true);
  assert.equal(lowerDaily.newBest, false, 'replays only count when better');
  const failDaily = recordDaily(again.daily, '2026-09-30', 'catch', 999, false);
  assert.equal(failDaily.newBest, false, 'a failed daily round counts for nothing');
  const rewound = recordDaily(again.daily, '2026-09-29', 'catch', 999, true);
  assert.equal(rewound.bonusShells, 0, 'setting the clock back does not reopen a day');
  const tomorrow = recordDaily(again.daily, '2026-10-01', 'catch', 5, true);
  assert.equal(tomorrow.bonusShells, DAILY_BONUS_SHELLS, 'a new day: a new best and a new bonus');
  assert.equal(recordDaily(again.daily, '2026-09-30', 'train', 5, true).bonusShells, DAILY_BONUS_SHELLS, 'per game');
}
ok('daily challenge: one fixed pattern per date and game; best only rises; bonus once a day per game; clock-back safe');

console.log(`\ncheck:pet-games — ${passed} groups passed.`);
