/**
 * wave78: staged intake on the server (emci 2026-10-02).
 * Run: npm run check:wave78
 *
 * Source assertions on the migration text (same pattern as wave49/wave52):
 *   - claim_full_profile_complete pays on "every trait has its 3" (trait_tracks,
 *     the count the app's stage reads), the old tiered 50 (same per-trait caps
 *     as LEGACY_INTAKE_AXIS_COUNTS), or the old 50 history rows — so nobody
 *     who qualified before loses it;
 *   - claim_ongoing_round_complete accepts a round of 16 (and an old 25);
 *   - the 20 authored pool rows deep-match the code (scripts/gen-wave78-rows.ts);
 *   - nothing alters or deletes existing data.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { LEGACY_INTAKE_AXIS_COUNTS } from '../src/lib/questions/bank';
import { ONGOING_ROUND_SIZE } from '../src/lib/questions/tiered-axis-plan';
import { INTAKE_SETS, LEGACY_INTAKE_TOTAL } from '../src/lib/questions/intake-stage';
import { TRAIT_AXES } from '../src/lib/traits';
import { wave78Drafts } from './gen-wave78-rows';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const sql = readFileSync(resolve(__dirname, '../supabase/migrations/wave78_staged_intake.sql'), 'utf8').replace(
  /\r\n/g,
  '\n',
);

function fnBody(name: string): string {
  const start = sql.indexOf(`create or replace function public.${name}(`);
  assert.ok(start >= 0, `${name} must be redefined`);
  const end = sql.indexOf('$$;', start);
  return sql.slice(start, end);
}

// --- 1. claim_full_profile_complete ----------------------------------------------
{
  const body = fnBody('claim_full_profile_complete');
  assert.match(body, /security definer\s+set search_path = public/);
  assert.match(body, /from public\.trait_tracks\s+where user_id = uid and track = 'report' and answer_count >= 3;/);
  assert.equal(INTAKE_SETS, 3);
  assert.match(body, new RegExp(`v_full_axes < ${TRAIT_AXES.length}`));
  for (const axis of TRAIT_AXES) {
    assert.match(body, new RegExp(`\\('${axis}', ${LEGACY_INTAKE_AXIS_COUNTS[axis]}\\)`), `old cap for ${axis}`);
  }
  assert.match(body, /sum\(least\(t\.answer_count, l\.old_count\)\)/);
  assert.match(body, new RegExp(`v_legacy_answered < ${LEGACY_INTAKE_TOTAL}`));
  assert.match(body, /where user_id = uid and source = 'self_situation';/);
  assert.match(body, /v_answer_count < 50 then\s+raise exception 'full profile not complete'/);
  assert.match(body, /on conflict \(user_id\) where reason = 'full_profile_complete' do nothing/);
  assert.match(body, /pg_advisory_xact_lock\(hashtext\('ato_tokens:' \|\| uid::text\)\)/);
  ok('full-profile +21: every trait at 3, OR the old 50 by per-trait caps, OR the old 50 history rows; once-ever and lock unchanged');
}

// --- 2. claim_ongoing_round_complete -----------------------------------------------
{
  const body = fnBody('claim_ongoing_round_complete');
  assert.match(body, /security definer\s+set search_path = public/);
  assert.equal(ONGOING_ROUND_SIZE, 16);
  assert.match(body, /if v_total_items < 16 then/);
  assert.doesNotMatch(body, /<> 25/);
  assert.match(body, /where pack_id = p_pack_id and answered_option is null;/);
  assert.match(body, /v_pack_owner is distinct from uid/);
  assert.match(body, /on conflict \(user_id, pack_id\) where reason = 'ongoing_round_complete' do nothing/);
  ok('round +21: 16 items (an old 25 still pays), every item answered, owner only, once per pack');
}

// --- 3. the 20 authored pool rows ------------------------------------------------------
{
  const insert = sql.match(/insert into public\.question_bank_pool[\s\S]+?on conflict \(prompt\) do nothing;/);
  assert.ok(insert, 'pool insert block');
  const rowPattern = /\(\s*'([^']*)',\s*'([^']*)',\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)'::jsonb,\s*'authored'\)/g;
  const unescape = (s: string) => s.replace(/''/g, "'");
  const rows = [...insert![0].matchAll(rowPattern)].map((m) => ({
    axis: m[1],
    category: m[2],
    prompt: unescape(m[3]),
    options: JSON.parse(unescape(m[4])),
  }));
  const drafts = wave78Drafts();
  assert.equal(rows.length, 20);
  assert.equal(rows.length, drafts.length);
  drafts.forEach((draft, i) => {
    assert.equal(rows[i].axis, draft.axis, `row ${i} axis`);
    assert.equal(rows[i].category, draft.category, `row ${i} category`);
    assert.equal(rows[i].prompt, draft.prompt, `row ${i} prompt`);
    assert.deepEqual(rows[i].options, draft.options, `row ${i} options`);
  });
  ok('20 authored rows deep-match bank.ts (10 restored + 10 original wordings), on conflict (prompt) do nothing');
}

// --- 4. additive only -----------------------------------------------------------------
{
  const code = sql.replace(/--.*$/gm, '');
  assert.doesNotMatch(code, /\bdelete from\b/i);
  assert.doesNotMatch(code, /\bdrop (table|function|policy|column)\b/i);
  assert.doesNotMatch(code, /\balter table\b/i);
  assert.doesNotMatch(code, /\btruncate\b/i);
  const updates = [...code.matchAll(/\bupdate public\.(\w+)/g)].map((m) => m[1]);
  assert.deepEqual(updates.sort(), ['me', 'me', 'question_packs'], 'only the balance write and completed_at, as in wave52');
  ok('no existing row is deleted or altered beyond the claims\' own balance write and completed_at');
}

console.log(`\n${passed} wave78 checks passed`);
