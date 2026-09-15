/**
 * Hero data contract — the Defend board's swap-in Heroes (Slice A1).
 *
 * `data/heroes.json` is the authoring surface: one row per Batch 1 Hero
 * (Corvus, Archangel, Aurex, Kitsune, Oni), stable `id`; code reads ids only.
 * A row carries the Hero's Cast art folder, its unlock lane, the skill kit it
 * brings (a Hero swaps sprites AND skill together — there is no mix-and-match
 * loadout) and the per-clip animation folder names its sprite set authors.
 *
 * Clip values are the animation FOLDER NAMES under `<folder>/animations/`,
 * spelled the way the Play art registry keys them: `scripts/play-art-prep.ts`
 * strips the pack's `-deadbeef` hash (and the copied Cast folders drop the
 * source pack's `N._` ordering prefix by hand, as Corvus's already have), so
 * the contract says `PLAGUE_IDLE` — never `1._PLAGUE_IDLE` or
 * `PLAGUE_IDLE-ab12cd34`. `clips` is deliberately PARTIAL — a clip the Hero's
 * art does not author is `null` (or the key is absent), the loader normalizes
 * both to an absent key, and callers fall back to idle art. No clip here names
 * a PNG, and `scripts/check-heroes.ts` holds this spelling to the registry.
 *
 * This module is the contract only. Nothing on the board reads it yet: the
 * Avatar draw is still the Corvus `unit.avatar` role (A3), and skill kits /
 * Defend wiring / the Avatar-vs-Bound-Boss exclusivity are A2/A6.
 */
import rawHeroes from './data/heroes.json';

/** The clip slots a Hero's sprite set can author. `walk` is the locomotion
 * loop; `dash` / `attack` / `skill` / `hurt` are the one-shots the FSM plays. */
export const HERO_CLIPS = ['idle', 'walk', 'dash', 'attack', 'skill', 'hurt'] as const;
export type HeroClip = (typeof HERO_CLIPS)[number];

/** Unlock lanes. Every Batch 1 Hero ships on the starter ticket today — no
 * price, currency or Premium gate is decided by this contract. */
export const HERO_UNLOCKS = ['starter_ticket', 'premium', 'free_farm'] as const;
export type HeroUnlock = (typeof HERO_UNLOCKS)[number];

/** Authored facings: the Cast pack ships honest east/west side-profile clips
 * only (see `SkinWalkFace`), so every clip row is 2-dir east + west. */
export const HERO_FACES = ['ew'] as const;
export type HeroFace = (typeof HERO_FACES)[number];

/** Authored clip set, keyed by slot. Partial by design. */
export type HeroClips = Partial<Record<HeroClip, string>>;

export type HeroDef = {
  id: string;
  role: 'hero';
  /** Cast art root, relative to the repo root (`assets/play/...`). */
  folder: string;
  unlock: HeroUnlock;
  /** The skill kit that ships WITH this Hero's sprites (no mix-and-match). */
  skillId: string;
  face: HeroFace;
  clips: HeroClips;
};

/** A hero folder must live under the Play art root — clip names are resolved
 * as registry keys against `<folder>/animations/<clip>/<facing>/frame_###`. */
const HERO_FOLDER_ROOT = 'assets/play/';

/** The Avatar the board draws today. A1 keeps Corvus live; A3 swaps it. */
export const DEFAULT_AVATAR_HERO_ID = 'corvus';

/** A validated row straight from JSON — `clips` values may be explicit nulls. */
type RawHeroRow = {
  id: string;
  role: 'hero';
  folder: string;
  unlock: HeroUnlock;
  skillId: string;
  face: HeroFace;
  clips?: Partial<Record<HeroClip, string | null>>;
};

const HEROES: readonly HeroDef[] = loadHeroes(rawHeroes);
const HERO_BY_ID: ReadonlyMap<string, HeroDef> = new Map(HEROES.map((hero) => [hero.id, hero]));

