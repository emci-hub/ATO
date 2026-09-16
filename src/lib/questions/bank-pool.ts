import { supabase } from '@/lib/supabase';
import type { TraitAxis } from '@/lib/traits';

import { assignBankItemIdsByPosition } from './bank-pool-match';
import type { QuestionDraft, QuestionOption } from './types';

/**
 * question_bank_pool / question_bank_reroll_exclusions (wave49) client
 * access — the shared, growing question bank for the post-50 ongoing-round
 * loop (core loop redesign §2). question_bank_pool is a read-only-to-clients
 * catalog table (insert/update/delete revoked from authenticated), so
 * `recordBankUsage`/`addToBankPool` below go through the two
 * security-definer RPCs wave50 adds for exactly this purpose.
 */

interface BankRow {
  id: string;
  category: string | null;
  prompt: string;
  options: unknown;
}

function parseOptions(raw: unknown): QuestionOption[] {
  if (!Array.isArray(raw)) return [];
  const out: QuestionOption[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const text = typeof row.text === 'string' ? row.text.trim() : '';
    const value = typeof row.value === 'number' ? row.value : Number(row.value);
    if (!text || !Number.isFinite(value)) continue;
    out.push({ text, value });
  }
  return out;
}

export interface BankCandidate {
  id: string;
  draft: QuestionDraft;
}

/**
 * Least-served question_bank_pool rows for `axis` (bank-first fill, §2), via
 * the wave68 `fetch_bank_candidates` RPC. The RPC excludes both this user's
 * permanent question_bank_reroll_exclusions AND every bank row already
 * referenced by one of their question_items — the second filter is why this
 * moved server-side (wave68): it is an anti-join against an unbounded answer
 * history, which a client-side `select` would have had to download in full
 * on every axis of every round just to filter locally.
 *
 * Still does NOT filter by recent-text itself — over-fetches a small
 * multiple of `count` so the caller (ongoing-round.ts) can drop
 * near-duplicates against its own recent-text window using the same
 * `isNearDuplicate` logic the AI-fallback path already uses, and still land
 * close to `count` picks.
 */
export async function fetchBankCandidates(axis: TraitAxis, count: number): Promise<BankCandidate[]> {
  if (count <= 0) return [];

  const { data, error } = await supabase.rpc('fetch_bank_candidates', {
    p_axis: axis,
    p_limit: count * 4 + 10,
  });
  if (error) throw error;

  return ((data ?? []) as BankRow[]).flatMap((bankRow) => {
    const options = parseOptions(bankRow.options);
    if (options.length < 2) return [];
    const draft: QuestionDraft = {
      axis,
      category: (bankRow.category ?? undefined) as QuestionDraft['category'],
      prompt: bankRow.prompt,
      options,
    };
    return [{ id: bankRow.id, draft }];
  });
}

/**
 * Per-axis count of bank questions this user has never been served (wave68
 * `bank_pool_depth`) — how many more rounds the shared pool can cover for
 * them before composition falls through to AI generation. An axis with no
 * usable rows left is ABSENT from the RPC's result, not present as 0; the
 * returned map preserves that, and `prewarm.ts` treats a missing axis as 0
 * so an empty axis still reads as short.
 */
export async function fetchBankPoolDepth(): Promise<Partial<Record<TraitAxis, number>>> {
  const { data, error } = await supabase.rpc('bank_pool_depth');
  if (error) throw error;
  const depth: Partial<Record<TraitAxis, number>> = {};
  for (const row of (data ?? []) as { axis: string; available: number }[]) {
    depth[row.axis as TraitAxis] = row.available;
  }
  return depth;
}

/** Bumps times_served for drawn bank items (wave50 RPC) — informational only, never itself an exclusion mechanism. */
export async function recordBankUsage(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.rpc('bump_bank_times_served', { p_ids: ids });
  if (error) throw error;
}

/**
 * Writes freshly AI-generated drafts into the shared bank pool (source='ai',
 * wave50 RPC) before they're saved as this user's round items, so every
 * ongoing-round question always has a bank row to reference (core loop
 * redesign §2 Q9) — mutates each draft in place with its new `bankItemId`.
 * Matching logic (by array position, not prompt text) lives in
 * `bank-pool-match.ts` — see that file for why.
 */
export async function addToBankPool(drafts: QuestionDraft[]): Promise<void> {
  if (drafts.length === 0) return;
  const payload = drafts.map((draft) => ({
    axis: draft.axis,
    category: draft.category ?? null,
    prompt: draft.prompt,
    options: draft.options,
  }));
  const { data, error } = await supabase.rpc('insert_bank_pool_items', { p_items: payload });
  if (error) throw error;
  assignBankItemIdsByPosition(drafts, (data ?? []) as { id: string }[]);
}
