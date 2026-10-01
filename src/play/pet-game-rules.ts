/**
 * Mini-game rules (v25, 2026-09-30) — pure, so the screen and `check:pet-games`
 * share one source. Both games can now be FAILED; only a pass counts.
 *
 * Catch the food (Fruit Ninja style), 25s:
 *   - spawns every 450ms at the start down to 250ms at the end; falls up to
 *     ×1.8 faster by the end;
 *   - 💣 15% of spawns after the first 3s — tapping one: −3 points, a flash,
 *     a strike; 3 strikes end the round;
 *   - golden food 5% of food: +3 points (still 1 food for the pass %);
 *   - combo: catches < 0.7s apart chain; every 3rd in a chain +1 point;
 *   - PASS = caught ≥ 50% of the food that finished falling (caught or
 *     missed; food still in the air at the end doesn't count) — and a round
 *     ended by 3 bombs is always a FAIL (no bomb-out shortcut).
 *
 * Tap to train, 15 taps:
 *   - the lit zone starts at 30% of the bar and shrinks 1.5 points per hit
 *     (min 12%); the marker is 6% faster after each hit;
 *   - 3 misses in a row end the round;
 *   - PASS = 8+ hits out of 15 (≥ 50%).
 *
 * A pass = feeding / training + care + tokens as before; a fail = nothing.
 * Egg care: a pass with 70%+ is a skilled round.
 *
 * v26 (Part C) — Fruit Ninja / Guitar Hero style:
 *   - 4 difficulties. NORMAL is exactly the v25 round above; Easy is gentler,
 *     Hard and Insane faster with more bombs / a smaller zone, and a bigger
 *     score multiplier. Pass / fail is the same share rule on every level.
 *   - a combo MULTIPLIER replaces the old "+1 every 3rd quick catch": the
 *     streak (catches / hits in a row) climbs ×1 → ×2 → ×3 → ×5; a miss or a
 *     bomb resets it. There is no time gap any more — only a miss breaks it.
 *   - score: Catch 1 a food, 3 a golden, −3 a bomb, times the combo; Train 10 a
 *     hit (+5 for a perfect hit in the middle of the zone), times the combo.
 *     The round's score is that × the difficulty multiplier.
 *   - a seeded rng (`seededRng`) gives the daily challenge one fixed pattern
 *     per local date.
 */

export type RoundOutcome = {
  pass: boolean;
  /** 0..1: the share caught / hit. */
  quality: number;
  /** For the result line: caught or hits. */
  got: number;
  /** For the result line: food that fell, or 15 taps. */
  of: number;
  /** Catch: bombs tapped (3 = the round ended on bombs). */
  bombs?: number;
};

export const PASS_SHARE = 0.5;
export const SKILL_SHARE = 0.7;

/* ------------------------------------------------ v26 difficulties --- */

export const DIFFICULTIES = ['easy', 'normal', 'hard', 'insane'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
  insane: 'Insane',
};

/** Score multiplier per game and level. Train's climbs more steeply: a harder
 * Train round tends to end early (3 misses in a row), so its multiplier has
 * to outrun that for Hard to score above Normal (sim:games). */
export const SCORE_MULT: Record<'catch' | 'train', Record<Difficulty, number>> = {
  catch: { easy: 1, normal: 1.5, hard: 2, insane: 3 },
  train: { easy: 1, normal: 1.5, hard: 2.5, insane: 4 },
};

/** Combo steps: the streak at which the multiplier becomes ×2, ×3, ×5. */
export const COMBO_MULTS = [1, 2, 3, 5] as const;
export const COMBO_STEPS: Record<'catch' | 'train', readonly [number, number, number]> = {
  catch: [5, 10, 20],
  train: [3, 6, 10],
};

/** The combo multiplier for a streak. */
export function comboMult(game: 'catch' | 'train', streak: number): number {
  const [a, b, c] = COMBO_STEPS[game];
  return streak >= c ? COMBO_MULTS[3] : streak >= b ? COMBO_MULTS[2] : streak >= a ? COMBO_MULTS[1] : COMBO_MULTS[0];
}

/** A small seeded rng (mulberry32 over an FNV-1a hash of the seed text). */
export function seededRng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The daily challenge seed: the same pattern for everyone on that date. */
export function dailySeed(ymd: string, game: 'catch' | 'train'): string {
  return `divecore-daily:${ymd}:${game}`;
}

