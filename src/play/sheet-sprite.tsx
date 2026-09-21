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
 *
 * The Avatar overlay draws with `expo-image` OUTSIDE the SVG board (an
 * Animated.View, sized by Reanimated shared values), so it needs a second
 * crop technique: `ClipImage` clips an overflow-hidden `View` around an
 * `expo-image` scaled up to the sheet's full size and offset by the frame's
 * top-left, same maths as `SheetSprite`'s viewBox, expressed in CSS instead.
 */
import { Image as ExpoImage } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { Svg, Image as SvgImage } from 'react-native-svg';

import type { ClipDrawable } from '@/play/skin';
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

/** Resolve a `ClipDrawable`'s sheet half to a drawable frame, or undefined
 * when it's the legacy half (caller draws `drawable.source` directly then). */
export function drawableFrame(drawable: ClipDrawable): SheetFrame | undefined {
  return drawable.kind === 'sheet' ? sheetFrame(drawable.sheetKey, drawable.frameKey) : undefined;
}

type ClipSpriteProps = {
  drawable: ClipDrawable | undefined;
  x: number;
  y: number;
  size: number;
  opacity?: number;
};

/** `SheetSprite`, but accepts a `ClipDrawable` and draws whichever half it
 * resolved to — the sheet crop or the legacy per-frame PNG. Every SVG-board
 * call site (towers, bound bosses) reads through this one component, so a
 * hero's sheets and its still-unpacked rotation art draw identically. */
export function ClipSprite({ drawable, x, y, size, opacity }: ClipSpriteProps) {
  if (!drawable) return null;
  if (drawable.kind === 'legacy') {
    return (
      <SvgImage href={drawable.source} x={x} y={y} width={size} height={size} opacity={opacity} />
    );
  }
  const frame = drawableFrame(drawable);
  // Unreachable today (see ClipImage) — PLAY_SHEETS and PLAY_SHEET_ART are
  // generated together — but a stray gap should drop the sprite, not crash.
  return frame ? <SheetSprite frame={frame} x={x} y={y} size={size} opacity={opacity} /> : null;
}

type ClipImageProps = {
  drawable: ClipDrawable | undefined;
};

/**
 * `expo-image` equivalent of `ClipSprite`, for the Avatar overlay (outside
 * the SVG board, sized by a Reanimated shared value the JS thread never sees
 * as a number). Fills its parent box exactly as the legacy `<Image contain>`
 * did, so it's a drop-in for `avatarArt`'s existing 100%/100% layout — no
 * pixel size is read or needed.
 *
 * The crop is expressed entirely in PERCENTAGES of that box: an
 * overflow-hidden wrapper at 100%/100%, holding the sheet image scaled to
 * `sheetSize / frameSize × 100%` and shifted by `-frameOrigin / frameSize ×
 * 100%`. Percentage layout resolves against the parent's real size at layout
 * time regardless of whether that size is animated, so this stays correct
 * frame to frame with no JS-thread involvement — the CSS form of
 * `SheetSprite`'s SVG viewBox. Assumes a square frame in a square box, true
 * for every hero sprite packed so far (128×128 samples); a non-square frame
 * would need `resizeMode`-style letterboxing this skips.
 */
export function ClipImage({ drawable }: ClipImageProps) {
  if (!drawable) return null;
  if (drawable.kind === 'legacy') {
    return (
      <ExpoImage source={drawable.source} contentFit="contain" style={styles.legacyFill} />
    );
  }
  const frame = drawableFrame(drawable);
  const source = frame ? playSheetArt(frame.sheetKey) : undefined;
  // Unreachable today — the registry and its requires are generated together
  // — but a stray gap between PLAY_SHEETS and PLAY_SHEET_ART should drop the
  // sprite quietly rather than crash.
  if (!frame || !source) return null;
  const { rect } = frame;
  return (
    <View style={styles.cropWrap}>
      <ExpoImage
        source={source}
        contentFit="fill"
        style={{
          position: 'absolute',
          width: `${(frame.sheetW / rect.w) * 100}%`,
          height: `${(frame.sheetH / rect.h) * 100}%`,
          left: `${(-rect.x / rect.w) * 100}%`,
          top: `${(-rect.y / rect.h) * 100}%`,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  legacyFill: { width: '100%', height: '100%' },
  cropWrap: { width: '100%', height: '100%', overflow: 'hidden' },
});
