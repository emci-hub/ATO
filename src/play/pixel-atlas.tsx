/**
 * Frame maps for the phase 3–4 scene atlases.
 *
 * One PNG per scene. Coordinates are art pixels in that PNG.
 * Draw with `AtlasSprite` at ART_PT (2pt per art pixel), nearest-neighbour.
 *
 * Both plates are the approved mockup (room2.py / dive2.py): the same layers,
 * colours and lighting, with the pet and the UI text left out. `glow` and
 * `shimmer` are the dim pass, drawn over the plate only while it flickers.
 * Room: the heart is Ninja Adventure (CC0). Dive sprites are ansimuz
 * Underwater Diving (CC0), recolored the same way as the mockup.
 */
import { Image, type ImageProps } from 'expo-image';
import type { ReactElement } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { ART_PT, pixelRenderStyle, snapArt } from '@/play/pixel-theme';

export const ROOM_ATLAS: ImageProps['source'] = require('@/assets/play/pixel/room-atlas.png');
export const DIVE_ATLAS: ImageProps['source'] = require('@/assets/play/pixel/dive-atlas.png');

export const ROOM_ATLAS_SIZE = { w: 303, h: 454 } as const;
export const DIVE_ATLAS_SIZE = { w: 477, h: 683 } as const;

/** Art size of both mockup plates (room2.py / dive2.py). 1 art px = ART_PT. */
export const MOCKUP_PLATE = { w: 197, h: 426 } as const;

/** Room anchors from room2.py, in art pixels. */
export const MOCKUP_ROOM = {
  feet: 318,
  petX: 98,
  motes: [
    { x: 44, y: 226 },
    { x: 60, y: 252 },
    { x: 78, y: 286 },
  ],
  glow: { x: 92, y: 129 },
  sky: { x: 23, y: 105 },
  meters: { x: 4, y: 31, w: 189, h: 38 },
  coach: { x: 4, y: 370, w: 189, h: 34 },
} as const;

/** Dive anchors from dive2.py, in art pixels. */
export const MOCKUP_DIVE = {
  ly: 284,
  feet: 278,
  petX: 88,
  weed: { x: 34, y: 225 },
  fish: { x: 150, y: 120 },
  shimmer: { x: 18, y: 0 },
  rare: { y: 72 },
  haul: { y: 354 },
  bubbles: [
    { x: 168, y: 250 },
    { x: 154, y: 210 },
    { x: 96, y: 268 },
    { x: 48, y: 190 },
    { x: 120, y: 230 },
  ],
} as const;

/**
 * Where the 197×426 plate sits in a scene box, in points.
 * Scale stays ART_PT on both axes (the 2pt grid — the plate is never stretched).
 * Wider than the plate: centered. Narrower: cropped equally on the sides.
 * `anchorArtY` (the feet) lands `anchorFromBottom` points above the box bottom,
 * so a short phone still shows the pet instead of a band of ceiling.
 * A box tall enough for the whole plate pins it to the top.
 */
export function placePlate(
  viewW: number,
  viewH: number,
  anchorArtY: number,
  anchorFromBottom = 8,
): { left: number; top: number; scale: number } {
  const scale = ART_PT;
  const pw = MOCKUP_PLATE.w * scale;
  const ph = MOCKUP_PLATE.h * scale;
  const left = snapArt((viewW - pw) / 2);
  let top = snapArt(viewH - anchorFromBottom - anchorArtY * scale);
  if (top > 0) top = 0;
  if (top + ph < viewH) top = snapArt(viewH - ph);
  return { left, top, scale };
}

/**
 * Where the 197×426 plate sits in a view, in points.
 * `focusArtY` is the art row that should stay above the bottom edge.
 */
export function mockupOrigin(viewW: number, viewH: number, focusArtY = 210): { left: number; top: number } {
  const placed = placePlate(viewW, viewH, focusArtY, 16);
  return { left: placed.left, top: placed.top };
}

export type AtlasFrame = { x: number; y: number; w: number; h: number };

export const ROOM_FRAMES = {
  'sky': { x: 0, y: 427, w: 43, h: 27 },
  'mote': { x: 44, y: 427, w: 2, h: 2 },
  'sparkle': { x: 47, y: 427, w: 7, h: 7 },
  'heart': { x: 55, y: 427, w: 16, h: 13 },
  'heart-empty': { x: 72, y: 427, w: 16, h: 13 },
  'heart-part': { x: 89, y: 427, w: 16, h: 13 },
  'plate': { x: 0, y: 0, w: 197, h: 426 },
  'glow': { x: 198, y: 0, w: 105, h: 210 },
} as const;