/* ------------------------------------------------------ Catch the food --- */

export const CATCH = {
  roundMs: 25_000,
  spawnStartMs: 450,
  spawnEndMs: 250,
  speedEndMult: 1.8,
  bombShare: 0.15,
  bombFromMs: 3_000,
  goldenShare: 0.05,
  bombPenalty: 3,
  bombStrikes: 3,
  goldenPoints: 3,
} as const;

/** v26: what changes per level (Normal = the CATCH values above). */
export type CatchLevel = { spawnStartMs: number; spawnEndMs: number; speedEndMult: number; bombShare: number };
export const CATCH_LEVELS: Record<Difficulty, CatchLevel> = {
  easy: { spawnStartMs: 550, spawnEndMs: 350, speedEndMult: 1.5, bombShare: 0.08 },
  normal: { spawnStartMs: CATCH.spawnStartMs, spawnEndMs: CATCH.spawnEndMs, speedEndMult: CATCH.speedEndMult, bombShare: CATCH.bombShare },
  hard: { spawnStartMs: 380, spawnEndMs: 200, speedEndMult: 2.1, bombShare: 0.2 },
  insane: { spawnStartMs: 320, spawnEndMs: 160, speedEndMult: 2.4, bombShare: 0.25 },
};

export function catchSpawnGapMs(elapsedMs: number, level: Difficulty = 'normal'): number {
  const L = CATCH_LEVELS[level];
  const t = Math.max(0, Math.min(1, elapsedMs / CATCH.roundMs));
  return Math.round(L.spawnStartMs + (L.spawnEndMs - L.spawnStartMs) * t);
}

export function catchSpeedMult(elapsedMs: number, level: Difficulty = 'normal'): number {
  const t = Math.max(0, Math.min(1, elapsedMs / CATCH.roundMs));
  return 1 + (CATCH_LEVELS[level].speedEndMult - 1) * t;
}

export type SpawnKind = 'food' | 'golden' | 'bomb';

/** What a spawn is, from one 0..1 draw. */
export function catchSpawnKind(elapsedMs: number, u: number, level: Difficulty = 'normal'): SpawnKind {
  const bombShare = CATCH_LEVELS[level].bombShare;
  if (elapsedMs >= CATCH.bombFromMs && u < bombShare) return 'bomb';
  const v = elapsedMs >= CATCH.bombFromMs ? (u - bombShare) / (1 - bombShare) : u;
  return v < CATCH.goldenShare ? 'golden' : 'food';
}

export type CatchTally = {
  caught: number;
  missed: number;
  points: number;
  strikes: number;
  /** The streak: catches in a row (a miss or a bomb resets it). */
  chain: number;
  /** Best streak this round. */
  bestChain: number;
  lastCatchAt: number | null;
  /** 3 strikes: the round is over. */
  over: boolean;
};

export const EMPTY_CATCH: CatchTally = {
  caught: 0,
  missed: 0,
  points: 0,
  strikes: 0,
  chain: 0,
  bestChain: 0,
  lastCatchAt: null,
  over: false,
};

export function catchFood(t: CatchTally, atMs: number, golden: boolean): CatchTally {
  if (t.over) return t;
  const chain = t.chain + 1;
  return {
    ...t,
    caught: t.caught + 1,
    points: t.points + (golden ? CATCH.goldenPoints : 1) * comboMult('catch', chain),
    chain,
    bestChain: Math.max(t.bestChain, chain),
    lastCatchAt: atMs,
  };
}

export function missFood(t: CatchTally): CatchTally {
  return t.over ? t : { ...t, missed: t.missed + 1, chain: 0 };
}

export function tapBomb(t: CatchTally): CatchTally {
  if (t.over) return t;
  const strikes = t.strikes + 1;
  return { ...t, points: t.points - CATCH.bombPenalty, strikes, chain: 0, over: strikes >= CATCH.bombStrikes };
}

export function catchOutcome(t: CatchTally): RoundOutcome {
  const fell = t.caught + t.missed;
  const quality = fell > 0 ? t.caught / fell : 0;
  const bombedOut = t.strikes >= CATCH.bombStrikes;
  return { pass: !bombedOut && fell > 0 && quality >= PASS_SHARE, quality, got: t.caught, of: fell, bombs: t.strikes };
}

