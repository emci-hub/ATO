/**
 * Sheet sprite — draws ONE frame out of a packed sheet.
 *
 * The board is one big `<Svg>` in board units (0..100), so a sprite is a nested
 * `<Svg>` placed at the sprite's box: its own `viewBox` is the frame's rect in
 * SHEET pixels, so the parent only ever sees that window. The sheet image is
 * drawn at its full pixel size inside that window and everything outside the
 * viewBox is clipped away by SVG itself — no ClipPath, no extra nodes.
 *
 * Replaces one `<Image href={framePng}>` with one `<Svg><Image href={sheet}/></Svg>`,
 * so the draw-call count per sprite is unchanged.
 */
import { Svg, Image as SvgImage } from 'react-native-svg';

import {
  PLAY_SHEETS,
  PLAY_SHEET_ART,
  type SheetFrameRect,
} from '@/play/generated-play-sheets';

/** A resolved frame: which sheet, and where the frame sits inside it. */
export type SheetFrame = {
  sheetKey: string;
  rect: SheetFrameRect;
  sheetW: number;
  sheetH: number;
};

/**
 * Resolve `'<sheetKey>'` + `'<dir>/frame_NNN'` to a drawable frame, or
 * undefined when the clip or frame is not packed (caller keeps its fallback).
 */
export function sheetFrame(sheetKey: string, frameKey: string): SheetFrame | undefined {
  const sheet = PLAY_SHEETS[sheetKey];
  const rect = sheet?.frames[frameKey];
  if (!sheet || !rect) return undefined;
  return { sheetKey, rect, sheetW: sheet.sheetW, sheetH: sheet.sheetH };
}

/** The sheet's image source. Swapped for a cached remote URI when the art moves
 * off the bundle — every caller goes through here, so that stays a one-liner. */
export function playSheetArt(sheetKey: string) {
  return PLAY_SHEET_ART[sheetKey];
}

type Props = {
  frame: SheetFrame;
  /** Top-left of the sprite box, board units. */
  x: number;
  y: number;
  /** Drawn box edge, board units. */
  size: number;
  opacity?: number;
};

/** One frame of a packed sheet, drawn into a board-units box. */
export function SheetSprite({ frame, x, y, size, opacity }: Props) {
  const source = playSheetArt(frame.sheetKey);
  if (!source) return null;
  const { rect } = frame;
  return (
    <Svg
      x={x}
      y={y}
      width={size}
      height={size}
      viewBox={`${rect.x} ${rect.y} ${rect.w} ${rect.h}`}
      opacity={opacity}>
      <SvgImage
        href={source}
        x={0}
        y={0}
        width={frame.sheetW}
        height={frame.sheetH}
        preserveAspectRatio="none"
      />
    </Svg>
  );
}
