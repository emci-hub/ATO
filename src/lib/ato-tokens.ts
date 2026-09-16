/**
 * ATO tokens — a brand-new currency, fully separate from the existing
 * earned-only Notes/Sage economy (`src/lib/tokens.ts`, `me.tokens`).
 * Deliberately its own module, not merged into tokens.ts (core loop redesign
 * §5) — the two currencies must never share a display, a constant name, or
 * a ledger row shape.
 *
 * Balance lives on `me.ato_tokens`; ledger is `ato_token_events`
 * (wave51_ato_tokens.sql). RPC calls live in ato-tokens-server.ts so unit
 * checks stay Node-safe.
 */
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';

export const ATO_TOKEN_EARN = {
  full_profile_complete: 21,
  ongoing_round_complete: 21,
} as const;

export const ATO_TOKEN_PRICE = {
  legend_reroll: 10,
  category_reroll: 1,
  question_reroll: 1,
} as const;

export type AtoTokenEarnReason = keyof typeof ATO_TOKEN_EARN;
export type AtoTokenSpendReason = keyof typeof ATO_TOKEN_PRICE;

export const ATO_TOKEN_LABEL = 'ATO tokens';
export const ATO_TOKEN_LEDE = 'Earned by finishing rounds. Spent on rerolls.';
export const ATO_TOKEN_NEED_MORE = 'Not enough ATO tokens yet — finish another round to earn more.';
export const ATO_TOKEN_SPENT = 'Rerolled.';

export function atoTokenBalanceOf(row: { ato_tokens?: number | null }): number {
  const n = row.ato_tokens;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function atoPriceLine(reason: AtoTokenSpendReason): string {
  return `${ATO_TOKEN_PRICE[reason]} ATO token${ATO_TOKEN_PRICE[reason] === 1 ? '' : 's'}`;
}

export interface AtoTokenResult {
  ok: boolean;
  already?: boolean;
  balance: number;
  delta?: number;
  reason?: string;
  price?: number;
}

export function parseAtoTokenResult(data: unknown): AtoTokenResult {
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
  };
}

export function atoTokenCopyClean(): boolean {
  const lines = [
    ATO_TOKEN_LABEL,
    ATO_TOKEN_LEDE,
    ATO_TOKEN_NEED_MORE,
    ATO_TOKEN_SPENT,
    atoPriceLine('legend_reroll'),
    atoPriceLine('category_reroll'),
    atoPriceLine('question_reroll'),
  ];
  return lines.every((line) => !containsFrameworkTerm(line));
}
