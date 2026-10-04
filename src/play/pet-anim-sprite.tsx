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
import { useEffect, useMemo, useState } from 'react';

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
  type ClipDrawable,
  type SkinRole,
} from '@/play/skin';

/* ------------------------------------------------------ shared clock --- */

const CLOCK_MS = 100;
const listeners = new Set<(now: number) => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: (now: number) => void): () => void {
  listeners.add(listener);
  if (!timer) {
    timer = setInterval(() => {
      const now = Date.now();
      listeners.forEach((fn) => fn(now));
    }, CLOCK_MS);
  }
  return () => {
    listeners.delete(listener);
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
    return subscribe(setNow);
  }, [active]);
  return now;
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

export type PetFace = 'e' | 'w' | 'front';

/** One frame of a pose at a facing (undefined → PetFigure's still pose). */
export function poseDrawable(
  role: SkinRole | undefined,
  pose: PetPose | null,
  face: PetFace,
  frame: number,
): ClipDrawable | undefined {
  if (!role) return undefined;
  if (face === 'front' || !pose) {
    const south = role.keys.findIndex((key) => /(?:^|\/)south$/.test(key));
    if (face === 'front' && south >= 0) return roleArtDrawable(role, south);
    return roleArtDrawable(role, roleFaceArtIndex(role, face === 'w' ? 'w' : 'e'));
  }
  const side = face === 'w' ? 'w' : 'e';
  if (pose.clip === 'walk') return directionalClipDrawable(role.walk, roleWalkFaceIndex(role, side), frame);
  return directionalClipDrawable(role.anims?.[pose.clip], roleAnimFaceIndex(role, pose.clip, side), frame);
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
  finish?: { kind: FinishKind; color: string | null } | null;
  foilMotion?: FinishMotion;
  reduceMotion?: boolean;
  reverseHost?: boolean;
  /** Equipped sword element. The aura colour follows it. */
  auraElement?: string | null;
}) {
  const blend = useBlendRecolor();
  const ticking = animate && pose != null && !pose.hold && pet.stage !== 'egg';
  const now = usePetClock(ticking);
  const slow = asleep ? PET_SLEEP_SLOWDOWN : 1;
  const index = ticking ? petFrameAt(art.kit, pose, now - startedAt, loop, slow) : 0;
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
    />
  );
}
