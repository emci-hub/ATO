import { useSyncExternalStore } from 'react';

/**
 * Session-only Dev Tools unlock. Set after the dev-unlock Edge Function
 * accepts the password typed behind the 7-tap version-number gesture
 * (`components/dev-unlock-gate.tsx`). Deliberately in-memory only — never
 * AsyncStorage/SecureStore — so a cold start always starts locked again.
 * Read wherever the app decides whether to show Dev Tools Hub gates
 * (`dev-lab.tsx`, Home's dev row) alongside `PRE_LAUNCH_DEV` / root / grants.
 */
let unlocked = false;
const listeners = new Set<() => void>();

export function isDevAccessUnlocked(): boolean {
  return unlocked;
}

export function setDevAccessUnlocked(next: boolean): void {
  if (unlocked === next) return;
  unlocked = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDevAccessUnlocked(): boolean {
  return useSyncExternalStore(subscribe, isDevAccessUnlocked, () => false);
}
