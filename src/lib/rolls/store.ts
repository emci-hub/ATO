/**
 * Roll/reveal data access (trait-system redesign §7) — wraps the RPCs from
 * supabase/migrations/wave46_trait_rolls.sql + wave47_reveal_requires_ready.sql.
 * Content/history data access, separate from the pure logic in
 * compose.ts/category-read.ts/results.ts.
 */
import { supabase } from '@/lib/supabase';

import type { TraitSnapshot } from '@/lib/rci';
import type { RollItem } from './compose';
import {
  parseClaimRollResult,
  parseRevealRollItemResult,
  parseStoreRollResult,
  type ClaimRollResult,
  type RevealRollItemResult,
  type StoreRollResult,
} from './results';

/** Claims the daily roll-composition backstop (rolls_daily_cap, default 1/day — how many roll COMPOSITIONS may start per day). Callers must have already decided eligibility (rollEligible) — this only enforces the blunt cap. */
export async function claimRoll(): Promise<ClaimRollResult> {
  const { data, error } = await supabase.rpc('claim_roll');
  if (error) throw error;
  return parseClaimRollResult(data);
}

/** Claims one roll-content generation (roll_generations_daily_cap, default 15/day — how many AI generations one composition may make). Called once per category-read/story attempt, before generateRollItemText's actual generateText/ai-generate call (wave48) — a separate, additional bound in front of the shared Sage/Explore quota, same pattern claim_questions_batch already uses for Infinite Questions. */
export async function claimRollGeneration(): Promise<ClaimRollResult> {
  const { data, error } = await supabase.rpc('claim_roll_generation');
  if (error) throw error;
  return parseClaimRollResult(data);
}

/** The most recent roll's stored axis snapshot for this user, or null if they've never rolled. */
export async function fetchLastRollSnapshot(userId: string): Promise<TraitSnapshot | null> {
  const { data, error } = await supabase
    .from('trait_roll_snapshots')
    .select('axis_snapshot')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data || typeof data.axis_snapshot !== 'object' || data.axis_snapshot === null) return null;
  return data.axis_snapshot as TraitSnapshot;
}

/** Atomically stores a roll's 13 items + its snapshot. store_roll (wave46) validates the exact shape server-side too — this does not re-validate, just shapes the RPC call. */
export async function storeRoll(
  rollId: string,
  items: readonly RollItem[],
  snapshot: TraitSnapshot,
): Promise<StoreRollResult> {
  const { data, error } = await supabase.rpc('store_roll', {
    p_roll_id: rollId,
    p_items: items.map((item) => ({ type: item.type, category_id: item.categoryId, result: item.result })),
    p_axis_snapshot: snapshot,
  });
  if (error) throw error;
  return parseStoreRollResult(data);
}

/** Atomic spend + reveal for one roll item. Refuses (ok:false, reason:'not_ready') if the item has nothing to reveal yet (wave47). */
export async function revealRollItem(itemId: string): Promise<RevealRollItemResult> {
  const { data, error } = await supabase.rpc('reveal_roll_item', { p_item_id: itemId });
  if (error) throw error;
  return parseRevealRollItemResult(data);
}

export interface StoredRollItem {
  id: string;
  type: RollItem['type'];
  categoryId: string | null;
  result: RollItem['result'];
  revealedAt: string | null;
}

/**
 * The most recent roll's roll_id for this user, or null if they've never
 * rolled — lets a screen restore its last roll's items on mount/reload
 * instead of only ever being reachable via the outcome of runRoll() in the
 * same session. All 13 rows of a roll share the same insert statement (and
 * so the same created_at, for ordering purposes) via store_roll's single
 * atomic write; RLS (trait_rolls_select_own) scopes rows to the caller.
 */
export async function fetchLatestRollId(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('trait_rolls')
    .select('roll_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.roll_id ?? null;
}

/**
 * Fetches one stored roll's rows back for display — store_roll (wave46)
 * writes them, but nothing previously read them back; runRoll only returns
 * the roll_id. Ordered legend, then categories, then story so the screen
 * doesn't need to re-sort (trait_rolls has no sort column of its own; `type`
 * sorts alphabetically as category/legend/story, so this orders client-side
 * instead). RLS (trait_rolls_select_own) already scopes rows to the caller.
 */
export async function fetchRollItems(rollId: string): Promise<StoredRollItem[]> {
  const { data, error } = await supabase
    .from('trait_rolls')
    .select('id, type, category_id, result, revealed_at')
    .eq('roll_id', rollId);
  if (error) throw error;
  const rows = (data ?? []) as {
    id: string;
    type: RollItem['type'];
    category_id: string | null;
    result: RollItem['result'];
    revealed_at: string | null;
  }[];
  const rank: Record<RollItem['type'], number> = { legend: 0, category: 1, story: 2 };
  return rows
    .map((row) => ({
      id: row.id,
      type: row.type,
      categoryId: row.category_id,
      result: row.result,
      revealedAt: row.revealed_at,
    }))
    .sort((a, b) => rank[a.type] - rank[b.type]);
}

/** Cap on a single history-fold fetch — a roll is 1/day and only 13 items each, so this comfortably covers months of history without an unbounded query. */
const REVEALED_HISTORY_LIMIT = 50;

/**
 * Trait-system redesign §8 — history/archive views. Every past REVEALED item
 * of the given type(s), across all rolls (not just the latest), newest
 * reveal first. RLS (trait_rolls_select_own) scopes rows to the caller;
 * `.eq('user_id', userId)` is also explicit here (unlike fetchRollItems,
 * which trusts a specific roll_id) since this query has no roll_id to
 * narrow by.
 */
export async function fetchRevealedRollItems(
  userId: string,
  types: readonly RollItem['type'][],
): Promise<StoredRollItem[]> {
  const { data, error } = await supabase
    .from('trait_rolls')
    .select('id, type, category_id, result, revealed_at')
    .eq('user_id', userId)
    .in('type', types)
    .not('revealed_at', 'is', null)
    .order('revealed_at', { ascending: false })
    .limit(REVEALED_HISTORY_LIMIT);
  if (error) throw error;
  const rows = (data ?? []) as {
    id: string;
    type: RollItem['type'];
    category_id: string | null;
    result: RollItem['result'];
    revealed_at: string | null;
  }[];
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    categoryId: row.category_id,
    result: row.result,
    revealedAt: row.revealed_at,
  }));
}
