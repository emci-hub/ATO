/**
 * Tower skin data contract — the Defend board's cast towers (K0/K1).
 *
 * `data/towerSkins.json` is the authoring surface: one row per tower skin, a
 * stable `id`, its cast art folder, its tower ROLE (archer / vine / crystal —
 * the same ids as `TowerKind`), its unlock lane, and the per-clip animation
 * folder names its sprite set authors. Code reads ids + roles only.
 *
 * Towers are stationary humanoids: they author an **idle** loop (breathing on
 * the pad) and an **attack** one-shot (the SHOOT clip that plays the tick the
 * tower fires). The shoot clip uses the SAME `attack` slot name as heroes; a
 * pack that names its shoot folder `fire` is tolerated via a loader alias
 * (`fire` → `attack`). No walk/dash/skill on a tower — it never moves.
 *
 * Clip values are the animation FOLDER NAMES under `<folder>/animations/`,
 * spelled the way the Play art registry keys them (hash-stripped, no `N._`
 * ordering prefix) — exactly like `heroes.json`. `clips` is deliberately
 * PARTIAL: a clip the skin's art does not author is `null` (or absent), the
 * loader normalizes both to an absent key, and the board falls back to the
 * static rotation. `scripts/check-towers.ts` holds the rows to the registry and
 * warns (never fails) while a tower's animation folders are not yet copied.
 *
 * The board resolves a placed tower's kit from its kind → default skin:
 *   archer → viper · vine → ghost · crystal → lux
 * via `defaultTowerSkin(role)`. The owned-but-not-yet-drawn skins (akira, nova,
 * zero, cyber-angel, omega, void) author the same shape so a future skin picker
 * only needs to pass an explicit skin id — no new TypeScript per tower.
 *
 * ### Adding a tower skin is a folder copy + a row here. No TypeScript.
 *
 * The folder layout, per skin id:
 *   assets/play/skins/cast/towers/<id>/rotations/{north,…,north-west}.png
 *   assets/play/skins/cast/towers/<id>/animations/<Clip>/<east|west>/frame_###.png
 *
 * The recipe (same as heroes):
 *   1. Copy the skin's pack folder from `games/grove/ref/cast-source/cyber-10/`
 *      into `assets/play/skins/cast/towers/<id>/`. Strip the `N._` ordering
 *      prefix from clip folder names; the `-deadbeef` hash may stay.
 *   2. Run `npx tsx scripts/play-art-prep.ts` to register the frame keys, then
 *      restart any dev server with a cleared cache (`npm start -- -c`).
 *   3. Fill the `clips` row here with the clip folder names.
 *   4. Run `npx tsx scripts/check-towers.ts`.
 */
import rawTowerSkins from './data/towerSkins.json';
import { CAST_CLIP_SLOTS, type CastClipKit, type CastClipSlot } from './cast-kits';

/** Tower skin roles — the same ids as `TowerKind` (archer / vine / crystal). */
export const TOWER_SKIN_ROLES = ['archer', 'vine', 'crystal'] as const;
export type TowerSkinRole = (typeof TOWER_SKIN_ROLES)[number];

export type TowerSkinDef = {
  id: string;
  role: TowerSkinRole;
  /** Cast art root, relative to the repo root (`assets/play/...`). */
  folder: string;
  unlock: string;
  /** The default skin for its role (the board draws this one today). */
  isDefault: boolean;
  /** Authored clips. Partial: a slot whose art isn't copied yet is absent. */
  clips: CastClipKit;
};

/** A tower skin folder must live under the Play art root. */
const TOWER_FOLDER_ROOT = 'assets/play/';

/** A validated row straight from JSON — `clips` values may be explicit nulls. */
type RawTowerSkinRow = {
  id: string;
  role: TowerSkinRole;
  folder: string;
  unlock?: string;
  default?: boolean;
  clips?: Partial<Record<CastClipSlot, string | null>>;
};

