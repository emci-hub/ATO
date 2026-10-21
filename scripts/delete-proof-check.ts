/**
 * Delete-account proof coverage (master plan Step 10, roadmap S8; 2026-10-20).
 * Run: npm run check:delete-proof
 *
 * Offline. The live check (check:delete-account) proves a real delete reports 0 rows left, but only for the
 * tables count_user_rows looks at. This check makes that list complete:
 * - every per-account table in the migrations (references auth.users or me) is counted by the NEWEST
 *   count_user_rows, or is on NOT_COUNTED with a reason, so a new table cannot be forgotten;
 * - nothing that points at an account can block the delete (no FK to auth.users / me without ON DELETE,
 *   except the ones fixed later, checked against the newest definition);
 * - count_user_rows stays service_role only.
 * Pass/fail pairs at the bottom prove the coverage test catches a missing table.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}
const root = resolve(__dirname, '..');
const dir = resolve(root, 'supabase/migrations');
const strip = (s: string) => s.replace(/\r\n/g, '\n').replace(/--[^\n]*/g, '');
const read = (f: string) => strip(readFileSync(resolve(dir, f), 'utf8'));

const waveNo = (f: string) => {
  const m = /^wave(\d+)([a-z]?)_/.exec(f);
  return m ? Number(m[1]) + (m[2] ? (m[2].charCodeAt(0) - 96) / 100 : 0) : -1;
};
const files = readdirSync(dir).filter((f) => f.endsWith('.sql'));

// --- the newest count_user_rows -----------------------------------------------------------------
const countFiles = files
  .filter((f) => waveNo(f) >= 0 && read(f).includes('create or replace function public.count_user_rows('))
  .sort((a, b) => waveNo(a) - waveNo(b));
const newestCountFile = countFiles[countFiles.length - 1]!;
const newestSql = read(newestCountFile);
const countBody = newestSql.slice(
  newestSql.indexOf('create or replace function public.count_user_rows('),
  newestSql.indexOf('$$;', newestSql.indexOf('create or replace function public.count_user_rows(')),
);
assert.equal(newestCountFile, 'wave108_circle_chat.sql', 'wave108 holds the newest count_user_rows');
assert.match(newestSql, /revoke execute on function public\.count_user_rows\(uuid\) from public, anon, authenticated;/);
assert.match(newestSql, /grant execute on function public\.count_user_rows\(uuid\) to service_role;/);
ok(`newest count_user_rows is ${newestCountFile}; service_role only`);

