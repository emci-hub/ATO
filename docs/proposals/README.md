# Proposals — written, NOT applied

Two server-side fixes, drafted on 2026-10-01 and waiting for emci's review.
Nothing in this folder runs. Nothing here is a migration or a deployed function
until it is deliberately moved and applied.

| File | What it is | Status |
|---|---|---|
| `wave74_bank_pool_owner_and_ai_refund.sql` | Database change | NOT applied |
| `ai-generate-refund-and-fallback.patch` | Change to the `ai-generate` Edge Function | NOT deployed |

## 1. Shared question pool lock (the SQL file, part 1)

**Problem.** Any signed-in account can write questions into the shared pool, and
every other account is then served them in its rounds of 25.

**Fix.** An AI-written question is served only to the account that generated it.
The hand-written bank stays shared with everyone. The app needs no change.

**Side effect.** AI questions already in the pool have no owner, so they stop
being served to anyone (nothing is deleted). Each account's rounds draw from the
hand-written bank plus its own AI questions, and generate fresh ones when short.
Expect more AI calls for a while.

## 2. AI call refund (the SQL file, part 2 + the patch)

**Problem.** The daily AI call is counted before the AI is contacted and never
given back. A failure costs a call, and the app's automatic retry costs a second.
One Story tap can use up to four of the day's twenty.

**Fix.** One call covers one answer. If Gemini fails, the function itself tries
DeepSeek under the same call. If both fail, the call is handed back (at most
five refunds a day per account, so failures cannot be used to dodge the limit).

**Order matters.** Apply the SQL first, then deploy the function. Deployed
without the SQL, the function still works; it just cannot refund.

**One follow-up in the app before deploying.** The function can now take up to
16 seconds (two 8-second tries); the app gives up at 15. Raise the app's wait to
about 20 seconds and have it skip its own retry when the function says it
already tried (`fallback_tried`). Both are small app changes, not yet made.

## To apply (only after review)

1. Copy the SQL to `supabase/migrations/wave74_bank_pool_owner_and_ai_refund.sql` and apply it.
2. `git apply docs/proposals/ai-generate-refund-and-fallback.patch`, then deploy `ai-generate`.
3. Make the two small app changes above and ship them over the air.
