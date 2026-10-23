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
import { DIGEST_TO, digestText } from '../supabase/functions/report-digest/digest';

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
// The tools live in the Circle tab (emci 2026-10-21); the Divecore sheet keeps visits and gifts only.
const ui = read('src/app/(tabs)/circle.tsx') + read('src/components/circle-panels.tsx');
const copy = read('src/play/circle-visits.ts');
assert.match(copy, /more: \(handle: string\) => `More options for @\$\{handle\}`/, 'the ⋯ button has a spoken label');
assert.match(ui, /accessibilityLabel=\{CIRCLE_UI\.more\(handle\)\}/, 'friend row has the labelled ⋯ button');
for (const f of ['blockCirclePeer', 'reportCirclePeer', 'sendCircleRequest', 'respondCircleRequest', 'fetchCircleBlocked', 'unblockCirclePeer']) {
  assert.match(ui, new RegExp(`\\b${f}\\(`), `Circle tab calls ${f}`);
  assert.doesNotMatch(read('src/play/circle-visits-ui.tsx'), new RegExp(`\\b${f}\\(`), `Divecore sheet no longer calls ${f}`);
}
assert.match(ui, /twoTap\.confirm\(`block:/, 'Block takes two taps');
assert.match(ui, /twoTap\.confirm\(`remove:/, 'Remove takes two taps');
assert.match(ui, /CIRCLE_REPORT_REASON_IDS\.map/, 'Report lists the six fixed reasons');
assert.match(copy, /export const CIRCLE_SUPPORT_EMAIL = '([^']+)'/);
const supportEmail = copy.match(/export const CIRCLE_SUPPORT_EMAIL = '([^']+)'/)![1];
assert.match(read('src/app/(tabs)/you.tsx'), new RegExp(`'${supportEmail!.replace('.', '\\.')}'`), 'same address as You → Send feedback');
assert.ok(!/from\('connections'\)\s*\.insert/.test(read('src/lib/circle.ts')), 'circle.ts never inserts a connection');
ok('Circle tab: ⋯ on every friend row → Report / Block (2 taps); support email matches You');

// wave110 (roadmap v2 S3, applied by emci 2026-10-22): the public card's show_up / talk_style
// accept only the app's chips on a change; NULL / '' pass; stored older values are left alone.
{
  const w110 = read('supabase/migrations/wave110_public_card_fields_guard.sql');
  const intake = read('src/lib/intake.ts');
  const chips = (name: string) => {
    const block = intake.slice(intake.indexOf(`export const ${name}`), intake.indexOf('];', intake.indexOf(`export const ${name}`)));
    return [...block.matchAll(/value: '([^']+)'/g)].map((m) => m[1]!);
  };
  const sqlIn = (col: string) => {
    const m = w110.match(new RegExp(`new\\.${col} not in \\(([^)]*)\\)`));
    assert.ok(m, `${col} list in wave110`);
    return [...m[1]!.matchAll(/'([^']+)'/g)].map((x) => x[1]!);
  };
  assert.deepEqual(sqlIn('show_up'), chips('SHOW_UP_CHIPS'), 'show_up: SQL list = app chips');
  assert.deepEqual(sqlIn('talk_style'), chips('TALK_STYLE_CHIPS'), 'talk_style: SQL list = app chips');
  assert.match(w110, /coalesce\(auth\.jwt\(\) ->> 'role', ''\) <> 'authenticated'/, 'only people using the app are checked (same as me_name_guard)');
  assert.match(w110, /tg_op = 'INSERT' or new\.show_up is distinct from old\.show_up/, 'only a CHANGED value is checked (old stored chips stay)');
  assert.match(w110, /nullif\(btrim\(coalesce\(new\.show_up, ''\)\), ''\) is not null/, "NULL and '' pass");
  assert.match(w110, /before insert or update of show_up, talk_style on public\.me/);
  assert.match(w110, /revoke all on function public\.me_card_fields_guard\(\) from public, anon, authenticated;/);
  // Pairs (the same rule in TS): app chips pass, free text fails, blank passes.
  const allowed = (v: string | null, list: string[]) => v == null || v.trim() === '' || list.includes(v);
  assert.ok(allowed('stay steady', chips('SHOW_UP_CHIPS')), 'pass: a chip');
  assert.ok(allowed('', chips('SHOW_UP_CHIPS')) && allowed(null, chips('SHOW_UP_CHIPS')), 'pass: blank');
  assert.ok(!allowed('visit my site example.com', chips('SHOW_UP_CHIPS')), 'fail: free text');
  assert.ok(!allowed('shout', chips('TALK_STYLE_CHIPS')), 'fail: not a talk-style chip');
  ok('wave110: public-card fields take only the app chips on change; lists match intake.ts');
}