/** Every Hero def, in authoring order. */
export function allHeroes(): readonly HeroDef[] {
  return HEROES;
}

/** Display def for an id, or undefined when the id is unknown (dangling). */
export function heroById(id: string): HeroDef | undefined {
  return HERO_BY_ID.get(id);
}

function loadHeroes(raw: unknown): readonly HeroDef[] {
  const problems = validateHeroes(raw);
  if (problems.length > 0) {
    throw new Error(`Grove heroes.json is invalid — fix the defs:\n  ${problems.join('\n  ')}`);
  }
  return (raw as readonly RawHeroRow[]).map(normalizeHero);
}

/** Drop the explicit `null`s so callers only ever see authored clips. Keys are
 * re-emitted in `HERO_CLIPS` order, so two equal defs compare equal. */
function normalizeHero(row: RawHeroRow): HeroDef {
  const clips: HeroClips = {};
  for (const clip of HERO_CLIPS) {
    const name = row.clips?.[clip];
    if (typeof name === 'string' && name.length > 0) clips[clip] = name;
  }
  return {
    id: row.id,
    role: row.role,
    folder: row.folder,
    unlock: row.unlock,
    skillId: row.skillId,
    face: row.face,
    clips,
  };
}

/** Shape + contract problems, one readable line each (empty = valid).
 *
 * Required per the A1 schema: unique `id`s, plus `role` / `folder` / `unlock` /
 * `skillId` / `face` on every row. `clips` is optional and may be partial —
 * only a present clip is checked (a non-empty folder name or `null`). */
function validateHeroes(raw: unknown): string[] {
  const problems: string[] = [];
  if (!Array.isArray(raw)) {
    return ['heroes.json must be a top-level array of hero defs'];
  }
  if (raw.length === 0) {
    return ['heroes.json must define at least one hero'];
  }
  const ids = new Set<string>();
  raw.forEach((row, index) => {
    const at = `heroes.json[${index}]`;
    if (!isRecord(row)) {
      problems.push(`${at}: not an object`);
      return;
    }
    if (typeof row.id !== 'string' || row.id.length === 0) {
      problems.push(`${at}: missing id`);
    } else if (ids.has(row.id)) {
      problems.push(`${at}: duplicate id "${row.id}"`);
    } else {
      ids.add(row.id);
    }

    if (row.role !== 'hero') {
      problems.push(`${at}: role must be "hero"`);
    }
    if (typeof row.folder !== 'string' || row.folder.length === 0) {
      problems.push(`${at}: missing folder`);
    } else if (!row.folder.startsWith(HERO_FOLDER_ROOT)) {
      problems.push(`${at}: folder must live under ${HERO_FOLDER_ROOT}`);
    }
    if (!HERO_UNLOCKS.includes(row.unlock as HeroUnlock)) {
      problems.push(`${at}: unlock must be one of ${HERO_UNLOCKS.join('/')}`);
    }
    if (typeof row.skillId !== 'string' || row.skillId.length === 0) {
      problems.push(`${at}: missing skillId`);
    }
    if (!HERO_FACES.includes(row.face as HeroFace)) {
      problems.push(`${at}: face must be one of ${HERO_FACES.join('/')}`);
    }
    problems.push(...validateClips(row.clips, at));
  });
  return problems;
}

function validateClips(raw: unknown, at: string): string[] {
  if (raw == null) return [];
  if (!isRecord(raw)) return [`${at}: clips must be an object`];
  const problems: string[] = [];
  for (const [clip, value] of Object.entries(raw)) {
    if (!HERO_CLIPS.includes(clip as HeroClip)) {
      problems.push(`${at}: unknown clip "${clip}" (expected ${HERO_CLIPS.join('/')})`);
      continue;
    }
    if (value != null && (typeof value !== 'string' || value.length === 0)) {
      problems.push(`${at}: clip "${clip}" must be a folder name or null`);
    }
  }
  return problems;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
