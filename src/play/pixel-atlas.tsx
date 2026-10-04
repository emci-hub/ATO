/**
 * Frame maps for the phase 3–4 scene atlases.
 *
 * One PNG per scene. Coordinates are art pixels in that PNG.
 * Draw with `AtlasSprite` at ART_PT (2pt per art pixel), nearest-neighbour.
 *
 * Room: Ninja Adventure (CC0) floor tile, bush, potted plant and heart,
 * plus original pixel props (window, shelf, lamp, rug, bed, bowl).
 * Dive: ansimuz Underwater Diving (CC0), recolored onto Resurrect 64,
 * plus an original pixel sky and find chests.
 */
import { Image, type ImageProps } from 'expo-image';
import type { ReactElement } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { ART_PT, pixelRenderStyle } from '@/play/pixel-theme';

export const ROOM_ATLAS: ImageProps['source'] = require('@/assets/play/pixel/room-atlas.png');
export const DIVE_ATLAS: ImageProps['source'] = require('@/assets/play/pixel/dive-atlas.png');

export const ROOM_ATLAS_SIZE = { w: 477, h: 156 } as const;
export const DIVE_ATLAS_SIZE = { w: 959, h: 1066 } as const;

export type AtlasFrame = { x: number; y: number; w: number; h: number };

export const ROOM_FRAMES = {
  'base': { x: 246, y: 81, w: 160, h: 6 },
  'bed': { x: 0, y: 81, w: 40, h: 22 },
  'bowl': { x: 229, y: 81, w: 16, h: 8 },
  'bush': { x: 447, y: 0, w: 30, h: 29 },
  'floor': { x: 286, y: 0, w: 160, h: 32 },
  'heart': { x: 143, y: 81, w: 16, h: 16 },
  'lamp': { x: 267, y: 0, w: 18, h: 52 },
  'lamp-hot': { x: 0, y: 104, w: 18, h: 52 },
  'cloud': { x: 20, y: 104, w: 16, h: 8 },
  'mote': { x: 38, y: 104, w: 2, h: 2 },
  'picture': { x: 197, y: 81, w: 16, h: 14 },
  'plant': { x: 214, y: 81, w: 14, h: 14 },
  'pool': { x: 160, y: 81, w: 36, h: 16 },
  'rug': { x: 41, y: 81, w: 56, h: 22 },
  'shelf': { x: 98, y: 81, w: 44, h: 20 },
  'treat': { x: 407, y: 81, w: 8, h: 5 },
  'wall': { x: 0, y: 0, w: 160, h: 80 },
  'window-day': { x: 161, y: 0, w: 52, h: 58 },
  'window-night': { x: 214, y: 0, w: 52, h: 58 },
} as const;

export const DIVE_FRAMES = {
  'arch': { x: 0, y: 746, w: 245, h: 186 },
  'bg0': { x: 0, y: 0, w: 288, h: 256 },
  'bg1': { x: 289, y: 0, w: 288, h: 256 },
  'bg2': { x: 578, y: 0, w: 288, h: 256 },
  'bg3': { x: 0, y: 257, w: 288, h: 256 },
  'bg4': { x: 289, y: 257, w: 288, h: 256 },
  'bg5': { x: 578, y: 257, w: 288, h: 256 },
  'bubble': { x: 276, y: 933, w: 7, h: 7 },
  'bubble2': { x: 24, y: 970, w: 7, h: 7 },
  'caustic': { x: 8, y: 970, w: 12, h: 6 },
  'ray': { x: 0, y: 970, w: 4, h: 96 },
  'bubbles': { x: 795, y: 746, w: 83, h: 36 },
  'chest': { x: 225, y: 933, w: 16, h: 14 },
  'coral': { x: 605, y: 746, w: 48, h: 56 },
  'coral-deep': { x: 654, y: 746, w: 48, h: 56 },
  'crate': { x: 242, y: 933, w: 16, h: 14 },
  'crate-small': { x: 259, y: 933, w: 16, h: 14 },
  'fish-big': { x: 750, y: 746, w: 44, h: 39 },
  'fish0': { x: 121, y: 933, w: 26, h: 20 },
  'fish1': { x: 148, y: 933, w: 25, h: 20 },
  'fish2': { x: 174, y: 933, w: 26, h: 20 },
  'fish3': { x: 201, y: 933, w: 23, h: 20 },
  'kelp': { x: 656, y: 514, w: 198, h: 205 },
  'lattice': { x: 214, y: 514, w: 220, h: 220 },
  'lattice-deep': { x: 435, y: 514, w: 220, h: 220 },
  'seabed': { x: 299, y: 746, w: 152, h: 60 },
  'seabed-deep': { x: 452, y: 746, w: 152, h: 60 },
  'sky': { x: 0, y: 933, w: 120, h: 36 },
  'statue': { x: 867, y: 257, w: 92, h: 231 },
  'statue-deep': { x: 0, y: 514, w: 92, h: 231 },
  'totem': { x: 93, y: 514, w: 120, h: 231 },
  'weed': { x: 703, y: 746, w: 46, h: 51 },
  'weed-deep': { x: 246, y: 746, w: 52, h: 67 },
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
