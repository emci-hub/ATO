/**
 * THE premium gate for the fixed question bank (emci 2026-10-06). Retest and
 * Start Fresh will later cost premium tokens; nobody can get those yet, so
 * both are free and this flag is the only switch.
 *
 * To turn pricing on later: set a price here, return the same number from the
 * server's `_bank_premium_price` (wave85), and spend it where that SQL says
 * PREMIUM GATE. Nothing else needs to change — the screens read this.
 */
export type PremiumBankAction = 'retest' | 'start_fresh';

export const PREMIUM_BANK_PRICE: Readonly<Record<PremiumBankAction, number | null>> = {
  retest: null,
  start_fresh: null,
};

/** null = free. */
export function premiumPriceFor(action: PremiumBankAction): number | null {
  return PREMIUM_BANK_PRICE[action];
}

export function isPremiumGated(action: PremiumBankAction): boolean {
  return premiumPriceFor(action) != null;
}
