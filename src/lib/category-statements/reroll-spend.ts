/**
 * The spend half of a category reroll: 1 ATO token, once per category per day
 * (the server enforces both). Returns a plain outcome instead of throwing for
 * the two expected refusals, so the fold can say which one it was.
 */
import { spendAtoTokensCategoryReroll } from '@/lib/ato-tokens-server';

export type CategoryRerollSpend = 'spent' | 'already_today' | 'not_enough';

export function categoryRerollOutcome(result: { ok: boolean; already?: boolean }): CategoryRerollSpend {
  if (result.ok) return 'spent';
  return result.already ? 'already_today' : 'not_enough';
}

export async function spendCategoryReroll(categoryId: string): Promise<CategoryRerollSpend> {
  try {
    return categoryRerollOutcome(await spendAtoTokensCategoryReroll(categoryId));
  } catch (err) {
    // The spend RPC raises P0040 for an insufficient balance (wave51).
    if ((err as { code?: string } | null)?.code === 'P0040') return 'not_enough';
    throw err;
  }
}
