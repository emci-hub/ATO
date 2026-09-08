/**
 * wave46: the roll/reveal mechanic schema (trait-system redesign §7).
 * Run: npm run check:wave46
 *
 * Schema-only check (source assertions) — not applied to the live DB yet.
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

const sql = read('supabase/migrations/wave46_trait_rolls.sql');

// --- claim_roll: own call_type, own cap, mirrors claim_questions_batch ----
assert.match(sql, /add column if not exists rolls_daily_cap int not null default 1/);
assert.match(sql, /create or replace function public\.claim_roll\(\)/);
assert.match(sql, /by_type->>'roll'/);
assert.doesNotMatch(sql, /ai_daily_cap|ai_monthly_cap/, 'claim_roll must not touch the shared Sage/Explore quota columns at all');
assert.match(sql, /pg_advisory_xact_lock\(hashtext\(uid::text \|\| ':roll'\)\)/);
ok('claim_roll: its own ai_usage.by_type key and app_config cap, never touches the shared Sage/Explore quota — mirrors claim_questions_batch exactly');

// --- trait_rolls: type-appropriate columns + defense-in-depth uniqueness --
assert.match(sql, /create table public\.trait_rolls \(/);
assert.match(sql, /type text not null check \(type in \('legend', 'category', 'story'\)\)/);
assert.match(
  sql,
  /constraint trait_rolls_category_id_matches_type check \(\s*\n\s*\(type = 'category'\) = \(category_id is not null\)\s*\n\s*\)/,
  'category_id must be set exactly when type is category, or a stray legend/story row with a category_id (or a category row missing one) could pass silently',
);
// A plain unique(roll_id, type, category_id) would NOT stop two legend rows
// in one roll (category_id is NULL for both, and NULLs are distinct from
// each other) — two separate partial indexes are required.
assert.match(sql, /create unique index trait_rolls_unique_category\s*\n\s*on public\.trait_rolls \(roll_id, category_id\)\s*\n\s*where category_id is not null/);
assert.match(sql, /create unique index trait_rolls_unique_singleton_type\s*\n\s*on public\.trait_rolls \(roll_id, type\)\s*\n\s*where category_id is null/);
assert.match(sql, /alter table public\.trait_rolls enable row level security/);
assert.match(sql, /create policy trait_rolls_select_own on public\.trait_rolls\s*\n\s*for select using \(auth\.uid\(\) = user_id\)/);
assert.match(sql, /revoke insert, update, delete on public\.trait_rolls from public, anon, authenticated/);
ok('trait_rolls: type-appropriate category_id constraint, no-duplicate-legend/story/category defense-in-depth indexes, RLS select-own, no direct client write path');

// --- trait_roll_snapshots ----------------------------------------------------
assert.match(sql, /create table public\.trait_roll_snapshots \(\s*\n\s*roll_id uuid primary key/, 'one row per ROLL, not per axis');
assert.match(sql, /alter table public\.trait_roll_snapshots enable row level security/);
assert.match(sql, /revoke insert, update, delete on public\.trait_roll_snapshots from public, anon, authenticated/);
ok('trait_roll_snapshots: one row per roll (primary key is roll_id itself), RLS select-own, no direct client write path');

// --- store_roll: bounded, validated, atomic, idempotent -------------------
// A prior draft trusted p_items completely — unbounded item count, no
// per-item shape/size validation, and a silent no-snapshot failure mode on
// a roll_id collision. All fixed and covered below.
assert.match(sql, /create or replace function public\.store_roll\(p_roll_id uuid, p_items jsonb, p_axis_snapshot jsonb\)/);
assert.match(
  sql,
  /if jsonb_typeof\(p_items\) <> 'array' or jsonb_array_length\(p_items\) <> 13 then/,
  'store_roll must reject anything other than exactly 13 items — an earlier version accepted any non-empty array, an unbounded-write risk',
);
// A local variable named `item` colliding with an `AS item` query alias is
// a REAL bug under plpgsql's default variable_conflict=error (found in
// review — "column reference is ambiguous" on every real call, since
// CREATE OR REPLACE FUNCTION only checks syntax, not this at apply time).
// Every jsonb_array_elements() call below must use the implicit `value`
// column (no alias), matching this repo's own convention elsewhere
// (explore.sql, wave17, wave44) — assert the fix, not the bug.
assert.doesNotMatch(sql, /jsonb_array_elements\([^)]*\)\s*as\s+item\b/i, 'no jsonb_array_elements() call may alias its column as `item` — that collides with the declared v_item variable\'s old name and is exactly the bug this fixed');
assert.match(sql, /count\(\*\) filter \(where value->>'type' = 'legend'\)/);
assert.match(sql, /count\(\*\) filter \(where value->>'type' = 'story'\)/);
assert.match(sql, /count\(distinct value->>'category_id'\) filter \(where value->>'type' = 'category'\)/);
assert.match(
  sql,
  /if v_legend_count <> 1 or v_story_count <> 1 or v_category_count <> 11 then/,
  'store_roll must enforce exactly 1 legend, 1 story, 11 distinct categories — not just a count of 13 (13 legends would pass a bare length check)',
);
assert.match(sql, /octet_length\(\(value->'result'\)::text\) > 8192/, 'each item\'s result must be size-capped, matching this repo\'s existing convention of bounding caller-supplied content');
assert.match(
  sql,
  /value->'result' = 'null'::jsonb/,
  'a caller-supplied JSON `null` literal for result must be rejected explicitly — `value->\'result\' is null` alone only catches a MISSING key (SQL NULL), not the jsonb scalar \'null\', which would otherwise still satisfy the NOT NULL column constraint',
);
assert.match(
  sql,
  /if v_snapshot_stored is not true then\s*\n\s*raise exception 'roll_id % is already in use by a different roll/,
  'a roll_id collision with another user must fail loudly, not silently succeed with no snapshot ever stored (the RCI baseline would then be permanently missing)',
);
assert.match(sql, /if exists \(select 1 from public\.trait_rolls where roll_id = p_roll_id and user_id = uid\) then\s*\n\s*return jsonb_build_object\('ok', true, 'already', true/, 'a retried store_roll with an already-stored roll_id (same user) must be a safe no-op, not a duplicate-key error');
assert.match(sql, /pg_advisory_xact_lock\(hashtext\(uid::text \|\| ':roll_store'\)\)/);
ok('store_roll: exactly 13 items with the correct type mix, each item shape/size-validated, idempotent for the same user, fails loudly (not silently) on a cross-user roll_id collision');

// --- reveal_roll_item: atomic spend+reveal, correct shared lock key -------
assert.match(sql, /'roll_reveal'/);
assert.match(sql, /create or replace function public\.reveal_roll_item\(p_item_id uuid\)/);
// Must share earn_tokens/spend_tokens/claim_intake_complete's exact lock
// key — a differently-suffixed key here would let a reveal run concurrently
// with a spend/earn on the same user instead of mutually excluding them.
// Found in review: an earlier version used a reveal-only suffix.
const revealFnStart = sql.indexOf('create or replace function public.reveal_roll_item');
const revealFnBody = sql.slice(revealFnStart);
assert.match(revealFnBody, /pg_advisory_xact_lock\(hashtext\('tokens:' \|\| uid::text\)\)/, 'reveal_roll_item must use the SAME lock key as earn_tokens/spend_tokens/claim_intake_complete, not its own suffix');
assert.doesNotMatch(revealFnBody, /hashtext\(uid::text \|\| ':reveal'\)/, 'the old, differently-suffixed lock key must be gone entirely');
assert.match(revealFnBody, /where id = p_item_id and user_id = uid\s*\n\s*for update/, 'row-level lock on the specific item too, not just the per-user advisory lock');
assert.match(revealFnBody, /v_price := case v_type when 'legend' then 5 else 1 end/);
assert.match(revealFnBody, /if coalesce\(v_balance, 0\) < v_price then/, 'balance check happens before any deduction');
assert.match(revealFnBody, /if v_revealed_at is not null then\s*\n\s*return jsonb_build_object\('ok', true, 'already', true/, 'revealing an already-revealed item must be a safe no-op, not a double-spend or an error');
ok('reveal_roll_item: shares the correct per-user token lock with every other token-mutating RPC; balance check + deduct + revealed_at update inside one transaction; already-revealed items are a safe no-op');

// The spend and the row update happen in the same function/transaction —
// no separate client-side "now spend, then separately mark revealed" calls
// that could race or partially fail.
const spendIdx = revealFnBody.indexOf("'roll_reveal', today");
const revealIdx = revealFnBody.indexOf('set revealed_at = now()');
assert.ok(spendIdx > -1 && revealIdx > spendIdx, 'the token spend and the revealed_at write must both happen inside reveal_roll_item, spend first');
ok('reveal_roll_item performs the spend and the reveal write in the same function call, not two separately-callable steps');

// --- token_events_reason_known: must retain every reason wave45 added -----
// Exact bug class the wave45 review caught: a rewrite of this constraint
// that drops or forgets a previously-added reason would silently break
// whatever RPC inserts with it.
for (const reason of ['check_in', 'game_round', 'trickle', 'sage_insight', 'profile_depth', 'intake_complete', 'round_complete', 'roll_reveal']) {
  assert.match(sql, new RegExp(`'${reason}'`), `token_events_reason_known must retain '${reason}' — dropping any prior reason here would break whatever RPC still inserts with it`);
}
ok('token_events_reason_known retains every reason from wave19 and wave45, plus the new roll_reveal — nothing silently dropped');

console.log(`\n${passed} wave46 checks passed`);
