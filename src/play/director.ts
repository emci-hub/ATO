/**
 * Wave director (W2) — data-driven spawn groups for Defend.
 *
 * Replaces the old drip-spawn in `defend.ts` with per-wave group tables. A
 * wave is an ordered list of `{ role, count, gapSec, delaySec, pattern }`
 * groups; the director flattens them into a time-sorted spawn schedule that
 * `defend.ts` pops as the run clock advances:
 *
 *   - stream  = one enemy every `gapSec`
 *   - cluster = a tight pack (0.15s), then a breath
 *   - batch   = PARKED (not modelled)
 *
 * `delaySec` is the time from wave start until that group's first member, so
 * the breath after a cluster — or before a boss — is just the gap between the
 * group's end and the next group's `delaySec`. Boss STATS (hp_mult / size /
 * burst) still come from `bands.ts`; only spawn TIMING + composition live
 * here. `swarm` / `runner` / `tank` / `boss` are the roster roles already on
 * a Puff. Trial has 5 waves, Main 10; boss waves are Trial 5 + Main 5 + 10.
 *
 * PURE data + scheduling — no React, no AsyncStorage, no engine imports.
 */
import rawWaveTables from './data/wave-tables.json';

export type SpawnRole = 'swarm' | 'runner' | 'tank' | 'boss';
export type SpawnPattern = 'stream' | 'cluster';

export type WaveGroup = {
  role: SpawnRole;
  count: number;
  /** stream: member gap; cluster: tight intra-pack gap (ignored). */
  gapSec: number;
  /** Time from wave start until this group's first member. */
  delaySec: number;
  pattern: SpawnPattern;
};

export type WaveDef = {
  phase: 'trial' | 'main';
  wave: number;
  groups: WaveGroup[];
};

/** One enemy to spawn at `tMs` into the wave. */
export type SpawnEvent = {
  tMs: number;
  role: SpawnRole;
  /** Within-wave HP ramp position 0..1 (bosses never ramp on themselves). */
  rampFrac: number;
  /** Boss-only: render size + enrage threshold (null for non-bosses). */
  boss: { size: number; burstHpPct: number | null } | null;
};

/** HP multiplier vs a baseline puff (tank soaks; boss reads the band). */
export const ROLE_HP_MULT: Record<SpawnRole, number> = {
  swarm: 1,
  runner: 1,
  tank: 2.5,
  boss: 1,
};

/** Tight intra-pack gap for a cluster, seconds. */
const CLUSTER_GAP_SEC = 0.15;

const ROLES: ReadonlySet<string> = new Set(['swarm', 'runner', 'tank', 'boss']);
const PATTERNS: ReadonlySet<string> = new Set(['stream', 'cluster']);

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseGroup(raw: unknown): WaveGroup | null {
  if (!isRecord(raw)) return null;
  const role =
    typeof raw.role === 'string' && ROLES.has(raw.role) ? (raw.role as SpawnRole) : null;
  const count = finite(raw.count);
  if (role == null || count == null || count < 1) return null;
  const pattern =
    typeof raw.pattern === 'string' && PATTERNS.has(raw.pattern)
      ? (raw.pattern as SpawnPattern)
      : 'stream';
  const gapSec = finite(raw.gapSec) ?? 1;
  const delaySec = finite(raw.delaySec) ?? 0;
  return {
    role,
    count: Math.max(1, Math.floor(count)),
    gapSec: Math.max(0, gapSec),
    delaySec: Math.max(0, delaySec),
    pattern,
  };
}

/**
 * Parse one authored wave entry. `phase` is the OUTER key it lives under
 * (`"trial"` / `"main"`) — the JSON entries carry no `phase` field, so reading
 * one off the entry silently rejected every row and emptied the tables.
 */
function parseWave(raw: unknown, phase: 'trial' | 'main'): WaveDef | null {
  if (!isRecord(raw)) return null;
  const wave = finite(raw.wave);
  if (wave == null || !Array.isArray(raw.groups)) return null;
  const groups: WaveGroup[] = [];
  for (const entry of raw.groups) {
    const group = parseGroup(entry);
    if (group) groups.push(group);
  }
  if (groups.length === 0) return null;
  return { phase, wave: Math.max(1, Math.floor(wave)), groups };
}

/** Parsed tables keyed by `${phase}:${wave}`. */
const TABLES: ReadonlyMap<string, WaveDef> = (() => {
  const map = new Map<string, WaveDef>();
  if (isRecord(rawWaveTables)) {
    for (const phase of ['trial', 'main'] as const) {
      const list = rawWaveTables[phase];
      if (!Array.isArray(list)) continue;
      for (const entry of list) {
        const def = parseWave(entry, phase);
        if (def && def.phase === phase) map.set(`${def.phase}:${def.wave}`, def);
      }
    }
  }
  return map;
})();

/** The wave def for a phase + wave, or null when the table omits it. */
export function waveDefFor(phase: 'trial' | 'main', wave: number): WaveDef | null {
  return TABLES.get(`${phase}:${Math.max(1, Math.floor(wave))}`) ?? null;
}

/** All defs for a phase, ascending wave order (Dev dump / debug). */
export function waveDefsFor(phase: 'trial' | 'main'): readonly WaveDef[] {
  return [...TABLES.values()]
    .filter((def) => def.phase === phase)
    .sort((a, b) => a.wave - b.wave);
}

/**
 * Flatten a wave's groups into a time-sorted spawn schedule. Boss groups read
 * `boss` for size/enrage; every non-boss event gets a within-wave HP ramp
 * position so later spawns read fatter (the §9m ramp, now data-driven).
 */
export function buildSchedule(
  def: WaveDef,
  boss: { size: number; burstHpPct: number | null } | null,
): SpawnEvent[] {
  const events: SpawnEvent[] = [];
  for (const group of def.groups) {
    const isBoss = group.role === 'boss';
    const gap = group.pattern === 'cluster' ? CLUSTER_GAP_SEC : group.gapSec;
    for (let i = 0; i < group.count; i += 1) {
      events.push({
        tMs: Math.round((group.delaySec + i * gap) * 1000),
        role: group.role,
        rampFrac: 0,
        boss: isBoss
          ? { size: boss?.size ?? 1, burstHpPct: boss?.burstHpPct ?? null }
          : null,
      });
    }
  }
  events.sort((a, b) => a.tMs - b.tMs);
  // Ramp only the non-boss tail; bosses spawn unramped (they carry band HP).
  const nonBoss = events.filter((event) => event.role !== 'boss');
  if (nonBoss.length > 1) {
    nonBoss.forEach((event, index) => {
      event.rampFrac = index / (nonBoss.length - 1);
    });
  }
  return events;
}
