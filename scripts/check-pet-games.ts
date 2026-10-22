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
import { readFileSync } from 'node:fs';

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

import * as rules from '../src/play/pet-game-rules';
import * as recs from '../src/play/game-records';

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
  assert.equal(normal.result.tokensGranted, insane.result.tokensGranted, 'Normal and harder pay the same tokens');
  assert.equal(easy.result.tokensGranted, 2, 'Easy pays 2 tokens a round (Minigames M1)');
  assert.equal(normal.result.tokensGranted, 5, 'Normal pays 5');
  // Six Easy passes cannot fill the daily cap of 30.
  let farm = baby as typeof easy.doc;
  let farmPaid = 0;
  for (let i = 0; i < 6; i += 1) {
    const r = finishPetRound(farm, 1000 + i, 'catch', great, { level: 'easy', score: 50, daily: false }, `farm:${i}`);
    farm = r.doc;
    farmPaid += r.result.tokensGranted;
  }
  assert.equal(farmPaid, 12, 'six Easy passes pay 12, not the 30 cap');
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

{
  // Minigames M1 (2026-10-22): the screen pins. Source reads, like the other check:* scripts.
  const games = readFileSync('src/play/pet-games.tsx', 'utf8');
  const screen = readFileSync('src/play/pet-screen.tsx', 'utf8');
  assert.ok(!games.includes('💣</Text>') && /function BombShape/.test(games), 'the bomb is a shape with an X, not the emoji');
  assert.ok(/<Polygon points=\{STAR_POINTS\}/.test(games), 'golden food is a star (shape cue beside the colour)');
  assert.ok(/if \(spawned \|\| missed \+ dodged > 0\) setItems\(next\)/.test(games), 'the field is not re-rendered every tick (the fall is a shared value)');
  assert.ok(/y\.value = withTiming\(1\.05/.test(games), 'each item falls on the UI thread');
  assert.ok(/markerSv\.value = p/.test(games) && !/setMarker\(/.test(games), 'the Train marker is a shared value, not state');
  assert.ok(/bombTimer\.current = setTimeout/.test(games) && /clearTimeout\(bombTimer\.current\)/.test(games), 'the bomb-flash timer is cleared on unmount');
  assert.ok(/const countdown = useCountdown\(\)/.test(games) && /\[playing\]/.test(games), 'both rounds start their clock after a 3-2-1');
  assert.ok(/function RoundCard/.test(games) && /onContinue/.test(games), 'a result card waits for Continue');
  assert.ok(/!still\) \{\s*\n\s*juice\.play\(\);\s*\n\s*alertHaptic\(\)/.test(games), 'haptics are off with Reduce Motion / Effects Off');
  assert.ok(/statusLine: \{[^}]*minHeight/.test(games), 'the status line keeps a full line of height (Larger Text)');
  assert.ok(/setRoundCard\(\{/.test(screen) && /afterRound\.current = after/.test(screen), 'the room shows the card, then runs the sheet / notices on Continue');
}
ok('Minigames M1: bomb + star shapes, UI-thread fall and marker, 3-2-1, result card on Continue, haptics gated by still, bomb timer cleared');

{
  // Minigames M2 (2026-10-22): the look. Art is named through the library tree, never a loose path or the old placeholders.
  const games = readFileSync('src/play/pet-games.tsx', 'utf8');
  const screen = readFileSync('src/play/pet-screen.tsx', 'utf8');
  for (const id of ['pizza', 'donut', 'burger', 'star', 'bomb']) {
    assert.ok(new RegExp(`ART\\.icon\\.streetwear\\.${id}\\b`).test(games), `${id} is a Streetwear library sprite`);
  }
  assert.ok(/ART\.prop\.streetwear\.punchingBag/.test(games), 'the Train dummy is the Streetwear punching bag');
  assert.ok(!/scribble-dungeons|CRATE_ART|PLAY_ART/.test(games), 'no off-style scribble crate');
  assert.ok(/ROOM\.hideout\.back/.test(games) && /ROOM\.hideout\.floor/.test(games), 'Catch wears the Hideout room');
  assert.ok(!/MOCKUP_DIVE|BubbleRing|CausticWash/.test(games), 'Catch no longer wears the reef plate, bubbles or caustics');
  assert.ok(!/styles\.glow, \{ backgroundColor/.test(games), 'no flat tinted square: the glow is a radial pool');
  assert.ok(/<GradeAura /.test(games) && /<ShinyOverlay /.test(games) && /auraElement=\{gp\.auraElement/.test(games), 'the pet shows its real aura / finish / shiny ring');
  assert.ok(/lockColour=\{gp\.shiny === true\}/.test(games) && /reduceMotion=\{still\}/.test(games), 'a shiny keeps its colour; the finish rests under Reduce Motion');
  assert.ok(/play\('hurt', 'e'\)/.test(games) && /item\.kind === 'golden' \? 'skill' : 'dash'/.test(games) && /perfect \? 'skill' : 'attack'/.test(games), 'happy (skill clip) and oof (hurt clip) come from existing clips');
  assert.ok(/auraElement: view\.swords\.equipped/.test(screen) && /grade: revealed \? pet\.grade : null/.test(screen), 'the pet room hands the games the real look');
  assert.ok(/hint: \{ textAlign: 'center', minHeight: pixelBodyLine\(PIXEL_CAPTION_PT\) \* 2 \}/.test(games), 'the hint stays two lines (fixed regions)');
  assert.ok(!/Ã|â€|ðŸ/.test(games), 'pet-games.tsx is clean UTF-8 (no double-encoded x, dash or bomb characters)');
  assert.ok(/!pose && want === 'skill'/.test(games), 'a pet with no skill clip still moves for the happy beat');
  assert.ok(/const s = Math\.max\(1, width \/ CATCH_ROOM_W\)/.test(games), 'the Catch room scales uniformly on a wide stage');
}
ok('Minigames M2: Streetwear food / bomb / dummy sprites, Hideout room behind Catch, real aura + finish on the pet, happy / oof from existing clips');

{
  // Minigames M3 (2026-10-22): power-ups are score-only, the Train zone modes keep the lit width, Lane dash + practice.
  const {
    POWERUP,
    DASH_LANES,
    catchPowerKind,
    magnetFood,
    trainZoneMode,
    trainZoneSegments,
    trainZoneHit,
    dashReaches,
    dashSpawnKind,
    dashSpawnGapMs,
    dashOutcome,
    dashScore,
    DASH_LEVELS,
  } = rules;

  // Power-ups: a pickup only from 4 s, ~5% of food spawns, half shield / half magnet.
  assert.equal(catchPowerKind(POWERUP.fromMs - 1, 0), null, 'no pickups in the first seconds');
  assert.equal(catchPowerKind(5000, 0.01), 'shield');
  assert.equal(catchPowerKind(5000, 0.03), 'magnet');
  assert.equal(catchPowerKind(5000, 0.5), null);
  const rng = seededRng('m3-powerups');
  let picks = 0;
  for (let i = 0; i < 4000; i += 1) if (catchPowerKind(10_000, rng())) picks += 1;
  assert.ok(picks / 4000 > 0.03 && picks / 4000 < 0.07, `about 5% pickups (${picks / 4000})`);
  // Magnet food scores but counts as NOT caught: it can never lift the pass share, so it cannot pass a round or farm tokens.
  let mt: CatchTally = EMPTY_CATCH;
  for (let i = 0; i < 40; i += 1) mt = magnetFood(mt, i % 5 === 0);
  assert.equal(mt.caught, 0);
  assert.equal(mt.missed, 40);
  assert.equal(mt.chain, 0);
  assert.ok(mt.points > 0, 'but it scores');
  assert.equal(catchOutcome(mt).pass, false, 'a round of only magnet food is still a FAIL');
  for (const caught of [3, 7, 10]) {
    let base: CatchTally = EMPTY_CATCH;
    for (let i = 0; i < caught; i += 1) base = catchFood(base, i * 2000, false);
    for (let i = 0; i < 10; i += 1) base = missFood(base);
    // The same round where 4 of the misses were pulled by the magnet instead: same share, never higher.
    let pulled: CatchTally = base;
    for (let i = 0; i < 4; i += 1) pulled = magnetFood({ ...pulled, missed: pulled.missed - 1 }, false);
    assert.ok(catchOutcome(pulled).quality <= catchOutcome(base).quality + 1e-9, 'the magnet never raises the share');
    assert.equal(catchOutcome(pulled).pass, catchOutcome(base).pass);
    assert.ok(pulled.points > base.points, 'but scores more');
  }

  // Train zones: never wider than the single zone; split = two halves; easy stays single.
  for (const level of DIFFICULTIES) {
    assert.equal(trainZoneMode(level, 0), 'single', `${level}: the first tap is always the plain zone`);
  }
  assert.equal(trainZoneMode('easy', 14), 'single');
  assert.equal(trainZoneMode('normal', 9), 'single');
  assert.equal(trainZoneMode('normal', 10), 'moving');
  assert.equal(trainZoneMode('hard', 5), 'moving');
  assert.equal(trainZoneMode('hard', 10), 'split');
  assert.equal(trainZoneMode('insane', 3), 'moving');
  for (const mode of ['single', 'moving', 'split'] as const) {
    for (const w of [0.3, 0.12, 0.08]) {
      for (const base of [0.1, 0.5, 0.9]) {
        for (const phase of [0, 600, 1200, 1800]) {
          const segs = trainZoneSegments(mode, base, w, phase);
          assert.equal(segs.length, mode === 'split' ? 2 : 1);
          assert.ok(Math.abs(segs.reduce((s, z) => s + z.width, 0) - w) < 1e-9, `${mode}: the lit width stays ${w}`);
          for (const z of segs) assert.ok(z.center - z.width / 2 >= -1e-9 && z.center + z.width / 2 <= 1 + 1e-9, 'inside the bar');
        }
      }
    }
  }
  const two = trainZoneSegments('split', 0.5, 0.3, 0);
  assert.equal(trainZoneHit(two, two[1].center).hit, true, 'either half is a hit');
  assert.equal(trainZoneHit(two, 0.5).hit, false, 'the gap between the halves is a miss');
  assert.equal(trainZoneHit(trainZoneSegments('single', 0.5, 0.3, 0), 0.5).perfect, true, 'the middle is perfect');

  // Lane dash: only the pet's lane, inside the catch band; Catch's pass rule and combo; its own level table.
  assert.equal(DASH_LANES, 3);
  assert.equal(dashReaches(1, 1, 0.8), true);
  assert.equal(dashReaches(0, 1, 0.8), false, 'another lane is not caught');
  assert.equal(dashReaches(1, 1, 0.3), false, 'not before the band');
  assert.equal(dashReaches(1, 1, 1.0), false, 'not after the band');
  let dt: CatchTally = EMPTY_CATCH;
  for (let i = 0; i < 6; i += 1) dt = catchFood(dt, i * 100, false);
  for (let i = 0; i < 4; i += 1) dt = missFood(dt);
  assert.equal(dashOutcome(dt).pass, true, '6 of 10 passes');
  assert.equal(dashScore(dt, 'normal'), Math.round(dt.points * SCORE_MULT.dash.normal));
  assert.equal(dashOutcome(tapBomb(tapBomb(tapBomb(dt)))).pass, false, 'a bomb-out is a FAIL');
  for (let i = 1; i < DIFFICULTIES.length; i += 1) {
    const a = DASH_LEVELS[DIFFICULTIES[i - 1]];
    const b = DASH_LEVELS[DIFFICULTIES[i]];
    assert.ok(b.spawnStartMs < a.spawnStartMs && b.speedEndMult > a.speedEndMult && b.bombShare > a.bombShare, 'each level is faster with more bombs');
  }
  assert.ok(dashSpawnGapMs(0) > dashSpawnGapMs(25_000), 'spawns speed up');
  let bombs = 0;
  const dr = seededRng('dash-bombs');
  for (let i = 0; i < 4000; i += 1) if (dashSpawnKind(10_000, dr(), 'normal') === 'bomb') bombs += 1;
  assert.ok(Math.abs(bombs / 4000 - DASH_LEVELS.normal.bombShare) < 0.03, 'Normal bombs match the level table');
  for (const level of DIFFICULTIES) {
    const [b, s, g] = recs.MEDAL_SCORES.dash[level];
    assert.ok(b < s && s < g, `dash ${level}: bronze < silver < gold`);
  }

  // Records: Dash is a third key inside the SAME game_records shape; an older save (no dash) opens with empty defaults.
  assert.deepEqual(Object.keys(emptyRecords()), ['catch', 'train', 'dash']);
  const old = recs.parseRecords({ catch: { easy: { best: 9, medal: 'gold' } }, train: {} });
  assert.equal(old.catch.easy.best, 9, 'old catch record survives');
  assert.deepEqual(old.dash.normal, { best: 0, medal: null }, 'dash starts empty');
  assert.deepEqual(recs.parseDaily({ ymd: '2026-10-01', catch: { best: 3, bonus: true } }).dash, { best: 0, bonus: false });
  assert.equal(rankTitle(emptyRecords(), 'dash'), 'Sidestepper');
  assert.equal(RANK_TITLES.dash.length, 4);

  // Dash pays like any pass: 5 tokens (Easy 2), trains the pet, 30 a day cap, records under its own key.
  const egg = chooseEggDoc(defaultPlayStore(0), 0, 'knight', null)!;
  const child = { ...egg, pet: { ...egg.pet, stage: 'child' as const, stage_age_ms: 0, seen_at: 0 } };
  const pass = { pass: true, quality: 0.8, got: 16, of: 20 };
  const normalDash = finishPetRound(child, 1000, 'dash', pass, { level: 'normal', score: 60, daily: false }, 'dash:1');
  assert.equal(normalDash.result.tokensGranted, 5);
  assert.equal(normalDash.doc.game_records.dash.normal.best, 60, 'recorded under dash');
  assert.equal(normalDash.doc.game_records.catch.normal.best, 0, 'catch untouched');
  const easyDash = finishPetRound(child, 1000, 'dash', pass, { level: 'easy', score: 60, daily: false }, 'dash:2');
  assert.equal(easyDash.result.tokensGranted, 2, 'Easy Dash pays 2 like Easy Catch');
  let farm = child as typeof easyDash.doc;
  let paid = 0;
  for (let i = 0; i < 20; i += 1) {
    const r = finishPetRound(farm, 1000 + i, 'dash', pass, { level: 'normal', score: 60, daily: false }, `dash-farm:${i}`);
    farm = r.doc;
    paid += r.result.tokensGranted;
  }
  assert.equal(paid, 30, 'Dash shares the 30-token daily cap');
  assert.equal(finishPetRound(child, 1000, 'dash', { pass: false, quality: 0.2, got: 2, of: 10 }).result.tokensGranted, 0, 'a fail pays nothing');
  assert.equal(defaultPlayStore(0).version, 33, 'the save stays v33 (additive key inside game_records)');

  // Screen: practice never reports a round; Reduce Motion keeps the zone still; Lane dash is a full game.
  const games = readFileSync('src/play/pet-games.tsx', 'utf8');
  const screen = readFileSync('src/play/pet-screen.tsx', 'utf8');
  const sheets = readFileSync('src/play/pet-sheets.tsx', 'utf8');
  assert.ok(/if \(!practice && left <= 0\) finish\(\)/.test(games), 'Catch practice has no clock');
  assert.ok(/next\.over && !practice/.test(games) && /practice \? \{ \.\.\.hit, strikes: 0, over: false \}/.test(games), 'Catch practice has no strikes');
  assert.ok(/practice\s*\n?\s*\? \{ \.\.\.tapped, over: false, taps: 0, missStreak: 0/.test(games), 'Train practice never ends or ramps');
  assert.ok(/!practice && \(left <= 0 \|\| t\.over\)/.test(games), 'Dash practice has no clock or strikes');
  assert.equal((games.match(/onDoneRef\.current\(/g) ?? []).length, 3, 'one report per game, each behind finish() / the over check');
  assert.ok(/const finishRound[^\n]*\n[^\n]*\n\s*if \(run\.practice\) return;/.test(screen), 'finishRound drops a practice report (nothing is counted)');
  assert.ok(/baseRef = useRef<number>\(-1\);\s*\n\s*if \(baseRef\.current < 0\)/.test(games), 'the seeded Train zone takes one draw, not one per render');
  assert.ok(/stillRef\.current/.test(games), 'the Train drift reads Reduce Motion live');
  assert.ok(/practice\?: boolean/.test(sheets) && /practice: true/.test(sheets), 'the Play and Feed cards offer Practice');
  assert.ok(/modeRef\.current === 'moving' && !still/.test(games), 'the drifting zone holds still under Reduce Motion');
  assert.ok(/function LaneDashGame/.test(games) && /kind === 'dash' \? <LaneDashGame/.test(games), 'Lane dash is mounted by the host');
  assert.ok(/ART\.icon\.streetwear\.shield\b/.test(games) && /function PowerShape/.test(games), 'the shield is a library sprite; the magnet a drawn shape');
  assert.ok(/function PowerChips/.test(games) && /powerChips: \{ position: 'absolute'/.test(games), 'the power-up chips are a float layer (no region resizes)');
  assert.ok(/<PowerChips /.test(games) && /<ComboStrip game="dash"/.test(games), 'the new overlays are mounted');
  assert.ok(/g="dash"/.test(sheets), 'the Play sheet has the Lane dash card');
  assert.ok(!/Ã|â€|ðŸ/.test(games), 'pet-games.tsx stays clean UTF-8');
}
ok('Minigames M3: power-ups are score-only, Train zone waves keep the lit width, Lane dash (own key, same pass/token rules), practice reports nothing');

console.log(`\ncheck:pet-games — ${passed} groups passed.`);
