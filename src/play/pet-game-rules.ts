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
  comboGapMs: 700,
  comboEvery: 3,
  goldenPoints: 3,
} as const;

export function catchSpawnGapMs(elapsedMs: number): number {
  const t = Math.max(0, Math.min(1, elapsedMs / CATCH.roundMs));
  return Math.round(CATCH.spawnStartMs + (CATCH.spawnEndMs - CATCH.spawnStartMs) * t);
}

export function catchSpeedMult(elapsedMs: number): number {
  const t = Math.max(0, Math.min(1, elapsedMs / CATCH.roundMs));
  return 1 + (CATCH.speedEndMult - 1) * t;
}

export type SpawnKind = 'food' | 'golden' | 'bomb';

/** What a spawn is, from one 0..1 draw. */
export function catchSpawnKind(elapsedMs: number, u: number): SpawnKind {
  if (elapsedMs >= CATCH.bombFromMs && u < CATCH.bombShare) return 'bomb';
  const v = elapsedMs >= CATCH.bombFromMs ? (u - CATCH.bombShare) / (1 - CATCH.bombShare) : u;
  return v < CATCH.goldenShare ? 'golden' : 'food';
}

export type CatchTally = {
  caught: number;
  missed: number;
  points: number;
  strikes: number;
  chain: number;
  lastCatchAt: number | null;
  /** 3 strikes: the round is over. */
  over: boolean;
};

export const EMPTY_CATCH: CatchTally = { caught: 0, missed: 0, points: 0, strikes: 0, chain: 0, lastCatchAt: null, over: false };

export function catchFood(t: CatchTally, atMs: number, golden: boolean): CatchTally {
  if (t.over) return t;
  const chain = t.lastCatchAt != null && atMs - t.lastCatchAt < CATCH.comboGapMs ? t.chain + 1 : 1;
  const combo = chain % CATCH.comboEvery === 0 ? 1 : 0;
  return {
    ...t,
    caught: t.caught + 1,
    points: t.points + (golden ? CATCH.goldenPoints : 1) + combo,
    chain,
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

export type TrainTally = { taps: number; hits: number; missStreak: number; zone: number; speed: number; over: boolean };

export const START_TRAIN: TrainTally = {
  taps: 0,
  hits: 0,
  missStreak: 0,
  zone: TRAIN.zoneStart,
  speed: TRAIN.speedStart,
  over: false,
};

export function trainTap(t: TrainTally, hit: boolean): TrainTally {
  if (t.over) return t;
  const taps = t.taps + 1;
  const hits = t.hits + (hit ? 1 : 0);
  const missStreak = hit ? 0 : t.missStreak + 1;
  return {
    taps,
    hits,
    missStreak,
    zone: hit ? Math.max(TRAIN.zoneMin, t.zone - TRAIN.zoneShrink) : t.zone,
    speed: hit ? t.speed * TRAIN.speedUp : t.speed,
    over: taps >= TRAIN.taps || missStreak >= TRAIN.missStreakEnd,
  };
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
