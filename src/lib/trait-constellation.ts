/**
 * "Your constellation": the profile as stars (ATO-BUILD PHASE-03). Pure maths,
 * no React, so the offline check can pin it. It reuses the shape's geometry
 * (`shapeGeometry`): one star per axis that has a track, in the same place as
 * that axis's point on "Your shape".
 *
 * Star size and brightness follow how clear the lean is (the track's
 * `stability`); a firmly settled trait (stability above 0.8) turns gold. No
 * number is ever drawn.
 */
import { AXIS_SHORT_NAME } from '@/lib/axis-poles';
import { shapeFilledCount, shapeGeometry, traitShapePoints, type ShapeGeometry } from '@/lib/trait-shape';
import { trackFor, type TraitTrack } from '@/lib/trait-stability';
import type { TraitAxis } from '@/lib/traits';

export type ConstellationVariant = 'hero' | 'header' | 'mini' | 'badge' | 'poster';

/** Above this stability a star turns gold. */
export const GOLD_STABILITY = 0.8;
/** Same gold as `MOTION_GOLD` in motion-tokens (kept here so this file stays pure; motion-check pins both). */
export const GOLD_COLOR = '#F9C22B';

export interface ConstellationStar {
  axis: TraitAxis;
  x: number;
  y: number;
  /** 0..1, how clear the lean is. */
  clarity: number;
  gold: boolean;
  /** Star radius in px at rest. */
  radius: number;
  /** Resting opacity (brighter when clearer). */
  brightness: number;
  /** 0..1 twinkle phase: fixed per axis, so a re-render never re-rolls it. */
  phase: number;
}

export interface ConstellationModel {
  stars: ConstellationStar[];
  /** Outline through the shape (null under 3 stars). */
  path: string | null;
  geo: ShapeGeometry;
  count: number;
  /** The clearest axis (ties: first in TRAIT_AXES order); null when empty. */
  strongest: TraitAxis | null;
  label: string;
}

/** Which parts of the motion each variant plays. Mini and badge sit still. */
export const VARIANT_MOTION: Record<ConstellationVariant, { live: boolean; halos: boolean; line: boolean; scale: number }> = {
  hero: { live: true, halos: true, line: true, scale: 1 },
  header: { live: true, halos: true, line: true, scale: 0.85 },
  mini: { live: false, halos: false, line: true, scale: 0.7 },
  badge: { live: false, halos: false, line: false, scale: 0.6 },
  /** The share poster: full-size stars and line, drawn still so a capture is never mid-motion. */
  poster: { live: false, halos: false, line: true, scale: 1 },
};

/** A fixed pseudo-random phase per axis position. */
export function starPhase(index: number): number {
  const x = Math.sin((index + 1) * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function constellationLabel(count: number, strongest: TraitAxis | null): string {
  if (count === 0 || !strongest) return 'Your constellation: no traits yet';
  return `Your constellation: ${count} ${count === 1 ? 'trait' : 'traits'}, strongest ${AXIS_SHORT_NAME[strongest]}`;
}

export function constellationModel(
  tracks: readonly TraitTrack[],
  size: number,
  variant: ConstellationVariant = 'hero',
  now: Date = new Date(),
): ConstellationModel {
  const points = traitShapePoints(null, tracks, now);
  const geo = shapeGeometry(points, size, size * 0.42);
  const { scale } = VARIANT_MOTION[variant];
  const baseR = Math.max(1.5, size * 0.016) * scale * 1.6;
  const stars: ConstellationStar[] = [];
  let strongest: TraitAxis | null = null;
  let best = -1;
  geo.coords.forEach((c, i) => {
    if (c.state === 'blank') return;
    const row = trackFor(tracks, c.axis, 'report');
    const clarity = Math.min(1, Math.max(0, row?.stability ?? 0));
    if (clarity > best) {
      best = clarity;
      strongest = c.axis;
    }
    stars.push({
      axis: c.axis,
      x: c.x,
      y: c.y,
      clarity,
      gold: clarity > GOLD_STABILITY,
      radius: baseR * (0.6 + 0.4 * clarity),
      brightness: 0.55 + 0.45 * clarity,
      phase: starPhase(i),
    });
  });
  const count = shapeFilledCount(points);
  return { stars, path: geo.path, geo, count, strongest, label: constellationLabel(count, strongest) };
}
