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

/**
 * Paid rounds per local day (emci 2026-10-03: "cap 2"). The server enforces it
 * (wave81 claim_ongoing_round_complete raises P0042 past it); rounds past the
 * cap still count toward the profile, they just earn nothing.
 */
export const ROUND_PAYOUTS_PER_DAY = 2;

/** Earn (wave92, emci 2026-10-09): one AI view = AI_TOKEN_PRICE, so a check-in
 * or a set of 16 is one AI view, the 7th check-in two, the first 48 all three. */
export const ATO_TOKEN_EARN = {
  full_profile_complete: 15,
  ongoing_round_complete: 5,
  daily_checkin: 5,
  checkin_week_bonus: 10,
} as const;

/** Every AI view costs the same (wave92): a Legends AI card, a deep dive (2 cards), a new Story. */
export const AI_TOKEN_PRICE = 5;
export type AiTokenKind = 'story' | 'legend' | 'deep_dive';
export const AI_PRICE_LABEL = `${AI_TOKEN_PRICE} tokens`;
/** What a screen says when the balance is below one AI view. */
export const AI_TOKENS_NEEDED = `You need ${AI_TOKEN_PRICE} ATO tokens for this. Check in on Home or answer a set of 16 questions to earn more.`;

export const ATO_TOKEN_PRICE = {
  legend_reroll: 10,
  category_reroll: 1,
  question_reroll: 1,
} as const;

export type AtoTokenEarnReason = 'full_profile_complete' | 'ongoing_round_complete';
export type AtoTokenSpendReason = keyof typeof ATO_TOKEN_PRICE;

export const ATO_TOKEN_LABEL = 'ATO tokens';
export const ATO_TOKEN_LEDE = 'Earned by checking in and answering questions. Spent on AI views.';
/**
 * How the currency works, said before a limit is hit rather than after. Built
 * from the constants above so a price change cannot leave this stale. The
 * once-a-day limits are enforced in SQL (wave51); this only states them. The
 * `legend_reroll` price is what a name style on the identity card costs: the
 * Legends tab is a placeholder, and that spend function had no other caller.
 */
export const ATO_TOKEN_HOW_LINES: readonly string[] = [
  `Check in on Home once a day: +${ATO_TOKEN_EARN.daily_checkin}. Every 7th check-in: +${ATO_TOKEN_EARN.checkin_week_bonus}. A missed day never resets your count. New check-in at midnight.`,
  `Answer a set of 16 questions: +${ATO_TOKEN_EARN.ongoing_round_complete} (up to ${ROUND_PAYOUTS_PER_DAY} sets a day). Finishing the first 48: +${ATO_TOKEN_EARN.full_profile_complete} once.`,
  `Spend: ${AI_TOKEN_PRICE} for each AI view — a new Story on Home, a Legends AI card, or a deep dive on Explore (2 cards). If the AI fails, your tokens come back (once a day for each).`,
  `Also: ${ATO_TOKEN_PRICE.question_reroll} to reroll a question, ${ATO_TOKEN_PRICE.legend_reroll} to unlock a name style.`,
];
export const ATO_TOKEN_NEED_MORE = 'Not enough ATO tokens yet. Check in on Home or answer a set of 16 to earn more.';
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
    ...ATO_TOKEN_HOW_LINES,
    ATO_TOKEN_NEED_MORE,
    ATO_TOKEN_SPENT,
    atoPriceLine('legend_reroll'),
    atoPriceLine('category_reroll'),
    atoPriceLine('question_reroll'),
  ];
  return lines.every((line) => !containsFrameworkTerm(line));
}
