/**
 * wave51: ATO tokens currency (core loop redesign §5, T-04). Run: npm run check:wave51
 *
 * Source-assertion check against the migration file. Applied to the live
 * DB 2026-09-09 — see wave52_ato_tokens_fixes.sql (and wave52-check.ts) for
 * the 4 critical review fixes layered on top via create-or-replace/alter,
 * same convention as wave47 patching wave46.
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

const sql = read('supabase/migrations/wave51_ato_tokens.sql');

// 1. me.ato_tokens + its own write-guard trigger, separate flag from tokens'.
assert.match(sql, /add column if not exists ato_tokens int not null default 0\s*\n\s*check \(ato_tokens >= 0\)/);
ok('me.ato_tokens: earned-only balance column, non-negative check');

assert.match(sql, /create or replace function public\.me_ato_tokens_guard\(\)/);
assert.match(sql, /current_setting\('ato\.allow_ato_token_write', true\) is distinct from '1'/);
assert.match(sql, /before update of ato_tokens on public\.me/);
assert.doesNotMatch(
  sql,
  /current_setting\('ato\.allow_token_write'/,
  'the ato_tokens guard must use its OWN config flag (ato.allow_ato_token_write), never the Notes economy\'s ato.allow_token_write — an in-flight Notes RPC must not incidentally permit an ato_tokens write in the same transaction',
);
ok('me.ato_tokens is protected by its own BEFORE UPDATE guard trigger, using a config flag distinct from me.tokens\' own guard');

// 2. ato_token_events: separate table, not a reason string on token_events.
assert.match(sql, /create table public\.ato_token_events \(/);
assert.doesNotMatch(sql, /alter table public\.token_events/, 'wave51 must never touch the existing Notes ledger (token_events) — these are two separate currencies with two separate ledgers');
const reasons = ['full_profile_complete', 'ongoing_round_complete', 'legend_reroll', 'category_reroll', 'question_reroll'];
for (const reason of reasons) {
  assert.ok(new RegExp(`'${reason}'`).test(sql), `reason check constraint must include '${reason}'`);
}
ok('ato_token_events is a wholly separate ledger table with its own 5-reason check constraint');

// Each reason's required-companion-column constraint (closes the NULL-bypass
// gap the same way wave45 did for round_number/round_complete).
assert.match(sql, /\(reason = 'ongoing_round_complete'\) = \(pack_id is not null\)/);
assert.match(sql, /\(reason = 'category_reroll'\) = \(category_id is not null\)/);
assert.match(sql, /\(reason = 'question_reroll'\) = \(question_item_id is not null\)/);
ok('pack_id/category_id/question_item_id are each tied to their matching reason via a CHECK constraint, closing the NULL-bypass-unique-index gap proactively');

// 3. RLS: select-own only, no write policy — RPC-only writes.
const ledgerStart = sql.indexOf('create table public.ato_token_events');
const ledgerRpcStart = sql.indexOf('-- 3. claim_full_profile_complete', ledgerStart);
const ledgerBlock = sql.slice(ledgerStart, ledgerRpcStart);
assert.match(ledgerBlock, /create policy ato_token_events_select_own on public\.ato_token_events\s+for select using \(auth\.uid\(\) = user_id\)/);
assert.doesNotMatch(ledgerBlock, /for insert|for update|for delete/, 'ato_token_events must have no client write policy — RPC-only, same convention as token_events');
ok('ato_token_events is select-own-only, no insert/update/delete policy');

// 4. Five unique indexes, one per reason, each scoped correctly.
assert.match(ledgerBlock, /create unique index ato_token_events_full_profile_once\s+on public\.ato_token_events \(user_id\) where reason = 'full_profile_complete'/);
assert.match(ledgerBlock, /create unique index ato_token_events_round_once\s+on public\.ato_token_events \(user_id, pack_id\) where reason = 'ongoing_round_complete'/);
assert.match(ledgerBlock, /create unique index ato_token_events_legend_reroll_daily\s+on public\.ato_token_events \(user_id, local_day\) where reason = 'legend_reroll'/);
assert.match(ledgerBlock, /create unique index ato_token_events_category_reroll_daily\s+on public\.ato_token_events \(user_id, category_id, local_day\) where reason = 'category_reroll'/);
assert.match(ledgerBlock, /create unique index ato_token_events_question_reroll_daily\s+on public\.ato_token_events \(user_id, question_item_id, local_day\) where reason = 'question_reroll'/);
ok('once-ever, once-per-round, and three once-per-day-scoped-by-target unique indexes all present, matching the finalized plan\'s exact reroll caps (1/day legend, 1/day/category, 1/day/question)');

// 5. Five RPCs, each security definer, authenticated-only, using the
// ato_tokens-specific advisory lock namespace and write-guard flag.
const rpcNames = [
  ['claim_full_profile_complete', '()'],
  ['claim_ongoing_round_complete', '(uuid)'],
  ['spend_ato_tokens_legend_reroll', '()'],
  ['spend_ato_tokens_category_reroll', '(text)'],
  ['spend_ato_tokens_question_reroll', '(uuid)'],
] as const;
for (const [name, sig] of rpcNames) {
  const escapedSig = sig.replace(/[()]/g, (c) => '\\' + c);
  assert.match(sql, new RegExp(`create function public\\.${name}\\(`), `${name} must be defined`);
  assert.match(
    sql,
    new RegExp(`revoke all on function public\\.${name}${escapedSig} from public, anon`),
    `${name} must revoke public/anon execute`,
  );
  assert.match(
    sql,
    new RegExp(`grant execute on function public\\.${name}${escapedSig} to authenticated`),
    `${name} must grant authenticated-only execute`,
  );
}
ok('all 5 RPCs defined, each authenticated-only (revoke public/anon, grant authenticated)');

const lockCount = (sql.match(/pg_advisory_xact_lock\(hashtext\('ato_tokens:' \|\| uid::text\)\)/g) ?? []).length;
assert.equal(lockCount, 5, 'all 5 RPCs must take the same per-user advisory lock, in the ato_tokens namespace (distinct from the Notes economy\'s "tokens:" namespace)');
const allowWriteCount = (sql.match(/set_config\('ato\.allow_ato_token_write', '1', true\)/g) ?? []).length;
assert.equal(allowWriteCount, 5, 'all 5 RPCs (2 claims + 3 spends) set the guard flag exactly once, on their success path only — the "already claimed/spent" early-return path never touches ato_tokens and must not set the flag');
ok('all 5 RPCs share the ato_tokens-specific advisory lock namespace; every code path that actually writes ato_tokens sets the matching write-guard flag first');

// 6. claim_ongoing_round_complete verifies completion server-side, not a
// trusted completed_at flag nothing in the client sets yet.
const claimRoundStart = sql.indexOf('create function public.claim_ongoing_round_complete(');
const claimRoundEnd = sql.indexOf('-- 5. spend_ato_tokens_legend_reroll', claimRoundStart);
const claimRoundBlock = sql.slice(claimRoundStart, claimRoundEnd);
assert.match(claimRoundBlock, /where pack_id = p_pack_id and answered_option is null and skipped_at is null/);
assert.match(claimRoundBlock, /kind = 'ongoing_round'/);
assert.match(claimRoundBlock, /v_pack_owner is null or v_pack_owner is distinct from uid/);
assert.match(claimRoundBlock, /set completed_at = now\(\)\s*\n\s*where id = p_pack_id and completed_at is null/);
ok('claim_ongoing_round_complete verifies ownership + full completion from question_items directly (not a client-trusted flag), and populates completed_at as a side effect');

// 7. Spend RPCs must abort (raise) on insufficient balance, not silently no-op.
const spendBlocks = sql.split(/create function public\.spend_ato_tokens_/).slice(1);
assert.equal(spendBlocks.length, 3, 'expected exactly 3 spend RPC bodies');
for (const block of spendBlocks) {
  assert.match(block, /where id = uid and ato_tokens >= amount/, 'balance-guarded decrement');
  assert.match(block, /if new_balance is null then\s*\n\s*raise exception 'insufficient ato tokens'/, 'insufficient balance must abort the whole transaction (rolling back the ledger insert too), not silently no-op');
}
ok('all 3 spend RPCs guard the decrement and raise on insufficient balance, rolling back the ledger insert in the same transaction');

// 8. Never touches token_events/tokens (Notes) or redefines an unrelated RPC.
assert.doesNotMatch(sql, /public\.earn_tokens|public\.spend_tokens|public\.claim_intake_complete/, 'wave51 must not redefine any Notes-economy RPC');
ok('wave51 never touches the Notes economy\'s RPCs or ledger — fully separate currency, confirmed at the SQL level');

console.log(`\n${passed} wave51 checks passed`);