const TOWER_SKINS: readonly TowerSkinDef[] = loadTowerSkins(rawTowerSkins);
const TOWER_SKIN_BY_ID: ReadonlyMap<string, TowerSkinDef> = new Map(
  TOWER_SKINS.map((skin) => [skin.id, skin]),
);

/** Every tower skin def, in authoring order. */
export function allTowerSkins(): readonly TowerSkinDef[] {
  return TOWER_SKINS;
}

/** Display def for an id, or undefined when the id is unknown (dangling). */
export function towerSkinById(id: string): TowerSkinDef | undefined {
  return TOWER_SKIN_BY_ID.get(id);
}

/** The default skin for a tower role (archer → viper, vine → ghost, crystal →
 * lux), else the first skin with that role. The board draws this one until a
 * per-tower skin picker lands. */
export function defaultTowerSkin(role: TowerSkinRole): TowerSkinDef | undefined {
  return (
    TOWER_SKINS.find((skin) => skin.role === role && skin.isDefault) ??
    TOWER_SKINS.find((skin) => skin.role === role)
  );
}

function loadTowerSkins(raw: unknown): readonly TowerSkinDef[] {
  const problems = validateTowerSkins(raw);
  if (problems.length > 0) {
    throw new Error(`Grove towerSkins.json is invalid — fix the defs:\n  ${problems.join('\n  ')}`);
  }
  return (raw as readonly RawTowerSkinRow[]).map(normalizeTowerSkin);
}

/** Drop explicit `null`s, fold a `fire` clip into `attack`, and re-emit keys in
 * `CAST_CLIP_SLOTS` order so two equal defs compare equal. */
function normalizeTowerSkin(row: RawTowerSkinRow): TowerSkinDef {
  const clips: CastClipKit = {};
  for (const clip of CAST_CLIP_SLOTS) {
    const name = row.clips?.[clip];
    if (typeof name === 'string' && name.length > 0) clips[clip] = name;
  }
  // Alias `fire` → `attack`: a pack that names its shoot folder `fire` keeps the
  // canonical `attack` slot. Prefer an explicitly-authored `attack`.
  if (clips.fire && !clips.attack) clips.attack = clips.fire;
  delete clips.fire;
  return {
    id: row.id,
    role: row.role,
    folder: row.folder,
    unlock: row.unlock ?? 'free_farm',
    isDefault: row.default === true,
    clips,
  };
}

/** Shape + contract problems, one readable line each (empty = valid). */
function validateTowerSkins(raw: unknown): string[] {
  const problems: string[] = [];
  if (!Array.isArray(raw)) {
    return ['towerSkins.json must be a top-level array of skin defs'];
  }
  if (raw.length === 0) {
    return ['towerSkins.json must define at least one skin'];
  }
  const ids = new Set<string>();
  raw.forEach((row, index) => {
    const at = `towerSkins.json[${index}]`;
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
    if (!TOWER_SKIN_ROLES.includes(row.role as TowerSkinRole)) {
      problems.push(`${at}: role must be one of ${TOWER_SKIN_ROLES.join('/')}`);
    }
    if (typeof row.folder !== 'string' || row.folder.length === 0) {
      problems.push(`${at}: missing folder`);
    } else if (!row.folder.startsWith(TOWER_FOLDER_ROOT)) {
      problems.push(`${at}: folder must live under ${TOWER_FOLDER_ROOT}`);
    }
    if (row.unlock != null && (typeof row.unlock !== 'string' || row.unlock.length === 0)) {
      problems.push(`${at}: unlock must be a non-empty string`);
    }
    problems.push(...validateTowerClips(row.clips, at));
  });
  return problems;
}

function validateTowerClips(raw: unknown, at: string): string[] {
  if (raw == null) return [];
  if (!isRecord(raw)) return [`${at}: clips must be an object`];
  const problems: string[] = [];
  for (const [clip, value] of Object.entries(raw)) {
    if (!CAST_CLIP_SLOTS.includes(clip as (typeof CAST_CLIP_SLOTS)[number])) {
      problems.push(`${at}: unknown clip "${clip}" (expected ${CAST_CLIP_SLOTS.join('/')})`);
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
