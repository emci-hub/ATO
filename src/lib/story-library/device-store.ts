/**
 * Phone copy of an approved Story Library. AsyncStorage is only here, so the
 * offline check can use the sync store in `persist.ts` without React Native.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { saveStoryLibrary, type SaveResult } from './persist';
import type { StoryLibrary } from './types';

const KEY = 'ato.story-library.approved';

let hydrated: Promise<void> | null = null;

/** Load a previously approved copy, once. A bad blob is ignored. */
export function hydrateStoryLibraryDevice(): Promise<void> {
  if (!hydrated) {
    hydrated = (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as StoryLibrary;
        saveStoryLibrary(parsed);
      } catch {
        // Keep the shipped library.
      }
    })();
  }
  return hydrated;
}

/** Validate, then keep the approved copy in memory and on the phone. */
export async function persistStoryLibraryDevice(library: StoryLibrary): Promise<SaveResult> {
  const result = saveStoryLibrary(library);
  if (!result.ok) return result;
  await AsyncStorage.setItem(KEY, JSON.stringify(library));
  hydrated = Promise.resolve();
  return result;
}
