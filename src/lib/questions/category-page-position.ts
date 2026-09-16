/**
 * Remembers which page a `PagedQuestions` viewer last landed on, per
 * question set (`storageKey`, e.g. "full-profile"). Stores a stringified page
 * index (e.g. "3") — before the book-pager restructure this stored a category
 * id instead; the storage shape (an opaque string per storageKey) didn't need
 * to change, only what the caller puts in it. Stored in AsyncStorage, not on
 * `me` — a `me` column is a schema change and needs emci's sign-off first,
 * same tradeoff `full-profile-unlock.ts` already accepts. Per-device, not
 * per-account: someone who leaves off on page 3 on their phone and opens the
 * app on a new device starts back at page 1 there. Answers themselves are
 * never affected either way — they live in `trait_tracks` (or, for a future
 * question-stack source, its own store), always server-side.
 *
 * Lazy dynamic import of AsyncStorage (same shape as
 * `lib/full-profile-unlock.ts`) so Node check scripts can import this module
 * without a React Native runtime.
 */

const KEY_PREFIX = 'ato.questions.categoryPage.';
const KEY_SUFFIX = '.v1';

export function categoryPagePositionKey(storageKey: string): string {
  return `${KEY_PREFIX}${storageKey}${KEY_SUFFIX}`;
}

/**
 * In-memory, keyed by `storageKey` — same reason `full-profile-unlock.ts`
 * keeps one: AsyncStorage's calls can fail/be unavailable in some runtimes
 * (e.g. a plain Node process, no `window`), and this keeps within-session
 * position restore (leave the screen, come back without restarting the app)
 * working even then. AsyncStorage remains the cross-launch source of truth
 * when it does work; this cache just means a failed read/write doesn't lose
 * position for the rest of the session.
 */
const cache = new Map<string, string>();

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

/** The last category id viewed for this question set, or null if never saved / unavailable. */
export async function loadCategoryPagePosition(storageKey: string): Promise<string | null> {
  const cached = cache.get(storageKey);
  if (cached !== undefined) return cached;
  try {
    const store = await storage();
    const raw = store ? await store.getItem(categoryPagePositionKey(storageKey)) : null;
    if (raw) cache.set(storageKey, raw);
    return raw;
  } catch {
    return null;
  }
}

/** Best-effort persistence beyond this session. Worst case a return visit starts back at the first category. */
export async function saveCategoryPagePosition(storageKey: string, categoryId: string): Promise<void> {
  cache.set(storageKey, categoryId);
  try {
    const store = await storage();
    await store?.setItem(categoryPagePositionKey(storageKey), categoryId);
  } catch {
    // ignore — in-memory cache above still keeps this session correct
  }
}

/** Tests only — the module-level cache would otherwise leak between cases. */
export function resetCategoryPagePositionCache(): void {
  cache.clear();
}
