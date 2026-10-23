/**
 * CastActor — ONE shared clip player for every Cast humanoid the board draws:
 * the Avatar, path walkers (creeps/bosses on the road), and pad towers (towers
 * + Bound Bosses).
 *
 * The model is the Avatar's: a priority ladder over a small clip set, looping
 * `idle`/`walk` clips, wall-clock one-shots (`dash`/`attack`/`skill`/`hurt`/
 * `death`), a post-skill attack-recovery gate, and an idle phase seed. Each
 * MODE masks the slots it may play, so a path walker can never ask for `attack`
 * and a tower can never ask for `walk` — the art is shared, the slot set is not:
 *
 *   - avatar — idle, walk, dash, attack, skill, hurt  (the full hero kit)
 *   - path   — idle, walk, death                      (a creep on the road)
 *   - tower  — idle, attack, skill                    (a stationary pad humanoid)
 *
 * Pure data + math — this module imports only `SkinRole` as a TYPE (erased at
 * build), so it loads under `tsx` for the offline data checks. Art resolution
 * (which needs the Metro registry) stays in the renderer (`defend-screen.tsx`).
 *
 * `path` keeps its ground-tracked `walk` phase in the renderer (frames track
 * ground travelled, never wall time) — `CAST_ACTOR_FRAME_MS.path` deliberately
 * authors no `walk` cadence for that reason. The path WALL-CLOCK clips (idle
 * loop + death one-shot) read `castActorPathFrame` below, which shares this
 * module's wrap/hold math with `castActorFrame`.
 */
import type { SkinRole } from './skin';

export type CastActorMode = 'avatar' | 'path' | 'tower';

/** Every clip a CastActor can address — the union of the three mode masks. */
export type CastActorClip =
  | 'idle'
  | 'walk'
  | 'dash'
  | 'attack'
  | 'skill'
  | 'hurt'
  | 'death'
  | 'faint';

/** The slots each mode may play. `avatar` is the full hero kit; `path` drops the
 * dash/attack/skill/hurt one-shots; `tower` drops walk/dash/hurt/death. */
export const CAST_ACTOR_CLIPS: Record<CastActorMode, readonly CastActorClip[]> = {
  avatar: ['idle', 'walk', 'dash', 'attack', 'skill', 'hurt'],
  path: ['idle', 'walk', 'death'],
  tower: ['idle', 'attack', 'skill'],
};

/** Display-only cadence (ms per frame) per mode. `path.walk` is absent on
 * purpose — a walker's walk frames track ground travelled (the walk tick owns
 * that phase), never wall time. */
export const CAST_ACTOR_FRAME_MS: Record<
  CastActorMode,
  Partial<Record<CastActorClip, number>>
> = {
  avatar: { idle: 120, walk: 100, dash: 50, attack: 65, skill: 70, hurt: 140 },
  path: { idle: 200, death: 70 },
  tower: { idle: 120, attack: 65, skill: 70, faint: 110 },
};

/** Clip priority per mode. A request only preempts a LOCKED one-shot
 * (`onceEndAt > 0`) if it strictly outranks it; `idle`/`walk` are loops and
 * always interruptible. `path` has no one-shot but `death`, which outranks the
 * walk/idle loops (a corpse never walks away). */
export const CAST_ACTOR_PRIORITY: Record<
  CastActorMode,
  Partial<Record<CastActorClip, number>>
> = {
  avatar: { hurt: 5, skill: 4, attack: 3, dash: 2, walk: 1, idle: 0 },
  path: { death: 3, walk: 2, idle: 1 },
  tower: { skill: 3, attack: 2, idle: 1 },
};

/**
 * One clip player's state. `onceEndAt === 0` means a looping clip (idle/walk)
 * is active; `lockUntil` is the post-skill attack-recovery gate (avatar only).
 * `idleSeedMs` slides the idle loop's phase so adjacent actors do not breathe in
 * lockstep. The sticky E/W side profile is NOT part of the state — each entity
 * keeps its own face (turned toward its target / travel), and the renderer
 * resolves the frame art at that face.
 */
