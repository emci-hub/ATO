/**
 * Pet actor (room + dive overhaul, 2026-09-29) — what the pet DOES next, as
 * pure data. No React, no art registry: the renderer (`pet-anim-sprite.tsx`)
 * resolves the pet's skin role and hands its clip frame counts in as a
 * `PetClipKit`, and this module only ever picks from the clips that kit has.
 *
 * A pet line's art is a Cast creep (Baby/Child of the themed lines — idle +
 * walk only) or a Cast hero (idle/walk/dash/attack/skill/hurt, some missing).
 * `petPose` maps what the behaviour WANTS to what the art HAS:
 *   - no walk → it glides on its idle clip (Morwen, Aurex);
 *   - no idle → it holds frame 0 of another clip (Aurex);
 *   - no attack/skill → the show-off becomes a hop (every creep);
 *   - no hurt → null, and the caller flashes + tumbles instead.
 * `check:pet-room` runs the planner over every line/stage/form/mood and fails
 * if it ever asks for a clip the art does not author.
 *
 * Motion is per form (Bright bouncy, Scruffy sluggish, Battle shows off, Deep
 * drifts, Standard between) and per mood (happy active, hungry slow and sits,
 * sad slumped, asleep 22:00-07:00 on the phone's clock).
 */
import type { PetBranch, PetStage } from './pet';

export const PET_CLIPS = ['idle', 'walk', 'dash', 'attack', 'skill', 'hurt'] as const;
export type PetClip = (typeof PET_CLIPS)[number];

/** Frames per clip the pet's art authors (absent / 0 = not authored). */
export type PetClipKit = Partial<Record<PetClip, number>>;

/** Heroes whose authored `hurt` slot is not fit for a pet (Kitsune's is a
 * death animation) — treated as missing, so a bust flashes instead. */
export const PET_NO_HURT_HEROES: readonly string[] = ['kitsune'];

/** The slice of a skin role this module reads (structural — no skin import). */
export type PetKitSource = {
  walk?: { frames: number };
  anims?: Partial<Record<string, { frames: number } | undefined>>;
};

/** The pet's clip kit from its resolved skin role. */
export function petKitOfRole(role: PetKitSource | undefined, heroId?: string): PetClipKit {
  const kit: PetClipKit = {};
  if (!role) return kit;
  if ((role.walk?.frames ?? 0) > 0) kit.walk = role.walk?.frames;
  for (const clip of ['idle', 'dash', 'attack', 'skill', 'hurt'] as const) {
    const frames = role.anims?.[clip]?.frames ?? 0;
    if (frames > 0) kit[clip] = frames;
  }
  if (heroId && PET_NO_HURT_HEROES.includes(heroId)) delete kit.hurt;
  return kit;
}

export function kitHas(kit: PetClipKit, clip: PetClip): boolean {
  return (kit[clip] ?? 0) > 0;
}

/** What the sprite draws: a clip, looping or held on frame 0. */
export type PetPose = { clip: PetClip; hold: boolean };

/**
 * Map a wanted clip to one the art authors, or null (the caller draws its
 * static pose / a flash). Never returns a clip absent from `kit`.
 */
export function petPose(kit: PetClipKit, want: PetClip): PetPose | null {
  if (kitHas(kit, want)) return { clip: want, hold: false };
  switch (want) {
    case 'walk':
      return kitHas(kit, 'dash') && !kitHas(kit, 'idle')
        ? { clip: 'dash', hold: false }
        : petPose(kit, 'idle');
    case 'dash':
      return kitHas(kit, 'walk') ? { clip: 'walk', hold: false } : petPose(kit, 'idle');
    case 'attack':
      return kitHas(kit, 'skill') ? { clip: 'skill', hold: false } : null;
    case 'skill':
      return kitHas(kit, 'attack') ? { clip: 'attack', hold: false } : null;
    case 'hurt':
      return null;
    case 'idle': {
      const any = (['skill', 'attack', 'walk', 'dash'] as const).find((c) => kitHas(kit, c));
      return any ? { clip: any, hold: true } : null;
    }
  }
}

