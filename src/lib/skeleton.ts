/**
 * Skeleton geometry for Kenney's "Shape Characters" pack.
 *
 * Every number here is derived from the pack's own data rather than eyeballed:
 *
 * - Sizes come from `Spritesheet/spritesheet_default.xml`. All four bodies are
 *   exactly 80x80, the largest face is 59x42 (face_c / face_i), and the widest
 *   hand is 36x40. Sprites are tightly cropped, so the atlas size IS the art.
 * - Face scale per shape is the largest the 59x42 face slot can be while
 *   staying inside that body's alpha silhouette when centred on the body.
 *   Square and squircle fit it at full size; the rhombus tapers, so it caps at
 *   0.9.
 * - Hand x per shape is the body's silhouette edge measured at the hand row,
 *   plus 1px clearance, minus half the hand slot — i.e. the hand sits just
 *   outside the body instead of a fixed guessed offset. Measured edges at row
 *   54: circle 2/78, rhombus 8/72, square 0/80, squircle 0/80.
 *
 * Left and right are the VIEWER's: `handLeft` sits past the body's left edge
 * (x < 0) and `handRight` past its right edge (x > 1). The pack ships one hand
 * sprite with no handedness in its name, so the renderer mirrors one copy.
 */

/** Body sprite side length in pack pixels. Shared by all four shapes. */
export const BODY_PX = 80;

/** Largest face sprite in the pack, from the atlas XML. */
export const FACE_SLOT_PX = { w: 59, h: 42 };

/** Widest/tallest hand sprite in the pack, from the atlas XML. */
export const HAND_SLOT_PX = { w: 36, h: 40 };

/** Vertical centre of both hands, as a fraction of the body box. */
export const HAND_ROW = 0.68;

export type ShapeBaseId = 'circle' | 'rhombus' | 'square' | 'squircle';

/**
 * A part's placement, expressed as fractions of the body's bounding box.
 * `x`/`y` are the part's CENTRE — (0.5, 0.5) is the middle of the body, and
 * values outside 0..1 sit outside the body. `scale` multiplies the sprite's
 * native pack size, so 1 renders it at the pack's intended 1:1 ratio.
 */
export interface Anchor {
  x: number;
  y: number;
  scale: number;
}

export interface Skeleton {
  face: Anchor;
  handLeft: Anchor;
  handRight: Anchor;
}

export const SHAPE_SKELETONS: Record<ShapeBaseId, Skeleton> = {
  circle: {
    face: { x: 0.5, y: 0.5, scale: 1 },
    handLeft: { x: -0.2125, y: HAND_ROW, scale: 1 },
    handRight: { x: 1.2125, y: HAND_ROW, scale: 1 },
  },
  rhombus: {
    face: { x: 0.5, y: 0.5, scale: 0.9 },
    handLeft: { x: -0.1375, y: HAND_ROW, scale: 1 },
    handRight: { x: 1.1375, y: HAND_ROW, scale: 1 },
  },
  square: {
    face: { x: 0.5, y: 0.5, scale: 1 },
    handLeft: { x: -0.2375, y: HAND_ROW, scale: 1 },
    handRight: { x: 1.2375, y: HAND_ROW, scale: 1 },
  },
  squircle: {
    face: { x: 0.5, y: 0.5, scale: 1 },
    handLeft: { x: -0.2375, y: HAND_ROW, scale: 1 },
    handRight: { x: 1.2375, y: HAND_ROW, scale: 1 },
  },
};

/**
 * Composite canvas, in body-box units: the hands reach outside the body, so the
 * renderer needs room around it. Derived from the anchors so it stays correct
 * if they ever change.
 */
export const SHAPE_CANVAS = {
  w:
    1 +
    2 *
      Math.max(
        ...Object.values(SHAPE_SKELETONS)
          .flatMap((skeleton) => [skeleton.handLeft, skeleton.handRight])
          .flatMap((hand) => [
            // How far the hand reaches past each edge of the body box, so the
            // canvas fits whichever side each hand ends up on.
            HAND_SLOT_PX.w / 2 / BODY_PX - hand.x,
            hand.x + HAND_SLOT_PX.w / 2 / BODY_PX - 1,
          ]),
      ),
  h: 1,
};
