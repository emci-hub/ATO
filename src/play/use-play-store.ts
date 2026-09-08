/**
 * Grove local economy hook (Play step 2). Wraps `playStore` for the Grove
 * screen:
 * - hydrates the AsyncStorage doc on mount,
 * - re-reads on app foreground (offline accrual while backgrounded),
 * - re-derives every 30s while mounted so refill / research countdowns move
 *   without user input.
 *
 * All time-dependent numbers are derived from `doc` + `Date.now()` at render;
 * only real mutations (Claim) write back to AsyncStorage.
 */
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  claimResearch,
  loadPlayStore,
  playView,
  savePlayStore,
  type ClaimResult,
  type PlayStoreDoc,
  type PlayView,
} from '@/play/playStore';

/** Rough tick for countdowns; refills/research are minutes-long, 30s is plenty. */
const TICK_MS = 30_000;

export function usePlayStore() {
  const [doc, setDoc] = useState<PlayStoreDoc | null>(null);
  const docRef = useRef<PlayStoreDoc | null>(null);
  const [, tick] = useReducer((n: number) => n + 1, 0);

  const hydrate = useCallback(async () => {
    const next = await loadPlayStore();
    docRef.current = next;
    setDoc(next);
  }, []);

  useEffect(() => {
    let alive = true;
    hydrate();
    const interval = setInterval(() => {
      if (alive) tick();
    }, TICK_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') hydrate();
    });
    return () => {
      alive = false;
      clearInterval(interval);
      sub.remove();
    };
  }, [hydrate]);

  const claim = useCallback(async (): Promise<ClaimResult | null> => {
    const current = docRef.current;
    if (!current) return null;
    const claimed = claimResearch(current, Date.now());
    if (!claimed) return null;
    docRef.current = claimed.doc;
    setDoc(claimed.doc);
    savePlayStore(claimed.doc).catch(() => {
      // Keep the in-memory economy on save failure; next open re-reads storage.
    });
    return claimed.result;
  }, []);

  const view: PlayView | null = doc ? playView(doc, Date.now()) : null;
  return { view, claim };
}
