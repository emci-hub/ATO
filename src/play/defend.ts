/**
 * Defend — board engine (Play steps 5a/5b, GAME_SPEC §9, §9b; GAME_DATA tower
 * upgrade).
 *
 * PURE simulation — no React, no AsyncStorage. The screen owns a timer and
 * feeds `dtMs` into `stepDefendLive`. Enemies walk the path, leak at the exit
 * = fail, towers auto-fire within range, kills grant scrap, and a clean wave
 * is a win. Tower placement / upgrade / retry are pure transitions here too.
 *
 * Map: ONE path, viewBox 0 0 100 100, spawn left → two bends → exit right.
 * Six tower pads sit near the path. No hero drag / skill in this step (5c).
 *
 * Stat note: GAME_DATA fully defines only `tower_archer` (base wave_power 0.6,
 * tower_speed 1.1; level_cost_scrap [0,40,90]; level_mult_wave_power
 * [1.0,1.25,1.55]). Vine / crystal base attack + range and the enemy base HP
 * are NOT in the defs yet — the numbers below are clearly-commented
 * placeholders tuned so wave 1 is clearable with ~2 towers from the 80 scrap,
 * and stay one-line changes once the real defs land.
 */

/* ------------------------------------------------------------------ path --- */
export type DefendWaypoint = { x: number; y: number };

/** Grove Path — spawn left/top → 2 bends → exit right/bottom (leak). */
export const DEFEND_PATH: readonly DefendWaypoint[] = [
  { x: 0, y: 0.2 }, // spawn, left edge
  { x: 0.52, y: 0.2 }, // bend 1
  { x: 0.52, y: 0.6 }, // bend 2
  { x: 1, y: 0.6 }, // exit / leak
] as const;

const PATH_LENGTH = DEFEND_PATH.slice(1).reduce(
  (length, point, index) =>
    length + Math.hypot(point.x - DEFEND_PATH[index].x, point.y - DEFEND_PATH[index].y),
  0,
);

/* ---------------------------------------------------------------- enemies --- */
/** Puff pink base HP (placeholder — enemy def not in GAME_DATA yet). */
export const PUFF_BASE_HP = 40;
/** Puffs walk this fraction of the whole path per second (base speed). */
export const PUFF_SPEED_PER_SEC = 0.06;
/** One kill grants this much scrap (GAME_SPEC §9c `scrap_kill` default 3). */
export const SCRAP_PER_KILL = 3;

export function waveEnemyCount(wave: number): number {
  return Math.floor(6 + wave * 1.2);
}
export function waveHpMult(wave: number): number {
  return 1 + (wave - 1) * 0.12;
}
export function waveSpeedMult(wave: number): number {
  return 1 + Math.max(0, wave - 10) * 0.02;
}

/* ----------------------------------------------------------------- towers --- */
export type TowerKind = 'archer' | 'vine' | 'crystal';

export type TowerDef = {
  kind: TowerKind;
  name: string;
  /** Damage per hit before level mult and the equipped wave_power bucket. */
  baseAttack: number;
  /** Base cooldown before the equipped tower_speed bucket (GAME_SPEC §9b). */
  cooldownMs: number;
  /** Soft range circle, board units (0..100 space). */
  range: number;
  /** Scrap to build on an empty pad (GAME_SPEC §9: enough for ~2 at 80). */
  placeCost: number;
  /** Scrap to reach each level: index 0 = base, then 40, 90 (GAME_DATA). */
  levelCostScrap: readonly number[];
  /** Wave-power mult per level (GAME_DATA level_mult_wave_power). */
  levelMultWavePower: readonly number[];
  /** Vine only: slow the target this much for `slowMs` on hit. */
  slowPct?: number;
  slowMs?: number;
};

export const TOWER_MAX_LEVEL = 3;

/** Placeholder stats: archer from GAME_DATA; vine/crystal tuned to its spec
 * role (stall / chunk) until the defs land. One-line changes later. */
export const TOWER_DEFS: Record<TowerKind, TowerDef> = {
  archer: {
    kind: 'archer',
    name: 'Archer',
    baseAttack: 15,
    cooldownMs: 900,
    range: 18,
    placeCost: 40,
    levelCostScrap: [0, 40, 90],
    levelMultWavePower: [1.0, 1.25, 1.55],
  },
  vine: {
    kind: 'vine',
    name: 'Vine',
    baseAttack: 10,
    cooldownMs: 1100,
    range: 16,
    placeCost: 40,
    levelCostScrap: [0, 40, 90],
    levelMultWavePower: [1.0, 1.25, 1.55],
    slowPct: 0.7,
    slowMs: 1000,
  },
  crystal: {
    kind: 'crystal',
    name: 'Crystal',
    baseAttack: 26,
    cooldownMs: 1400,
    range: 20,
    placeCost: 40,
    levelCostScrap: [0, 40, 90],
    levelMultWavePower: [1.0, 1.25, 1.55],
  },
};

