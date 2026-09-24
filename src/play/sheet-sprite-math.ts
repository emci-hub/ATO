/**
 * Sheet-sprite placement maths — kept in a plain module (no react-native /
 * expo imports) so `scripts/check-sheet-sprite.ts` can execute it directly in
 * Node and assert real numbers, instead of only type-checking JSX.
 *
 * This exists because the bug it guards was invisible to every check we had:
 * the sprite was drawn with a nested `<Svg x={} y={}>`, which react-native-svg
 * renders as a native view and positions by LAYOUT, ignoring `x`/`y` — so
 * every packed sprite drew at the board's origin. Sheet Lab compared sprites
 * at x=0,y=0, where that bug is invisible, so it passed. The check that
 * replaces it asserts placement at a NON-ZERO position.
 */

/** Where a frame sits inside its sheet, in sheet pixels. */
export type SpriteRect = { x: number; y: number; w: number; h: number };

/** The two SVG values that place one frame into a board-units box. */
export type SheetSpritePlacement = {
  /** `transform` for the wrapping `<G>`. */
  transform: string;
  /** Top-left the sheet image is drawn at, inside the scaled group. */
  imageX: number;
  imageY: number;
  /** Clip rect (always the frame's own size, anchored at the group origin). */
  clip: { x: number; y: number; width: number; height: number };
};

/**
 * Place one sheet frame into a `size × size` box whose top-left is (`x`, `y`)
 * in board units.
 *
 * `translate(x, y)` moves the group's origin to the box's top-left;
 * `scale(size / rect.w, size / rect.h)` makes one FRAME pixel one box unit, so
 * the frame fills the box exactly. The sheet is then drawn at
 * `(-rect.x, -rect.y)`, sliding the wanted frame onto the origin, and the clip
 * hides every neighbouring frame.
 */
export function sheetSpritePlacement(
  rect: SpriteRect,
  x: number,
  y: number,
  size: number,
): SheetSpritePlacement {
  return {
    transform: `translate(${x}, ${y}) scale(${size / rect.w}, ${size / rect.h})`,
    imageX: -rect.x,
    imageY: -rect.y,
    clip: { x: 0, y: 0, width: rect.w, height: rect.h },
  };
}

/**
 * NOTE — there is deliberately no `placedFrameBox()` helper here.
 *
 * An earlier version of this file had one, and the check script asserted the
 * frame "lands exactly on its box" through it. Review caught that it was a
 * TAUTOLOGY: `(-rect.x + rect.x) * scale + x` reduces to `x` by algebra, so it
 * returned the caller's own box no matter what `sheetSpritePlacement` did —
 * an assertion that could never fail, guarding the exact bug this module
 * exists for. The check now asserts the literal transform string instead, so a
 * wrong scale factor fails loudly.
 */
