/**
 * wave52: 4 critical fixes to wave51 (ATO tokens), found by the `reviewer`
 * subagent the same session wave51 was applied. Run: npm run check:wave52
 *
 * Schema-only check (source assertions) against the patch migration file —
 * wave51 itself is untouched (already live), same convention as
 * wave47-check.ts checking wave47's patch over an already-applied wave46.
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

const sql = read('supabase/migrations/wave52_ato_tokens_fixes.sql');

// Fix 1: FK cascade, not set null — the combination with the reason/companion
// CHECK constraints was fatal to delete-account (cascading a question_packs
// delete would try to null pack_id, tripping the CHECK before the row itself
// is removed via its own user_id cascade).
assert.match(
  sql,
  /drop constraint ato_token_events_pack_id_fkey,\s*\n\s*add constraint ato_token_events_pack_id_fkey\s*\n\s*foreign key \(pack_id\) references public\.question_packs\(id\) on delete cascade/,
);
assert.match(
  sql,
  /drop constraint ato_token_events_question_item_id_fkey,\s*\n\s*add constraint ato_token_events_question_item_id_fkey\s*\n\s*foreign key \(question_item_id\) references public\.question_items\(id\) on delete cascade/,
);
assert.doesNotMatch(sql, /on delete set null/i, 'wave52 must leave no "set null" FK behind on this table — that was the exact bug');
ok('both pack_id/question_item_id FKs on ato_token_events are switched from ON DELETE SET NULL to ON DELETE CASCADE, closing the delete-account abort');

// Fix 2 & 3: claim_ongoing_round_complete requires exactly 25 items, all
// genuinely answered — skipped_at is never consulted (skip_rest_question_pack
// is generic and would otherwise let a user farm the award for free).
const claimRoundStart = sql.indexOf('create or replace function public.claim_ongoing_round_complete(');
const claimRoundEnd = sql.indexOf('-- 4. claim_full_profile_complete', claimRoundStart);
const claimRoundBlock = sql.slice(claimRoundStart, claimRoundEnd);
assert.match(claimRoundBlock, /v_total_items <> 25/, 'must require exactly 25 items in the pack — a real round is always 25, closing the tiny-pack farm');
assert.match(claimRoundBlock, /where pack_id = p_pack_id and answered_option is null;/, 'unanswered check must not also exclude skipped_at — skip must never count as done');
assert.doesNotMatch(claimRoundBlock, /skipped_at/, 'claim_ongoing_round_complete must not consult skipped_at at all anymore — skip_rest_question_pack has no kind filter and would otherwise let a full skip count as a finished round');
ok('claim_ongoing_round_complete now requires exactly 25 items AND every one genuinely answered_option-is-not-null; skipped_at is never consulted');

// Fix 4: claim_full_profile_complete verifies real server-side evidence
// (trait_history rows from the bank-answer write source) before paying out,
// closing "any authenticated caller gets +21 for free".
const claimProfileStart = sql.indexOf('create or replace function public.claim_full_profile_complete()');
const claimProfileBlock = sql.slice(claimProfileStart);
assert.match(claimProfileBlock, /from public\.trait_history\s*\n\s*where user_id = uid and source = 'self_situation'/);
assert.match(claimProfileBlock, /v_answer_count < 50/);
ok('claim_full_profile_complete now requires >= 50 trait_history rows with source=self_situation before paying out — no longer a free +21 for any authenticated caller');

// Both redefined RPCs keep the same lock namespace and write-guard flag as
// wave51 — this is a fix, not a parallel/divergent write path.
const lockCount = (sql.match(/pg_advisory_xact_lock\(hashtext\('ato_tokens:' \|\| uid::text\)\)/g) ?? []).length;
assert.equal(lockCount, 2, 'both redefined RPCs must keep the same per-user advisory lock');
const allowWriteCount = (sql.match(/set_config\('ato\.allow_ato_token_write', '1', true\)/g) ?? []).length;
assert.equal(allowWriteCount, 2, 'both redefined RPCs must keep setting the same write-guard flag on their success path only');
ok('both redefined RPCs preserve the exact lock/write-guard pattern from wave51 — these are targeted fixes, not a rewrite');

console.log(`\n${passed} wave52 checks passed`);
