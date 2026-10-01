# Proposals

Server-side fixes drafted on 2026-10-01.

| File | What it is | Status |
|---|---|---|
| `supabase/migrations/wave74_bank_pool_owner_and_ai_refund.sql` | Database change | APPROVED by emci 2026-10-01 — **not applied yet** (moved out of this folder) |
| `supabase/migrations/wave75_reset_my_test_data.sql` | Database change (test tool) | APPROVED by emci 2026-10-01 — **not applied yet** (moved out of this folder) |
| `ai-generate-refund-and-fallback.patch` | Change to the `ai-generate` Edge Function | NOT approved, NOT deployed |

The two approved files could not be applied by the session that wrote them (it
was not permitted to touch the live database). To apply: Supabase dashboard →
SQL editor → paste the whole file → Run. wave74 first, then wave75. For wave75
the account you test on must be root (`me.is_root = true`).

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

## 3. Reset my own test data (`wave75_reset_my_test_data.sql`)

**Problem.** Testing the 50 questions again means deleting the account and making
a new one. The app can already jump an account to any stage (Dev tools → Intake
stage), but it cannot wipe the token history, so the +21 for finishing the 50 —
paid once ever — never pays a second time, and old rounds, insights and category
reads stay behind.

**Fix.** One function, "clear all my questions": it wipes the caller's OWN answers,
trait scores, rounds, tokens and generated content, and keeps the profile. Root
accounts only (so an invited tester cannot loop it to re-earn tokens), it cannot be
aimed at anyone else, and it switches itself off once sign-up is public. It leaves
today's AI call count, Check history and safety rows alone.

**After applying**, the app needs one small button wired to it (not built yet).

## To apply (only after review)

1. Apply `supabase/migrations/wave74_bank_pool_owner_and_ai_refund.sql` (approved; see the top of this file).
2. `git apply docs/proposals/ai-generate-refund-and-fallback.patch`, then deploy `ai-generate`.
3. Make the two small app changes above and ship them over the air.
