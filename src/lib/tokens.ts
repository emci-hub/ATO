/**
 * Earned-only tokens. Balance lives on ME (`me.tokens`); ledger is
 * `token_events`. Never purchased. Prices are fixed.
 * RPC calls live in tokens-server.ts so unit checks stay Node-safe.
 */
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';

export const TOKEN_EARN = {
  check_in: 3,
  game_round: 5,
  trickle: 1,
} as const;

export const TOKEN_PRICE = {
  sage_insight: 8,
  profile_depth: 12,
} as const;

/**
 * Trait-system redesign §7 — a new, dedicated earn event, deliberately NOT
 * added to TOKEN_EARN above: those reasons all go through the generic
 * earn_tokens(reason) RPC (once-per-local-day idempotency), while this one
 * has a "once ever" idempotency shape and calls its own dedicated RPC
 * (claimIntakeComplete in tokens-server.ts) — kept as a separate constant
 * so the two call patterns can never be silently conflated.
 *
 * round_complete's +13/round price is documented in the plan but has no
 * constant here yet — its RPC is deliberately not shipped until real
 * round-tracking state exists to validate a round number against (see
 * wave45_trait_redesign_tokens.sql's header comment).
 */
export const TOKEN_EARN_INTAKE_COMPLETE = 20;

export type TokenEarnReason = keyof typeof TOKEN_EARN;
export type TokenSpendReason = keyof typeof TOKEN_PRICE;

export const TOKEN_LABEL = 'Notes';
export const TOKEN_LEDE = 'Earned by showing up. Never bought.';
export const TOKEN_INSIGHT_LABEL = 'A closer look from Sage';
export const TOKEN_INSIGHT_HINT = 'One extra observation. Sage does not change how you lean.';
export const TOKEN_DEPTH_LABEL = 'Go deeper on this one';
export const TOKEN_DEPTH_HINT = 'Spend to answer this category again.';
export const TOKEN_NEED_MORE = 'Not enough notes yet — check in or play to earn more.';
export const TOKEN_SPENT = 'Spent.';

export function tokenBalanceOf(row: { tokens?: number | null }): number {
  const n = row.tokens;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function priceLine(reason: TokenSpendReason): string {
  return `${TOKEN_PRICE[reason]} notes`;
}

export interface TokenResult {
  ok: boolean;
  already?: boolean;
  balance: number;
  delta?: number;
  reason?: string;
  price?: number;
  /** Only set by claim_round_complete's result (§7). */
  roundNumber?: number;
}

export function parseTokenResult(data: unknown): TokenResult {
  if (!data || typeof data !== 'object') {
    return { ok: false, balance: 0, reason: 'empty' };
  }
  const row = data as Record<string, unknown>;
  return {
    ok: row.ok === true,
    already: row.already === true,
    balance: typeof row.balance === 'number' ? row.balance : 0,
    delta: typeof row.delta === 'number' ? row.delta : undefined,
    reason: typeof row.reason === 'string' ? row.reason : undefined,
    price: typeof row.price === 'number' ? row.price : undefined,
    roundNumber: typeof row.round_number === 'number' ? row.round_number : undefined,
  };
}

export function tokenCopyClean(): boolean {
  const lines = [
    TOKEN_LABEL,
    TOKEN_LEDE,
    TOKEN_INSIGHT_LABEL,
    TOKEN_INSIGHT_HINT,
    TOKEN_DEPTH_LABEL,
    TOKEN_DEPTH_HINT,
    TOKEN_NEED_MORE,
    TOKEN_SPENT,
    priceLine('sage_insight'),
    priceLine('profile_depth'),
  ];
  return lines.every((line) => !containsFrameworkTerm(line));
}
