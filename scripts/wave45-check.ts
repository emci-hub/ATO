/**
 * wave45: new token earn events (trait-system redesign §7). Run: npm run check:wave45
 *
 * Schema-only check (source assertions against the migration file) — same
 * pattern as every other not-yet-applied migration in this repo
 * (category-batch-check.ts etc.). The migration is committed but NOT
 * applied to the live DB until emci reviews and runs it.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

const sql = read('supabase/migrations/wave45_trait_redesign_tokens.sql');

assert.match(sql, /add column if not exists round_number int/);
ok('token_events gains a round_number column (forward-compat groundwork; round_complete\'s RPC is deliberately not shipped yet)');

assert.match(sql, /'intake_complete',\s*\n\s*'round_complete'/);
ok('token_events_reason_known widens to include intake_complete and round_complete');

// The pre-existing once-per-day index must be scoped to EXCLUDE the two new
// reasons — a real bug found and fixed during planning: left unscoped, it
// would silently cap "once ever" / "once per round" at "once per day" too.
assert.match(sql, /drop index if exists public\.token_events_earn_once_per_day/);
assert.match(sql, /reason not in \('intake_complete', 'round_complete'\)/);
ok('the pre-existing once-per-day index is rescoped to exclude the two new once-ever/once-per-round reasons');

assert.match(sql, /create unique index if not exists token_events_intake_once\s*\n\s*on public\.token_events \(user_id\)\s*\n\s*where reason = 'intake_complete'/);
ok('token_events_intake_once: once ever per user, exact shape from the pre-approved plan');

assert.match(sql, /create unique index if not exists token_events_round_once\s*\n\s*on public\.token_events \(user_id, round_number\)\s*\n\s*where reason = 'round_complete'/);
ok('token_events_round_once: index laid down as groundwork even though no RPC writes round_complete rows yet');

assert.match(
  sql,
  /add constraint token_events_round_number_matches_reason check \(\s*\n\s*\(reason = 'round_complete'\) = \(round_number is not null\)\s*\n\s*\)/,
  'round_number must be set exactly when reason is round_complete, or a NULL could bypass token_events_round_once\'s dedupe (NULLs are distinct in a unique index)',
);
ok('a CHECK constraint ties round_number IS NOT NULL to reason = round_complete, closing the NULL-bypass gap proactively');

assert.match(sql, /drop constraint if exists token_events_reason_known/);
ok('the migration is idempotent/re-runnable — drop statements use IF EXISTS, matching this repo\'s convention');

// Critical fix from review: rescoping the once-per-day index without
// updating earn_tokens's own ON CONFLICT predicate breaks Postgres arbiter
// inference (the ON CONFLICT predicate must IMPLY the index's real
// predicate) — every check_in/game_round earn would error at runtime.
// earn_tokens must be redefined here with the matching predicate.
const earnTokensMatches = [...sql.matchAll(/create or replace function public\.earn_tokens\(p_reason text\)/g)];
assert.equal(earnTokensMatches.length, 1, 'earn_tokens must be redefined exactly once in this migration, with the corrected ON CONFLICT predicate');
assert.match(
  sql,
  /on conflict \(user_id, reason, local_day\)\s*\n\s*where delta > 0 and reason not in \('intake_complete', 'round_complete'\)\s*\n\s*do nothing/,
  'earn_tokens\'s ON CONFLICT predicate must match token_events_earn_once_per_day\'s new predicate exactly, or Postgres cannot infer the arbiter and every check_in/game_round earn errors',
);
ok('earn_tokens is redefined with an ON CONFLICT predicate matching the rescoped index exactly — the critical arbiter-inference bug found in review is fixed');

assert.match(sql, /create or replace function public\.claim_intake_complete\(\)/);
assert.match(sql, /amount int := 20;/);
assert.match(sql, /on conflict \(user_id\) where reason = 'intake_complete' do nothing/);
ok('claim_intake_complete: +20 tokens, idempotent via the once-ever index, not a duplicated day-based check');

// claim_round_complete must NOT exist in this migration — shipping it would
// be an unbounded token mint (client-supplied round number, nothing
// server-side to validate it against yet). Found and removed in review.
assert.doesNotMatch(sql, /claim_round_complete/, 'claim_round_complete must not be defined until real round-tracking state exists to validate a round number against');
ok('claim_round_complete is deliberately absent — shipping it now would be an unbounded token mint with no real round state to validate against');

// Both remaining RPCs must reuse the SAME advisory-lock/allow_token_write
// pattern earn_tokens already used before this migration — not a parallel,
// divergent write path.
const lockCount = (sql.match(/pg_advisory_xact_lock\(hashtext\('tokens:' \|\| uid::text\)\)/g) ?? []).length;
assert.equal(lockCount, 2, 'both earn_tokens (redefined) and claim_intake_complete must take the same per-user advisory lock');
const allowWriteCount = (sql.match(/set_config\('ato\.allow_token_write', '1', true\)/g) ?? []).length;
assert.equal(allowWriteCount, 2, 'both functions must set the same guard flag the me_tokens_guard trigger checks for');
ok('earn_tokens and claim_intake_complete reuse the existing per-user advisory lock and token-write guard, not a parallel write path');

assert.match(sql, /grant execute on function public\.claim_intake_complete\(\) to authenticated/);
assert.doesNotMatch(sql, /grant execute on function public\.claim_intake_complete\(\) to (anon|public)/);
ok('claim_intake_complete is authenticated-only, same as every other claim/earn/spend RPC in this repo');

// --- Client-side wiring: tokens.ts / tokens-server.ts ----------------------
import { TOKEN_EARN_INTAKE_COMPLETE, parseTokenResult } from '../src/lib/tokens';

assert.equal(TOKEN_EARN_INTAKE_COMPLETE, 20);
assert.deepEqual(
  parseTokenResult({ ok: true, already: false, balance: 33, delta: 13, reason: 'round_complete', round_number: 2 }),
  { ok: true, already: false, balance: 33, delta: 13, reason: 'round_complete', price: undefined, roundNumber: 2 },
  'parseTokenResult already reads round_number defensively, ready for whenever claim_round_complete ships',
);
ok('tokens.ts: earn constant matches the migration exactly (20), parseTokenResult reads round_number into roundNumber');

const tokensServerSrc = read('src/lib/tokens-server.ts');
assert.match(tokensServerSrc, /export async function claimIntakeComplete\(\): Promise<TokenResult> \{/);
assert.match(tokensServerSrc, /supabase\.rpc\('claim_intake_complete'\)/);
assert.doesNotMatch(tokensServerSrc, /claimRoundComplete|claim_round_complete/, 'no client wrapper for a server RPC that does not exist yet');
ok('tokens-server.ts: claimIntakeComplete calls the correct dedicated RPC; no dangling wrapper for the deferred claim_round_complete');

console.log(`\n${passed} wave45 checks passed`);