// --- per-account tables (same scanner as check:reset-account) -----------------------------------
const ACCOUNT_REF = /references\s+(?:auth\.users|(?:public\.)?me\s*\()/i;
const perAccount = new Set<string>();
const dropped = new Set<string>();
for (const f of files) {
  const sql = read(f);
  for (const m of sql.matchAll(/create table (?:if not exists )?(?:public\.)?([a-z_0-9]+)\s*\(([\s\S]*?)\n\s*\);/gi)) {
    if (ACCOUNT_REF.test(m[2]!)) perAccount.add(m[1]!);
  }
  for (const m of sql.matchAll(/alter table (?:only )?(?:if exists )?(?:public\.)?([a-z_0-9]+)\s+add column[^;]*?references\s+(?:auth\.users|(?:public\.)?me\s*\()/gi)) {
    perAccount.add(m[1]!);
  }
  for (const m of sql.matchAll(/drop table (?:if exists )?(?:public\.)?([a-z_0-9]+)/gi)) dropped.add(m[1]!);
}
// Baseline tables written before the migrations used `create table … references auth.users`.
for (const t of ['checks', 'connections']) perAccount.add(t);
for (const t of dropped) perAccount.delete(t);

/** Point at an account but are deliberately not counted, each with its reason. */
const NOT_COUNTED: Record<string, string> = {
  account_deletions: 'the deletion record itself (no FK; written after the count)',
  play_dev_logs: 'Divecore dev logs, pre-launch tooling only',
  access_requests: 'landing-page join requests, keyed by email, not by an account',
};

export function uncounted(tables: Iterable<string>, body: string, skip: Record<string, string> = NOT_COUNTED): string[] {
  return [...tables].filter((t) => !(t in skip) && !new RegExp(`from public\\.${t} where`).test(body)).sort();
}

const missing = uncounted(perAccount, countBody);
assert.deepEqual(missing, [], `per-account tables not counted by count_user_rows: ${missing.join(', ')}`);
for (const t of Object.keys(NOT_COUNTED)) {
  assert.ok(!new RegExp(`from public\\.${t} where`).test(countBody), `${t} is on NOT_COUNTED but is counted`);
}
ok(`every per-account table (${perAccount.size}) is counted or not counted on purpose`);

// The four the old proof missed, and the shared-content author links (SET NULL: must read 0 after a delete).
for (const line of [
  /from public\.circle_compare_share where user_id = p_user_id or peer_id = p_user_id/,
  /from public\.ai_library_seen where user_id = p_user_id/,
  /from public\.ai_library_reports where user_id = p_user_id/,
  /from public\.ai_library_wanted where user_id = p_user_id/,
  /from public\.ai_library_cards where created_by = p_user_id/,
  /from public\.daily_line_pool where created_by = p_user_id/,
  /from public\.question_bank_pool where created_by = p_user_id/,
  /from public\.me where referred_by = p_user_id/,
  /from public\.dev_access_grants where user_id = p_user_id or granted_by = p_user_id/,
  /from auth\.users where id = p_user_id/,
]) assert.match(countBody, line);
ok('the four missed tables, shared-content authors, referrals and dev grants are counted');

// wave106 = wave104's body + new lines only (nothing dropped from the old proof).
{
  const w104 = read('wave104_circle_safety.sql');
  const s = w104.indexOf('create or replace function public.count_user_rows(');
  const old = w104.slice(s, w104.indexOf('$$;', s));
  const terms = (b: string) => [...b.matchAll(/from (?:public|auth)\.([a-z_0-9]+) where/g)].map((m) => m[1]!);
  const lost = terms(old).filter((t) => !terms(countBody).includes(t));
  assert.deepEqual(lost, [], `wave106 dropped tables from the proof: ${lost.join(', ')}`);
  ok('wave106 keeps every table wave104 counted');
}

// wave108 = wave106's body + the three chat tables (nothing dropped).
{
  const w106 = read('wave106_delete_proof.sql');
  const s = w106.indexOf('create or replace function public.count_user_rows(');
  const old = w106.slice(s, w106.indexOf('$$;', s));
  const terms = (b: string) => [...b.matchAll(/from (?:public|auth)\.([a-z_0-9]+) where/g)].map((m) => m[1]!);
  const lost = terms(old).filter((t) => !terms(countBody).includes(t));
  assert.deepEqual(lost, [], `wave108 dropped tables from the proof: ${lost.join(', ')}`);
  for (const t of ['chat_keys', 'chat_restrictions']) assert.match(countBody, new RegExp(`from public\\.${t} where user_id = p_user_id`));
  assert.match(countBody, /from public\.chat_messages where sender_id = p_user_id or recipient_id = p_user_id/);
  ok('wave108 keeps every table wave106 counted and adds the chat tables');
}

// --- nothing blocks the delete ------------------------------------------------------------------
// A column that references an account with no ON DELETE defaults to NO ACTION: deleting that account
// fails. Only dev_access_grants.granted_by had that; wave106 makes it SET NULL.
{
  const blocking: string[] = [];
  for (const f of files) {
    const sql = read(f);
    for (const m of sql.matchAll(/create table (?:if not exists )?(?:public\.)?([a-z_0-9]+)\s*\(([\s\S]*?)\n\s*\);/gi)) {
      if (dropped.has(m[1]!)) continue;
      for (const col of m[2]!.split('\n')) {
        if (ACCOUNT_REF.test(col) && !/on delete/i.test(col)) blocking.push(`${m[1]}.${col.trim().split(/\s+/)[0]}`);
      }
    }
    // Columns / constraints added later: alter table … add column x … references … or
    // add constraint … foreign key (x) references … — each statement up to its semicolon.
    for (const m of sql.matchAll(/alter table (?:only )?(?:if exists )?(?:public\.)?([a-z_0-9]+)\s+(add (?:column|constraint)[^;]*?references\s+(?:auth\.users|(?:public\.)?me\s*\()[^;]*);/gi)) {
      if (dropped.has(m[1]!) || /on delete/i.test(m[2]!)) continue;
      const col = /foreign key\s*\(\s*([a-z_0-9]+)/i.exec(m[2]!)?.[1] ?? /add column (?:if not exists )?([a-z_0-9]+)/i.exec(m[2]!)?.[1] ?? '?';
      blocking.push(`${m[1]}.${col}`);
    }
  }
  const FIXED_LATER: Record<string, RegExp> = {
    'dev_access_grants.granted_by': /add constraint dev_access_grants_granted_by_fkey\s+foreign key \(granted_by\) references public\.me\(id\) on delete set null;/,
  };
  const unfixed = blocking.filter((c) => !(c in FIXED_LATER && FIXED_LATER[c]!.test(read('wave106_delete_proof.sql'))));
  assert.deepEqual(unfixed, [], `account references with no ON DELETE (would block a delete): ${unfixed.join(', ')}`);
  assert.match(read('wave106_delete_proof.sql'), /alter column granted_by drop not null;/, 'granted_by can be cleared');
  ok('no account reference blocks a delete (dev_access_grants.granted_by → SET NULL in wave106)');
}

// --- pass/fail pairs for the coverage test --------------------------------------------------------
assert.deepEqual(uncounted(['a_tbl'], 'from public.a_tbl where user_id = p_user_id', {}), [], 'pass: a counted table');
assert.deepEqual(uncounted(['a_tbl', 'b_tbl'], 'from public.a_tbl where user_id = p_user_id', {}), ['b_tbl'], 'fail: a missing table is reported');
assert.deepEqual(uncounted(['b_tbl'], '', { b_tbl: 'reason' }), [], 'pass: a skipped table with a reason');
assert.deepEqual(uncounted(['a_tbl_x'], 'from public.a_tbl where', {}), ['a_tbl_x'], 'fail: a prefix match does not count');
ok('coverage test: pass/fail pairs');

console.log(`\n${passed} delete-proof checks passed`);
