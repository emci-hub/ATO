/**
 * The guide's on/off and dismissed steps (Divecore finish step 5). A device-only key — not the Divecore save, so
 * no save-version bump; it is an `ato.*` key, so sign-out / delete wipes it with the rest of the local account data
 * (same pattern as `pet-seen.ts`). Nothing shows until it has loaded, so a veteran never sees a flash.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

import { parseGuideStore, serializeGuideStore, type GuideStepId, type GuideStore } from '@/play/guide';

export const GUIDE_KEY = 'ato.play.guide.v1';

type State = GuideStore & { loaded: boolean };

let state: State = { off: false, dismissed: [], loaded: false };
let loadPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function set(next: State): void {
  state = next;
  for (const l of listeners) l();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

const snapshot = (): State => state;

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(GUIDE_KEY, serializeGuideStore({ off: state.off, dismissed: state.dismissed }));
  } catch {
    // Best effort — a step that comes back once is harmless.
  }
}

/** Read the stored value once. A reset that lands while the read is in flight wins (it has already set `loaded`). */
function load(): Promise<void> {
  if (state.loaded) return Promise.resolve();
  if (!loadPromise) {
    loadPromise = (async () => {
      let next: State;
      try {
        next = { ...parseGuideStore(await AsyncStorage.getItem(GUIDE_KEY)), loaded: true };
      } catch {
        // Unreadable: stay quiet rather than risk nagging.
        next = { off: true, dismissed: [], loaded: true };
      }
      if (!state.loaded) set(next);
    })();
  }
  return loadPromise;
}

/** "Got it": this step never shows again (until Replay tips / Reset). Waits for the stored value first, so it can
 * never overwrite what was saved with an empty list. */
export async function dismissGuideStep(id: GuideStepId): Promise<void> {
  await load();
  if (state.dismissed.includes(id)) return;
  set({ ...state, dismissed: [...state.dismissed, id] });
  await persist();
}

export async function setGuideOff(off: boolean): Promise<void> {
  await load();
  if (state.off === off) return;
  set({ ...state, off });
  await persist();
}

/** Replay tips / Reset Divecore: the guide starts over (on, nothing dismissed). */
export async function resetGuide(): Promise<void> {
  set({ off: false, dismissed: [], loaded: true });
  try {
    await AsyncStorage.removeItem(GUIDE_KEY);
  } catch {
    // Best effort.
  }
}

/** The guide's stored state; `loaded` is false until the first read lands (render nothing then). */
export function useGuideStore(): State {
  useEffect(() => {
    void load();
  }, []);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
