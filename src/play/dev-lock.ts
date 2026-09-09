import { useSyncExternalStore } from 'react';

/**
 * Play Dev kit lock — a soft CLIENT gate (NOT security).
 *
 * The Grove Dev kit is a powerful debug surface, so while `PRE_LAUNCH_DEV` it
 * also sits behind a small PIN field on the Play hub; a wrong answer keeps the
 * kit hidden. Deliberately compare-in-client + in-memory only (no
 * AsyncStorage/SecureStore), so a cold start starts locked again. Real
 * security is the app's server-side dev-unlock (`lib/dev-access-unlock.ts`);
 * this one just keeps stray taps away from debug rows, and App Store builds
 * strip the whole Play route via `PRE_LAUNCH_DEV = false` anyway.
 *
 * The PIN is stored as char codes so a plain source grep for the literal never
 * matches (still trivially recoverable — soft gate only, by design).
 */
const PLAY_DEV_PIN = String.fromCharCode(67, 97, 108, 103, 97, 114, 121, 49, 33);

let unlocked = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function isPlayDevUnlocked(): boolean {
  return unlocked;
}

/** Try a PIN. True (and unlocks for the session) only when it matches. */
export function unlockPlayDev(pin: string): boolean {
  if (!unlocked && pin === PLAY_DEV_PIN) {
    unlocked = true;
    emit();
  }
  return unlocked;
}

/** Lock again (dev use — e.g. a future "lock" row; cold start does it too). */
export function lockPlayDev(): void {
  if (!unlocked) return;
  unlocked = false;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePlayDevUnlocked(): boolean {
  return useSyncExternalStore(subscribe, isPlayDevUnlocked, () => false);
}
