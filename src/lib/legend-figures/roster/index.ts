/**
 * The museum: every legend, one file per hall (12 halls). Order inside a file
 * is the display order in that hall; ids never change (roster-ids.json pins them).
 */
import type { LegendFigure, LegendHall } from '../types';
import { ANIMAL_LEGENDS } from './animals';
import { ART_LEGENDS } from './art';
import { CHANGEMAKER_LEGENDS } from './changemakers';
import { EXPLORER_LEGENDS } from './explorers';
import { GHOST_LEGENDS } from './ghosts';
import { HEALER_LEGENDS } from './healers';
import { MUSIC_LEGENDS } from './music';
import { MYTH_LEGENDS } from './myth';
import { SCIENCE_LEGENDS } from './science';
import { SCREEN_LEGENDS } from './screen';
import { SPORT_LEGENDS } from './sport';
import { WORDS_LEGENDS } from './words';

export const LEGEND_ROSTER: readonly LegendFigure[] = [
  ...SCIENCE_LEGENDS,
  ...ART_LEGENDS,
  ...MUSIC_LEGENDS,
  ...WORDS_LEGENDS,
  ...SCREEN_LEGENDS,
  ...EXPLORER_LEGENDS,
  ...SPORT_LEGENDS,
  ...HEALER_LEGENDS,
  ...CHANGEMAKER_LEGENDS,
  ...MYTH_LEGENDS,
  ...GHOST_LEGENDS,
  ...ANIMAL_LEGENDS,
];

const BY_ID: ReadonlyMap<string, LegendFigure> = new Map(LEGEND_ROSTER.map((legend) => [legend.id, legend]));

export function legendById(id: string): LegendFigure | null {
  return BY_ID.get(id) ?? null;
}

export function legendsInHall(hall: LegendHall): LegendFigure[] {
  return LEGEND_ROSTER.filter((legend) => legend.hall === hall);
}
