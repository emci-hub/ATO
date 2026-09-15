/**
 * Cast clip-kit contract — ONE reusable schema for every Cast humanoid
 * (heroes, towers, creeps, bosses). K0.
 *
 * The slots are the animation FOLDER NAMES each sprite set may author under
 * `<folder>/animations/`, spelled the way the Play art registry keys them
 * (hash-stripped, no `N._` ordering prefix). Partial by design: a slot the art
 * does not author is `null` (or absent), the loader normalizes both to an
 * absent key, and the clip player skips it — never inventing a frame.
 *
 * One slot set, used by every cast member (heroes already ship on the first
 * six; towers / creeps / bosses reuse the SAME names, no new slots per role):
 *   - heroes         — idle, walk, dash, attack, skill, hurt  (`HERO_CLIPS`).
 *   - towers         — idle (loop) + `attack` as the SHOOT one-shot. Some packs
 *                      name the shoot folder `fire`; the loader aliases
 *                      `fire` → `attack` so the contract keeps ONE canonical
 *                      name (`attack`, matching heroes). No walk/dash/skill.
 *   - creeps/bosses  — walk (locomotion) + idle + death + attack, on these same
 *                      slots (wired in K2/K3).
 *
 * `face` is always `'ew'`: Cast packs ship honest east/west side profiles only,
 * and the board draws humanoids as a sticky E/W side profile (never rotated
 * into a path tangent, never snapped to a north/south rotation).
 */
export const CAST_CLIP_SLOTS = [
  'idle',
  'walk',
  'dash',
  'attack',
  'skill',
  'hurt',
  'death',
  'fire',
] as const;
export type CastClipSlot = (typeof CAST_CLIP_SLOTS)[number];

/** Authored clip set, keyed by slot. Partial by design. `fire` is accepted for
 * towers (an alternate name for the shoot folder) and folded into `attack` by
 * the tower loader. */
export type CastClipKit = Partial<Record<CastClipSlot, string>>;

export const CAST_FACES = ['ew'] as const;
export type CastFace = (typeof CAST_FACES)[number];
