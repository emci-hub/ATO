import { STORY_BANK } from './bank';
import { STORY_TEMPLATES } from './templates';
import type { StoryLibrary } from './types';

/** Shipped library. Nothing in here is live until `STORY_LIBRARY_RUNTIME` is on. */
export const STORY_LIBRARY: StoryLibrary = {
  version: 'storylib-0',
  templates: [...STORY_TEMPLATES],
  entries: [...STORY_BANK],
};

export function templateById(id: string, library: StoryLibrary = STORY_LIBRARY) {
  return library.templates.find((row) => row.id === id) ?? null;
}
