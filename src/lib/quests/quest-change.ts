/**
 * "A Quest Apply or Undo just changed this account's Quest numbers." Only the full profile
 * listens (it refetches its tracks). It is NOT the account-data epoch: that one means "the
 * account was replaced" and makes Questions, Legends and the buddy reset themselves.
 */
import { useSyncExternalStore } from 'react';

let count = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function bumpQuestChange(): void {
  count += 1;
  for (const listener of listeners) listener();
}

export function useQuestChange(): number {
  return useSyncExternalStore(subscribe, () => count, () => count);
}
