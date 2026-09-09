import type { QuestionDraft } from './types';

/**
 * Pure matching step for `addToBankPool` (bank-pool.ts) — split into its
 * own file, no `@/lib/supabase` import, so it stays Node-testable (same
 * reason `rolls/results.ts` is split from `rolls/store.ts`: importing
 * anything that pulls in `@/lib/supabase` also pulls in react-native,
 * which tsx/esbuild can't transform outside the app runtime).
 *
 * Matches RPC result rows back to input drafts by ARRAY POSITION, not by
 * prompt-text equality. `insert_bank_pool_items` (wave50) iterates its
 * input in a single sequential `for ... loop` and does `return query
 * insert ... returning ...` once per iteration with no later ORDER BY, so
 * row N of the result always corresponds to item N of the input — a
 * stronger, runtime-agnostic guarantee than string equality. Matching by
 * prompt text was the original design; found fragile in review (T-03,
 * flagged as a follow-up, fixed here): the RPC applies its own
 * `left(trim(...), 400)` server-side, which is a no-op today only because
 * `parseQuestionDraft` already trims and caps every draft at 400 chars
 * before it reaches this function — a real but currently-latent invariant
 * this code should not have to depend on to work correctly. Position-based
 * matching has no such dependency. A partial/misaligned result set also
 * can't reach this function: items before a failing one in the RPC's loop
 * are inserted within the same implicit call transaction, but any
 * exception (e.g. item N fails a validation check) rolls the whole
 * transaction back, so the client's `error` branch (bank-pool.ts) fires
 * with no rows at all — never a partial array — rather than this function
 * ever seeing a genuinely partial result.
 */
export function assignBankItemIdsByPosition(drafts: QuestionDraft[], rows: readonly { id: string }[]): void {
  if (rows.length !== drafts.length) {
    throw new Error(
      `insert_bank_pool_items returned ${rows.length} rows for ${drafts.length} drafts — cannot safely match by position.`,
    );
  }
  drafts.forEach((draft, i) => {
    draft.bankItemId = rows[i].id;
  });
}
