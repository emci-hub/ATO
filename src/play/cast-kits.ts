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
 *                      name (`attack`, matching heroes). No walk/dash; a tower
 *                      MAY author `skill` (K1b — the auto-skill one-shot).
 *   - creeps/bosses  — walk (locomotion) + idle (breathing loop when stalled)
 *                      + death (one-shot on kill, `K2`) + attack, on these same
 *                      slots (creep idle/death wired in K2; creep ATTACK and the
 *                      bosses' clips are still parked for K3).
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

/* ------------------------------------------- path-walker clip ladder (K2) --- */
/* The three slots a humanoid PATH WALKER (a creep on the road) plays, in the
 * order the board resolves them: `death` > `walk` > `idle`. Pure decision
 * table — the renderer asks, the art answers, and a slot the art does not
 * author is SKIPPED rather than invented (`creepClip` returns null and the
 * caller keeps its own fallback). Lives here, not in the screen, so the
 * contract and `scripts/check-creeps.ts` share one source of truth for what a
 * creep plays when it moves, when it stops, and when it dies. */

/** The clips a path walker plays. A subset of `CAST_CLIP_SLOTS`, no new names. */
export const CREEP_PATH_CLIPS = ['death', 'walk', 'idle'] as const;
export type CreepPathClip = (typeof CREEP_PATH_CLIPS)[number];

/** How long a creep must show no path progress before it counts as stopped and
 * breathes idle instead of holding a frozen walk frame. The walk tick measures
 * path progress itself (a slowed creep is still advancing ⇒ still `walk`); this
 * is the stall window, ~0.25s, long enough that a slow pulse's leg drag never
 * flickers between the two clips. */
export const CREEP_STILL_MS = 250;

/** Display cadence (ms per frame) for the two clips the board clocks itself.
 * `walk` is absent on purpose: its frames track ground travelled (the walk
 * tick's per-creep phase), never wall time. */
export const CREEP_CLIP_FRAME_MS: Record<'idle' | 'death', number> = {
  idle: 200, // 4f ≈ 0.8s breathing loop
  death: 70, // 9f ≈ 0.63s one-shot, then the last frame holds
};

export type CreepClipInput = {
  /** The creep was killed: the corpse phase, which outlives its engine entry. */
  dead: boolean;
  /** Measured path rate (dist/sec) from the walk tick. `0` = the creep has not
   * advanced for `CREEP_STILL_MS`. */
  rate: number;
  /** Frames authored per slot (0/absent = the art does not author that clip). */
  frames: Partial<Record<CreepPathClip, number>>;
};

/**
 * Which clip a path walker draws, or null when nothing applies and the caller
 * keeps its fallback (the static rotation).
 *
 *   - killed  → `death` (a one-shot) when the art authors one, else null =
 *     vanish, the behaviour before death art existed.
 *   - moving  → `walk`, exactly as before.
 *   - stalled → `idle` when the art authors a breathing loop, else null so a
 *     creep with no idle clip keeps holding its last walk frame.
 */
export function creepClip(input: CreepClipInput): CreepPathClip | null {
  const authored = (clip: CreepPathClip) => (input.frames[clip] ?? 0) > 1;
  if (input.dead) return authored('death') ? 'death' : null;
  if (input.rate > 0) return authored('walk') ? 'walk' : null;
  return authored('idle') ? 'idle' : null;
}

/**
 * Frame index for one of the wall-clock creep clips. `idle` loops; `death`
 * plays ONCE and holds its last frame, so a corpse stays down instead of
 * standing back up. `seed` slides a creep's phase so a stalled cluster does not
 * breathe in lockstep (idle only — a death never staggers).
 */
export function creepClipFrame(
  clip: 'idle' | 'death',
  elapsedMs: number,
  frames: number,
  seed = 0,
): number {
  if (frames <= 1) return 0;
  const per = CREEP_CLIP_FRAME_MS[clip];
  const elapsed = Math.max(0, elapsedMs) + (clip === 'idle' ? seed * per : 0);
  const raw = Math.floor(elapsed / per);
  return clip === 'death' ? Math.min(raw, frames - 1) : raw % frames;
}