/** Six tower pads, board coordinates (0..100), hugging the path so every road
 * segment sits within a tower's range. Positions: two cover the top run (spawn
 * → bend 1), two the vertical, two the bottom run → exit (leak). */
export const DEFEND_PADS: readonly DefendWaypoint[] = [
  { x: 12, y: 10 },
  { x: 38, y: 10 },
  { x: 52, y: 26 },
  { x: 52, y: 54 },
  { x: 76, y: 70 },
  { x: 92, y: 56 },
] as const;

export type Puff = {
  id: number;
  /** Path progress 0..1. */
  dist: number;
  hp: number;
  maxHp: number;
  /** ms of remaining slow; while > 0 the puff moves at slowPct speed. */
  slowMs: number;
};

export type Tower = {
  id: number;
  pad: number; // index into DEFEND_PADS
  kind: TowerKind;
  level: number; // 1..3
  /** ms until the next shot; decremented each tick. */
  cooldownMs: number;
};

export type DefendLive = {
  wave: number;
  puffs: Puff[];
  pendingSpawns: number;
  spawnCooldownMs: number;
  nextId: number;
  towers: Tower[];
  scrap: number;
};

export type DefendStep = {
  state: DefendLive;
  /** An enemy reached the exit this tick → fail. */
  leak: boolean;
  /** Wave finished cleanly (all spawned dead, none leaked) → win. */
  done: boolean;
};

export const DEFEND_SPAWN_INTERVAL_MS = 850;
export const DEFEND_TICK_MS = 100;

export function createDefendLive(wave: number, scrap = 80): DefendLive {
  return {
    wave: Math.max(1, Math.floor(wave)),
    puffs: [],
    pendingSpawns: waveEnemyCount(wave),
    spawnCooldownMs: 0,
    nextId: 0,
    towers: [],
    scrap,
  };
}

/**
 * Retry after a fail keeps the tower layout (GAME_SPEC §9) and resets the
 * enemy queue + scrap to the run start, so Retry is always playable.
 */
export function retryDefendLive(state: DefendLive): DefendLive {
  return {
    ...createDefendLive(state.wave),
    towers: state.towers.map((tower) => ({ ...tower, cooldownMs: 0 })),
  };
}

/* ---------------------------------------------------------------- combat --- */
type DefendBuckets = { wavePower: number; towerSpeed: number };

/** Place a tower on an empty pad, deducting scrap. Null when blocked. */
export function placeTower(
  state: DefendLive,
  pad: number,
  kind: TowerKind,
): DefendLive | null {
  const def = TOWER_DEFS[kind];
  if (state.scrap < def.placeCost) return null;
  if (state.towers.some((tower) => tower.pad === pad)) return null;
  return {
    ...state,
    scrap: state.scrap - def.placeCost,
    towers: [
      ...state.towers,
      { id: state.nextId, pad, kind, level: 1, cooldownMs: 0 },
    ],
    nextId: state.nextId + 1,
  };
}

/** Upgrade a tower one level, deducting scrap. Null when blocked. */
export function upgradeTower(
  state: DefendLive,
  towerId: number,
): DefendLive | null {
  const tower = state.towers.find((t) => t.id === towerId);
  if (!tower || tower.level >= TOWER_MAX_LEVEL) return null;
  const cost = TOWER_DEFS[tower.kind].levelCostScrap[tower.level] ?? 0;
  if (state.scrap < cost) return null;
  return {
    ...state,
    scrap: state.scrap - cost,
    towers: state.towers.map((t) =>
      t.id === towerId ? { ...t, level: t.level + 1 } : t,
    ),
  };
}

/** The scrap cost to upgrade this tower to its next level (0 at cap). */
export function towerUpgradeCost(tower: Tower): number {
  if (tower.level >= TOWER_MAX_LEVEL) return 0;
  return TOWER_DEFS[tower.kind].levelCostScrap[tower.level] ?? 0;
}

