/**
 * Boss bands — Main waves 9 / 10 / 19 / 20 (GAME_SPEC §9e §9f §18 C; Phase C).
 *
 * Data-driven from `data/waves.json`: each boss band names its kind (Scout
 * mini-boss → Scout boss → Semi-final → Final form), a fat-HP boss (hp_mult /
 * size / count), an optional HP-threshold enrage "burst", a Runner pack, and
 * the drop table the band rolls from. The cycle tint (Tide/Ember/Root/Spark)
 * is NOT authored here — it is a cycle property living in `playStore`
 * (`cycle_tint`, one boss family until ContentPack 2), so the Dev kit's
 * "set tint" can re-skin the whole band without touching content JSON.
 *
 * v0 boss ability = fat HP + tint + size + Runner pack. The optional burst is
 * the `burst` skill primitive's knobs (hp_pct / power / radius): when a boss
 * first drops below `hp_pct` it fires once and spawns a burst of
 * `round(power)` extra runners (a threat spike). `radius` is carried for a
 * future damage nova but unused in v0 — enemies cannot damage towers/heroes
 * (§9b), so leak-only fail leaves a reinforcement burst as the only meaningful
 * enrage. No new skill primitive; no new engine system.
 */
import rawWaves from '../data/waves.json';

/** Boss enrage knobs — the `burst` skill primitive's shape (§9d). */
export type BossBurst = {
  /** Fire once when boss HP first drops below this fraction (0..1). */
  hp_pct: number;
  /** Runners to spawn as the burst (rounds to a whole count, min 1). */
  power: number;
  /** Carried for a future damage nova; unused in v0. */
  radius: number;
};

export type BossBandKind = 'scout_mini' | 'scout' | 'semi' | 'final';

export type BossBand = {
  phase: 'trial' | 'main';
  wave: number;
  kind: BossBandKind;
  /** Player-facing band label (e.g. "Scout mini-boss"). */
  label: string;
  /** One-line story toast for the band (§9e — no cutscenes). */
  story: string;
  /** Drop table id this band rolls from on a clear. */
  drops: string;
  boss: {
    name: string;
    /** Fat-HP multiplier on the normal puff HP formula. */
    hp_mult: number;
    /** Render radius scale vs a normal puff. */
    size: number;
    /** Boss enemies in the wave (v0 = 1). */
    count: number;
    burst: BossBurst | null;
  };
  /** Runner puffs escorting the boss (the "Runner pack"). */
  runners: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseBurst(raw: unknown): BossBurst | null {
  if (!isRecord(raw)) return null;
  const hpPct = finite(raw.hp_pct);
  const power = finite(raw.power);
  const radius = finite(raw.radius);
  if (hpPct == null || power == null) return null;
  return {
    hp_pct: Math.max(0, Math.min(1, hpPct)),
    power: Math.max(1, power),
    radius: radius ?? 70,
  };
}

function parseBands(raw: unknown): readonly BossBand[] {
  if (!Array.isArray(raw)) return [];
  const bands: BossBand[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const phase = entry.phase === 'main' || entry.phase === 'trial' ? entry.phase : null;
    const wave = finite(entry.wave);
    if (phase == null || wave == null) continue;
    const kind =
      entry.kind === 'scout_mini' || entry.kind === 'scout' || entry.kind === 'semi' || entry.kind === 'final'
        ? entry.kind
        : null;
    if (kind == null) continue;
    const boss = entry.boss;
    if (!isRecord(boss)) continue;
    const name = typeof boss.name === 'string' && boss.name.length > 0 ? boss.name : 'Boss';
    const hpMult = finite(boss.hp_mult);
    const size = finite(boss.size);
    const count = finite(boss.count);
    if (hpMult == null || size == null || count == null) continue;
    bands.push({
      phase,
      wave: Math.floor(wave),
      kind,
      label: typeof entry.label === 'string' && entry.label.length > 0 ? entry.label : name,
      story: typeof entry.story === 'string' ? entry.story : '',
      drops: typeof entry.drops === 'string' && entry.drops.length > 0 ? entry.drops : 'drop_defend_farm',
      boss: {
        name,
        hp_mult: Math.max(1, hpMult),
        size: Math.max(1, size),
        count: Math.max(1, Math.floor(count)),
        burst: parseBurst(boss.burst),
      },
      runners: Math.max(0, Math.floor(finite(entry.runners) ?? 0)),
    });
  }
  return bands;
}

/** Parsed bands keyed by `${phase}:${wave}`. */
const BANDS: ReadonlyMap<string, BossBand> = new Map(
  parseBands(rawWaves).map((band) => [`${band.phase}:${band.wave}`, band]),
);

/** The boss band at a phase + wave, or null for a normal formula wave. */
export function bossBandFor(phase: 'trial' | 'main', wave: number): BossBand | null {
  return BANDS.get(`${phase}:${Math.floor(wave)}`) ?? null;
}

/** All bands (for Dev kit dump / debug listing). */
export function allBossBands(): readonly BossBand[] {
  return [...BANDS.values()];
}
