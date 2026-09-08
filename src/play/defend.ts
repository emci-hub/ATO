/**
 * Defend — board skeleton engine (Play step 5a, GAME_SPEC §9 map + wave
 * formula + fail/win + wave ladder; GAME_DATA defend run defaults).
 *
 * PURE simulation only — no React, no AsyncStorage. The screen owns a timer
 * and feeds `dtMs` into `stepDefendLive`; puffs walk the path, leak at the
 * exit = fail, wave spawns its whole count, and a wave with no leaks and no
 * remaining spawns is done (win — unreachable for real until towers exist in
 * 5b, which is why the Dev kit has a Win button this step).
 *
 * The map: ONE path, viewBox 0 0 100 100, spawn at the left → two bends →
 * exit on the right (leak). No towers / no hero drag in this step.
 */
export type DefendWaypoint = { x: number; y: number };

/** Grove Path — spawn left/top → 2 bends → exit right/bottom (leak). */
export const DEFEND_PATH: readonly DefendWaypoint[] = [
  { x: 0, y: 0.2 }, // spawn, left edge
  { x: 0.52, y: 0.2 }, // bend 1
  { x: 0.52, y: 0.6 }, // bend 2
  { x: 1, y: 0.6 }, // exit / leak
] as const;

/** Whole path length in the same normalized units (dx/dy as-is). */
const PATH_LENGTH = DEFEND_PATH.slice(1).reduce(
  (length, point, index) =>
    length + Math.hypot(point.x - DEFEND_PATH[index].x, point.y - DEFEND_PATH[index].y),
  0,
);

/** Wave composition (GAME_SPEC §9 wave formula). */
export function waveEnemyCount(wave: number): number {
  return Math.floor(6 + wave * 1.2);
}
export function waveHpMult(wave: number): number {
  return 1 + (wave - 1) * 0.12;
}
export function waveSpeedMult(wave: number): number {
  return 1 + Math.max(0, wave - 10) * 0.02;
}

/** Base walk speed: fraction of the whole path per second at wave ≤ 10. */
const PUFF_SPEED_PER_SEC = 0.06;

/** Time between spawns while a wave is starting. */
export const DEFEND_SPAWN_INTERVAL_MS = 850;

/** Screen tick cadence — puffs advance in these slices. */
export const DEFEND_TICK_MS = 100;

export type Puff = { id: number; dist: number };

/**
 * Live run state. `phase` is kept by the screen; the engine only mutates
 * `puffs`, the spawn queue, and their scheduling.
 */
export type DefendLive = {
  wave: number;
  /** Puffs currently on the path (dist is 0..1 progress). */
  puffs: Puff[];
  /** Whole enemies not yet spawned this wave. */
  pendingSpawns: number;
  /** ms until the next spawn fires. */
  spawnCooldownMs: number;
  /** Monotonic id source for puffs. */
  nextId: number;
};

export type DefendStep = {
  state: DefendLive;
  /** An enemy reached the exit this tick → fail. */
  leak: boolean;
  /** Wave is finished cleanly (all spawned, none left) → win. */
  done: boolean;
};

export function createDefendLive(wave: number): DefendLive {
  return {
    wave: Math.max(1, Math.floor(wave)),
    puffs: [],
    pendingSpawns: waveEnemyCount(wave),
    spawnCooldownMs: 0,
    nextId: 0,
  };
}

/**
 * Advance the live run by `dtMs`. Spawns fire while the queue is non-empty,
 * every `DEFEND_SPAWN_INTERVAL_MS`; puffs move by their wave speed. A puff
 * crossing dist ≥ 1 sets `leak`. When the queue is empty and the path is clear,
 * `done` is set. Returns the next state plus both flags (they are not part of
 * the state so the screen decides phase transitions, e.g. keep the frozen
 * board under a fail overlay).
 */
export function stepDefendLive(state: DefendLive, dtMs: number): DefendStep {
  const step = (PUFF_SPEED_PER_SEC * waveSpeedMult(state.wave) * dtMs) / 1000;

  let pendingSpawns = state.pendingSpawns;
  let spawnCooldownMs = state.spawnCooldownMs - dtMs;
  let nextId = state.nextId;
  let puffs = state.puffs;

  if (pendingSpawns > 0 && spawnCooldownMs <= 0) {
    puffs = [...puffs, { id: nextId++, dist: 0 }];
    pendingSpawns -= 1;
    spawnCooldownMs = DEFEND_SPAWN_INTERVAL_MS;
  }

  puffs = puffs.map((puff) => ({ ...puff, dist: puff.dist + step }));
  const leak = puffs.some((puff) => puff.dist >= 1);

  return {
    state: {
      wave: state.wave,
      puffs,
      pendingSpawns,
      spawnCooldownMs,
      nextId,
    },
    leak,
    done: pendingSpawns === 0 && puffs.length === 0,
  };
}

/**
 * A puff at path progress `dist` (0..1) → its position on the board (0..1
 * coordinates, same space as `DEFEND_PATH`). Renders multiply by the SVG
 * viewBox (100).
 */
export function puffPosition(dist: number): { x: number; y: number } {
  const clamped = Math.max(0, Math.min(1, dist));
  const total = PATH_LENGTH;
  const target = clamped * total;
  let travelled = 0;
  for (let i = 0; i < DEFEND_PATH.length - 1; i++) {
    const from = DEFEND_PATH[i];
    const to = DEFEND_PATH[i + 1];
    const segment = Math.hypot(to.x - from.x, to.y - from.y);
    if (travelled + segment >= target) {
      const t = segment === 0 ? 0 : (target - travelled) / segment;
      return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
    }
    travelled += segment;
  }
  const end = DEFEND_PATH[DEFEND_PATH.length - 1];
  return { x: end.x, y: end.y };
}