/** Distance in board units between a pad and a puff's current position. */
function padPuffDist(pad: DefendWaypoint, dist: number): number {
  const pos = puffPosition(dist);
  return Math.hypot(pos.x * 100 - pad.x, pos.y * 100 - pad.y);
}

/**
 * Advance the live run by `dtMs`: spawns, movement (slow applied), tower fire,
 * kills → scrap, leak and done flags. `buckets` carries the equipped
 * wave_power / tower_speed multipliers from playStore.
 */
export function stepDefendLive(
  state: DefendLive,
  dtMs: number,
  buckets: DefendBuckets,
): DefendStep {
  const speedBase =
    (PUFF_SPEED_PER_SEC * waveSpeedMult(state.wave) * dtMs) / 1000;
  const hp = PUFF_BASE_HP * waveHpMult(state.wave);

  let pendingSpawns = state.pendingSpawns;
  let spawnCooldownMs = state.spawnCooldownMs - dtMs;
  let nextId = state.nextId;
  let puffs = state.puffs;
  let scrap = state.scrap;

  // Spawns.
  if (pendingSpawns > 0 && spawnCooldownMs <= 0) {
    puffs = [...puffs, { id: nextId++, dist: 0, hp, maxHp: hp, slowMs: 0 }];
    pendingSpawns -= 1;
    spawnCooldownMs = DEFEND_SPAWN_INTERVAL_MS;
  }

  // Movement (slowed puffs crawl at their type's slowPct).
  puffs = puffs.map((puff) => {
    const slow = puff.slowMs > 0 ? TOWER_DEFS.vine.slowPct ?? 1 : 1;
    const slowMs = Math.max(0, puff.slowMs - dtMs);
    return { ...puff, dist: puff.dist + speedBase * slow, slowMs };
  });

  // Towers fire.
  const towerSpeedBucket = Math.max(0.1, buckets.towerSpeed);
  const firedTowers: Tower[] = [];
  for (const tower of state.towers) {
    let cooldownMs = tower.cooldownMs - dtMs;
    if (cooldownMs <= 0) {
      const target = acquireTarget(tower, puffs);
      if (target) {
        const def = TOWER_DEFS[tower.kind];
        const damage =
          def.baseAttack *
          def.levelMultWavePower[tower.level - 1] *
          buckets.wavePower;
        puffs = applyHit(puffs, target.id, damage, def);
        if (puffs.some((p) => p.id === target.id && p.hp <= 0)) {
          scrap += SCRAP_PER_KILL;
          puffs = puffs.filter((p) => p.id !== target.id);
        }
        cooldownMs = def.cooldownMs / towerSpeedBucket;
      } else {
        cooldownMs = 0; // idle: retry next tick
      }
    }
    firedTowers.push({ ...tower, cooldownMs });
  }

  const leak = puffs.some((puff) => puff.dist >= 1);

  return {
    state: {
      wave: state.wave,
      puffs,
      pendingSpawns,
      spawnCooldownMs,
      nextId,
      towers: firedTowers,
      scrap,
    },
    leak,
    done: pendingSpawns === 0 && puffs.length === 0,
  };
}

/** Pick the tower's target per §9b: archer/vine first-toward-exit (max dist);
 * crystal highest current HP. In range only. */
function acquireTarget(tower: Tower, puffs: Puff[]): Puff | null {
  const range = TOWER_DEFS[tower.kind].range;
  const pad = DEFEND_PADS[tower.pad];
  const inRange = puffs.filter((puff) => padPuffDist(pad, puff.dist) <= range);
  if (inRange.length === 0) return null;
  if (tower.kind === 'crystal') {
    return inRange.reduce((a, b) => (b.hp > a.hp ? b : a));
  }
  return inRange.reduce((a, b) => (b.dist > a.dist ? b : a));
}

/** Subtract damage; vine also (re)applies its slow. Returns a new array. */
function applyHit(puffs: Puff[], targetId: number, damage: number, def: TowerDef): Puff[] {
  return puffs.map((puff) => {
    if (puff.id !== targetId) return puff;
    return {
      ...puff,
      hp: puff.hp - damage,
      slowMs: def.slowMs ? def.slowMs : puff.slowMs,
    };
  });
}

/**
 * A puff at path progress `dist` (0..1) → its board position (0..1 space,
 * same as `DEFEND_PATH`). Multiply by the SVG viewBox (100) to render.
 */
export function puffPosition(dist: number): { x: number; y: number } {
  const clamped = Math.max(0, Math.min(1, dist));
  const target = clamped * PATH_LENGTH;
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
