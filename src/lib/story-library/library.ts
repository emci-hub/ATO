import { STORY_LINES } from './lines';
import type { StoryLibrary } from './types';

/** Shipped library. Nothing in here is live until `STORY_LIBRARY_RUNTIME` is on. */
export const STORY_LIBRARY: StoryLibrary = {
  version: 'storylib-1',
  templates: [],
  entries: [],
  lines: [...STORY_LINES],
};

export function templateById(id: string, library: StoryLibrary = STORY_LIBRARY) {
  return library.templates.find((row) => row.id === id) ?? null;
}
