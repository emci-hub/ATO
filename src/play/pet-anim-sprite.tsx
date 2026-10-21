/**
 * Animated pet sprite (room + dive overhaul, 2026-09-29) — the pet's real
 * Cast clips (idle / walk / dash / attack / skill / hurt, east or west), drawn
 * through `PetFigure` so the form wash and cosmetics still apply.
 *
 * Every animated sprite steps off ONE shared clock (a single ~10 fps timer
 * for the whole app, only running while a sprite is on screen) — never one
 * timer per sprite. Movement itself is Reanimated (UI thread); this only picks
 * which frame to draw. What to play is decided by `pet-actor.ts`.
 */
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { SharedValue } from 'react-native-reanimated';

import { PLAY_SHEETS } from '@/play/generated-play-sheets';
import { petLookFor, type PetState } from '@/play/pet';
import {
  PET_SLEEP_SLOWDOWN,
  petFrameAt,
  petKitOfRole,
  type PetClipKit,
  type PetPose,
} from '@/play/pet-actor';
import type { FinishKind, FinishMotion } from '@/play/finishes';
import { PetFigure } from '@/play/pet-figure';
import { useBlendRecolor } from '@/play/pet-looks';
import type { PetWear } from '@/play/pet-cosmetics';
import {
  directionalClipDrawable,
  getSkinRole,
  heroAvatarRole,
  roleAnimFaceIndex,
  roleArtDrawable,
  roleFaceArtIndex,
  roleWalkFaceIndex,
  skinWalkClipDirIndex,
  SKIN_WALK_NO_DIR,
  type ClipDrawable,
  type SkinRole,
} from '@/play/skin';

/* ------------------------------------------------------ shared clock --- */

/** Base tick of the one shared timer. Frames last 60–140 ms, so a 100 ms tick skipped
 * frames (a 60 ms dash showed 0,1,3,5,6,8…); 20 ms lands every frame boundary. Each
 * listener says how often it wants to hear it (`everyMs`), so only frame watchers run hot. */
const TICK_MS = 20;
/** Cadence of `usePetClock` (wall-clock readers that re-render on every call). */
const CLOCK_MS = 100;
type Sub = { fn: (now: number) => void; everyMs: number; last: number };
const listeners = new Set<Sub>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(fn: (now: number) => void, everyMs: number): () => void {
  const sub: Sub = { fn, everyMs, last: 0 };
  listeners.add(sub);
  if (!timer) {
    timer = setInterval(() => {
      const now = Date.now();
      listeners.forEach((s) => {
        if (now - s.last >= s.everyMs) {
          s.last = now;
          s.fn(now);
        }
      });
    }, TICK_MS);
  }
  return () => {
    listeners.delete(sub);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** Wall-clock `now`, re-rendered on the shared tick while `active`. */
export function usePetClock(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    return subscribe(setNow, CLOCK_MS);
  }, [active]);
  return now;
}

/**
 * The frame to draw for a pose, exact to the clip's own frame length. The frame is
 * computed during render from the wall clock; the shared timer only forces a re-render
 * when that frame has changed, so a sprite re-renders once per frame, not once per tick.
 */
export function usePetFrame(
  active: boolean,
  kit: PetClipKit,
  pose: PetPose | null,
  startedAt: number,
  loop: boolean,
  slow = 1,
): number {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const frameOf = () => (active ? petFrameAt(kit, pose, Date.now() - startedAt, loop, slow) : 0);
  const shown = useRef(0);
  const latest = useRef(frameOf);
  const frame = frameOf();
  shown.current = frame;
  latest.current = frameOf;
  useEffect(() => {
    if (!active) return;
    return subscribe(() => {
      if (latest.current() !== shown.current) bump();
    }, 0);
  }, [active]);
  return frame;
}

/* ------------------------------------------------------------- role --- */

export type PetArt = {
  role: SkinRole | undefined;
  kit: PetClipKit;
  /** Source frame edge in px (for whole-pixel sizing). */
  cellPx: number;
};

function drawableCellPx(drawable: ClipDrawable | undefined, fallback: number): number {
  if (drawable?.kind === 'sheet') {
    const rect = PLAY_SHEETS[drawable.sheetKey]?.frames[drawable.frameKey];
    if (rect && rect.w > 0) return rect.w;
  }
  return fallback;
}

/** The pet's resolved art: its skin role, the clips it authors, its cell size. */
export function usePetArt(pet: PetState): PetArt {
  return useMemo(() => {
    const look = petLookFor(pet.line, pet.stage);
    if (!look) return { role: undefined, kit: {}, cellPx: 64 };
    const role = look.kind === 'hero' ? heroAvatarRole(look.heroId) : getSkinRole(look.role);
    const kit = petKitOfRole(role, look.kind === 'hero' ? look.heroId : undefined);
    const still = roleArtDrawable(role, roleFaceArtIndex(role, 'e'));
    const first =
      directionalClipDrawable(role?.anims?.idle, roleAnimFaceIndex(role, 'idle', 'e'), 0) ??
      directionalClipDrawable(role?.walk, roleWalkFaceIndex(role, 'e'), 0) ??
      still;
    return { role, kit, cellPx: drawableCellPx(first, role?.cellPx ?? 64) };
  }, [pet.line, pet.stage]);
}

export type PetFace = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw' | 'front';