export const DIVE_FRAMES = {
  'weed': { x: 0, y: 427, w: 52, h: 67 },
  'coral': { x: 53, y: 427, w: 48, h: 56 },
  'coral-y': { x: 102, y: 427, w: 46, h: 51 },
  'weed-deep': { x: 149, y: 427, w: 52, h: 67 },
  'coral-deep': { x: 202, y: 427, w: 46, h: 51 },
  'statue-deep': { x: 249, y: 427, w: 92, h: 231 },
  'fish0': { x: 342, y: 427, w: 26, h: 20 },
  'fish2': { x: 369, y: 427, w: 26, h: 20 },
  'fish-big': { x: 396, y: 427, w: 26, h: 20 },
  'bubble': { x: 423, y: 427, w: 18, h: 18 },
  'bubble2': { x: 442, y: 427, w: 17, h: 19 },
  'bubble3': { x: 460, y: 427, w: 17, h: 27 },
  'bubble4': { x: 0, y: 659, w: 10, h: 24 },
  'crate-small': { x: 11, y: 659, w: 14, h: 12 },
  'crate': { x: 26, y: 659, w: 16, h: 14 },
  'chest': { x: 43, y: 659, w: 16, h: 14 },
  'sky': { x: 60, y: 659, w: 120, h: 24 },
  'caustic': { x: 181, y: 659, w: 2, h: 2 },
  'ray': { x: 184, y: 659, w: 2, h: 2 },
  'plate': { x: 0, y: 0, w: 197, h: 426 },
  'shimmer': { x: 198, y: 0, w: 179, h: 324 },
} as const;

export type RoomFrame = keyof typeof ROOM_FRAMES;
export type DiveFrame = keyof typeof DIVE_FRAMES;

type AtlasName = 'room' | 'dive';

const ATLAS = {
  room: { source: ROOM_ATLAS, size: ROOM_ATLAS_SIZE, frames: ROOM_FRAMES },
  dive: { source: DIVE_ATLAS, size: DIVE_ATLAS_SIZE, frames: DIVE_FRAMES },
} as const;

/** One frame of an atlas, integer-scaled. Nothing here is tinted or faded. */
export function AtlasSprite({
  atlas,
  frame,
  scale = ART_PT,
  style,
}: {
  atlas: AtlasName;
  frame: string;
  scale?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const book = ATLAS[atlas];
  const rect = (book.frames as Record<string, AtlasFrame>)[frame];
  if (!rect) return null;
  const k = Math.max(1, Math.round(scale));
  return (
    <View style={[{ width: rect.w * k, height: rect.h * k, overflow: 'hidden' }, style]}>
      <Image
        source={book.source}
        contentFit='fill'
        transition={0}
        accessibilityIgnoresInvertColors
        style={{
          position: 'absolute',
          width: book.size.w * k,
          height: book.size.h * k,
          left: -rect.x * k,
          top: -rect.y * k,
          ...pixelRenderStyle,
        }}
      />
    </View>
  );
}

/** Repeat a frame across a rectangle. The frame itself tiles; the view count stays small. */
export function AtlasFill({
  atlas,
  frame,
  width,
  height,
  scale = ART_PT,
}: {
  atlas: AtlasName;
  frame: string;
  width: number;
  height: number;
  scale?: number;
}) {
  const book = ATLAS[atlas];
  const rect = (book.frames as Record<string, AtlasFrame>)[frame];
  if (!rect || width <= 0 || height <= 0) return null;
  const k = Math.max(1, Math.round(scale));
  const fw = rect.w * k;
  const fh = rect.h * k;
  const cols = Math.max(1, Math.ceil(width / fw));
  const rows = Math.max(1, Math.ceil(height / fh));
  const cells: ReactElement[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      cells.push(
        <View key={`${col}-${row}`} style={{ position: 'absolute', left: col * fw, top: row * fh }}>
          <AtlasSprite atlas={atlas} frame={frame} scale={k} />
        </View>,
      );
    }
  }
  return <View style={{ width, height, overflow: 'hidden' }}>{cells}</View>;
}