/** Display cadence (ms per frame) — a touch slower than the Defend Avatar. */
export const PET_FRAME_MS: Record<PetClip, number> = {
  idle: 140,
  walk: 110,
  dash: 60,
  attack: 80,
  skill: 85,
  hurt: 140,
};
/** Asleep, the idle loop breathes this many times slower. */
export const PET_SLEEP_SLOWDOWN = 3;

/** One-shot length for a pose (a held pose lasts `fallbackMs`). */
export function petPoseMs(kit: PetClipKit, pose: PetPose | null, fallbackMs = 700): number {
  if (!pose || pose.hold) return fallbackMs;
  return Math.max(1, kit[pose.clip] ?? 1) * PET_FRAME_MS[pose.clip];
}

/** Frame to draw `elapsedMs` into a pose: loops wrap, one-shots hold the last
 * frame, a held pose stays on frame 0. */
export function petFrameAt(
  kit: PetClipKit,
  pose: PetPose | null,
  elapsedMs: number,
  loop: boolean,
  slow = 1,
): number {
  if (!pose || pose.hold) return 0;
  const frames = Math.max(1, kit[pose.clip] ?? 1);
  const raw = Math.floor(Math.max(0, elapsedMs) / (PET_FRAME_MS[pose.clip] * slow));
  return loop ? raw % frames : Math.min(raw, frames - 1);
}

/* ---------------------------------------------------------- behaviour --- */

export type PetMoodKind = 'happy' | 'okay' | 'hungry' | 'sad' | 'asleep';

/** How the pet feels right now, for MOTION only (the status bubble has its
 * own priority list in `pet-status.ts`). */
export function petMoodKind(hunger: number, mood: number, night: boolean): PetMoodKind {
  if (night) return 'asleep';
  if (hunger <= 1) return 'hungry';
  if (mood <= 1) return 'sad';
  if (hunger >= 3 && mood >= 3) return 'happy';
  return 'okay';
}

export type PetFormMotion = {
  /** Walk speed multiplier. */
  speed: number;
  /** Hop height while walking, as a fraction of the base bounce. */
  bounce: number;
  /** Rest (idle/sit) length multiplier. */
  rest: number;
  /** Chance a step is a show-off. */
  showoff: number;
  /** Floats up and down instead of standing (Deep). */
  drift: boolean;
};

export const PET_FORM_MOTION: Record<PetBranch, PetFormMotion> = {
  standard: { speed: 1, bounce: 0.4, rest: 1, showoff: 0.12, drift: false },
  bright: { speed: 1.35, bounce: 1, rest: 0.6, showoff: 0.15, drift: false },
  battle: { speed: 1.15, bounce: 0.5, rest: 0.8, showoff: 0.35, drift: false },
  scruffy: { speed: 0.6, bounce: 0.1, rest: 1.8, showoff: 0.05, drift: false },
  deep: { speed: 0.8, bounce: 0, rest: 1.1, showoff: 0.1, drift: true },
};

const MOOD_MOTION: Record<Exclude<PetMoodKind, 'asleep'>, { speed: number; bounce: number; rest: number; showoff: number; sit: number; wander: number }> = {
  happy: { speed: 1.2, bounce: 1.3, rest: 0.7, showoff: 1.5, sit: 0.05, wander: 0.5 },
  okay: { speed: 1, bounce: 1, rest: 1, showoff: 1, sit: 0.15, wander: 0.4 },
  hungry: { speed: 0.5, bounce: 0, rest: 2, showoff: 0.3, sit: 0.6, wander: 0.2 },
  sad: { speed: 0.6, bounce: 0, rest: 1.6, showoff: 0.3, sit: 0.4, wander: 0.25 },
};

export type PetAct = 'idle' | 'sit' | 'wander' | 'showoff' | 'hop' | 'sleep';

export type PetStep = {
  act: PetAct;
  /** What the sprite plays (null = static pose). */
  pose: PetPose | null;
  /** How long the step lasts. */
  ms: number;
  /** Where it ends up, 0..1 across the room. */
  toX: number;
  /** Hop height while moving, points (0 = glide). */
  bounce: number;
  /** Slumped (sad) / sitting — drawn squashed a little. */
  squash: boolean;
  /** Floats up and down (Deep form). */
  drift: boolean;
  /** One-shot (show-off) vs a looping clip. */
  loop: boolean;
};

