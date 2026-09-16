/**
 * Hero skill kits — thin veil variants (Slice A1 skills).
 *
 * `data/skills.json` is the authoring surface: one row per hero `skillId`
 * (heroes.json), each a thin variant of the starter "Root Veil" slow field —
 * a name, a radius, a soft damage tick and a slow (strength + duration). The
 * Avatar's skill button casts the ACTIVE hero's veil; the hero swaps sprites
 * AND skill together (there is no mix-and-match loadout).
 *
 * The closed veil shape is deliberate: every skill is a slow field, just tuned
 * per hero. `slow_pct` is the same knob `tune.skillSlowPct` reads — the value
 * subtracted from 1 to get the slowed speed multiplier (0.35 ⇒ 0.65× speed).
 * Cooldown stays the tune's `skillCooldownMs`, NOT per-skill (a veil is a veil).
 */
import rawSkills from './data/skills.json';

export type SkillDef = {
  id: string;
  name: string;
  description: string;
  /** Skill radius, board units (0..100 space). */
  radius: number;
  /** Soft damage applied to every foe in radius on cast. */
  damage: number;
  /** Slow duration, ms. */
  slow_ms: number;
  /** Slow strength knob (1 − this = the slowed speed multiplier). */
  slow_pct: number;
};

const SKILLS: readonly SkillDef[] = loadSkills(rawSkills);
const BY_ID: ReadonlyMap<string, SkillDef> = new Map(SKILLS.map((skill) => [skill.id, skill]));

/** The starter veil — Corvus's kit, and the fallback for an unknown skillId. */
export const DEFAULT_SKILL_ID = 'black_death_ritual';

/** Every skill def, in authoring order. */
export function allSkills(): readonly SkillDef[] {
  return SKILLS;
}

/** Skill def for an id, falling back to the starter veil when unknown. */
export function skillById(id: string): SkillDef {
  return BY_ID.get(id) ?? BY_ID.get(DEFAULT_SKILL_ID)!;
}

/** The skill def a hero brings (resolves its `skillId`), or null when the hero
 * is unknown — callers fall back to the starter veil. */
export function skillForSkillId(skillId: string): SkillDef {
  return skillById(skillId);
}

function loadSkills(raw: unknown): readonly SkillDef[] {
  if (!Array.isArray(raw)) {
    throw new Error(`Grove skills.json is invalid — expected a top-level array`);
  }
  const skills: SkillDef[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (typeof row !== 'object' || row == null) continue;
    const r = row as Record<string, unknown>;
    const id = typeof r.id === 'string' ? r.id : '';
    const name = typeof r.name === 'string' ? r.name : '';
    const description = typeof r.description === 'string' ? r.description : '';
    const radius = finite(r.radius);
    const damage = finite(r.damage);
    const slowMs = finite(r.slow_ms);
    const slowPct = finite(r.slow_pct);
    if (!id || !name || radius == null || damage == null || slowMs == null || slowPct == null) {
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    skills.push({
      id,
      name,
      description,
      radius: Math.max(1, radius),
      damage: Math.max(0, damage),
      slow_ms: Math.max(100, slowMs),
      slow_pct: Math.min(0.9, Math.max(0, slowPct)),
    });
  }
  if (skills.length === 0) {
    throw new Error(`Grove skills.json is invalid — no parseable skill rows`);
  }
  return skills;
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
