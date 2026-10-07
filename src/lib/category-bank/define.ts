/**
 * Stored category cards (emci, 2026-10-07) — types. Written by hand in the
 * clear voice (src/lib/voice/clear-voice.ts), never by a model.
 *
 * A bar category has three cells, cut from `reading.bar` by `traitBand`
 * (low / mid / high). A map category has four, from its two axes in
 * `def.axes` order: h/l for x, then h/l for y, each at 0.5 (hh, hl, lh, ll).
 *
 * Every cell has three wordings of each part. The picker turns through them
 * week by week, so a card someone opens often does not read the same forever.
 * The watch-out is the flip side of that cell's strength, and both ends of
 * every category get a real strength.
 */
export type Three = readonly [string, string, string];

export interface CardCell {
  summary: Three;
  strength: Three;
  watchOut: Three;
  tryThis: Three;
}

export type BarCell = 'low' | 'mid' | 'high';
export type MapCell = 'hh' | 'hl' | 'lh' | 'll';

export interface BarCard {
  shape: 'bar';
  cells: Record<BarCell, CardCell>;
}

export interface MapCard {
  shape: 'map';
  cells: Record<MapCell, CardCell>;
}

export type CategoryCardBank = BarCard | MapCard;

export const BAR_CELLS: readonly BarCell[] = ['low', 'mid', 'high'];
export const MAP_CELLS: readonly MapCell[] = ['hh', 'hl', 'lh', 'll'];
export const CARD_PARTS = ['summary', 'strength', 'watchOut', 'tryThis'] as const;
export type CardPart = (typeof CARD_PARTS)[number];
