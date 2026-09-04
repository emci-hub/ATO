/**
 * One-time "full profile unlocked" celebration flag.
 *
 * Stored in AsyncStorage, NOT on `me`: a `me` column is a schema change and
 * needs emci's sign-off first. The tradeoff is that this is per-device — a
 * person who unlocks on their phone and later opens the app on a new device
 * sees the celebration once more there. Move it to `me` if that matters.
 *
 * The flag only controls the celebration. The badge's unlocked state is always
 * a live read of `isProfileSettled(tracks)`, so a profile that stops being
 * settled relocks the badge regardless of what this stores.
 *
 * Lazy dynamic import of AsyncStorage (same shape as `lib/ai/override.ts`) so
 * Node check scripts can import this module without a React Native runtime.
 */

export const FULL_PROFILE_UNLOCK_SEEN_KEY = 'ato.profile.fullUnlock.seen.v1';

let cached: boolean | undefined;

async function storage(): Promise<{
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
} | null> {
  try {
    const mod = await import('@react-native-async-storage/async-storage');
    return mod.default;
  } catch {
    return null;
  }
}

/** Default false — an unread flag must never suppress the first celebration. */
export async function hasSeenFullProfileUnlock(): Promise<boolean> {
  if (cached !== undefined) return cached;
  try {
    const store = await storage();
    const raw = store ? await store.getItem(FULL_PROFILE_UNLOCK_SEEN_KEY) : null;
    cached = raw === '1';
  } catch {
    cached = false;
  }
  return cached;
}

export async function markFullProfileUnlockSeen(): Promise<void> {
  cached = true;
  try {
    const store = await storage();
    await store?.setItem(FULL_PROFILE_UNLOCK_SEEN_KEY, '1');
  } catch {
    // Storage is best-effort. Worst case the celebration replays once.
  }
}

/** Tests only — the module-level cache would otherwise leak between cases. */
export function resetFullProfileUnlockCache(): void {
  cached = undefined;
}
