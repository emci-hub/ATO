/**
 * Daily visitor — the roaming loop (roadmap step 0o). Mirrors the pet's walk loop in pet-room.tsx:
 * one plan at a time (`planVisitorStep`), a Reanimated tween along the path, the face from the
 * heading. The visitor's feet live in two shared values the room passes in (so the pet's loop can
 * keep clear of them); `feet` is the same position polled for the depth sort.
 */
import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { Easing, ReduceMotion, cancelAnimation, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';

import { hideoutFace, hideoutIdleFace, type HideoutIdleFace, type IsoRoomGeom, type Pt, type WalkBounds } from '@/play/hideout-iso';
import type { PetFace } from '@/play/pet-anim-sprite';
import { VISITOR_MEET_RANGE_PX, planVisitorStep, visitorDoorPoint } from '@/play/visitor-walk';

/** Off-stage parking for the shared values while the visitor is not in the room. */
export const VISITOR_PARKED = -1000;

export type VisitorAct = { walking: boolean; face: PetFace };

export function useVisitorRoam({
  on,
  open,
  walkOn,
  geom,
  bounds,
  fixed,
  petHere,
  pet,
  x,
  y,
  onMeet,
}: {
  /** The room draws the visitor (street layout, Hideout viewed). */
  on: boolean;
  /** Inside the 08:00–22:00 window. */
  open: boolean;
  /** Motion is not Off. */
  walkOn: boolean;
  geom: IsoRoomGeom | null;
  bounds: WalkBounds | undefined;
  /** A visitor that stands still at a spot (a Circle friend's pet): no loop, no window. */
  fixed: Pt | null;
  /** The pet is in this room and drawn (so a meeting makes sense). */
  petHere: MutableRefObject<boolean>;
  pet: { x: SharedValue<number>; y: SharedValue<number> };
  x: SharedValue<number>;
  y: SharedValue<number>;
  /** The visitor stopped beside the pet: (visitor feet). */
  onMeet: MutableRefObject<(v: Pt) => void>;
}): { gone: boolean; feet: { x: number; y: number } | null; act: VisitorAct } {
  const [gone, setGone] = useState(() => fixed == null && !open);
  const [act, setAct] = useState<VisitorAct>({ walking: false, face: fixed ? 'w' : 's' });
  const [feet, setFeet] = useState<{ x: number; y: number } | null>(null);
  const faceRef = useRef<PetFace>(fixed ? 'w' : 's');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;
  const geomRef = useRef(geom);
  geomRef.current = geom;
  const placed = useRef(false);

  // A fixed visitor just stands at its spot.
  useEffect(() => {
    if (!fixed) return;
    cancelAnimation(x);
    cancelAnimation(y);
    x.value = fixed[0];
    y.value = fixed[1];
    setGone(false);
    setAct({ walking: false, face: 'w' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixed?.[0], fixed?.[1]]);

  // The window: in at the door when it opens; out of sight if it closes while nobody is looking.
  useEffect(() => {
    if (fixed) return;
    if (open && gone) {
      placed.current = false;
      setGone(false);
    } else if (!open && !on && !gone) {
      setGone(true);
    }
  }, [open, on, gone, fixed]);

  // Gone: park the shared values far away so the pet's planner never sees a ghost.
  const shown = fixed != null || (!gone && on);
  // Also parked while it is not drawn (another room, a Circle visit): it walks in from the door again on return.
  useEffect(() => {
    if (fixed || (!gone && on)) return;
    cancelAnimation(x);
    cancelAnimation(y);
    x.value = VISITOR_PARKED;
    y.value = VISITOR_PARKED;
    placed.current = false;
    setFeet(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gone, on, fixed]);

  useEffect(() => {
    if (fixed || gone || !on || !geom) return;
    let alive = true;
    const later = (ms: number, fn: () => void) => {
      const t = setTimeout(() => {
        if (alive) fn();
      }, ms);
      timers.current.push(t);
    };
    if (!placed.current) {
      const door = visitorDoorPoint(geom, boundsRef.current);
      x.value = door[0];
      y.value = door[1];
      placed.current = true;
    }
    const run = () => {
      if (!alive) return;
      const g = geomRef.current;
      if (!g) return;
      if (!walkOn) {
        // Motion Off: it stands where it is; a closed window still sends it away.
        cancelAnimation(x);
        cancelAnimation(y);
        setAct({ walking: false, face: faceRef.current });
        if (!open) {
          setGone(true);
          return;
        }
        later(4000, run);
        return;
      }
      const fromX = x.value;
      const fromY = y.value;
      const petPt: Pt | null = petHere.current ? [pet.x.value, pet.y.value] : null;
      const step = planVisitorStep({ x: fromX, y: fromY, pet: petPt, geom: g, bounds: boundsRef.current, rng: Math.random, leaving: !open });
      if (step.kind === 'leave' && step.walkMs === 0) {
        setGone(true);
        return;
      }
      for (const t of timers.current) clearTimeout(t);
      timers.current = [];
      cancelAnimation(x);
      cancelAnimation(y);
      if (step.walkMs > 0 && step.path.length >= 2) {
        const keep = { easing: Easing.linear, reduceMotion: ReduceMotion.Never };
        const path = step.path;
        const total = Math.max(
          1e-3,
          path.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - path[i]![0], p[1] - path[i]![1]), 0),
        );
        const xs: ReturnType<typeof withTiming>[] = [];
        const ys: ReturnType<typeof withTiming>[] = [];
        let delay = 0;
        let px = fromX;
        let py = fromY;
        for (let i = 1; i < path.length; i += 1) {
          const nx = path[i]![0];
          const ny = path[i]![1];
          const ms = Math.max(16, Math.round((step.walkMs * Math.hypot(nx - px, ny - py)) / total));
          xs.push(withTiming(nx, { duration: ms, ...keep }));
          ys.push(withTiming(ny, { duration: ms, ...keep }));
          const f = hideoutFace(nx - px, ny - py, faceRef.current) as PetFace;
          if (i === 1) {
            faceRef.current = f;
            setAct({ walking: true, face: f });
          } else {
            const at = delay;
            later(at, () => {
              faceRef.current = f;
              setAct({ walking: true, face: f });
            });
          }
          delay += ms;
          px = nx;
          py = ny;
        }
        x.value = (xs.length === 1 ? xs[0]! : withSequence(...xs)) as number;
        y.value = (ys.length === 1 ? ys[0]! : withSequence(...ys)) as number;
      }
      later(step.walkMs, () => {
        const here: Pt = [step.toX, step.toY];
        if (step.faceTo) faceRef.current = hideoutIdleFace(step.faceTo[0] - here[0], step.faceTo[1] - here[1], faceRef.current as HideoutIdleFace) as PetFace;
        setAct({ walking: false, face: faceRef.current });
        if (step.kind === 'leave') {
          setGone(true);
          return;
        }
        if (step.kind === 'pet' && petHere.current) {
          const d = Math.hypot(pet.x.value - here[0], pet.y.value - here[1]);
          if (d <= VISITOR_MEET_RANGE_PX) {
            faceRef.current = hideoutIdleFace(pet.x.value - here[0], pet.y.value - here[1], faceRef.current as HideoutIdleFace) as PetFace;
            setAct({ walking: false, face: faceRef.current });
            onMeet.current(here);
          }
        }
      });
      later(step.walkMs + step.dwellMs, run);
    };
    run();
    return () => {
      alive = false;
      for (const t of timers.current) clearTimeout(t);
      timers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, gone, open, walkOn, !!geom, !!fixed]);

  // The depth sort follows the live feet.
  useEffect(() => {
    if (!shown || fixed) return;
    const tick = () =>
      setFeet((prev) => (prev && prev.x === x.value && prev.y === y.value ? prev : { x: x.value, y: y.value }));
    tick();
    const id = setInterval(tick, 80);
    return () => clearInterval(id);
  }, [shown, fixed, x, y]);

  return { gone: fixed ? false : gone, feet: fixed ? { x: fixed[0], y: fixed[1] } : feet, act };
}
