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

/** Labels sit this far out from the outer ring (1.1 = 10% past it). */
export const SHAPE_LABEL_RING = 1.1;
/** Rough width of one character of the label font, as a share of its size. */
const LABEL_CHAR_WIDTH = 0.56;

/**
 * The biggest outer radius at which every trait name still fits inside the
 * square (emci, 2026-10-08: the diagram was too small to tap). Each label is
 * anchored like the component draws it (start on the right, end on the left,
 * middle at the top and bottom), so the long names on the slanted spokes are
 * what limit it, not the short ones at 3 and 9 o'clock.
 */
export function labeledOuterRadius(names: readonly string[], size: number, fontSize: number, pad = 4): number {
  const half = size / 2;
  let best = size * 0.36;
  names.forEach((name, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / names.length;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const width = name.length * fontSize * LABEL_CHAR_WIDTH;
    // Horizontal room. A centred label (top or bottom spoke) only needs half its
    // width either side of the centre, which never limits it at these sizes.
    if (Math.abs(cos) >= 0.05) {
      best = Math.min(best, (half - pad - width) / (SHAPE_LABEL_RING * Math.abs(cos)));
    }
    // Vertical room (the label's text height sits below the anchor line at the bottom).
    if (Math.abs(sin) > 0.05) {
      best = Math.min(best, (half - pad - fontSize) / (SHAPE_LABEL_RING * Math.abs(sin)));
    }
  });
  return Math.max(best, size * 0.22);
}

/**
 * Which trait a tap anywhere on the diagram means: the spoke nearest in
 * angle, so every trait owns a whole slice of the circle instead of a dot.
 * Null for a tap right on the centre, where no direction is clear.
 */
export function axisAtPoint(geo: Pick<ShapeGeometry, 'cx' | 'cy' | 'outer' | 'coords'>, x: number, y: number): TraitAxis | null {
  const dx = x - geo.cx;
  const dy = y - geo.cy;
  if (Math.hypot(dx, dy) < geo.outer * 0.12) return null;
  const n = geo.coords.length;
  if (n === 0) return null;
  // Spoke i points at -90° + i·(360°/n); turn the tap into the same index.
  const angle = Math.atan2(dy, dx) + Math.PI / 2;
  const step = (2 * Math.PI) / n;
  const index = ((Math.round(angle / step) % n) + n) % n;
  return geo.coords[index]!.axis;
}
