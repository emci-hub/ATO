/**
 * Bound Boss towers — beat the Final boss, recruit it (GAME_SPEC §9k §9l;
 * Phase E).
 *
 * Content lives in `src/play/data/bound_bosses.json`: one boss family (Ember)
 * until ContentPack 2. Each row names its boss, a cycle tint, tower stats
 * (base attack / cooldown / range / scrap place cost), an echo skill mapped to
 * the CLOSED skill-primitive set (§9d — burst / slow_pulse / focus_beam; v0
 * content = burst), and the fragment star ladder. Fragments are a save-side
 * currency (playStore), not an item — this module only parses the def and
 * resolves the star costs/mults the board + store read.
 *
 * Star ladder (§9k): 3 fragments → unlock ★1, then +2/+3/+4/+5 per star to
 * ★5 (star_cost_frags indexed by current star, 0 = the unlock step). Each star
 * multiplies damage and shortens the echo-skill cooldown. No pity — fragments
 * are an honest farm, never guaranteed, never from the skip crate.
 */
import rawBoundBosses from '../data/bound_bosses.json';
import { isTypeTag, type TypeTag } from './type-match';

/** Echo-skill primitive (§9d closed set — never expand without a version bump). */
export type BoundBossSkillId = 'burst' | 'slow_pulse' | 'focus_beam';

export type BoundBossSkill = {
  skill_id: BoundBossSkillId;
  name: string;
  description: string;
  /** Burst/focus power mult (× base_attack, then star + board mults). */
  power: number;
  /** Skill radius, board units (0..100 space). */
  radius: number;
  /** Skill cooldown before the per-star cd scale. */
  cooldown_ms: number;
};

export type BoundBossDef = {
  boss_id: string;
  name: string;
  family: string;
  tint: TypeTag;
  base_attack: number;
  cooldown_ms: number;
  range: number;
  place_cost: number;
  skill: BoundBossSkill;
  /** Fragments to go from star N → N+1; index 0 = unlock (★0 → ★1). */
  star_cost_frags: readonly number[];
  /** Damage mult per star (index = star 0..5). */
  star_mult_damage: readonly number[];
  /** Echo-skill cooldown scale per star (index = star 0..5). */
  star_skill_cd_scale: readonly number[];
};

export const BOUND_BOSS_MAX_STAR = 5;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseSkill(raw: unknown): BoundBossSkill | null {
  if (!isRecord(raw)) return null;
  const skillId =
    raw.skill_id === 'burst' || raw.skill_id === 'slow_pulse' || raw.skill_id === 'focus_beam'
      ? raw.skill_id
      : null;
  if (skillId == null) return null;
  const power = finite(raw.power);
  const cooldown = finite(raw.cooldown_ms);
  if (power == null || cooldown == null) return null;
  return {
    skill_id: skillId,
    name: typeof raw.name === 'string' && raw.name.length > 0 ? raw.name : 'Echo',
    description: typeof raw.description === 'string' ? raw.description : '',
    power: Math.max(0, power),
    radius: Math.max(1, finite(raw.radius) ?? 20),
    cooldown_ms: Math.max(100, cooldown),
  };
}

function parseNumberList(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const out: number[] = [];
  for (const entry of raw) {
    const n = finite(entry);
    if (n != null && n >= 0) out.push(n);
  }
  return out;
}

function parseDefs(raw: unknown): readonly BoundBossDef[] {
  if (!Array.isArray(raw)) return [];
  const defs: BoundBossDef[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const bossId = entry.boss_id;
    if (typeof bossId !== 'string' || bossId.length === 0) continue;
    const name = typeof entry.name === 'string' && entry.name.length > 0 ? entry.name : bossId;
    const baseAttack = finite(entry.base_attack);
    const cooldown = finite(entry.cooldown_ms);
    const range = finite(entry.range);
    const placeCost = finite(entry.place_cost);
    const skill = parseSkill(entry.skill);
    if (baseAttack == null || cooldown == null || range == null || placeCost == null || !skill) {
      continue;
    }
    defs.push({
      boss_id: bossId,
      name,
      family: typeof entry.family === 'string' ? entry.family : bossId,
      tint: isTypeTag(entry.tint) ? entry.tint : 'ember',
      base_attack: Math.max(1, baseAttack),
      cooldown_ms: Math.max(100, cooldown),
      range: Math.max(1, range),
      place_cost: Math.max(1, placeCost),
      skill,
      star_cost_frags: parseNumberList(entry.star_cost_frags),
      star_mult_damage: parseNumberList(entry.star_mult_damage),
      star_skill_cd_scale: parseNumberList(entry.star_skill_cd_scale),
    });
  }
  return defs;
}

const DEFS = parseDefs(rawBoundBosses);
const BY_ID: ReadonlyMap<string, BoundBossDef> = new Map(DEFS.map((def) => [def.boss_id, def]));

export function getBoundBossDef(bossId: string): BoundBossDef | undefined {
  return BY_ID.get(bossId);
}

export function allBoundBossDefs(): readonly BoundBossDef[] {
  return DEFS;
}

/** The cycle's boss family — the first (and, until pack 2, only) def. */
export function defaultBoundBossId(): string | null {
  return DEFS[0]?.boss_id ?? null;
}

/** Fragments needed to go from `star` → `star + 1` (null at/above the cap). */
export function boundBossFragmentCost(def: BoundBossDef, star: number): number | null {
  const s = Math.max(0, Math.floor(star));
  if (s >= BOUND_BOSS_MAX_STAR) return null;
  const cost = def.star_cost_frags[s];
  return cost == null || cost <= 0 ? null : Math.floor(cost);
}

function clampStar(star: number): number {
  return Math.max(0, Math.min(BOUND_BOSS_MAX_STAR, Math.floor(star)));
}

/** Damage mult at a star (index-clamped; ★0 = the pre-unlock 1.0). */
export function boundBossStarDamage(def: BoundBossDef, star: number): number {
  const mult = def.star_mult_damage[clampStar(star)];
  return mult == null || mult <= 0 ? 1 : mult;
}

/** Echo-skill cooldown scale at a star (index-clamped). */
export function boundBossStarSkillCdScale(def: BoundBossDef, star: number): number {
  const scale = def.star_skill_cd_scale[clampStar(star)];
  return scale == null || scale <= 0 ? 1 : scale;
}
