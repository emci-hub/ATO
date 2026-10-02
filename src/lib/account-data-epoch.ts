/**
 * A counter that says "this account's data was just replaced from outside the
 * screen you are on".
 *
 * Screens load trait tracks and their own `me` once, on mount, and tabs stay
 * mounted. A dev jump or "Start over" rewrites the account underneath them, so
 * Questions kept showing the old answers and the old round until the app was
 * reopened. Screens that cache account data read this and reload when it moves.
 * Only the dev tools bump it; a normal answer already refreshes its own screen.
 */
import { useSyncExternalStore } from 'react';

let epoch = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function bumpAccountDataEpoch(): void {
  epoch += 1;
  for (const listener of listeners) listener();
}

export function accountDataEpoch(): number {
  return epoch;
}

export function useAccountDataEpoch(): number {
  return useSyncExternalStore(subscribe, accountDataEpoch, accountDataEpoch);
}
