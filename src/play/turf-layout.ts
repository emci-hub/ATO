/**
 * Turf War layout math — pure, no React Native (check:turf-war-layout runs it in Node).
 * Rules: docs/turf-war-layout.md. The stage itself comes from `computeStageFrame`; this file only
 * places things INSIDE it (the board, the pad hit circles, the build card).
 */
import { TAP_MIN } from './stage-frame';

/** Empty strip left and right of the board (pt). */
export const TURF_SIDE_GUTTER = 8;
/** The board never gets smaller than this, however small the stage. */
export const TURF_BOARD_MIN = 160;
/** A pad's tap area: at least this wide (pt), whatever the art size. */
export const PAD_HIT_MIN_PT = TAP_MIN;
/**
 * Pad tap radius (percent of the board side): half the closest pad spacing (12.5 units = 2 cells), so
 * neighbouring circles touch but never overlap. Was 6.5 (circles overlapped by 0.5 unit).
 */
export const PAD_TAP_RADIUS_UNITS = 6.25;
/** A pad in the top 30 % of the board gets its build card BELOW it, every other pad ABOVE. */
export const BUILD_CARD_FLIP_BELOW = 30;
/** The build card is at most this tall (pt), so it always fits above or below a pad on the 375×667 stage. */
export const BUILD_CARD_MAX_H = 120;
/** Gap between the pad's hit circle and the build card (pt). */
export const BUILD_CARD_GAP = 8;

type Size = { width: number; height: number };

/** Board side: the stage width minus the gutters, capped by the stage height. */
export function turfBoardSide(stage: Size): number {
  return Math.max(TURF_BOARD_MIN, Math.min(stage.width - TURF_SIDE_GUTTER * 2, stage.height));
}

/** The board's rect inside the stage: centred both ways (stage coordinates, pt). */
export function turfBoardRect(stage: Size): { x: number; y: number; size: number } {
  const size = turfBoardSide(stage);
  return { x: (stage.width - size) / 2, y: (stage.height - size) / 2, size };
}

/** Pad tap radius in board units (0–100): 6.25, or wider when 6.25 % is under 22 pt (boards under 352 pt). */
export function padTapRadiusUnits(boardSide: number): number {
  return Math.max(PAD_TAP_RADIUS_UNITS, ((PAD_HIT_MIN_PT / 2) / boardSide) * 100);
}

/** Pad tap radius in pt. */
export function padTapRadiusPt(boardSide: number): number {
  return (padTapRadiusUnits(boardSide) / 100) * boardSide;
}

export type BuildCardPlacement = { x: number; y: number; side: 'above' | 'below' };

/**
 * Where a card of `card` size goes for a pad at board units (px, py): above the pad (below it when
 * the pad is in the top 30 % of the board), centred on the pad, then clamped inside the stage.
 * Returns stage coordinates of the card's top-left corner.
 */
export function buildCardPlacement(stage: Size, pad: { x: number; y: number }, card: Size): BuildCardPlacement {
  const board = turfBoardRect(stage);
  const cx = board.x + (pad.x / 100) * board.size;
  const cy = board.y + (pad.y / 100) * board.size;
  const r = padTapRadiusPt(board.size);
  const aboveY = cy - r - BUILD_CARD_GAP - card.height;
  const belowY = cy + r + BUILD_CARD_GAP;
  const fitsAbove = aboveY >= 0;
  const fitsBelow = belowY + card.height <= stage.height;
  let side: 'above' | 'below' = pad.y < BUILD_CARD_FLIP_BELOW ? 'below' : 'above';
  // The preferred side has no room: take the other one (a card ≤ BUILD_CARD_MAX_H always fits one side).
  if (side === 'below' && !fitsBelow && fitsAbove) side = 'above';
  else if (side === 'above' && !fitsAbove && fitsBelow) side = 'below';
  const rawY = side === 'above' ? aboveY : belowY;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  return {
    side,
    x: clamp(cx - card.width / 2, 0, Math.max(0, stage.width - card.width)),
    y: clamp(rawY, 0, Math.max(0, stage.height - card.height)),
  };
}

/**
 * Next-wave preview card (T2b): a FloatLayer card that hangs under the wave chip. It lives in the NoticeLane
 * box + the empty stage strip above the board, so it never covers the board or another region. Float
 * coordinates start at the NoticeLane's top edge.
 */
export const WAVE_PEEK = { width: 344, height: 64, left: 8, top: 2 } as const;

/** The card's rect in float coordinates (origin = NoticeLane top-left). */
export function wavePeekRect(stage: Size): { x: number; y: number; width: number; height: number } {
  return {
    x: WAVE_PEEK.left,
    y: WAVE_PEEK.top,
    // Leaves a TAP_MIN strip at the right for the lane's help (?) button, so the card never covers it.
    width: Math.min(WAVE_PEEK.width, stage.width - WAVE_PEEK.left * 2 - TAP_MIN),
    height: WAVE_PEEK.height,
  };
}
