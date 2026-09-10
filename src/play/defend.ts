/**
 * Defend — board engine (Play steps 5a/5b/5c + Phase B campaign, GAME_SPEC §9,
 * §9b, §9d, §9e; GAME_DATA tower upgrade).
 *
 * PURE simulation — no React, no AsyncStorage. The screen owns a timer and
 * feeds `dtMs` into `stepDefendLive`. Enemies walk the path, leak at the exit
 * = fail, towers auto-fire within range, kills grant scrap, and a clean wave
 * is a win. Tower placement / upgrade / retry are pure transitions here too.
 * The Avatar (step 5c) auto-attacks the nearest enemy in range and its skill
 * (slow_pulse) is a pure transition that slows everything in radius.
 *
 * Maps (Phase B — GAME_SPEC §9e): the Trial map reuses the original Grove
 * Path (one path, spawn left → two bends → exit right); the Main campaign map
 * lives in `data/maps/divecore_main.json` (a longer S-curve + chokes). Both
 * are `DefendMap`s of waypoints (0..1 board fractions) + six tower pads
 * (0..100 board units). A `DefendLive` carries its own `mapId`, so one screen
 * can switch maps between waves without global state. No SakPix — placeholder
 * circles only.
 *
 * Forever engine (Phase B): a conquered cycle raises `cyclePower`
 * (1 + conquered × tune step, `CycleScaler` in `engine/cycle.ts`). Each live
 * run carries its cycle power, which scales enemy spawn COUNT and base HP on
 * the next run (GAME_SPEC §9e) — wave speed and rewards are untouched here.
 *
 * Stat note: GAME_DATA fully defines only `tower_archer` (base wave_power 0.6,
 * tower_speed 1.1; level_cost_scrap [0,40,90]; level_mult_wave_power
 * [1.0,1.25,1.55]). Vine / crystal base attack + range, the enemy base HP, and
 * the Avatar's base attack + range are NOT in the defs yet — the numbers below
 * are clearly-commented placeholders tuned so wave 1 is clearable, and stay
 * one-line changes once the real defs land. Boss bands (Scout/Semi/Final) are
 * a later phase — waves 9/10/19/20 are plain formula waves here.
 */

import {
  avatarLevelWavePower,
  avatarStarWavePower,
  DEFAULT_CYCLE_TINT,
} from '@/play/playStore';
import { bossBandFor, type BossBand } from '@/play/engine/bands';
import {
  boundBossStarDamage,
  boundBossStarSkillCdScale,
  getBoundBossDef,
  type BoundBossDef,
} from '@/play/engine/bound-boss';
import { type TypeTag } from '@/play/engine/type-match';
import { getTune } from '@/play/tune';

import rawMainMap from './data/maps/divecore_main.json';

/* ------------------------------------------------------------------ maps --- */
export type DefendMapId = 'trial' | 'main';

export type DefendWaypoint = { x: number; y: number };

/** One board: the road the puffs walk (waypoints 0..1) + six tower pads
 * (board units 0..100). Content-driven — new maps are new JSON, no engine. */
export type DefendMap = {
  id: DefendMapId;
  /** Player-facing map name. */
  name: string;
  path: readonly DefendWaypoint[];
  pads: readonly DefendWaypoint[];
};

/** Trial map = the original Grove Path (spawn left → 2 bends → exit right). */
export const TRIAL_MAP: DefendMap = {
  id: 'trial',
  name: 'Grove Path',
  path: [
    { x: 0, y: 0.2 }, // spawn, left edge
    { x: 0.52, y: 0.2 }, // bend 1
    { x: 0.52, y: 0.6 }, // bend 2
    { x: 1, y: 0.6 }, // exit / leak
  ],
  pads: [
    { x: 12, y: 10 },
    { x: 38, y: 10 },
    { x: 52, y: 26 },
    { x: 52, y: 54 },
    { x: 76, y: 70 },
    { x: 92, y: 56 },
  ],
};

/** Loose read of the Main map JSON; any malformed row falls back to the Trial
 * geometry so a bad content file can never crash the board. */
