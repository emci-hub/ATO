/**
 * check:circle-safety — master plan Step 7 (roadmap step 3: Circle safety, Apple 1.2).
 * Offline: reads wave104_circle_safety.sql, the Circle sheet and the name filter. The live blocked-pair
 * test is a manual SQL routine in docs/circle-safety.md (two dev-test-style accounts, never real ones).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  SLURS_ANYWHERE,
  SAFE_WORDS,
  SLURS_WHOLE,
  STAFF_PREFIXES,
  STAFF_SUFFIXES,
  nameNotAllowed,
} from '../src/lib/name-filter';

const root = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n');
let groups = 0;
const ok = (msg: string) => {
  groups += 1;
  console.log(`  ✓ ${msg}`);
};

// wave104 + its reviewer fixes (wave104b); the newest definition of a function wins.
const sql = read('supabase/migrations/wave104_circle_safety.sql') + '\n' + read('supabase/migrations/wave104b_circle_safety_fixes.sql');
const fn = (name: string): string => {
  const start = sql.lastIndexOf(`create or replace function public.${name}(`);
  assert.ok(start >= 0, `wave104 defines ${name}`);
  const end = sql.indexOf('\n$$;', start);
  return sql.slice(start, end);
};

/* 1 · accept before connect ------------------------------------------------ */
assert.match(sql, /drop policy if exists connections_insert_own on public\.connections;/);
assert.ok(!/create policy [a-z_]+ on public\.connections\s+for insert/i.test(sql), 'no new client insert path');
assert.match(sql, /create table if not exists public\.circle_requests/);
assert.match(sql, /circle_requests_one_pending[\s\S]*where status = 'pending'/);
assert.ok(!/create policy [a-z_]+ on public\.circle_requests\s+for (insert|update|delete)/i.test(sql), 'requests: functions only');
for (const name of ['circle_request', 'circle_respond']) {
  assert.match(fn(name), /_circle_size\([a-z_]+\) >= 20/, `${name}: 20-friend cap`);
  assert.match(fn(name), /_circle_blocked\(/, `${name}: refuses a blocked pair`);
  assert.match(fn(name), /is_adult\(/, `${name}: the other person must be 18+`);
}
assert.match(fn('circle_request'), /_rate_limit_caller\('circle_request', 20, 3600\)/);
// A block must look like "no such handle" (never reveal it).
assert.match(fn('circle_request'), /v_peer is null or public\._circle_blocked\(uid, v_peer\)[^\n]*\n\s*return jsonb_build_object\('ok', false, 'reason', 'not_found'\)/);
ok('accept before connect: no client insert into connections; requests go through capped, rate-limited functions');

/* 2 · every new function is 18+ gated, signed-in only ---------------------- */
const appFns = ['circle_request', 'circle_requests', 'circle_respond', 'circle_cancel', 'circle_remove', 'circle_block', 'circle_unblock', 'circle_blocked', 'circle_report'];
for (const name of appFns) {
  assert.match(fn(name), /perform public\.require_adult\(\);/, `${name}: require_adult first`);
  assert.match(sql, new RegExp(`revoke all on function public\\.${name}\\([^)]*\\) from public, anon;`), `${name}: not anon`);
  assert.match(sql, new RegExp(`grant execute on function public\\.${name}\\([^)]*\\) to authenticated;`), `${name}: granted`);
}
for (const name of ['_circle_blocked', '_circle_size', '_name_fold', '_name_not_allowed', 'me_name_guard']) {
  assert.match(sql, new RegExp(`revoke all on function public\\.${name}\\([^)]*\\) from public, anon, authenticated;`), `${name}: internal`);
}
ok(`${appFns.length} new app functions: require_adult, signed-in only; helpers internal`);

/* 3 · a blocked pair reads nothing ---------------------------------------- */
for (const name of ['categories_share_allowed', 'category_share_status', 'set_circle_visit_share', 'get_or_create_thread', 'public_profile']) {
  assert.match(fn(name), /_circle_blocked\(/, `${name}: block check`);
}
assert.match(fn('circle_block'), /delete from public\.connections where \(user_id = uid and peer_id = p_peer\) or \(user_id = p_peer and peer_id = uid\)/);
assert.match(fn('circle_block'), /status = 'cancelled'/);
for (const name of ['peer_profile', 'peer_checks']) assert.match(fn(name), /where false;/, `${name}: closed`);
// Visits and legends already refused blocked pairs (wave97 / wave89, restated in wave101).
const w101 = read('supabase/migrations/wave101_under18_server_gate.sql');
for (const name of ['circle_visit_allowed', 'circle_visit_friends', 'legend_circle_friends']) {
  const s = w101.indexOf(`create or replace function public.${name}(`);
  assert.ok(/from public\.blocks b/.test(w101.slice(s, w101.indexOf('\n$$;', s))), `${name}: still checks blocks`);
}
ok('blocked pair: share, status, visit switch, thread, handle lookup refuse; block drops the friendship; peer reads closed');

/* 4 · reports survive deletion -------------------------------------------- */
assert.match(sql, /foreign key \("from"\) references auth\.users\(id\) on delete set null/);
assert.match(sql, /foreign key \(user_id\) references auth\.users\(id\) on delete set null/);
assert.match(sql, /alter column "from" drop not null/);
assert.match(sql, /drop constraint if exists reports_exactly_one_target/);
assert.match(sql, /add column if not exists reported_handle text/);
assert.match(fn('circle_report'), /p_reason not in \('harassment', 'hate', 'sexual', 'spam', 'impersonation', 'other'\)/);
assert.match(fn('circle_report'), /_rate_limit_caller\('circle_report', 10, 86400\)/);
const reportDeletes = [...sql.matchAll(/delete from public\.reports[^\n]*/g)].map((m) => m[0]);
assert.deepEqual(reportDeletes, ['delete from public.reports where "from" = v_dev_id or user_id = v_dev_id;'], 'only the dev-test reset clears its own reports');
assert.match(fn('count_user_rows'), /from public\.circle_requests where from_user = p_user_id or to_user = p_user_id/, 'delete-account counts requests');
assert.match(fn('reset_dev_test_user'), /delete from public\.circle_requests where from_user = v_dev_id or to_user = v_dev_id;/);
ok('reports: ids go null on account deletion, handle + fixed reason kept, rate-limited');

/* 5 · name filter: same lists on phone and server, pass/fail pairs -------- */
const sqlList = (tag: string): string[] => {
  const all = [...sql.matchAll(new RegExp(`-- name-filter:${tag}\\n\\s*[a-z]+ text\\[\\] := array\\[([^\\]]*)\\]`, 'g'))];
  assert.ok(all.length > 0, `SQL list ${tag}`);
  return all[all.length - 1]![1]!.split(',').map((s) => s.trim().replace(/^'|'$/g, ''));
};
assert.deepEqual(sqlList('SLURS_ANYWHERE'), [...SLURS_ANYWHERE]);
assert.deepEqual(sqlList('SLURS_WHOLE'), [...SLURS_WHOLE]);
assert.deepEqual(sqlList('SAFE_WORDS'), [...SAFE_WORDS]);
assert.deepEqual(sqlList('STAFF_PREFIXES'), [...STAFF_PREFIXES]);
assert.deepEqual(sqlList('STAFF_SUFFIXES'), [...STAFF_SUFFIXES]);
assert.match(sql, /before insert or update of name, handle on public\.me/);
// The trigger reads the internal filter as its owner (wave104b), so a refusal is name_not_allowed, not "permission denied".
assert.match(fn('me_name_guard'), /language plpgsql\s+security definer/);
// Accepting closes the other direction (wave104b).
for (const name of ['circle_request', 'circle_respond']) assert.match(fn(name), /status = 'cancelled'[^;]*\n\s*where from_user = uid and to_user = v_[a-z]+ and status = 'pending';/);

const refuse: [string, 'name' | 'handle'][] = [
  ['n1gger', 'handle'], ['Big Faggot', 'name'], ['spic', 'handle'], ['Kike Jones', 'name'], ['hitler88', 'handle'],
  ['atoteam', 'handle'], ['supportdesk', 'handle'], ['atoofficial', 'handle'], ['realadmin', 'handle'], ['ATO Team', 'name'],
  ['sniggernigger', 'handle'],
];
const allow: [string, 'name' | 'handle'][] = [
  ['spicyfood', 'handle'], ['Pakistan Pete', 'name'], ['raccoonlover', 'handle'], ['badminton', 'handle'], ['atom', 'handle'],
  ['Shitty Steve', 'name'], ['fuckboi', 'handle'], ['Dyke Street', 'name'], ['Tomato', 'name'], ['admiral', 'handle'], ['Coonan', 'name'],
  // wave104b (reviewer): real names and ordinary words
  ['Ato', 'name'], ['Ato Mensah', 'name'], ['Jo Coon', 'name'], ['snigger', 'handle'], ['lifesupport', 'handle'],
];
for (const [s, k] of refuse) assert.equal(nameNotAllowed(s, k), true, `refuses ${k} "${s}"`);
for (const [s, k] of allow) assert.equal(nameNotAllowed(s, k), false, `allows ${k} "${s}"`);
ok(`name filter: phone and server lists match; ${refuse.length} refused / ${allow.length} allowed pairs (swearing allowed)`);

/* 6 · the Circle sheet: 2 taps, silent block, support contact ------------- */
const ui = read('src/play/circle-visits-ui.tsx');
const copy = read('src/play/circle-visits.ts');
assert.match(copy, /more: \(handle: string\) => `More options for @\$\{handle\}`/, 'the ⋯ button has a spoken label');
assert.match(ui, /accessibilityLabel=\{CIRCLE_UI\.more\(handle\)\}/, 'friend row has the labelled ⋯ button');
for (const f of ['blockCirclePeer', 'reportCirclePeer', 'sendCircleRequest', 'respondCircleRequest', 'fetchCircleBlocked', 'unblockCirclePeer']) {
  assert.match(ui, new RegExp(`\\b${f}\\(`), `sheet calls ${f}`);
}
assert.match(copy, /export const CIRCLE_SUPPORT_EMAIL = '([^']+)'/);
const supportEmail = copy.match(/export const CIRCLE_SUPPORT_EMAIL = '([^']+)'/)![1];
assert.match(read('src/app/(tabs)/you.tsx'), new RegExp(`'${supportEmail!.replace('.', '\\.')}'`), 'same address as You → Send feedback');
assert.ok(!/from\('connections'\)\s*\.insert/.test(read('src/lib/circle.ts')), 'circle.ts never inserts a connection');
ok('sheet: ⋯ on every friend row → Report / Block (2 taps); support email matches You');

console.log(`\ncheck:circle-safety ok — ${groups} groups`);
