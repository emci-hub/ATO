/**
 * Pure result-parsing for the roll/reveal RPCs (trait-system redesign §7).
 * Split out from store.ts specifically so this stays Node-testable — store.ts
 * imports @/lib/supabase, which pulls in react-native and fails under plain
 * Node (same class of issue category-paged-questions.tsx once hit), same
 * split tokens.ts (pure)/tokens-server.ts (RPC calls) already uses.
 */

export interface ClaimRollResult {
  ok: boolean;
  reason?: string;
  daily?: number;
  dailyCap?: number;
}

export function parseClaimRollResult(data: unknown): ClaimRollResult {
  if (!data || typeof data !== 'object') return { ok: false, reason: 'empty' };
  const row = data as Record<string, unknown>;
  return {
    ok: row.ok === true,
    reason: typeof row.reason === 'string' ? row.reason : undefined,
    daily: typeof row.daily === 'number' ? row.daily : undefined,
    dailyCap: typeof row.daily_cap === 'number' ? row.daily_cap : undefined,
  };
}

export interface StoreRollResult {
  ok: boolean;
  already?: boolean;
  rollId?: string;
  count?: number;
}

export function parseStoreRollResult(data: unknown): StoreRollResult {
  if (!data || typeof data !== 'object') return { ok: false };
  const row = data as Record<string, unknown>;
  return {
    ok: row.ok === true,
    already: row.already === true,
    rollId: typeof row.roll_id === 'string' ? row.roll_id : undefined,
    count: typeof row.count === 'number' ? row.count : undefined,
  };
}

export interface RevealRollItemResult {
  ok: boolean;
  already?: boolean;
  reason?: string;
  balance?: number;
  price?: number;
  revealedAt?: string;
  type?: string;
}

export function parseRevealRollItemResult(data: unknown): RevealRollItemResult {
  if (!data || typeof data !== 'object') return { ok: false, reason: 'empty' };
  const row = data as Record<string, unknown>;
  return {
    ok: row.ok === true,
    already: row.already === true,
    reason: typeof row.reason === 'string' ? row.reason : undefined,
    balance: typeof row.balance === 'number' ? row.balance : undefined,
    price: typeof row.price === 'number' ? row.price : undefined,
    revealedAt: typeof row.revealed_at === 'string' ? row.revealed_at : undefined,
    type: typeof row.type === 'string' ? row.type : undefined,
  };
}

/** True only when the stored result for a roll item is actually ready to reveal (matches wave47's reveal_roll_item check, client-side mirror for UI gating — the RPC is still the real enforcement). */
export function rollItemResultIsReady(result: unknown): boolean {
  if (!result || typeof result !== 'object') return false;
  return (result as Record<string, unknown>).ready === true;
}
