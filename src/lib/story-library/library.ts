import { LEGEND_LINES } from './legend-lines';
import { STORY_LINES } from './lines';
import type { StoryLibrary } from './types';

/** Shipped library. Legends cards and category deep dives render from these lines. */
export const STORY_LIBRARY: StoryLibrary = {
  version: 'storylib-1',
  templates: [],
  entries: [],
  lines: [...STORY_LINES, ...LEGEND_LINES],
};

export function templateById(id: string, library: StoryLibrary = STORY_LIBRARY) {
  return library.templates.find((row) => row.id === id) ?? null;
}
