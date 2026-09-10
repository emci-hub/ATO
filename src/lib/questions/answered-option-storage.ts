/**
 * Remembers which option a `CategoryPagedQuestions` row was answered with,
 * per question set (`storageKey`, e.g. "full-profile") — same shape as
 * `category-page-position.ts`, which this mirrors exactly, for the same
 * reason: AsyncStorage, not a `me` column (a schema change needing sign-off
 * first), per-device rather than per-account. The row's actual answer still
 * lives in `trait_tracks` (a blended EWMA value, not a discrete option
 * index) — this is purely a display hint so the "answered" stamp can keep
 * showing the right option when paging back to a row answered earlier,
 * not just the one just tapped this session. Doesn't backfill: a row
 * answered before this shipped has no stored index here, so it reads as
 * answered with no option to stamp.
 *
 * Lazy dynamic import of AsyncStorage (same shape as
 * `lib/full-profile-unlock.ts`/`category-page-position.ts`) so Node check
 * scripts can import this module without a React Native runtime.
 */

const KEY_PREFIX = 'ato.questions.answeredOption.';
const KEY_SUFFIX = '.v1';

export function answeredOptionStorageKey(storageKey: string): string {
  return `${KEY_PREFIX}${storageKey}${KEY_SUFFIX}`;
}

/**
 * In-memory, keyed by `storageKey` — same reason `category-page-position.ts`
 * keeps one: keeps within-session restore working even if AsyncStorage is
 * unavailable in some runtime, with AsyncStorage as the cross-launch source
 * of truth when it does work.
 */
const cache = new Map<string, Record<string, number>>();

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

function parseMap(raw: string | null): Record<string, number> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

/** row key -> answered option index, for every row ever answered under this question set. */
export async function loadAnsweredOptions(storageKey: string): Promise<Record<string, number>> {
  const cached = cache.get(storageKey);
  if (cached !== undefined) return cached;
  try {
    const store = await storage();
    const raw = store ? await store.getItem(answeredOptionStorageKey(storageKey)) : null;
    const map = parseMap(raw);
    cache.set(storageKey, map);
    return map;
  } catch {
    return {};
  }
}

/**
 * Best-effort persistence beyond this session. Worst case a return visit
 * just doesn't show the stamp on that row.
 *
 * Reads `cache` synchronously (no `await` before the merge+`cache.set`,
 * same discipline `category-page-position.ts`'s `saveCategoryPagePosition`
 * uses) — an earlier draft read via `cache.get(storageKey) ?? (await
 * loadAnsweredOptions(storageKey))`, which left an async gap between the
 * read and the write: two picks on different rows landing before the first
 * one's `await` resolved would both derive `next` from the same stale base
 * map, and the second `cache.set` would silently drop the first row's
 * index (caught in review). The component always calls
 * `loadAnsweredOptions` once on mount before any tap is possible, so the
 * cache is warm by the time a real pick can happen — falling back to `{}`
 * here is just startup-order safety, not a real "might not be loaded yet"
 * case.
 */
export async function saveAnsweredOption(storageKey: string, rowKey: string, optionIndex: number): Promise<void> {
  const current = cache.get(storageKey) ?? {};
  const next = { ...current, [rowKey]: optionIndex };
  cache.set(storageKey, next);
  try {
    const store = await storage();
    await store?.setItem(answeredOptionStorageKey(storageKey), JSON.stringify(next));
  } catch {
    // ignore — in-memory cache above still keeps this session correct
  }
}

/** Tests only — the module-level cache would otherwise leak between cases. */
export function resetAnsweredOptionCache(): void {
  cache.clear();
}