export type CastActor = {
  mode: CastActorMode;
  clip: CastActorClip;
  clipStartAt: number;
  onceEndAt: number;
  lockUntil: number;
  idleSeedMs: number;
};

/** A fresh actor looping idle from now, with an idle phase offset of
 * `idleSeedMs` (0 = breathe from frame 0). */
export function castActorCreate(mode: CastActorMode, idleSeedMs = 0): CastActor {
  return {
    mode,
    clip: 'idle',
    clipStartAt: Date.now(),
    onceEndAt: 0,
    lockUntil: 0,
    idleSeedMs,
  };
}

/** A stable per-entity idle phase offset (ms) so adjacent towers / Bound Bosses
 * do not breathe in lockstep. Slides by `id % 8` idle frames. */
export function castActorIdleSeed(id: number, mode: CastActorMode): number {
  const per = CAST_ACTOR_FRAME_MS[mode].idle ?? 120;
  return (id % 8) * per;
}

/** Frame count for a clip on a role (0 when the role omits it). `walk` reads
 * the role's locomotion clip; every other slot reads the named `anims`. */
export function castActorClipFrames(clip: CastActorClip, role: SkinRole): number {
  return clip === 'walk'
    ? role.walk?.frames ?? 0
    : role.anims?.[clip]?.frames ?? 0;
}

/** Per-frame holds (ms each) a role's clip authors, or undefined when it has none
 * (the clip then plays at the mode's flat cadence). Only a full set counts. */
export function castActorClipHolds(clip: CastActorClip, role: SkinRole): readonly number[] | undefined {
  const art = clip === 'walk' ? role.walk : role.anims?.[clip];
  const holds = art?.holds;
  return holds && holds.length === art?.frames && holds.length > 0 ? holds : undefined;
}

/** Total length of a clip in ms: the sum of its holds, else frames x the flat cadence. */
function castActorClipMs(mode: CastActorMode, clip: CastActorClip, role: SkinRole): number {
  const holds = castActorClipHolds(clip, role);
  if (holds) return holds.reduce((a, b) => a + b, 0);
  return Math.max(1, castActorClipFrames(clip, role)) * castActorFrameMs(mode, clip);
}

/** Cadence for a clip in a mode (ms per frame), defaulting to the idle cadence. */
export function castActorFrameMs(mode: CastActorMode, clip: CastActorClip): number {
  return CAST_ACTOR_FRAME_MS[mode][clip] ?? 120;
}

/** Whether a clip may preempt what's playing right now (the mode's ladder). */
export function castActorCanStart(
  actor: CastActor,
  next: CastActorClip,
  now: number,
): boolean {
  const priority = CAST_ACTOR_PRIORITY[actor.mode];
  if (next === 'attack' && now < actor.lockUntil) return false;
  if (actor.onceEndAt === 0) return true; // idle/walk loop — always interruptible
  return (priority[next] ?? 0) > (priority[actor.clip] ?? 0);
}

/**
 * Start a one-shot if the mode allows it, the role authors frames for it, and
 * the priority ladder permits. Returns false when it cannot — nothing changes
 * and the caller still does its gameplay work (shots/damage are never tied to
 * whether the clip played). Mutates the actor in place on success.
 */
export function castActorStartOnce(
  actor: CastActor,
  clip: CastActorClip,
  now: number,
  role: SkinRole,
): boolean {
  if (!CAST_ACTOR_CLIPS[actor.mode].includes(clip)) return false;
  if (castActorClipFrames(clip, role) <= 0) return false;
  if (!castActorCanStart(actor, clip, now)) return false;
  actor.clip = clip;
  actor.clipStartAt = now;
  actor.onceEndAt = now + castActorClipMs(actor.mode, clip, role);
  return true;
}

/** The wrap/hold frame math shared by every clip reader. With `holds` (ms per
 * frame) each frame lasts its own time; without, every frame lasts `perMs`. */
