/**
 * Rerolls are frozen (emci, 2026-10-07). The daily insight and the category
 * cards are stored copy now, so there is nothing for a reroll to rewrite: the
 * reroll control is hidden on both. The spend RPCs and their client code
 * (category-statements/reroll-spend.ts, spendAtoTokens*Reroll) are kept, not
 * deleted, so a reroll can return without a migration. Story is unchanged.
 */
export const REROLLS_FROZEN = true;
