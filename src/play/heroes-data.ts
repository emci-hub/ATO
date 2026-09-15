/**
 * Hero data contract — the Defend board's swap-in Heroes (Slice A1).
 *
 * `data/heroes.json` is the authoring surface: one row per Batch 1 Hero
 * (Corvus, Archangel, Aurex, Kitsune, Oni), stable `id`; code reads ids only.
 * A row carries the Hero's display name, its Cast art folder, its unlock lane,
 * the skill kit it brings (a Hero swaps sprites AND skill together — there is
 * no mix-and-match loadout) and the per-clip animation folder names its sprite
 * set authors.
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
 * The board reads this contract through `heroAvatarRole` in `src/play/skin.ts`
 * (A3): the Defend Avatar resolves the hero set in Dress (`active_avatar_hero_id`)
 * to its cast folder + these clips, instead of a fixed Corvus role. Skill kits /
 * Defend wiring / the Avatar-vs-Bound-Boss exclusivity are A2/A6.
 *
 * ### Adding a Hero is a folder copy + a row here. No TypeScript.
 *
 * The six clip slots are `HERO_CLIPS` — **idle, walk, dash, attack, skill,
 * hurt** — and `face` is always `'ew'` (the Cast packs ship honest east/west
 * side profiles only; the board draws the Avatar as a sticky E/W side profile).
 * Aim for all six on any Hero you can fight as, but the two the build ENFORCES
 * are **`attack` and `skill`**: a Hero whose art is bundled must author both, and
 * the Avatar-reachable Heroes (Corvus, Archangel, Oni) must author both even
 * before their art lands — `scripts/check-heroes.ts` fails otherwise, so a kit
 * can never ship able to walk and idle but never hit or cast. The remaining
 * slots are REPORTED, not failed: a Hero simply plays no one-shot for a slot it
 * does not author (the clip player skips it and never invents a frame), and a
 * slot may legitimately be null because the pack has no such clip — Crimson Oni
 * ships no flinch, so its `hurt` is reported and skipped. A leftover `null` is
 * otherwise only legitimate while a Hero's art has not been copied yet (Aurex,
 * Kitsune).
 *
 * The folder layout, per Hero id:
 *   assets/play/skins/cast/heroes/<id>/rotations/{north,north-east,east,
 *     south-east,south,south-west,west,north-west}.png        ← 8 static dirs
 *   assets/play/skins/cast/heroes/<id>/animations/<Clip>/<east|west>/frame_###.png
 *
 * so a `clips` value is the `<Clip>` FOLDER NAME only, spelled the way the art
 * registry keys it (hash stripped, no `N._` prefix, no PNG named). The recipe:
 *
 *   1. Copy the Hero's pack folder from `games/grove/ref/cast-source/...` into
 *      `assets/play/skins/cast/heroes/<id>/`, keeping its `rotations/` as-is and
 *      its `animations/<Clip>/<east|west>/frame_###.png` rows. Strip the source
 *      pack's `N._` ordering prefix from clip folder names where it has one
 *      (Corvus's did; Archangel's and Oni's did not). The `-deadbeef` folder
 *      hash may stay — the registry strips it.
 *   2. Run `npx tsx scripts/play-art-prep.ts` to register the new frame keys.
 *      **If a dev server is already running, restart it with a cleared cache
 *      (`npm start -- -c`) afterwards.** The script deletes and re-bakes the
 *      9-slice folder under `assets/play/kenney-ui/border/sliced/`, and Metro's
 *      file map does not always pick those files back up on Windows — the
 *      running server then 500s the whole bundle with "Unable to resolve module
 *      …/sliced/bl.png" even though the files are on disk and tracked.
 *   3. Add the row here with the clip names. Frame counts are never listed:
 *      `heroAvatarRole` counts them from the generated registry.
 *   4. Run `npx tsx scripts/check-heroes.ts` — it holds the row to the registry,
 *      both facings, the frame counts on disk, and the attack/skill floor.
 */
import rawHeroes from './data/heroes.json';

/** The clip slots a Hero's sprite set can author. `walk` is the locomotion
 * loop; `dash` / `attack` / `skill` / `hurt` are the one-shots the FSM plays.
 * This is the hero subset of the shared `CAST_CLIP_SLOTS` schema in
 * `src/play/cast-kits.ts` (towers reuse `idle` + `attack`; creeps/bosses reuse
 * `walk` + `idle` + `death` + `attack` — same slot names, no new ones). */
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

/** The clip slots a hero bound as a tower plays (A6 prep) — the tower FSM's
 * idle loop + attack one-shot + skill one-shot. Same slot names as the Avatar,
 * no new ones; a stationary tower never plays walk/dash/hurt. */
export const BOUND_HERO_TOWER_CLIPS = ['idle', 'attack', 'skill'] as const;
export type BoundHeroTowerClip = (typeof BOUND_HERO_TOWER_CLIPS)[number];

/** The clip folder names a hero contributes when bound as a tower — the tower
 * subset of its full kit. Missing slots are simply absent (the tower falls back
 * to its rotation art for that slot). Pure data read — no registry access, so
 * the resolve path (`resolveBoundHeroTowerKit` in skin.ts) and `check:heroes`
 * share one source of truth for which slots a hero-tower plays. */
export function boundHeroTowerClips(hero: HeroDef): Partial<Record<BoundHeroTowerClip, string>> {
  const clips: Partial<Record<BoundHeroTowerClip, string>> = {};
  for (const clip of BOUND_HERO_TOWER_CLIPS) {
    if (hero.clips[clip]) clips[clip] = hero.clips[clip];
  }
  return clips;
}

export type HeroDef = {
  id: string;
  /** Player-facing name — the toast / bind copy reads this. */
  name: string;
  /** How the hero is earned, as a short player-facing hint for a locked row
   * ("Clear Main Final", "Starter", "Coming soon"). `unlock` is the economy
   * lane; this is the copy that explains it, because a lane id is not a
   * sentence and the locked rows have nowhere else to read it from. */
  acquire: string;
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

/** The starter Avatar hero, and the fallback the board draws when a hero's art
 * isn't bundled. Every fresh save starts here (A3 swaps per `heroAvatarRole`). */
export const DEFAULT_AVATAR_HERO_ID = 'corvus';

/** A validated row straight from JSON — `clips` values may be explicit nulls. */
type RawHeroRow = {
  id: string;
  name: string;
  acquire: string;
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

/** Player-facing name for an id, falling back to the raw id when the hero is
 * unknown — so a stale save's offer/toast still reads as *something* rather
 * than blank (the same fallback `playView` uses for a def-less Bound Boss). */
export function heroName(id: string): string {
  return HERO_BY_ID.get(id)?.name ?? id;
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
    name: row.name,
    acquire: row.acquire,
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

    if (typeof row.name !== 'string' || row.name.length === 0) {
      problems.push(`${at}: missing name`);
    }
    if (typeof row.acquire !== 'string' || row.acquire.length === 0) {
      problems.push(`${at}: missing acquire hint (the locked-row copy)`);
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
