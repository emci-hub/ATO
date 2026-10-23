/**
 * Device-local Story bank memory (emci 2026-10-13 gap check): skip recently
 * shown bank ids and hooks so a reader does not see the same card too soon.
 *
 * Pure helpers stay importable from Node checks. AsyncStorage is lazy so this
 * module does not need a React Native runtime.
 */
const HISTORY_PREFIX = 'ato.story.bankHistory.';
const REWRITE_PREFIX = 'ato.story.rewriteTried.';
const KEY_SUFFIX = '.v1';

/** Remembered bank ids (cap). Older than this can return. */
export const BANK_SEEN_CAP = 40;
/** Recent hooks used for STORY_HOOK_VARIETY_LIMIT. */
export const BANK_HOOK_CAP = 8;
/** Once a pool is exhausted, skip only this many recent ids so it can cycle. */
export const BANK_SKIP_RECENT = 8;

export interface StoryBankHistory {
  seenIds: string[];
  recentHooks: string[];
}

export function storyBankHistoryKey(userId: string): string {
  return `${HISTORY_PREFIX}${userId}${KEY_SUFFIX}`;
}

export function storyRewriteTriedKey(userId: string): string {
  return `${REWRITE_PREFIX}${userId}${KEY_SUFFIX}`;
}

export function nextBankSeenIds(prev: readonly string[], id: string): string[] {
  const trimmed = id.trim();
  if (!trimmed) return [...prev].slice(-BANK_SEEN_CAP);
  return [...prev.filter((row) => row !== trimmed), trimmed].slice(-BANK_SEEN_CAP);
}

export function nextBankRecentHooks(prev: readonly string[], hook: string): string[] {
  const trimmed = hook.trim();
  if (!trimmed) return [...prev].slice(-BANK_HOOK_CAP);
  return [...prev.filter((row) => row !== trimmed), trimmed].slice(-BANK_HOOK_CAP);
}

/**
 * Skip every seen id until that would empty the pool, then only the last
 * few so a reader can cycle without an instant repeat.
 */
export function bankIdsToSkip(seenInPool: readonly string[], poolSize: number): readonly string[] {
  if (poolSize <= 0) return [];
  if (seenInPool.length >= poolSize) {
    const keepOff = Math.min(BANK_SKIP_RECENT, Math.max(1, poolSize - 1));
    return seenInPool.slice(-keepOff);
  }
  return seenInPool;
}

function parseHistory(raw: string | null): StoryBankHistory {
  if (!raw) return { seenIds: [], recentHooks: [] };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return { seenIds: [], recentHooks: [] };
    const obj = parsed as Record<string, unknown>;
    const ids = Array.isArray(obj.seenIds) ? obj.seenIds.filter((row): row is string => typeof row === 'string' && !!row.trim()) : [];
    const hooks = Array.isArray(obj.recentHooks)
      ? obj.recentHooks.filter((row): row is string => typeof row === 'string' && !!row.trim())
      : [];
    return {
      seenIds: ids.slice(-BANK_SEEN_CAP),
      recentHooks: hooks.slice(-BANK_HOOK_CAP),
    };
  } catch {
    return { seenIds: [], recentHooks: [] };
  }
}

function parseTried(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row): row is string => typeof row === 'string' && !!row.trim()).slice(-BANK_SEEN_CAP);
  } catch {
    return [];
  }
}

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

export async function loadStoryBankHistory(userId: string): Promise<StoryBankHistory> {
  if (!userId) return { seenIds: [], recentHooks: [] };
  try {
    const store = await storage();
    const raw = store ? await store.getItem(storyBankHistoryKey(userId)) : null;
    return parseHistory(raw);
  } catch {
    return { seenIds: [], recentHooks: [] };
  }
}

export async function rememberStoryBankHistory(userId: string, history: StoryBankHistory): Promise<void> {
  if (!userId) return;
  try {
    const store = await storage();
    if (!store) return;
    await store.setItem(
      storyBankHistoryKey(userId),
      JSON.stringify({
        seenIds: history.seenIds.slice(-BANK_SEEN_CAP),
        recentHooks: history.recentHooks.slice(-BANK_HOOK_CAP),
      }),
    );
  } catch {
    // Best-effort: a missed write only means a later tap may re-show a card.
  }
}

export async function loadStoryRewriteTried(userId: string): Promise<string[]> {
  if (!userId) return [];
  try {
    const store = await storage();
    const raw = store ? await store.getItem(storyRewriteTriedKey(userId)) : null;
    return parseTried(raw);
  } catch {
    return [];
  }
}

/** Persist before the rewrite call so a remount cannot mass-retry a failed v1. */
export async function markStoryRewriteTried(userId: string, triedKey: string): Promise<void> {
  if (!userId || !triedKey.trim()) return;
  try {
    const store = await storage();
    if (!store) return;
    const prev = parseTried(await store.getItem(storyRewriteTriedKey(userId)));
    const next = [...prev.filter((row) => row !== triedKey), triedKey].slice(-BANK_SEEN_CAP);
    await store.setItem(storyRewriteTriedKey(userId), JSON.stringify(next));
  } catch {
    // In-session ref still blocks a second call this launch.
  }
}

export function storyRewriteAttemptKey(fingerprint: string, generatedOn: string | undefined, body: string): string {
  const stem = `${fingerprint}|${generatedOn ?? ''}|${body.slice(0, 80)}`;
  return stem.slice(0, 180);
}