/** v26: the round's score (never below 0) at a level. */
export function catchScore(t: CatchTally, level: Difficulty = 'normal'): number {
  return Math.max(0, Math.round(t.points * SCORE_MULT.catch[level]));
}

/* -------------------------------------------------------- Tap to train --- */

export const TRAIN = {
  taps: 15,
  zoneStart: 0.3,
  zoneShrink: 0.015,
  zoneMin: 0.12,
  speedStart: 0.9,
  speedUp: 1.06,
  missStreakEnd: 3,
  passHits: 8,
} as const;

/** v26: what changes per level (Normal = the TRAIN values above). */
export type TrainLevel = { zoneStart: number; zoneShrink: number; zoneMin: number; speedStart: number; speedUp: number };
export const TRAIN_LEVELS: Record<Difficulty, TrainLevel> = {
  easy: { zoneStart: 0.36, zoneShrink: 0.01, zoneMin: 0.16, speedStart: 0.8, speedUp: 1.04 },
  normal: {
    zoneStart: TRAIN.zoneStart,
    zoneShrink: TRAIN.zoneShrink,
    zoneMin: TRAIN.zoneMin,
    speedStart: TRAIN.speedStart,
    speedUp: TRAIN.speedUp,
  },
  hard: { zoneStart: 0.26, zoneShrink: 0.015, zoneMin: 0.1, speedStart: 1.0, speedUp: 1.07 },
  insane: { zoneStart: 0.22, zoneShrink: 0.015, zoneMin: 0.08, speedStart: 1.1, speedUp: 1.08 },
};
/** A hit this close to the zone's middle (share of the zone width) is perfect. */
export const TRAIN_PERFECT_SHARE = 0.2;
export const TRAIN_HIT_POINTS = 10;
export const TRAIN_PERFECT_POINTS = 5;

export type TrainTally = {
  taps: number;
  hits: number;
  missStreak: number;
  zone: number;
  speed: number;
  over: boolean;
  /** v26: hits in a row (the combo), best of the round, points, perfects. */
  streak: number;
  bestStreak: number;
  points: number;
  perfects: number;
};

export function startTrain(level: Difficulty = 'normal'): TrainTally {
  return {
    taps: 0,
    hits: 0,
    missStreak: 0,
    zone: TRAIN_LEVELS[level].zoneStart,
    speed: TRAIN_LEVELS[level].speedStart,
    over: false,
    streak: 0,
    bestStreak: 0,
    points: 0,
    perfects: 0,
  };
}

export const START_TRAIN: TrainTally = startTrain('normal');

export function trainTap(t: TrainTally, hit: boolean, level: Difficulty = 'normal', perfect = false): TrainTally {
  if (t.over) return t;
  const L = TRAIN_LEVELS[level];
  const taps = t.taps + 1;
  const hits = t.hits + (hit ? 1 : 0);
  const missStreak = hit ? 0 : t.missStreak + 1;
  const streak = hit ? t.streak + 1 : 0;
  const isPerfect = hit && perfect;
  return {
    taps,
    hits,
    missStreak,
    zone: hit ? Math.max(L.zoneMin, t.zone - L.zoneShrink) : t.zone,
    speed: hit ? t.speed * L.speedUp : t.speed,
    over: taps >= TRAIN.taps || missStreak >= TRAIN.missStreakEnd,
    streak,
    bestStreak: Math.max(t.bestStreak, streak),
    points: hit
      ? t.points + (TRAIN_HIT_POINTS + (isPerfect ? TRAIN_PERFECT_POINTS : 0)) * comboMult('train', streak)
      : t.points,
    perfects: t.perfects + (isPerfect ? 1 : 0),
  };
}

/** v26: the round's score at a level. */
export function trainScore(t: TrainTally, level: Difficulty = 'normal'): number {
  return Math.round(t.points * SCORE_MULT.train[level]);
}

export function trainOutcome(t: TrainTally): RoundOutcome {
  const quality = t.hits / TRAIN.taps;
  return { pass: t.hits >= TRAIN.passHits, quality, got: t.hits, of: TRAIN.taps };
}

/** "Caught 23/38 (61%) · PASS". */
export function outcomeLine(kind: 'catch' | 'train', o: RoundOutcome): string {
  const pct = Math.round(o.quality * 100);
  return `${kind === 'catch' ? 'Caught' : 'Hit'} ${o.got}/${o.of} (${pct}%) · ${o.pass ? 'PASS' : 'FAIL'}`;
}
