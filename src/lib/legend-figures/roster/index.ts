/**
 * The museum: every legend, one file per hall. Order inside a file is the
 * display order in that hall; ids never change (roster-ids.json pins them).
 */
import type { LegendFigure, LegendHall } from '../types';
import { ART_LEGENDS } from './art';
import { EXPLORER_LEGENDS } from './explorers';
import { GHOST_LEGENDS } from './ghosts';
import { HISTORY_LEGENDS } from './history';
import { MYTH_LEGENDS } from './myth';
import { SCIENCE_LEGENDS } from './science';
import { SPORT_LEGENDS } from './sport';

export const LEGEND_ROSTER: readonly LegendFigure[] = [
  ...HISTORY_LEGENDS,
  ...SCIENCE_LEGENDS,
  ...ART_LEGENDS,
  ...EXPLORER_LEGENDS,
  ...SPORT_LEGENDS,
  ...MYTH_LEGENDS,
  ...GHOST_LEGENDS,
];

const BY_ID: ReadonlyMap<string, LegendFigure> = new Map(LEGEND_ROSTER.map((legend) => [legend.id, legend]));

export function legendById(id: string): LegendFigure | null {
  return BY_ID.get(id) ?? null;
}

export function legendsInHall(hall: LegendHall): LegendFigure[] {
  return LEGEND_ROSTER.filter((legend) => legend.hall === hall);
}
