/**
 * Roll/reveal data access (trait-system redesign §7) — wraps the RPCs from
 * supabase/migrations/wave46_trait_rolls.sql + wave47_reveal_requires_ready.sql.
 * Mirrors src/lib/legends/store.ts's naming (content/history data access,
 * separate from the pure logic in compose.ts/category-read.ts/results.ts).
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
