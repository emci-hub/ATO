import type { KenneyFamilyManifest } from '../types';

/**
 * Shape Characters (Kenney) manifest.
 *
 * Anchors and sizes are measured from the pack's own data (same method as the
 * original Stage-3 skeleton): sprite sizes come from Spritesheet/
 * spritesheet_default.xml, hand x is the body's silhouette edge at the hand
 * row plus 1px clearance, and face scale is the largest the 59x42 face slot
 * fits inside each body's alpha silhouette. All values are in body-box units
 * (body = 1.0 × 1.0).
 *
 * Body-dependent placement: each body state "hosts" the face and hand
 * placements (the hands sit just outside the body's silhouette, which differs
 * per shape), so the renderer needs no per-shape branches.
 */
export const SHAPE_MANIFEST: KenneyFamilyManifest = {
  family: 'shape',
  label: 'Shape Characters',
  bodyPx: 80,
  // Hands reach outside the body box; derived like the original SHAPE_CANVAS.
  canvas: { w: 1.925, h: 1 },
  colorVariants: [
    { id: 'blue', label: 'Blue', rgb: [115, 142, 233] },
    { id: 'green', label: 'Green', rgb: [100, 191, 118] },
    { id: 'pink', label: 'Pink', rgb: [255, 130, 195] },
    { id: 'purple', label: 'Purple', rgb: [144, 90, 229] },
    { id: 'red', label: 'Red', rgb: [218, 84, 99] },
    { id: 'yellow', label: 'Yellow', rgb: [250, 181, 53] },
  ],
  parts: [
    {
      id: 'hand',
      z: 0,
      instances: [],
      colorable: true,
      sourcePattern: 'hand',
      states: {
        // 'hidden' is a magic rest state: no hand layer renders. It is the
        // DEFAULT for hands — the arms only appear for a brief event gesture.
        hidden: { asset: 'hidden', size: { w: 0.425, h: 0.475 } },
        open: { asset: 'open', raw: 'hand_yellow_open', size: { w: 0.425, h: 0.475 } },
        closed: { asset: 'closed', raw: 'hand_yellow_closed', size: { w: 0.4375, h: 0.425 } },
        peace: { asset: 'peace', raw: 'hand_yellow_peace', size: { w: 0.35, h: 0.5 } },
        point: { asset: 'point', raw: 'hand_yellow_point', size: { w: 0.425, h: 0.45 } },
        rock: { asset: 'rock', raw: 'hand_yellow_rock', size: { w: 0.45, h: 0.475 } },
        thumb: { asset: 'thumb', raw: 'hand_yellow_thumb', size: { w: 0.4, h: 0.475 } },
      },
    },
    {
      id: 'body',
      z: 1,
      instances: [{ anchor: { x: 0.5, y: 0.5, scale: 1 } }],
      colorable: true,
      sourcePattern: 'body',
      states: {
        circle: {
          asset: 'circle',
          size: { w: 1, h: 1 },
          // Hands sit just outside the circle's silhouette edge; the pack's one
          // hand sprite has its thumb toward the viewer's left, so the right
          // hand renders as-is and the left mirrors.
          places: {
            hand: [
              { anchor: { x: 1.2125, y: 0.68, scale: 1 } },
              { anchor: { x: -0.2125, y: 0.68, scale: 1 }, flip: true },
            ],
            face: [{ anchor: { x: 0.5, y: 0.5, scale: 1 } }],
          },
        },
        rhombus: {
          asset: 'rhombus',
          size: { w: 1, h: 1 },
          places: {
            hand: [
              { anchor: { x: 1.1375, y: 0.68, scale: 1 } },
              { anchor: { x: -0.1375, y: 0.68, scale: 1 }, flip: true },
            ],
            // Tapered silhouette: the 59x42 face slot only fits at 0.9.
            face: [{ anchor: { x: 0.5, y: 0.5, scale: 0.9 } }],
          },
        },
        square: {
          asset: 'square',
          size: { w: 1, h: 1 },
          places: {
            hand: [
              { anchor: { x: 1.2375, y: 0.68, scale: 1 } },
              { anchor: { x: -0.2375, y: 0.68, scale: 1 }, flip: true },
            ],
            face: [{ anchor: { x: 0.5, y: 0.5, scale: 1 } }],
          },
        },
        squircle: {
          asset: 'squircle',
          size: { w: 1, h: 1 },
          places: {
            hand: [
              { anchor: { x: 1.2375, y: 0.68, scale: 1 } },
              { anchor: { x: -0.2375, y: 0.68, scale: 1 }, flip: true },
            ],
            face: [{ anchor: { x: 0.5, y: 0.5, scale: 1 } }],
          },
        },
      },
    },
    {
      id: 'face',
      z: 2,
      instances: [],
      colorable: false,
      sourcePattern: 'face',
      states: {
        // The pack's looks: each maps to one of its 12 pre-composed faces.
        even: { asset: 'face_a', size: { w: 0.625, h: 0.3625 } },
        tired: { asset: 'face_h', size: { w: 0.6875, h: 0.45 } },
        set: { asset: 'face_f', size: { w: 0.6875, h: 0.4125 } },
        listen: { asset: 'face_c', size: { w: 0.7375, h: 0.375 } },
        glow: { asset: 'face_l', size: { w: 0.6625, h: 0.4625 } },
      },
    },
  ],
  animations: {
    // Blink: the pack's closed-eye face is face_l ("glow"). Brief swap, then
    // restore the recipe's chosen look. (No idle gesture cycle — hands are
    // hidden at rest and gestures are event-driven via `gesture(state)`.)
    blink: {
      part: 'face',
      states: ['glow'],
      intervalMs: 2800,
      holdMs: 140,
      jitterMs: 1400,
    },
  },
  // Event-driven hand gestures, each keyed by the app action that triggers it.
  eventGestures: {
    checkDone: { state: 'thumb' },
    talkReply: { state: 'point' },
    circleConnected: { state: 'peace' },
    posterShared: { state: 'peace' },
  },
};
