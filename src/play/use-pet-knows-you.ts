/**
 * The pet screen's door to "the pet that knows you". One `maybeLine()` per idle tick: returns a
 * personal line now and then (rare, cooldown, never repeated), or null. A visit = one mount of the
 * pet screen. Never throws, never blocks, and the line is only ever shown in the pet's own bubble.
 */
import { useCallback, useEffect, useRef } from 'react';

import { isPreviewing } from '@/lib/preview-mode';
import {
  personalLineAllowed,
  pickPersonalLine,
  rememberShown,
  styleRoll,
  talkStyle,
  THIN_PROFILE,
} from '@/play/pet-knows-you';
import { loadPetKnows, savePetKnowsState, type PetKnowsLoaded } from '@/play/pet-knows-you-store';

export interface UsePetKnowsYou {
  /** `busy` = egg, away, or a sheet is open. `rng` is for previews and checks. */
  maybeLine: (busy: boolean, rng?: () => number) => string | null;
}

export function usePetKnowsYou(): UsePetKnowsYou {
  const loadedRef = useRef<PetKnowsLoaded | null>(null);
  const shownRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void loadPetKnows().then((loaded) => {
      if (!cancelled) loadedRef.current = loaded;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const maybeLine = useCallback((busy: boolean, rng: () => number = Math.random): string | null => {
    let loaded = loadedRef.current;
    if (!loaded) return null; // still loading: the next tick tries again
    // Preview as new user can start while the screen is open: never keep using the real profile then.
    if (isPreviewing()) loaded = { profile: THIN_PROFILE, userId: null, state: null };
    const style = talkStyle(loaded.profile);
    const state = loaded.state;
    const gate = {
      nowMs: Date.now(),
      lastShownAt: state?.lastShownAt ?? null,
      shownThisVisit: shownRef.current,
      busy,
    };
    if (!personalLineAllowed(gate, style)) return null;
    if (rng() >= styleRoll(style)) return null;
    const pick = pickPersonalLine(loaded.profile ?? THIN_PROFILE, state?.recent ?? [], rng);
    shownRef.current += 1;
    if (state && loaded.userId) {
      const next = { ...state, lastShownAt: gate.nowMs, recent: rememberShown(state.recent, pick.line.id) };
      loadedRef.current = { ...loaded, state: next };
      void savePetKnowsState(next, true);
    }
    return pick.line.text;
  }, []);

  return { maybeLine };
}
