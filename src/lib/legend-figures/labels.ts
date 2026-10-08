/**
 * Legend figures — the plain words the cards use (no UI imports, so the
 * offline check can pin them).
 */
import type { LegendFigure } from './types';

export const STORY_NOT_HISTORY = 'Story, not history';
export const REAL_ANIMAL = 'A real animal';
export const AI_LEGEND_PLACEHOLDER = 'Find a new legend with AI · coming soon';

/** "Leonardo da Vinci, as an inventor" — the name with its role, when it has one. */
export function legendTitle(legend: LegendFigure): string {
  return legend.role ? `${legend.name}, ${legend.role}` : legend.name;
}

/** What a screen reader hears on a "???" frame: never the name. */
export function frameA11yLabel(index: number, total: number, chapter: boolean): string {
  return chapter
    ? `Hidden chapter ${index + 1} of ${total}, double tap to reveal`
    : `Hidden legend ${index + 1} of ${total}, double tap to reveal`;
}