const FACE_ROTATION: Record<Exclude<PetFace, 'front'>, string> = {
  n: 'north',
  ne: 'north-east',
  e: 'east',
  se: 'south-east',
  s: 'south',
  sw: 'south-west',
  w: 'west',
  nw: 'north-west',
};

/** Snap a compass face to a walk-clip folder (4-dir: E,N,S,W). */
function walkFolder(face: PetFace): 'north' | 'east' | 'south' | 'west' {
  if (face === 'n' || face === 'nw' || face === 'ne') return 'north';
  if (face === 's' || face === 'sw' || face === 'se' || face === 'front') return 'south';
  if (face === 'w') return 'west';
  return 'east';
}

/** Unit heading for `skinWalkClipDirIndex` from a 4-dir walk folder. */
function walkFolderHeading(folder: 'north' | 'east' | 'south' | 'west'): { dx: number; dy: number } {
  if (folder === 'north') return { dx: 0, dy: -1 };
  if (folder === 'south') return { dx: 0, dy: 1 };
  if (folder === 'west') return { dx: -1, dy: 0 };
  return { dx: 1, dy: 0 };
}

function rotationIndex(role: SkinRole, face: PetFace): number {
  const folder = face === 'front' ? 'south' : FACE_ROTATION[face];
  const re = new RegExp(`(?:^|/)${folder}$`);
  const index = role.keys.findIndex((key) => re.test(key));
  return index >= 0 ? index : roleFaceArtIndex(role, face === 'w' ? 'w' : 'e');
}

/** One frame of a pose at a facing (undefined → PetFigure's still pose). */
export function poseDrawable(
  role: SkinRole | undefined,
  pose: PetPose | null,
  face: PetFace,
  frame: number,
): ClipDrawable | undefined {
  if (!role) return undefined;
  if (face === 'front' || !pose) {
    return roleArtDrawable(role, rotationIndex(role, face === 'front' ? 'front' : face));
  }
  const folder = walkFolder(face);
  if (pose.clip === 'walk') {
    // Same snap as `skinWalkDirIndex`: 4-dir plays N/S/E/W; 2-dir vertical
    // returns SKIN_WALK_NO_DIR and we keep the standing pose — never a side
    // walk when a north/south cycle exists, never a side walk when it doesn't.
    const heading = walkFolderHeading(folder);
    const idx = skinWalkClipDirIndex(role.walk, heading.dx, heading.dy);
    if (idx !== SKIN_WALK_NO_DIR) return directionalClipDrawable(role.walk, idx, frame);
    return roleArtDrawable(role, rotationIndex(role, face));
  }
  const anim = role.anims?.[pose.clip];
  const idx = anim?.order.indexOf(folder) ?? -1;
  if (idx >= 0) return directionalClipDrawable(anim, idx, frame);
  const side = face === 'w' || face === 'nw' || face === 'sw' ? 'w' : 'e';
  return (
    directionalClipDrawable(role.anims?.[pose.clip], roleAnimFaceIndex(role, pose.clip, side), frame) ??
    roleArtDrawable(role, rotationIndex(role, face))
  );
}

/* ----------------------------------------------------------- sprite --- */

export function PetAnimSprite({
  pet,
  art,
  wear,
  eggColor,
  pose,
  face,
  startedAt,
  loop,
  asleep = false,
  box,
  animate,
  recolor = null,
  lockColour = false,
  finish = null,
  foilMotion = 'still',
  reduceMotion = false,
  reverseHost = false,
  auraElement = null,
  flash = null,
}: {
  pet: PetState;
  art: PetArt;
  wear: PetWear;
  eggColor: string;
  pose: PetPose | null;
  face: PetFace;
  /** When the current pose started (wall clock). */
  startedAt: number;
  /** Loop the clip (idle/walk) or hold its last frame (a one-shot). */
  loop: boolean;
  asleep?: boolean;
  box: number;
  /** False = hold frame 0 (reduced motion keeps its idle, just slower). */
  animate: boolean;
  /** v23 — shiny / dye recolour, and a shiny's locked colour. */
  recolor?: string | null;
  lockColour?: boolean;
  finish?: { kind: FinishKind; color: string | null; sweep?: string; glint?: string } | null;
  foilMotion?: FinishMotion;
  reduceMotion?: boolean;
  reverseHost?: boolean;
  /** Equipped sword element. The aura colour follows it. */
  auraElement?: string | null;
  /** White image copy. Opacity is this value (80ms on, then a fade). */
  flash?: SharedValue<number> | null;
}) {
  const blend = useBlendRecolor();
  const ticking = animate && pose != null && !pose.hold && pet.stage !== 'egg';
  const slow = asleep ? PET_SLEEP_SLOWDOWN : 1;
  const index = usePetFrame(ticking, art.kit, pose, startedAt, loop, slow);
  const drawable = pet.stage === 'egg' ? undefined : poseDrawable(art.role, pose, face, index);
  return (
    <PetFigure
      pet={pet}
      baseBox={box}
      box={box}
      eggColor={eggColor}
      wear={wear}
      frame={drawable}
      recolor={recolor}
      blend={blend}
      lockColour={lockColour}
      finish={finish}
      foilMotion={foilMotion}
      reduceMotion={reduceMotion}
      reverseHost={reverseHost}
      auraElement={auraElement}
      flash={flash}
    />
  );
}
