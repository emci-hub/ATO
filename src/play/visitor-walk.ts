/**
 * Daily visitor — roaming rules (roadmap step 0o, emci 2026-10-16) — pure, no React.
 *
 *  - WHEN: the visitor is in the Hideout from 08:00 to 22:00 local time. It walks in through the door
 *    when the window opens (or when the app opens inside it) and walks out through the door when it
 *    closes. Which hero comes is still `visitorFor` (the date alone); the greeting stays once a day.
 *  - WHERE: it walks the same floor as the pet (same grid, rail bounds, decor blocks), by its own plan.
 *  - WHAT: it rests, wanders, goes to a prop (couch, stereo, cushion) and waits there, or walks up
 *    beside the pet — then the pet turns to it and both stop for a beat (see `VISITOR_MEET_MS`).
 * Nothing here touches tokens, shells, stones or copy.
 */
import { hideoutPathMs, isoClampToWalk, isoRandomWalkPoint, planPath, type IsoRoomGeom, type Pt, type WalkBounds } from '@/play/hideout-iso';

/** Local hour the visitor walks in (inclusive) and out (exclusive). */
export const VISITOR_OPEN_HOUR = 8;
export const VISITOR_CLOSE_HOUR = 22;
/** Walk speed relative to a grown pet (a visitor ambles). */
export const VISITOR_SPEED = 0.8;
/** The visitor never picks a resting spot closer than this (art px) to the pet's feet … */
export const VISITOR_PET_SPACE_PX = 48;
/** … except to meet it: it stops this far (art px) to the side of the pet. */
export const VISITOR_MEET_PX = 40;
/** A meeting happens if the pet is still within this range (art px) when the visitor arrives. */
export const VISITOR_MEET_RANGE_PX = 72;
/** How long both stand still when they meet. */
export const VISITOR_MEET_MS = 3200;
/** Props it likes to visit (hotspot / target ids of the Hideout map; missing ones are skipped). */
export const VISITOR_PROP_TARGETS = ['chair', 'boombox', 'cushion'] as const;
/** The visitor counts as gone once its feet are this close (art px) to the door. */
export const VISITOR_DOOR_DONE_PX = 12;

export function visitorOpenAtHour(h: number): boolean {
  return h >= VISITOR_OPEN_HOUR && h < VISITOR_CLOSE_HOUR;
}

export function visitorInWindow(d: Date): boolean {
  return visitorOpenAtHour(d.getHours());
}

export type VisitorStepKind = 'rest' | 'wander' | 'prop' | 'pet' | 'leave';

export type VisitorStep = {
  kind: VisitorStepKind;
  toX: number;
  toY: number;
  path: readonly Pt[];
  /** Time spent walking the path (0 = it stays put). */
  walkMs: number;
  /** Time it then stands there before the next step. */
  dwellMs: number;
  /** What it looks at once it arrives (null = keeps its facing). */
  faceTo: Pt | null;
};

export type VisitorPlanInput = {
  x: number;
  y: number;
  /** The pet's feet, or null when it is not in this room. */
  pet: Pt | null;
  geom: IsoRoomGeom;
  bounds?: WalkBounds;
  rng: () => number;
  /** The window has closed: walk to the door. */
  leaving: boolean;
};

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Where the door stands (the visitor's way in and out), on the walk floor. */
export function visitorDoorPoint(geom: IsoRoomGeom, bounds?: WalkBounds): Pt {
  const d = geom.targets.door ?? geom.spawns.door ?? geom.spawns.default ?? ([geom.canvas[0] / 2, 520] as Pt);
  return isoClampToWalk(d[0], d[1], geom, 'adult', bounds);
}

export function planVisitorStep(input: VisitorPlanInput): VisitorStep {
  const { geom, bounds, rng, pet } = input;
  const here = isoClampToWalk(input.x, input.y, geom, 'adult', bounds);
  const stay = (kind: VisitorStepKind, dwellMs: number, faceTo: Pt | null = null): VisitorStep => ({
    kind,
    toX: here[0],
    toY: here[1],
    path: [here],
    walkMs: 0,
    dwellMs,
    faceTo,
  });
  const go = (kind: VisitorStepKind, dest: Pt, dwellMs: number, faceTo: Pt | null): VisitorStep => {
    const path = planPath(geom, here, dest, 'adult', undefined, bounds);
    const end = path[path.length - 1] ?? dest;
    return { kind, toX: end[0], toY: end[1], path, walkMs: hideoutPathMs(path, VISITOR_SPEED), dwellMs, faceTo };
  };
  const clearOfPet = (p: Pt) => pet == null || dist(p, pet) >= VISITOR_PET_SPACE_PX;

  if (input.leaving) {
    const door = visitorDoorPoint(geom, bounds);
    if (dist(here, door) <= VISITOR_DOOR_DONE_PX) return { ...stay('leave', 0), walkMs: 0 };
    return go('leave', door, 0, null);
  }

  const roll = rng();
  if (roll < 0.25) return stay('rest', 2500 + Math.round(rng() * 2500));

  if (roll < 0.5) {
    const ids = VISITOR_PROP_TARGETS.filter((id) => geom.targets[id] != null);
    const id = ids[Math.floor(rng() * ids.length)];
    if (id) {
      const t = geom.targets[id]!;
      const dest = isoClampToWalk(t[0], t[1], geom, 'adult', bounds);
      if (clearOfPet(dest) && dist(here, dest) >= 14) {
        // It faces up the room, at the prop standing on the back wall side.
        return go('prop', dest, 3000 + Math.round(rng() * 2000), [dest[0], dest[1] - 100]);
      }
    }
  }

  if (roll < 0.7 && pet) {
    const sides: Pt[] = [
      [pet[0] - VISITOR_MEET_PX, pet[1]],
      [pet[0] + VISITOR_MEET_PX, pet[1]],
    ];
    const spots = sides
      .map((s) => isoClampToWalk(s[0], s[1], geom, 'adult', bounds))
      .filter((s) => dist(s, pet) >= 24 && dist(s, pet) <= VISITOR_MEET_RANGE_PX)
      .sort((a, b) => dist(a, here) - dist(b, here));
    const dest = spots[0];
    if (dest && dist(here, dest) >= 8) return go('pet', dest, VISITOR_MEET_MS + 400, pet);
  }

  for (let n = 0; n < 6; n += 1) {
    const dest = isoRandomWalkPoint(geom, rng, 'adult', bounds);
    if (dist(dest, here) >= 24 && clearOfPet(dest)) return go('wander', dest, 1200 + Math.round(rng() * 1800), null);
  }
  return stay('rest', 2500);
}
