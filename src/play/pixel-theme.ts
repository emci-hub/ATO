/**
 * Pixel UI theme for Divecore.
 *
 * 1 art pixel = 2pt. Panels, type and pixel-art boxes snap to that grid.
 * Departure Mono labels (em is 11 font-pixels, so 22pt is 2pt per font pixel
 * and the 8px cap draws at 16pt). The line box is that em — no extra leading —
 * so a label centers on the cap. Rajdhani SemiBold carries body copy and
 * numbers, at the mockup's sizes (no faux bold — the SemiBold file is the
 * weight). Text carries a 1-art-px shadow, down and right, radius 0.
 * Both faces are OFL.
 */

/** Points per art pixel. */
export const ART_PT = 2;

export const PIXEL = {
  ink: '#05070D',
  cyan: '#22D3EE',
  cyanHi: '#8FD3FF',
  cyanLo: '#0B8A8F',
  amber: '#F9C22B',
  amberHi: '#FBFF86',
  amberLo: '#F79617',
  glow: '#0B5E65',
  glowAmber: '#7A3045',
  slot: '#3E3546',
  text: '#F4FBFF',
  body: '#D5E2EF',
  /** Mockup secondary text (`DIM`). */
  dim: '#7F708A',
  muted: '#8FA3BF',
  heart: '#FF4D6D',
  heartEmpty: '#5A4568',
  onFill: '#05070D',
} as const;

/**
 * Label + body faces. Family names match the `usePixelFonts` keys.
 * The whole Play UI reads this pair.
 */
export const PIXEL_FONT = {
  label: 'DepartureMono_Regular',
  body: 'Rajdhani_600SemiBold',
} as const;

/**
 * Departure Mono: em 11, drawn at 2pt per font pixel (the mockup's
 * 1 font pixel = 1 art pixel). Cap height is 8px → 16pt.
 */
export const PIXEL_LABEL_PT = 22;
/**
 * Rajdhani runs small in the mockup, which sizes it at `pt * 1.18`.
 * The coach sentence is 16pt → 19pt. The secondary line ("2 treats left")
 * is 14pt → 17pt. Shell / risk numbers are 18pt and 17pt → 21pt and 20pt.
 */
export const PIXEL_BODY_PT = 19;
export const PIXEL_CAPTION_PT = 17;
export const PIXEL_NUM_PT = 21;
/** Every tappable control is at least this tall. */
export const PIXEL_TAP_PT = 48;

/**
 * Nearest-neighbour hint. Web honours `imageRendering`; native expo-image
 * has no filter prop, so integer sizes (below) are what keep the scale crisp.
 */
export const pixelRenderStyle = { imageRendering: 'pixelated' as const };

/** Snap a point measurement onto the art-pixel grid. */
export function snapArt(pt: number): number {
  if (!Number.isFinite(pt)) return 0;
  return Math.round(pt / ART_PT) * ART_PT;
}

/**
 * Integer scale of a source bitmap, in points.
 * Prefers 1 art px = ART_PT pt. When that is taller than `maxPt`, uses the
 * largest integer scale that still fits (never a fractional scale).
 */
export function crispSpan(sourcePx: number, maxPt?: number): number {
  const src = Math.max(1, Math.round(sourcePx));
  const target = src * ART_PT;
  if (maxPt == null || target <= maxPt) return target;
  const k = Math.max(1, Math.floor(maxPt / src));
  return src * k;
}