// wave113 + report-digest (roadmap v2 S1 / D24, emci OK 2026-10-22): a daily email of new report counts + ids.
// Copies wave94's timed-job path (Vault token, service-role check, pg_cron → net.http_post). Never the reason,
// message text, handle or reporter in the email; nothing is sent on a day with no new report.
{
  const w113 = read('supabase/migrations/wave113_report_digest.sql');
  const code = (s: string) => s.replace(/--[^\n]*/g, '');
  const body = (name: string) => {
    const s = code(w113);
    const start = s.indexOf(`create or replace function public.${name}(`);
    assert.ok(start >= 0, `${name} in wave113`);
    return s.slice(start, s.indexOf('$$;', start));
  };
  for (const sig of ['report_digest_token_ok(text)', 'report_digest(integer)']) {
    assert.ok(w113.includes(`revoke all on function public.${sig} from public, anon, authenticated;`), `${sig}: no phone`);
    assert.ok(w113.includes(`grant execute on function public.${sig} to service_role;`), `${sig}: service role only`);
  }
  assert.match(body('report_digest_token_ok'), /vault\.decrypted_secrets\s+where name = 'report_digest_token'/, 'the token lives in Vault');
  assert.match(body('report_digest_token_ok'), /length\(p_token\) >= 32/);
  assert.match(code(w113), /cron\.schedule\(\s*'report-digest-daily',\s*'5 15 \* \* \*'/, 'once a day');
  assert.match(code(w113), /functions\/v1\/report-digest/);
  assert.doesNotMatch(code(w113), /\b(delete|update|insert|truncate|drop|alter)\b/i, 'additive: no row or schema change');
  // Pairs: the digest's output fields carry ids and kind only.
  const leaksDetail = (fnBody: string) => /'(reason|context|reported_handle|from|admin_note|user_id|message_id)',/.test(fnBody);
  assert.equal(leaksDetail(body('report_digest')), false, 'pass: wave113 outputs ids + kind only');
  assert.equal(leaksDetail(`'id', r.id, 'reason', r.reason,`), true, 'fail case: a reason field would be caught');
  const fnSrc = read('supabase/functions/report-digest/index.ts');
  assert.ok(fnSrc.indexOf("rpc('report_digest_token_ok'") < fnSrc.indexOf("rpc('report_digest',"), 'the token is checked first');
  assert.match(fnSrc, /if \(!mail\) return json\(\{ ok: true, sent: false/, 'no email when nothing is new');
  assert.doesNotMatch(fnSrc, /console\.log\([^)]*(text|mail|data)\b/, 'logs counts only');
  assert.match(fnSrc, /Deno\.env\.get\('RESEND_API_KEY'\)/, 'same Resend key as review-access');
  assert.equal(DIGEST_TO, supportEmail, 'the alert goes to the published support inbox');
  const none = digestText({ hours: 24, reports: [], card_reports: [], open_total: 2 });
  assert.equal(none, null, 'pass: no new report → no email');
  const some = digestText({
    hours: 24,
    reports: [{ id: '11111111-1111-1111-1111-111111111111', kind: 'message' }, { id: '22222222-2222-2222-2222-222222222222', kind: 'person' }],
    card_reports: [{ card_id: '33333333-3333-3333-3333-333333333333' }],
    open_total: 2,
  });
  assert.ok(some, 'fail case: new reports → an email');
  assert.equal(some!.subject, 'ATO: 3 new reports');
  assert.match(some!.text, /chat message report 11111111/);
  assert.match(some!.text, /shared card report, card 33333333/);
  ok('wave113: daily report email = counts + ids only, Vault token, service role, no email on a quiet day');
}

console.log(`\ncheck:circle-safety ok — ${groups} groups`);
