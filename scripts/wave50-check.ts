/**
 * wave50: ongoing-round save-path prep (core loop redesign §2, T-02). Run:
 * npm run check:wave50
 *
 * Schema-only check (source assertions) — not yet applied to a live DB, same
 * pattern as wave45-49-check.ts.
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

const sql = read('supabase/migrations/wave50_ongoing_round_prep.sql');

// 1. This migration must NOT touch question_items.axis in any way — that
// was a false claim in an earlier draft (caught in review before push):
// wave21 already replaced the 15-axis check with the 16-axis
// question_items_axis_known, and wave27 exists solely to drop the old name.
// Re-adding it here would resurrect the exact redundant constraint wave27
// was written to remove. Scoped to actual SQL statements, not the header
// comment's prose explaining the correction (which legitimately names the
// old constraint for context — a whole-file check would false-positive).
assert.doesNotMatch(
  sql,
  /alter table public\.question_items\s+add constraint .*axis/i,
  'wave50 must not add any axis-related constraint on question_items — question_items_axis_known (wave21) already covers all 16 axes; re-adding one here would undo wave27',
);
ok('wave50 does not touch question_items.axis (wave21/27 already fixed it — no re-fix needed)');

// 2. sort_index widened from < 5 (wave17) to < 30, via drop+add (idempotent
// re-run pattern), not a raw ALTER that would fail on re-apply.
assert.match(sql, /drop constraint if exists question_items_sort_index_check/);
assert.match(sql, /add constraint question_items_sort_index_check check \(sort_index >= 0 and sort_index < 30\)/);
ok('question_items.sort_index widened to 0..29 (was 0..4), idempotent drop-then-add');

// 3. insert_ongoing_round_pack: sibling RPC, not a modification of
// insert_question_pack. Requires question_bank_item_id on every item, caps
// at 25, security definer, authenticated-only.
assert.doesNotMatch(
  sql,
  /create (or replace )?function public\.insert_question_pack/,
  'wave50 must not redefine insert_question_pack — it stays untouched, Infinite Questions must keep behaving exactly as it does today',
);
assert.match(sql, /create function public\.insert_ongoing_round_pack\(/);
const roundPackStart = sql.indexOf('create function public.insert_ongoing_round_pack(');
const roundPackEnd = sql.indexOf('-- 3. bump_bank_times_served', roundPackStart);
const roundPackBlock = sql.slice(roundPackStart, roundPackEnd);
assert.match(roundPackBlock, /security definer/);
assert.match(roundPackBlock, /set search_path = public/);
assert.match(roundPackBlock, /entry_count < 1 or entry_count > 25/);
assert.match(roundPackBlock, /question_bank_item_id required for ongoing round items/);
assert.match(roundPackBlock, /kind\)\s*\n\s*values \(uid, \(timezone\('utc', now\(\)\)\)::date, 'ongoing_round'\)/);
assert.match(roundPackBlock, /revoke all on function public\.insert_ongoing_round_pack\(jsonb\) from public, anon/);
assert.match(roundPackBlock, /grant execute on function public\.insert_ongoing_round_pack\(jsonb\) to authenticated/);
ok('insert_ongoing_round_pack is a new sibling RPC (1-25 items, requires question_bank_item_id, kind=ongoing_round) — insert_question_pack is untouched');

// 4. bump_bank_times_served: capped at 25 ids, security definer, no client
// write path onto question_bank_pool otherwise exists (wave49 revokes it).
const bumpStart = sql.indexOf('create function public.bump_bank_times_served(');
const bumpEnd = sql.indexOf('-- 4. insert_bank_pool_items', bumpStart);
const bumpBlock = sql.slice(bumpStart, bumpEnd);
assert.match(bumpBlock, /security definer/);
assert.match(bumpBlock, /id_count > 25/);
assert.match(bumpBlock, /set times_served = times_served \+ 1/);
assert.match(bumpBlock, /revoke all on function public\.bump_bank_times_served\(uuid\[\]\) from public, anon/);
assert.match(bumpBlock, /grant execute on function public\.bump_bank_times_served\(uuid\[\]\) to authenticated/);
ok('bump_bank_times_served caps at 25 ids, security definer, authenticated-only');

// 5. insert_bank_pool_items: capped at 25 items, dedups by prompt via
// on-conflict-do-update-returning (never do-nothing, which would silently
// drop the returned row for a coincidental collision).
const insertItemsStart = sql.indexOf('create function public.insert_bank_pool_items(');
const insertItemsBlock = sql.slice(insertItemsStart);
assert.match(insertItemsBlock, /security definer/);
assert.match(insertItemsBlock, /entry_count > 25/);
assert.match(insertItemsBlock, /values \(item->>'axis', item->>'category', v_prompt, item->'options', 'ai'\)/);
assert.match(insertItemsBlock, /on conflict \(prompt\) do update set prompt = excluded\.prompt/);
assert.doesNotMatch(insertItemsBlock, /on conflict \(prompt\) do nothing/, 'insert_bank_pool_items must always return a row (new or pre-existing) — do nothing would silently drop it on a prompt collision');
assert.match(insertItemsBlock, /revoke all on function public\.insert_bank_pool_items\(jsonb\) from public, anon/);
assert.match(insertItemsBlock, /grant execute on function public\.insert_bank_pool_items\(jsonb\) to authenticated/);
ok('insert_bank_pool_items caps at 25 items, source=ai, always returns a row via on-conflict-do-update, security definer, authenticated-only');

console.log(`\n${passed} wave50 checks passed`);
