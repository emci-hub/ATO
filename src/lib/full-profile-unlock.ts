/**
 * One-time "full profile unlocked" celebration flag.
 *
 * Stored in AsyncStorage, NOT on `me`: a `me` column is a schema change and
 * needs emci's sign-off first. Scoped per account id (same pattern
 * `questions-fold.tsx` uses for its own storage key) so a deleted-and-recreated
 * account on the same device doesn't inherit the prior account's flag and
 * silently suppress its own first celebration.
 *
 * The flag only controls the celebration. The badge's unlocked state is always
 * a live read of `isProfileSettled(tracks)`, so a profile that stops being
 * settled relocks the badge regardless of what this stores.
 *
 * Lazy dynamic import of AsyncStorage (same shape as `lib/ai/override.ts`) so
 * Node check scripts can import this module without a React Native runtime.
 */

const KEY_PREFIX = 'ato.profile.fullUnlock.seen.';
const KEY_SUFFIX = '.v1';

export function fullProfileUnlockSeenKey(userId: string): string {
  return `${KEY_PREFIX}${userId}${KEY_SUFFIX}`;
}

/** In-memory, keyed by userId — same reason the other question-storage modules keep one. */
const cache = new Map<string, boolean>();

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
export async function hasSeenFullProfileUnlock(userId: string): Promise<boolean> {
  const cached = cache.get(userId);
  if (cached !== undefined) return cached;
  let seen = false;
  try {
    const store = await storage();
    const raw = store ? await store.getItem(fullProfileUnlockSeenKey(userId)) : null;
    seen = raw === '1';
  } catch {
    seen = false;
  }
  cache.set(userId, seen);
  return seen;
}

export async function markFullProfileUnlockSeen(userId: string): Promise<void> {
  cache.set(userId, true);
  try {
    const store = await storage();
    await store?.setItem(fullProfileUnlockSeenKey(userId), '1');
  } catch {
    // Storage is best-effort. Worst case the celebration replays once.
  }
}

/** Tests only — the module-level cache would otherwise leak between cases. */
export function resetFullProfileUnlockCache(): void {
  cache.clear();
}
