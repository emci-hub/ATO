/**
 * wave48: dedicated per-generation quota for roll content (trait-system
 * redesign §7). Run: npm run check:wave48
 *
 * Schema-only check (source assertions) — mirrors claim_questions_batch
 * (wave17), a real RPC already applied live, so this pattern is proven.
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

const sql = read('supabase/migrations/wave48_roll_generation_quota.sql');
const wave17Sql = read('supabase/migrations/wave17_infinite_questions.sql');

assert.match(sql, /add column if not exists roll_generations_daily_cap int not null default 15/);
assert.match(sql, /create or replace function public\.claim_roll_generation\(\)/);

// Scope the "never touches the shared quota" check to the function BODY
// only — the migration's own header comment legitimately mentions
// ai_daily_cap/ai_monthly_cap in prose (explaining why this RPC exists at
// all), which a whole-file check would false-positive on.
const fnStart = sql.indexOf('create or replace function public.claim_roll_generation()');
const fnEnd = sql.indexOf('$$;', fnStart);
const fnBody = sql.slice(fnStart, fnEnd);
assert.match(fnBody, /by_type->>'roll_gen'/);
assert.doesNotMatch(fnBody, /ai_daily_cap|ai_monthly_cap/, 'claim_roll_generation\'s function body must not touch the shared Sage/Explore quota columns — it is a separate, additional bound');
assert.match(fnBody, /pg_advisory_xact_lock\(hashtext\(uid::text \|\| ':roll_gen'\)\)/);
assert.match(sql, /grant execute on function public\.claim_roll_generation\(\) to authenticated/);
assert.doesNotMatch(sql, /grant execute on function public\.claim_roll_generation\(\) to (anon|public)/);
ok('claim_roll_generation: its own ai_usage.by_type key and app_config cap, authenticated-only, never touches the shared Sage/Explore quota');

// This RPC must genuinely mirror claim_questions_batch's shape (own
// by_type key, own advisory lock suffix, own app_config cap, claimed
// BEFORE generation) — not a divergent, ad-hoc reimplementation.
assert.match(wave17Sql, /create or replace function public\.claim_questions_batch\(\)/);
assert.match(wave17Sql, /by_type->>'questions'/);
assert.match(wave17Sql, /pg_advisory_xact_lock\(hashtext\(uid::text \|\| ':questions'\)\)/);
ok('claim_roll_generation genuinely mirrors the proven claim_questions_batch pattern (own by_type key, own lock suffix, own cap)');

// A corrected `comment on function` for claim_roll (wave46) must no longer
// claim RCI eligibility is decided in "the calling Edge Function" — no such
// function exists. Scoped to the actual SQL statement, not the surrounding
// prose explaining the correction (which legitimately quotes the old wrong
// text for context — a whole-file check would false-positive on that).
const commentStmtStart = sql.indexOf("comment on function public.claim_roll() is");
const commentStmt = sql.slice(commentStmtStart);
assert.doesNotMatch(commentStmt, /decided in the calling Edge Function/i);
assert.match(commentStmt, /RCI eligibility \(rollEligible\) is checked client-side before this is called — not independently re-verified server-side/);
ok('claim_roll\'s comment is corrected to accurately describe eligibility as client-checked, not server-enforced by a nonexistent Edge Function');

// A second, separate stale comment (the rolls_daily_cap COLUMN comment,
// distinct from the function comment above) carried the same false claim —
// found and corrected in the same review pass.
const columnCommentStart = sql.indexOf('comment on column public.app_config.rolls_daily_cap is');
assert.ok(columnCommentStart > -1, 'wave48 must also correct the rolls_daily_cap column comment, not just the function comment');
const columnComment = sql.slice(columnCommentStart);
assert.doesNotMatch(columnComment, /decided in the calling Edge Function/i);
ok('the separate rolls_daily_cap column comment is also corrected, not just claim_roll\'s function comment');

console.log(`\n${passed} wave48 checks passed`);