function parseMapJson(raw: unknown): DefendMap | null {
  if (typeof raw !== 'object' || raw == null) return null;
  const row = raw as Record<string, unknown>;
  const id = row.id;
  if (id !== 'main') return null;
  const name = typeof row.name === 'string' && row.name.length > 0 ? row.name : 'Divecore Main';
  const path = Array.isArray(row.path)
    ? row.path.filter(isWaypoint)
    : [];
  const pads = Array.isArray(row.pads)
    ? row.pads.filter(isWaypoint)
    : [];
  if (path.length < 2 || pads.length === 0) return null;
  return { id, name, path, pads };
}

function isWaypoint(value: unknown): value is DefendWaypoint {
  if (typeof value !== 'object' || value == null) return false;
  const point = value as Record<string, unknown>;
  return (
    typeof point.x === 'number' &&
    Number.isFinite(point.x) &&
    typeof point.y === 'number' &&
    Number.isFinite(point.y)
  );
}

const parsedMain = parseMapJson(rawMainMap);
/** Main campaign map — Divecore Main (longer S-curve + chokes). */
export const MAIN_MAP: DefendMap =
  parsedMain ?? { id: 'main', name: 'Divecore Main', path: TRIAL_MAP.path, pads: TRIAL_MAP.pads };

/** All board geometry, keyed by map id. `DefendLive.mapId` picks one. */
export const DEFEND_MAPS: Record<DefendMapId, DefendMap> = {
  trial: TRIAL_MAP,
  main: MAIN_MAP,
};

const lengthCache = new WeakMap<DefendMap, number>();
/** Total road length (0..1 units) for one map — cached per map object. */
function mapPathLength(map: DefendMap): number {
  const cached = lengthCache.get(map);
  if (cached != null) return cached;
  const length = map.path.slice(1).reduce(
    (total, point, index) =>
      total + Math.hypot(point.x - map.path[index].x, point.y - map.path[index].y),
    0,
  );
  lengthCache.set(map, length);
  return length;
}

/* ---------------------------------------------------------------- enemies --- */
/** Puff pink base HP (placeholder — enemy def not in GAME_DATA yet). */
export const PUFF_BASE_HP = 40;
/** Puffs walk this fraction of the whole path per second (base speed). */
export const PUFF_SPEED_PER_SEC = 0.06;
/** Runners (boss pack / late-Main pressure) move this much faster than a puff. */
export const RUNNER_SPEED_MULT = 1.25;

/* ----------------------------------------------------------------- Avatar --- */
/** Avatar base attack (placeholder — def not in GAME_DATA). */
export const AVATAR_BASE_ATTACK = 12;
/** Avatar auto-attack radius, board units (0..100 space). */
export const AVATAR_RANGE = 15;

/** Starter skill — slow_pulse "Root Veil" (GAME_SPEC §9d / GAME_DATA). Live
 * slow strength + cooldown read the tune doc; these are the Sane copy/defs. */
export const SKILL_NAME = 'Root Veil';
export const SKILL_DESCRIPTION = 'Vines slow nearby foes for a short breath.';
export const SKILL_COOLDOWN_MS = 12_000; // §9d cooldown 12 (≥10s, Sane)
export const SKILL_SLOW_MS = 2_000; // duration 2.0
export const SKILL_RADIUS = 24; // §9d radius 90 art-px → ~24 board units

/**
 * Puff count for `wave`, scaled by this run's `cyclePower` (GAME_SPEC §9e —
 * a conquered cycle makes the NEXT run fatter, not the current one). §9
 * formula `floor(6 + wave × count_per_level)`, then × cycle power. The hard
 * 20 cap (§5c: if FPS dips, cut count first) is the perf bound and stays LAST,
 * so count scaling saturates on late-Main waves and `cycle_power` keeps
 * scaling there through puff HP (`stepDefendLive`).
 */