export type PetPlanInput = {
  kit: PetClipKit;
  mood: PetMoodKind;
  branch: PetBranch;
  stage: PetStage;
  /** Current position, 0..1. */
  x: number;
  /** 0..1 random source (seeded in the check). */
  rng: () => number;
};

/** Room edges the pet stays within (0..1). */
/** The pet stays on the rug. The bowl, bush and bed sit outside this span. */
export const PET_ROOM_MIN_X = 0.38;
export const PET_ROOM_MAX_X = 0.64;
/** Where the bed is — the pet sleeps here. */
export const PET_BED_X = 0.78;
/** A full walk across the room at speed 1. */
const CROSS_MS = 5200;
const BASE_BOUNCE = 8;

/** The next thing the pet does. Pure; every pose comes from `petPose`. */
export function planPetStep(input: PetPlanInput): PetStep {
  const { kit, mood, branch, x, rng } = input;
  const form = PET_FORM_MOTION[branch];
  const still = { toX: x, bounce: 0, drift: form.drift, loop: true };
  if (mood === 'asleep') {
    return { act: 'sleep', pose: petPose(kit, 'idle'), ms: 6000, squash: true, ...still, drift: false };
  }
  const m = MOOD_MOTION[mood];
  const roll = rng();
  const showoffChance = Math.min(0.6, form.showoff * m.showoff);
  if (roll < showoffChance) {
    const want: PetClip = rng() < 0.5 ? 'attack' : 'skill';
    const pose = petPose(kit, want);
    if (!pose) {
      return { act: 'hop', pose: petPose(kit, 'idle'), ms: 700, squash: false, ...still };
    }
    return { act: 'showoff', pose, ms: petPoseMs(kit, pose), squash: false, ...still, loop: false };
  }
  if (roll < showoffChance + m.wander) {
    let toX = PET_ROOM_MIN_X + rng() * (PET_ROOM_MAX_X - PET_ROOM_MIN_X);
    if (Math.abs(toX - x) < 0.15) toX = x > 0.5 ? x - 0.3 : x + 0.3;
    toX = Math.min(PET_ROOM_MAX_X, Math.max(PET_ROOM_MIN_X, toX));
    const speed = Math.max(0.2, form.speed * m.speed);
    const ms = Math.round((Math.abs(toX - x) * CROSS_MS) / speed);
    return {
      act: 'wander',
      pose: petPose(kit, 'walk'),
      ms: Math.max(600, ms),
      toX,
      bounce: Math.round(BASE_BOUNCE * form.bounce * m.bounce),
      squash: mood === 'sad',
      drift: form.drift,
      loop: true,
    };
  }
  const sit = rng() < m.sit;
  const restMs = Math.round((1800 + rng() * 2200) * form.rest * m.rest);
  return { act: sit ? 'sit' : 'idle', pose: petPose(kit, 'idle'), ms: restMs, squash: sit || mood === 'sad', ...still };
}

/* ------------------------------------------------------- sharp pixels --- */

/**
 * Snap a wanted size to a whole number of device pixels per source pixel, so
 * pixel art scales by an integer (sharper). `cellPx` is the art's frame edge.
 */
export function sharpPetBox(desiredPt: number, cellPx: number, pixelRatio: number): number {
  const cell = Math.max(1, cellPx);
  const ratio = pixelRatio > 0 ? pixelRatio : 1;
  const k = Math.max(1, Math.round((desiredPt * ratio) / cell));
  return (k * cell) / ratio;
}

/**
 * Wanted room size per stage, points (snapped by `sharpPetBox`).
 * The mockup stand-in is a bbox-cropped raven, 64 art px tall. Hero frames
 * keep that body in the lower half of a 128px cell, so the box is about
 * twice the visible body (256pt ≈ 128pt of character at 1 art px = 2pt).
 */
export const PET_ROOM_BOX: Record<PetStage, number> = {
  egg: 84,
  baby: 192,
  child: 256,
  teen: 256,
  adult: 288,
  god: 320,
};