function frameIndex(
  now: number,
  clipStartAt: number,
  perMs: number,
  seedMs: number,
  frames: number,
  holdLast: boolean,
  holds?: readonly number[],
): number {
  if (holds) {
    const total = holds.reduce((a, b) => a + b, 0);
    let t = Math.max(0, now - clipStartAt + seedMs);
    if (holdLast && t >= total) return frames - 1;
    t %= total;
    for (let i = 0; i < holds.length; i += 1) {
      if (t < holds[i]) return i;
      t -= holds[i];
    }
    return frames - 1;
  }
  const raw = Math.floor((now - clipStartAt + seedMs) / perMs);
  return holdLast ? Math.min(raw, frames - 1) : raw % frames;
}

/**
 * Frame index to draw for the current clip state. Looping clips wrap (idle
 * slides by `idleSeedMs`); a one-shot holds its last frame. Single source of
 * truth — the renderer and the anim tick both read this.
 */
export function castActorFrame(actor: CastActor, now: number, role: SkinRole): number {
  const frames = Math.max(1, castActorClipFrames(actor.clip, role));
  return frameIndex(
    now,
    actor.clipStartAt,
    castActorFrameMs(actor.mode, actor.clip),
    actor.clip === 'idle' ? actor.idleSeedMs : 0,
    frames,
    actor.onceEndAt > 0,
    castActorClipHolds(actor.clip, role),
  );
}

/**
 * P5b — a Turf helper's daze: the `faint` clip from `koAt`, holding its last frame (lying down) until it
 * gets up. Not in any mode's clip mask: the board starts it from the sim's daze event, never through
 * the priority ladder. 0 when the role has no faint art.
 */
export function castActorFaintFrame(now: number, koAt: number, role: SkinRole): number {
  const frames = castActorClipFrames('faint', role);
  if (frames <= 1) return 0;
  return frameIndex(now, koAt, castActorFrameMs('tower', 'faint'), 0, frames, true, castActorClipHolds('faint', role));
}

/**
 * P5b — getting up: the `faint` clip played in reverse from `upAt`, spread over `durationMs` (the sim's
 * get-up time), ending on frame 0 (standing). No new art. 0 when the role has no faint art.
 */
export function castActorGetUpFrame(now: number, upAt: number, durationMs: number, role: SkinRole): number {
  const frames = castActorClipFrames('faint', role);
  if (frames <= 1) return 0;
  const per = Math.max(1, durationMs / frames);
  const forward = Math.min(frames - 1, Math.max(0, Math.floor((now - upAt) / per)));
  return frames - 1 - forward;
}

/** P5b — a walking helper's `walk` loop from `walkAt` at the avatar's walk cadence (a tower-mode actor
 * never asks for walk; the board plays it while the sim says the helper is moving). */
export function castActorWalkFrame(now: number, walkAt: number, role: SkinRole): number {
  const frames = castActorClipFrames('walk', role);
  if (frames <= 1) return 0;
  return frameIndex(now, walkAt, castActorFrameMs('avatar', 'walk'), 0, frames, false, castActorClipHolds('walk', role));
}

/**
 * Frame index for a path walker's WALL-CLOCK clip (idle loop / death one-shot).
 * Path walkers are transient — their clip origin and idle seed are derived each
 * draw, not a persistent `CastActor` — so this takes the pieces directly instead
 * of an actor. `idleSeedFrames` is the per-creep phase offset (its puff id) that
 * keeps a stalled cluster from breathing in lockstep. Idle wraps; death holds
 * its last frame.
 */
export function castActorPathFrame(
  clip: 'idle' | 'death',
  now: number,
  clipStartAt: number,
  idleSeedFrames: number,
  frames: number,
): number {
  if (frames <= 1) return 0;
  const per = CAST_ACTOR_FRAME_MS.path[clip] ?? 120;
  return frameIndex(
    now,
    clipStartAt,
    per,
    clip === 'idle' ? idleSeedFrames * per : 0,
    frames,
    clip === 'death',
  );
}