export function waveEnemyCount(wave: number, cyclePower: number = 1): number {
  const perLevel = getTune().waveCountPerLevel;
  const base = Math.floor(6 + Math.max(1, Math.floor(wave)) * perLevel);
  const scaled = base * Math.max(1, cyclePower);
  return Math.min(20, Math.max(1, Math.round(scaled)));
}
export function waveHpMult(wave: number): number {
  return 1 + (wave - 1) * getTune().waveHpPerLevel;
}
export function waveSpeedMult(wave: number): number {
  return 1 + Math.max(0, wave - 10) * 0.02;
}

/* ------------------------------------------------------------ difficulty --- */
export type DefendDifficulty = 'Easy' | 'Moderate' | 'Hard' | 'Brutal';

/** Player-facing difficulty band from the wave number (display only). */
export function defendDifficulty(wave: number): DefendDifficulty {
  if (wave <= 3) return 'Easy';
  if (wave <= 8) return 'Moderate';
  if (wave <= 15) return 'Hard';
  return 'Brutal';
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

export type PuffKind = 'puff' | 'runner' | 'boss';

export type Puff = {
  id: number;
  /** Path progress 0..1. */
  dist: number;
  hp: number;
  maxHp: number;
  /** ms of remaining slow; while > 0 the puff moves at `slowFactor` speed. */
  slowMs: number;
  /** Speed multiplier while slowed (1 when un-slowed). */
  slowFactor: number;
  /** Enemy archetype: normal puff, fast runner, or a fat boss. */
  kind: PuffKind;
  /** Boss only: cycle tint (renders a tinted ring). */
  tint: TypeTag | null;
  /** Boss only: render radius scale (1 for normal enemies). */
  size: number;
  /** Boss only: enrage once below this HP fraction, or null. */
  burstHpPct: number | null;
  /** Boss only: the enrage already fired. */
  burstFired: boolean;
};

export type Tower = {
  id: number;
  pad: number; // index into the map's `pads`
  kind: TowerKind;
  level: number; // 1..3
  /** ms until the next shot; decremented each tick. */
  cooldownMs: number;
};

/** A placed Bound Boss tower (GAME_SPEC §9k) — fixed on a pad, stars-only
 * (no scrap 1→3 upgrade), auto-attacks + fires its echo skill on CD. */
export type BoundBossTower = {
  id: number;
  pad: number; // index into the map's `pads`
  bossId: string; // matches a bound_bosses.json def
  stars: number; // 1..5
  /** ms until the next auto-attack. */
  cooldownMs: number;
  /** ms until the echo skill fires again. */
  skillCooldownMs: number;
};

/** Max Bound Bosses on the board at once (of 6 pads — §9k). */
export const BOUND_BOSS_MAX_ON_BOARD = 2;

export type DefendLive = {
  /** 1-based display wave (within its phase/map — Trial or Main). */
  wave: number;
  /** Which map this run is on (`DEFEND_MAPS[mapId]` gives the geometry). */
  mapId: DefendMapId;
  /** Forever-engine cycle power for this run: scales puff count + HP. */
  cyclePower: number;
  /** Boss band for this run (null = normal formula wave). */
  band: BossBand | null;
  /** Cycle tint for this run (boss tint + type-match target). */
  tint: TypeTag;
  /** Bosses still to spawn (from band.boss.count; boss bands only). */
  bossesRemaining: number;
  puffs: Puff[];
  pendingSpawns: number;
  spawnCooldownMs: number;
  /**
   * §9m wave beat: `minions` (normal puffs / band runners ramp in first) →
   * `breath` (boss bands only, ~2s pause after the minion budget is spent and
   * the board is clear) → `boss` (the mini/final spawns last). Normal waves
   * never leave `minions`.
   */
  spawnStage: SpawnStage;
  /** ms left in the boss-band breath (only while `spawnStage === 'breath'`). */
  breathMs: number;
  /** Minion spawns so far — drives the §9m within-wave HP ramp. */
  minionsSpawned: number;
  /** Total minion budget (grows when a boss enrage adds burst runners). */
  minionsPlanned: number;
  nextId: number;
  towers: Tower[];
  boundBosses: BoundBossTower[];
  scrap: number;
  /** ms until the Avatar's next auto-attack. */
  avatarCooldownMs: number;
  /** ms until the skill button is ready again. */
  skillCooldownMs: number;
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

/** §9m spawn beat — see `DefendLive.spawnStage`. */
export type SpawnStage = 'minions' | 'breath' | 'boss';

export type DefendLiveOptions = {
  /** Map to fight on (default `trial` = Grove Path). */
  mapId?: DefendMapId;
  /** Cycle power for this run (default 1 — no conquered cycles). */
  cyclePower?: number;
  /** Starting scrap (defaults to the tune's startScrap). */
  scrap?: number;
  /** Cycle boss tint (defaults to the store's cycle tint). */
  tint?: TypeTag;
};

export function createDefendLive(wave: number, options: DefendLiveOptions = {}): DefendLive {
  const mapId = options.mapId ?? 'trial';
  const cyclePower = Math.max(1, options.cyclePower ?? 1);
  const waveN = Math.max(1, Math.floor(wave));
  const band = bossBandFor(mapId, waveN);
  // §9m: band minions are the runner pack; normal waves are the §9 count.
  const minionCount = band ? band.runners : waveEnemyCount(waveN, cyclePower);
  return {
    wave: waveN,
    mapId,
    cyclePower,
    band,
    tint: options.tint ?? DEFAULT_CYCLE_TINT,
    bossesRemaining: band ? band.boss.count : 0,
    puffs: [],
    pendingSpawns: minionCount,
    spawnCooldownMs: 0,
    spawnStage: 'minions',
    breathMs: 0,
    minionsSpawned: 0,
    minionsPlanned: minionCount,
    nextId: 0,
    towers: [],
    boundBosses: [],
    scrap: options.scrap ?? getTune().startScrap,
    avatarCooldownMs: 0,
    skillCooldownMs: 0,
  };
}

/**
 * Retry after a fail keeps the tower layout (GAME_SPEC §9) and resets the
 * enemy queue + scrap to the run start, so Retry is always playable. The map
 * and cycle power of the failed run are kept.
 */
export function retryDefendLive(state: DefendLive): DefendLive {
  return {
    ...createDefendLive(state.wave, {
      mapId: state.mapId,
      cyclePower: state.cyclePower,
      tint: state.tint,
    }),
    towers: state.towers.map((tower) => ({ ...tower, cooldownMs: 0 })),
    boundBosses: state.boundBosses.map((bb) => ({
      ...bb,
      cooldownMs: 0,
      skillCooldownMs: 0,
    })),
  };
}

/* ---------------------------------------------------------------- combat --- */
type DefendBuckets = {
  wavePower: number;
  towerSpeed: number;
  avatarLevel: number;
  /** Type-match bonus fraction (0, or tune.typeMatchBonus when matched). */
  typeMatch: number;
  /** Avatar stars (→ +3% base wave_power each, `avatarStarWavePower`). */
  avatarStars: number;
};

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

/** Place a Bound Boss on an empty pad (§9k), deducting its scrap place cost.
 * Blocked when the boss isn't ≥ ★1, the pad is occupied, scrap is short, or
 * the board already holds `BOUND_BOSS_MAX_ON_BOARD` Bound Bosses. */
export function placeBoundBoss(
  state: DefendLive,
  pad: number,
  bossId: string,
  stars: number,
): DefendLive | null {
  const def = getBoundBossDef(bossId);
  if (!def || stars < 1) return null;
  if (state.scrap < def.place_cost) return null;
  if (
    state.towers.some((tower) => tower.pad === pad) ||
    state.boundBosses.some((bb) => bb.pad === pad)
  ) {
    return null;
  }
  if (state.boundBosses.length >= BOUND_BOSS_MAX_ON_BOARD) return null;
  return {
    ...state,
    scrap: state.scrap - def.place_cost,
    boundBosses: [
      ...state.boundBosses,
      {
        id: state.nextId,
        pad,
        bossId,
        stars: Math.max(1, Math.min(5, Math.floor(stars))),
        cooldownMs: 0,
        skillCooldownMs: 0,
      },
    ],
    nextId: state.nextId + 1,
  };
}

/** Distance in board units between a pad and a puff's current position. */
function padPuffDist(pad: DefendWaypoint, dist: number, map: DefendMap): number {
  const pos = puffPosition(dist, map);
  return Math.hypot(pos.x * 100 - pad.x, pos.y * 100 - pad.y);
}

/**
 * Advance the live run by `dtMs`: spawns, movement (slow applied), tower fire,
 * Avatar auto-attack, kills → scrap, skill cooldown, leak and done flags.
 * `buckets` carries the equipped wave_power / tower_speed multipliers and the
 * Avatar level from playStore; `avatar` is the Avatar's position (board units).
 * Puff HP and spawn count are already scaled by the run's `cyclePower` (§9e).
 */
export function stepDefendLive(
  state: DefendLive,
  dtMs: number,
  buckets: DefendBuckets,
  avatar: { x: number; y: number },
): DefendStep {
  const map = DEFEND_MAPS[state.mapId];
  const band = state.band;
  const speedBase =
    (PUFF_SPEED_PER_SEC * waveSpeedMult(state.wave) * dtMs) / 1000;
  const puffHp = PUFF_BASE_HP * waveHpMult(state.wave) * state.cyclePower;
  const bossHp = band
    ? PUFF_BASE_HP * waveHpMult(state.wave) * state.cyclePower * band.boss.hp_mult
    : puffHp;
  // Board-wide damage mults: gear wave_power × type-match × Avatar stars.
  const boardMult =
    buckets.wavePower *
    (1 + buckets.typeMatch) *
    avatarStarWavePower(buckets.avatarStars);

  let pendingSpawns = state.pendingSpawns;
  let bossesRemaining = state.bossesRemaining;
  let spawnCooldownMs = state.spawnCooldownMs - dtMs;
  let nextId = state.nextId;
  let puffs = state.puffs;
  let scrap = state.scrap;
  let spawnStage = state.spawnStage;
  let breathMs = state.breathMs;
  let minionsSpawned = state.minionsSpawned;
  let minionsPlanned = state.minionsPlanned;

  // §9m wave beat. Normal waves: light within-wave HP ramp only — no breath,
  // no alert, the beat never leaves `minions`. Boss bands: minions first →
  // ~2s breath once the budget is spent and the board is clear → the boss
  // spawns last (the screen shows the alert banner on the breath→boss step).
  const rampPct = getTune().withinWaveRamp;
  // Spawn one minion (puff / runner) — later spawns are slightly fatter HP.
  const spawnMinion = () => {
    const rampFrac =
      minionsPlanned > 1 ? Math.min(1, minionsSpawned / (minionsPlanned - 1)) : 0;
    const hp = puffHp * (1 + rampPct * rampFrac);
    puffs = [
      ...puffs,
      {
        id: nextId++,
        dist: 0,
        hp,
        maxHp: hp,
        slowMs: 0,
        slowFactor: 1,
        kind: band ? 'runner' : 'puff',
        tint: null,
        size: 1,
        burstHpPct: null,
        burstFired: false,
      },
    ];
    pendingSpawns -= 1;
    minionsSpawned += 1;
  };
  // Spawn a boss — the last, fat beat (no within-wave ramp on itself).
  const spawnBoss = () => {
    const burst = band?.boss.burst;
    puffs = [
      ...puffs,
      {
        id: nextId++,
        dist: 0,
        hp: bossHp,
        maxHp: bossHp,
        slowMs: 0,
        slowFactor: 1,
        kind: 'boss',
        tint: state.tint,
        size: band?.boss.size ?? 1,
        burstHpPct: burst?.hp_pct ?? null,
        burstFired: false,
      },
    ];
    bossesRemaining -= 1;
  };

  if (spawnStage === 'minions') {
    if (pendingSpawns > 0 && spawnCooldownMs <= 0) {
      spawnMinion();
      spawnCooldownMs = DEFEND_SPAWN_INTERVAL_MS;
    } else if (pendingSpawns === 0 && puffs.length === 0 && band) {
      // Minion budget spent + board clear → the ~2s breath before the boss.
      spawnStage = 'breath';
      breathMs = getTune().bossBreathMs;
    }
  } else if (spawnStage === 'breath') {
    breathMs -= dtMs;
    if (breathMs <= 0 && bossesRemaining > 0) {
      // Boss spawns last — the screen banners this breath→boss step.
      spawnStage = 'boss';
      spawnBoss();
      spawnCooldownMs = DEFEND_SPAWN_INTERVAL_MS;
    }
  } else if (spawnStage === 'boss') {
    // Boss(es) first, then any burst runners a boss enrage added.
    if (spawnCooldownMs <= 0) {
      if (bossesRemaining > 0) {
        spawnBoss();
        spawnCooldownMs = DEFEND_SPAWN_INTERVAL_MS;
      } else if (pendingSpawns > 0) {
        spawnMinion();
        spawnCooldownMs = DEFEND_SPAWN_INTERVAL_MS;
      }
    }
  }

  // Movement (§9m boss crawl): bosses move at ~1/3 puff speed so the alert
  // beat is fightable; runners keep their faster clip; normal puffs are the
  // baseline. Slowed puffs crawl on top of their kind's base.
  const bossSpeedMult = getTune().bossSpeedMult;
  puffs = puffs.map((puff) => {
    const slow = puff.slowMs > 0 ? puff.slowFactor : 1;
    const speed =
      puff.kind === 'runner'
        ? speedBase * RUNNER_SPEED_MULT
        : puff.kind === 'boss'
          ? speedBase * Math.max(0.05, bossSpeedMult)
          : speedBase;
    const slowMs = Math.max(0, puff.slowMs - dtMs);
    return { ...puff, dist: puff.dist + speed * slow, slowMs };
  });

  // Towers fire.
  const towerSpeedBucket = Math.max(0.1, buckets.towerSpeed);
  const towerCdScale = getTune().towerCooldownScale;
  const scrapPerKill = getTune().scrapKill;
  const firedTowers: Tower[] = [];
  for (const tower of state.towers) {
    let cooldownMs = tower.cooldownMs - dtMs;
    if (cooldownMs <= 0) {
      const target = towerTarget(tower, puffs, map);
      if (target) {
        const def = TOWER_DEFS[tower.kind];
        const damage =
          def.baseAttack * def.levelMultWavePower[tower.level - 1] * boardMult;
        puffs = applyHit(puffs, target.id, damage, def);
        if (puffs.some((p) => p.id === target.id && p.hp <= 0)) {
          scrap += scrapPerKill;
          puffs = puffs.filter((p) => p.id !== target.id);
        }
        cooldownMs = (def.cooldownMs * towerCdScale) / towerSpeedBucket;
      } else {
        cooldownMs = 0; // idle: retry next tick
      }
    }
    firedTowers.push({ ...tower, cooldownMs });
  }

  // Avatar auto-attack: nearest enemy in range (§9b), 0.7s cooldown.
  let avatarCooldownMs = state.avatarCooldownMs - dtMs;
  if (avatarCooldownMs <= 0) {
    const target = acquireAvatarTarget(avatar, puffs, map);
    if (target) {
      const damage =
        AVATAR_BASE_ATTACK * boardMult * avatarLevelWavePower(buckets.avatarLevel);
      puffs = puffs.map((puff) =>
        puff.id === target.id ? { ...puff, hp: puff.hp - damage } : puff,
      );
      if (puffs.some((p) => p.id === target.id && p.hp <= 0)) {
        scrap += scrapPerKill;
        puffs = puffs.filter((p) => p.id !== target.id);
      }
      avatarCooldownMs = getTune().avatarCooldownMs;
    } else {
      avatarCooldownMs = 0;
    }
  }

  // Bound Boss towers fire (§9k): auto-attack on CD + echo skill on CD. Auto
  // only — no second skill button. The echo maps to the closed skill
  // primitives (burst = instant AoE around the pad); slow_pulse / focus_beam
  // are authored with future packs, no new primitive here.
  const firedBoundBosses: BoundBossTower[] = [];
  for (const bb of state.boundBosses) {
    const def = getBoundBossDef(bb.bossId);
    if (!def) {
      firedBoundBosses.push(bb);
      continue;
    }
    const pad = map.pads[bb.pad];
    let cooldownMs = bb.cooldownMs - dtMs;
    let skillCooldownMs = bb.skillCooldownMs - dtMs;

    // Auto-attack — highest current HP in range (a boss echoes its chunk hits).
    if (cooldownMs <= 0) {
      const target = acquireBoundBossTarget(def, pad, puffs, map);
      if (target) {
        const damage = def.base_attack * boundBossStarDamage(def, bb.stars) * boardMult;
        puffs = puffs.map((p) => (p.id === target.id ? { ...p, hp: p.hp - damage } : p));
        if (puffs.some((p) => p.id === target.id && p.hp <= 0)) {
          scrap += scrapPerKill;
          puffs = puffs.filter((p) => p.id !== target.id);
        }
        cooldownMs = def.cooldown_ms;
      } else {
        cooldownMs = 0;
      }
    }

    // Echo skill (burst): instant AoE damage around the pad on CD.
    if (skillCooldownMs <= 0) {
      if (def.skill.skill_id === 'burst') {
        const hitAny = puffs.some(
          (puff) => padPuffDist(pad, puff.dist, map) <= def.skill.radius,
        );
        if (hitAny) {
          const skillDamage =
            def.base_attack * def.skill.power * boundBossStarDamage(def, bb.stars) * boardMult;
          puffs = puffs.map((puff) => {
            if (padPuffDist(pad, puff.dist, map) > def.skill.radius) return puff;
            return { ...puff, hp: puff.hp - skillDamage };
          });
          scrap += puffs.filter((p) => p.hp <= 0).length * scrapPerKill;
          puffs = puffs.filter((p) => p.hp > 0);
          skillCooldownMs = def.skill.cooldown_ms * boundBossStarSkillCdScale(def, bb.stars);
        } else {
          skillCooldownMs = 0;
        }
      } else {
        skillCooldownMs = def.skill.cooldown_ms;
      }
    }

    firedBoundBosses.push({ ...bb, cooldownMs, skillCooldownMs });
  }

  // Boss enrage (§18 C): a boss that first drops below its HP threshold fires
  // once and spawns a burst of extra runners (`burst` primitive's threat spike
  // in v0 — enemies can't damage towers/hero, so leak-only fail makes a
  // reinforcement burst the meaningful enrage).
  for (const puff of puffs) {
    if (
      puff.kind === 'boss' &&
      puff.burstHpPct != null &&
      !puff.burstFired &&
      puff.hp <= puff.maxHp * puff.burstHpPct
    ) {
      puffs = puffs.map((p) => (p.id === puff.id ? { ...p, burstFired: true } : p));
      const burst = band?.boss.burst;
      if (burst) {
        const runners = Math.max(1, Math.round(burst.power));
        // Burst runners re-open the minion budget; count them in the ramp so
        // the fatter tail stays monotonic.
        pendingSpawns += runners;
        minionsPlanned += runners;
      }
    }
  }

  const skillCooldownMs = Math.max(0, state.skillCooldownMs - dtMs);
  const leak = puffs.some((puff) => puff.dist >= 1);

  return {
    state: {
      wave: state.wave,
      mapId: state.mapId,
      cyclePower: state.cyclePower,
      band,
      tint: state.tint,
      bossesRemaining,
      puffs,
      pendingSpawns,
      spawnCooldownMs,
      spawnStage,
      breathMs,
      minionsSpawned,
      minionsPlanned,
      nextId,
      towers: firedTowers,
      boundBosses: firedBoundBosses,
      scrap,
      avatarCooldownMs,
      skillCooldownMs,
    },
    leak,
    done: bossesRemaining === 0 && pendingSpawns === 0 && puffs.length === 0,
  };
}

/** Cast the Avatar skill (slow_pulse): slow everything within `SKILL_RADIUS`
 * of the Avatar and put the skill on cooldown. Slow strength + cooldown read
 * the tune doc (§9c skill power/cooldown); duration stays the def's 2s. Null
 * when still cooling down. */
export function castSlowPulse(
  state: DefendLive,
  avatar: { x: number; y: number },
): DefendLive | null {
  if (state.skillCooldownMs > 0) return null;
  const map = DEFEND_MAPS[state.mapId];
  const slowFactor = 1 - getTune().skillSlowPct;
  const puffs = state.puffs.map((puff) => {
    const pos = puffPosition(puff.dist, map);
    const dist = Math.hypot(pos.x * 100 - avatar.x, pos.y * 100 - avatar.y);
    if (dist > SKILL_RADIUS) return puff;
    return { ...puff, slowMs: SKILL_SLOW_MS, slowFactor };
  });
  return { ...state, puffs, skillCooldownMs: getTune().skillCooldownMs };
}

/** Nearest enemy to the Avatar within `AVATAR_RANGE` (§9b), or null. The
 * geometry is the run's own map (a Main-map run must not measure puffs on the
 * Trial path). */
function acquireAvatarTarget(
  avatar: { x: number; y: number },
  puffs: Puff[],
  map: DefendMap,
): Puff | null {
  let best: Puff | null = null;
  let bestDist = Infinity;
  for (const puff of puffs) {
    const pos = puffPosition(puff.dist, map);
    const d = Math.hypot(pos.x * 100 - avatar.x, pos.y * 100 - avatar.y);
    if (d <= AVATAR_RANGE && d < bestDist) {
      best = puff;
      bestDist = d;
    }
  }
  return best;
}

/** Pick the tower's target per §9b: archer/vine first-toward-exit (max dist);
 * crystal highest current HP. In range only. Exported so the entity presenter
 * aims its shot at the exact enemy the engine will damage (no math change). */
export function towerTarget(tower: Tower, puffs: Puff[], map: DefendMap): Puff | null {
  const range = TOWER_DEFS[tower.kind].range;
  const pad = map.pads[tower.pad];
  const inRange = puffs.filter((puff) => padPuffDist(pad, puff.dist, map) <= range);
  if (inRange.length === 0) return null;
  if (tower.kind === 'crystal') {
    return inRange.reduce((a, b) => (b.hp > a.hp ? b : a));
  }
  return inRange.reduce((a, b) => (b.dist > a.dist ? b : a));
}

/** Bound Boss auto-attack target — highest current HP in range (a boss echoes
 * its chunky hits). */
function acquireBoundBossTarget(
  def: BoundBossDef,
  pad: DefendWaypoint,
  puffs: Puff[],
  map: DefendMap,
): Puff | null {
  const inRange = puffs.filter((puff) => padPuffDist(pad, puff.dist, map) <= def.range);
  if (inRange.length === 0) return null;
  return inRange.reduce((a, b) => (b.hp > a.hp ? b : a));
}

/** Subtract damage; vine also (re)applies its slow. Returns a new array. */
function applyHit(puffs: Puff[], targetId: number, damage: number, def: TowerDef): Puff[] {
  return puffs.map((puff) => {
    if (puff.id !== targetId) return puff;
    return {
      ...puff,
      hp: puff.hp - damage,
      slowMs: def.slowMs ? def.slowMs : puff.slowMs,
      slowFactor: def.slowMs ? def.slowPct ?? puff.slowFactor : puff.slowFactor,
    };
  });
}

/**
 * A puff at path progress `dist` (0..1) → its board position (0..1 space,
 * same as `map.path`). Multiply by the SVG viewBox (100) to render.
 */
export function puffPosition(dist: number, map: DefendMap = TRIAL_MAP): { x: number; y: number } {
  const clamped = Math.max(0, Math.min(1, dist));
  const target = clamped * mapPathLength(map);
  let travelled = 0;
  for (let i = 0; i < map.path.length - 1; i++) {
    const from = map.path[i];
    const to = map.path[i + 1];
    const segment = Math.hypot(to.x - from.x, to.y - from.y);
    if (travelled + segment >= target) {
      const t = segment === 0 ? 0 : (target - travelled) / segment;
      return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
    }
    travelled += segment;
  }
  const end = map.path[map.path.length - 1];
  return { x: end.x, y: end.y };
}
