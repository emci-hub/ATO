/**
 * "Your shape" — the profile drawn as one 16-point figure (polish pass,
 * emci 2026-10-05). Pure maths, no React, so the offline check can pin it.
 *
 * Each trait is a spoke. Its point sits on a dashed middle ring when the
 * lean is in between, further OUT toward the trait's high end and further IN
 * toward its low end. Neither end is "more", so a point never reads as a
 * score, and nothing here produces a number for the screen.
 *
 * Value source matches every other profile surface (`filledTraitBands`): the
 * report-track value when there is one, else the raw `me` column. The game
 * track never mixes in.
 */
import { TRAIT_AXES, traitStateFromRow, type TraitAxis } from '@/lib/traits';
import { isAxisSettled, trackFor, type TraitTrack } from '@/lib/trait-stability';

export type ShapePointState = 'blank' | 'settling' | 'settled';

export interface ShapePoint {
  axis: TraitAxis;
  /** 0 = the trait's low end, 1 = its high end. null = not answered yet. */
  lean: number | null;
  state: ShapePointState;
}

export function traitShapePoints(
  me: Parameters<typeof traitStateFromRow>[0] | null | undefined,
  tracks: readonly TraitTrack[] = [],
  now: Date = new Date(),
): ShapePoint[] {
  const values = me ? traitStateFromRow(me).values : null;
  return TRAIT_AXES.map((axis) => {
    const row = trackFor(tracks, axis, 'report');
    const raw = row?.value ?? values?.[axis] ?? null;
    if (raw == null || !Number.isFinite(raw)) return { axis, lean: null, state: 'blank' as const };
    const lean = Math.min(1, Math.max(0, raw));
    return { axis, lean, state: isAxisSettled(row, now) ? ('settled' as const) : ('settling' as const) };
  });
}

/** How many spokes have a point. Drives the empty / partial / full look. */
export function shapeFilledCount(points: readonly ShapePoint[]): number {
  return points.filter((p) => p.state !== 'blank').length;
}

export interface ShapeCoord {
  axis: TraitAxis;
  x: number;
  y: number;
  /** End of the spoke (for the faint grid line and the tap target). */
  edgeX: number;
  edgeY: number;
  state: ShapePointState;
}

export interface ShapeGeometry {
  cx: number;
  cy: number;
  /** Outer ring = a full lean toward the high end. */
  outer: number;
  /** Dashed middle ring = in between. */
  mid: number;
  coords: ShapeCoord[];
  /** Closed outline through every point (blank spokes sit on the middle ring); null under 3 points. */
  path: string | null;
}

/** The radius fraction at the very low end, so a low lean never collapses into the centre. */
export const SHAPE_INNER_FRACTION = 0.18;

export function shapeGeometry(points: readonly ShapePoint[], size: number, outer: number): ShapeGeometry {
  const cx = size / 2;
  const cy = size / 2;
  const span = 1 - SHAPE_INNER_FRACTION;
  const radiusFor = (lean: number) => outer * (SHAPE_INNER_FRACTION + span * lean);
  const mid = radiusFor(0.5);
  const n = points.length;
  const coords = points.map((p, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const r = p.lean == null ? mid : radiusFor(p.lean);
    return {
      axis: p.axis,
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      edgeX: cx + outer * Math.cos(angle),
      edgeY: cy + outer * Math.sin(angle),
      state: p.state,
    };
  });
  const path =
    shapeFilledCount(points) >= 3
      ? `M${coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join('L')}Z`
      : null;
  return { cx, cy, outer, mid, coords, path };
}
