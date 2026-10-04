/**
 * Pixel UI theme for Divecore phase 1.
 *
 * 1 art pixel = 2pt. Panels, type and pixel-art boxes snap to that grid.
 * Tiny5 labels (em is 8 font-pixels, so 28pt is 3.5pt per font pixel and the
 * 5px cap draws at 17.5pt). Inter carries body copy and numbers.
 * Both faces are OFL; the files live in assets/play/fonts.
 */

/** Points per art pixel. */
export const ART_PT = 2;

export const PIXEL = {
  ink: '#05070D',
  cyan: '#22D3EE',
  amber: '#FFC83D',
  text: '#F4FBFF',
  body: '#D5E2EF',
  muted: '#8FA3BF',
  heart: '#FF4D6D',
  heartEmpty: '#5A4568',
  onFill: '#05070D',
} as const;

/**
 * Label + body faces. Family names match the `usePixelFonts` keys.
 * Switching the pair (for example to Departure Mono + Rajdhani) is this
 * object plus the matching file in `usePixelFonts`.
 */
export const PIXEL_FONT = {
  label: 'Tiny5_Regular',
  body: 'Inter_400Regular',
} as const;

/**
 * Tiny5: unitsPerEm 1024, one font pixel = 128 units, cap height = 5px.
 * 28pt → 3.5pt per font pixel, cap = 17.5pt (never under 16pt).
 */
export const PIXEL_LABEL_PT = 28;
export const PIXEL_BODY_PT = 16;
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
