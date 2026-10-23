/**
 * The library the phone reads. The shipped `STORY_LIBRARY` is the default.
 * An approved edit replaces it only after `validateLibrary` reports no failures.
 * The store is synchronous so the offline check can round-trip a save without
 * a device. The phone adapter lives in `device-store.ts`.
 */
import { STORY_LIBRARY } from './library';
import type { MatrixFailure } from './validate';
import { validateLibrary } from './validate';
import type { StoryLibrary } from './types';

export interface StoryLibraryStore {
  read(): StoryLibrary | null;
  write(library: StoryLibrary): void;
}

export type SaveResult =
  | { ok: true; renders: number }
  | { ok: false; renders: number; failures: MatrixFailure[] };

let installed: StoryLibrary | null = null;
let store: StoryLibraryStore | null = null;

export function setStoryLibraryStore(next: StoryLibraryStore | null): void {
  store = next;
  installed = null;
}

/** Drop the in-memory copy so the next read comes from the store or the ship. */
export function resetStoryLibrary(): void {
  installed = null;
}

export function getStoryLibrary(): StoryLibrary {
  if (installed) return installed;
  const loaded = store?.read() ?? null;
  if (loaded) {
    const report = validateLibrary(loaded, { requireApproved: true });
    if (report.failures.length === 0) {
      installed = loaded;
      return loaded;
    }
  }
  installed = STORY_LIBRARY;
  return installed;
}

/**
 * Approve a library into the runtime copy. Refuses the write when the matrix
 * is not clean, and leaves the previous copy in place.
 */
export function saveStoryLibrary(library: StoryLibrary): SaveResult {
  const report = validateLibrary(library, { requireApproved: true });
  if (report.failures.length > 0) {
    return { ok: false, renders: report.renders, failures: report.failures };
  }
  installed = library;
  store?.write(library);
  return { ok: true, renders: report.renders };
}
