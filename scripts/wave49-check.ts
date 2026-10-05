/**
 * wave49: shared question bank pool for the post-50 ongoing-round loop
 * (core loop redesign §2). Run: npm run check:wave49
 *
 * Schema-only check (source assertions) — not yet applied to a live DB, so
 * this checks the migration's SQL text directly, same pattern as
 * wave45-48-check.ts.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { LEGACY_INTAKE_PROMPTS } from '../src/lib/questions/bank';
import { QUESTIONS_BANK_V1, ROUND_ONLY_BANK_V1 } from '../src/lib/questions/bank-v1';
import type { QuestionDraft } from '../src/lib/questions/types';
import { TRAIT_AXES } from '../src/lib/traits';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

const sql = read('supabase/migrations/wave49_question_bank_pool.sql');

// 1. question_bank_pool: catalog-shaped (shared, read-only to clients).
assert.match(sql, /create table if not exists public\.question_bank_pool \(/);
assert.match(sql, /prompt text not null unique check/);
assert.match(sql, /source text not null check \(source in \('authored', 'ai'\)\)/);
const poolStart = sql.indexOf('create table if not exists public.question_bank_pool');
const poolPolicyEnd = sql.indexOf('-- 2. question_bank_reroll_exclusions -----', poolStart);
const poolBlock = sql.slice(poolStart, poolPolicyEnd);
assert.match(poolBlock, /create policy question_bank_pool_select_auth on public\.question_bank_pool\s+for select to authenticated using \(true\)/);
assert.match(poolBlock, /grant select on public\.question_bank_pool to authenticated/);
assert.match(poolBlock, /revoke insert, update, delete on public\.question_bank_pool from public, anon, authenticated/);
assert.doesNotMatch(poolBlock, /for insert|for update|for delete/, 'question_bank_pool must be read-only to clients — no client-facing write policy');
ok('question_bank_pool is a shared, read-only-to-clients catalog table (same RLS shape as archetype_defs/legends)');

// 2. question_bank_reroll_exclusions: permanent per-user, no insert policy.
assert.match(sql, /create table if not exists public\.question_bank_reroll_exclusions \(/);
assert.match(sql, /unique \(user_id, question_bank_item_id\)/);
const exclusionsStart = sql.indexOf('create table if not exists public.question_bank_reroll_exclusions');
const exclusionsEnd = sql.indexOf('-- 3. question_packs additions -----', exclusionsStart);
const exclusionsBlock = sql.slice(exclusionsStart, exclusionsEnd);
assert.match(exclusionsBlock, /create policy question_bank_reroll_exclusions_select_own on public\.question_bank_reroll_exclusions\s+for select using \(auth\.uid\(\) = user_id\)/);
assert.doesNotMatch(exclusionsBlock, /for insert/, 'no insert policy — writes happen only via a future security-definer RPC (T-02), same convention as question_items/question_packs');
ok('question_bank_reroll_exclusions is per-user, select-own-only, write-only-through-a-future-RPC (unique on user_id+item makes exclusion permanent, not time-bounded)');

// 3. question_packs: kind + completed_at, generated_on documented as vestigial.
assert.match(
  sql,
  /add column if not exists kind text not null default 'infinite_questions'\s+check \(kind in \('infinite_questions', 'ongoing_round'\)\)/,
);
assert.match(sql, /add column if not exists completed_at timestamptz/);
assert.match(sql, /comment on column public\.question_packs\.generated_on is\s+'Infinite-Questions daily-cache field/);
ok('question_packs gains kind + completed_at; generated_on documented as vestigial for ongoing_round rows (Gap B, comment-only)');

// 4. question_items: nullable FK, does not touch insert_question_pack.
assert.match(
  sql,
  /add column if not exists question_bank_item_id uuid references public\.question_bank_pool\(id\) on delete set null/,
);
// The header comment legitimately mentions insert_question_pack in prose
// (explaining why the new column is nullable) — the real check is that no
// SQL statement redefines or alters that RPC.
assert.doesNotMatch(
  sql,
  /create (or replace )?function public\.insert_question_pack/,
  'wave49 must not redefine insert_question_pack — the new column is nullable specifically so that RPC needs no change',
);
ok('question_items.question_bank_item_id is a nullable FK; insert_question_pack (the only INSERT path on question_items) is untouched');

// 5. Seed: the OLD 50-question intake, as it was when wave49 was applied.
// Since the staged intake (2026-10-02) the intake is 48 and the old 50 live on
// split between QUESTIONS_BANK and ROUND_ONLY_BANK, in the old order recorded
// by LEGACY_INTAKE_PROMPTS. wave49 is applied and never edited, so this checks
// it against that old order — every row, not a spot-check.
const SEEDED_BANK: QuestionDraft[] = LEGACY_INTAKE_PROMPTS.map((row) => {
  // The seeded wording is the frozen one (bank-v1.ts); wave84 rewords the live rows.
  const draft = [...QUESTIONS_BANK_V1, ...ROUND_ONLY_BANK_V1].find((d) => d.prompt === row.prompt);
  assert.ok(draft, `old intake prompt missing from the code: ${row.prompt}`);
  return draft!;
});
const insertMatch = sql.match(/insert into public\.question_bank_pool[\s\S]+?on conflict \(prompt\) do nothing;/);
assert.ok(insertMatch, 'seed insert block must exist');
const insertBlock = insertMatch![0];
const rowCount = (insertBlock.match(/'authored'\)/g) ?? []).length;
assert.equal(rowCount, SEEDED_BANK.length, 'seed must insert exactly one row per old intake question');
assert.match(insertBlock, /on conflict \(prompt\) do nothing/);
ok(`seed inserts exactly ${SEEDED_BANK.length} rows (the old intake), idempotent via on conflict (prompt) do nothing`);

// Every one of the 50 rows, not a spot-check: parse each VALUES tuple back
// out of the SQL and deep-compare axis/category/prompt/options against the
// live QUESTIONS_BANK entry at the same position. A wrong axis, dropped
// option, or mistranscribed prompt on any row fails this, not just the
// first/middle/last ones a spot-check would catch.
const rowPattern = /\(\s*'([^']*(?:''[^']*)*)',\s*(?:'([^']*(?:''[^']*)*)'|null),\s*'([^']*(?:''[^']*)*)',\s*'((?:[^']|'')*)'::jsonb,\s*'authored'\)/g;
function unescapeSql(s: string): string {
  return s.replace(/''/g, "'");
}
const parsedRows: { axis: string; category: string | null; prompt: string; options: unknown }[] = [];
for (const m of insertBlock.matchAll(rowPattern)) {
  parsedRows.push({
    axis: unescapeSql(m[1]),
    category: m[2] != null ? unescapeSql(m[2]) : null,
    prompt: unescapeSql(m[3]),
    options: JSON.parse(unescapeSql(m[4])),
  });
}
assert.equal(parsedRows.length, SEEDED_BANK.length, 'row-parser must find exactly one parsed row per old intake question (parser bug if this drifts from the earlier count check)');
for (let i = 0; i < SEEDED_BANK.length; i++) {
  const bank = SEEDED_BANK[i];
  const seeded = parsedRows[i];
  assert.equal(seeded.axis, bank.axis, `row ${i}: axis mismatch (seed has "${seeded.axis}", bank.ts has "${bank.axis}")`);
  assert.equal(seeded.category ?? undefined, bank.category, `row ${i}: category mismatch`);
  assert.equal(seeded.prompt, bank.prompt, `row ${i}: prompt text mismatch`);
  assert.deepEqual(seeded.options, bank.options, `row ${i}: options mismatch`);
}
ok('all 50 seeded rows deep-match the old intake (now QUESTIONS_BANK + ROUND_ONLY_BANK) at the same index: axis, category, prompt text, and options');

// Every axis in the 16-axis vocabulary appears in question_bank_pool's own
// check constraint (independent of question_items' constraint elsewhere).
for (const axis of TRAIT_AXES) {
  assert.ok(
    new RegExp(`'${axis}'`).test(poolBlock),
    `question_bank_pool's axis check constraint must include '${axis}'`,
  );
}
assert.equal(TRAIT_AXES.length, 16, 'sanity: still 16 axes as of this check');
ok('question_bank_pool.axis check constraint covers all 16 current TRAIT_AXES');

console.log(`\n${passed} wave49 checks passed`);
