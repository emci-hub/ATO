/**
 * "Reset account" (Dev Tools Hub, Danger zone; emci 2026-10-07).
 * Run: npm run check:reset-account
 *
 * The load-bearing assertions:
 * - every per-account table in the migrations is either wiped by
 *   reset_my_account or on an explicit KEEP list with a reason, so a new
 *   table cannot be forgotten (red team: "reset leaves orphaned rows");
 * - the server function is root only, own-account only, invite-only only, and
 *   not runnable by anon (red team: "non-root reaching the RPC");
 * - the balances are zeroed through the token guards' own flags;
 * - the button needs RESET typed, sits in the Danger zone, and refuses during
 *   "Preview as new user";
 * - the dev sign-up reset and the delete-account row count cover the six
 *   tables added since wave71.
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
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8').replace(/\r\n/g, '\n');
}

// The NEWEST migration that restates reset_my_account (wave88 first; wave89
// restated it with legend_museum). Picked by wave number, not file-name order.
const resetFiles = readdirSync(resolve(root, 'supabase/migrations'))
  .filter((f) => /^wave\d+[a-z]?_.*\.sql$/.test(f))
  .filter((f) => read(`supabase/migrations/${f}`).includes('create or replace function public.reset_my_account()'))
  .sort((a, b) => Number(/^wave(\d+)/.exec(a)![1]) - Number(/^wave(\d+)/.exec(b)![1]));
assert.ok(resetFiles.length > 0, 'reset_my_account is defined in a wave migration');
const wave88 = read(`supabase/migrations/${resetFiles[resetFiles.length - 1]}`);
const fnStart = wave88.indexOf('create or replace function public.reset_my_account()');
const fnEnd = wave88.indexOf('$$;', fnStart);
const resetFn = wave88.slice(fnStart, fnEnd);
assert.ok(fnStart >= 0 && fnEnd > fnStart, 'reset_my_account is defined in wave88');

// --- coverage --------------------------------------------------------------------
const dir = resolve(root, 'supabase/migrations');
const perAccount = new Set<string>();
const dropped = new Set<string>();
for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql'))) {
  const sql = readFileSync(resolve(dir, file), 'utf8').replace(/\r\n/g, '\n').replace(/--[^\n]*/g, '');
  // A table is per-account if it points at the account: auth.users or me,
  // in its create statement or added later with alter table.
  const ACCOUNT_REF = /references\s+(?:auth\.users|(?:public\.)?me\s*\()/i;
  for (const m of sql.matchAll(/create table (?:if not exists )?(?:public\.)?([a-z_0-9]+)\s*\(([\s\S]*?)\n\s*\);/gi)) {
    if (ACCOUNT_REF.test(m[2]!)) perAccount.add(m[1]!);
  }
  for (const m of sql.matchAll(/alter table (?:only )?(?:if exists )?(?:public\.)?([a-z_0-9]+)\s+add column[^;]*?references\s+(?:auth\.users|(?:public\.)?me\s*\()/gi)) {
    perAccount.add(m[1]!);
  }
  for (const m of sql.matchAll(/drop table (?:if exists )?(?:public\.)?([a-z_0-9]+)/gi)) dropped.add(m[1]!);
}
// Baseline tables written before the migrations used `create table … references auth.users`.
for (const t of ['checks', 'crisis_flags', 'connections']) perAccount.add(t);
for (const t of dropped) perAccount.delete(t);

/** Kept on purpose, each with its reason. Anything else must be wiped. */
const KEEP: Record<string, string> = {
  ai_usage: 'AI quota log: a reset must never refill quota',
  ai_provider_log: 'AI audit log, same reason',
  apple_credentials: 'sign-in link, part of the account',
  connections: 'Circle: other people are in these rows',
  circle_requests: 'Circle friend requests (wave104): other people are in these rows; deleted with the account',
  messages: 'Circle',
  threads: 'Circle',
  chat_keys: 'Circle chat (wave108): the phone’s public key; a reset keeps the Circle, so chat keeps working; deleted with the account',
  chat_messages: 'Circle chat (wave108): encrypted, another person is in every row; 30-day retention; deleted with the account',
  chat_restrictions: 'safety: a reset must never lift a chat warning, chat-off or ban',
  blocks: 'safety: other people are in these rows',
  mutes: 'safety',
  reports: 'safety',
  category_share: 'Circle sharing with other accounts',
  circle_compare_share: 'Circle compare switch (wave105): like category_share it is a choice about a friend, who stays in the Circle; the strengths it shows come from trait_tracks, which Reset wipes; cascades with the account',
  going: 'Around plans with other accounts',
  question_bank_pool: 'shared content served to everyone (created_by is only the author)',
  ai_library_cards: 'shared AI library cards served to everyone (created_by is only the writer)',
  ai_library_seen: 'which shared cards were shown: kept so a reset never re-serves the same free cards',
  ai_library_reports: 'safety: reports about shared cards',
  ai_library_wanted: 'look-ahead group keys (no text); the phone re-sends them on the next open, deleted with the account',
  dev_access_grants: 'root-managed tester grants, not game data',
  dev_trace_sessions: 'debug traces, expire on their own',
  dev_trace_events: 'debug traces, expire on their own',
  play_saves: 'the Divecore save: a reset keeps the game (the phone keeps ato.play.* too); deleted with the account',
  invite_codes: 'the account’s invites (other people may hold them)',
  access_requests: 'join requests, not game data',
  me: 'the account itself (its game columns are reset in place)',
};
const deletes = new Set([...resetFn.matchAll(/delete from public\.([a-z_0-9]+) where (?:user_id|created_by) = uid/g)].map((m) => m[1]!));
const missing = [...perAccount].filter((t) => !deletes.has(t) && !(t in KEEP)).sort();
assert.deepEqual(missing, [], `per-account tables neither wiped nor kept on purpose: ${missing.join(', ')}`);
for (const t of Object.keys(KEEP)) assert.ok(!deletes.has(t), `${t} is on the KEEP list and must not be wiped`);
assert.ok(/delete from public\.daily_line_pool where created_by = uid and source = 'ai';/.test(resetFn), 'only this account’s own AI lines, never the shared written ones');
ok(`every per-account table (${perAccount.size}) is wiped or kept on purpose; shared lines and questions are untouched`);

// --- server rules ---------------------------------------------------------------------
assert.match(resetFn, /uid := public\.require_root\(\);/, 'root is checked on the server, from me.is_root');
assert.match(resetFn, /signup_mode into v_mode from public\.app_config where id = 1;\s*if v_mode is distinct from 'invite_only' then\s*raise exception/);
assert.match(resetFn, /security definer\s*set search_path = public/);
assert.doesNotMatch(resetFn.slice(0, resetFn.indexOf(')')), /p_[a-z]/, 'no parameters: it can only act on auth.uid()');
assert.doesNotMatch(resetFn, /auth\.users|delete from public\.me\b/, 'never deletes the account itself');
assert.match(wave88, /revoke all on function public\.reset_my_account\(\) from public, anon;/);
assert.match(wave88, /grant execute on function public\.reset_my_account\(\) to authenticated;/);
ok('reset_my_account: require_root, invite-only only, no parameters, keeps the account, revoked from public/anon');

assert.match(resetFn, /set_config\('ato\.allow_ato_token_write', '1', true\)/);
assert.match(resetFn, /set_config\('ato\.allow_token_write', '1', true\)/);
assert.match(resetFn, /ato_tokens = 0,\s*tokens = 0,/);
assert.match(resetFn, /celebrated_milestone_ids = '\{\}',\s*milestones_celebrated = '\{\}'::jsonb,/, 'both milestone columns');
assert.match(resetFn, /set_config\('ato\.allow_ato_token_write', '0', true\)/, 'the token flag is switched back off');
assert.doesNotMatch(resetFn, /ai_consent|is_root|handle/, 'consent, root and handle are never touched');
ok('balances zeroed through the token guards’ own flags; both milestone columns cleared; consent, root, handle kept');

// --- the six tables wave71 missed -------------------------------------------------------
const six = ['trait_answers', 'trait_flags', 'trait_profile_snapshots', 'trait_answer_changes', 'daily_pick_answers', 'daily_line_days'];
const devReset = wave88.slice(wave88.indexOf('create or replace function public.reset_dev_test_user()'), wave88.indexOf('create or replace function public.count_user_rows'));
const countRows = wave88.slice(wave88.indexOf('create or replace function public.count_user_rows'));
for (const t of six) {
  assert.match(devReset, new RegExp(`delete from public\\.${t} where user_id = v_dev_id;`), `reset_dev_test_user clears ${t}`);
  assert.match(countRows, new RegExp(`from public\\.${t} where user_id = p_user_id`), `count_user_rows counts ${t}`);
}
assert.match(devReset, /if auth\.uid\(\) is distinct from v_dev_id then/, 'the dev reset is still the dev-test account only');
assert.match(countRows, /grant execute on function public\.count_user_rows\(uuid\) to service_role;/);
ok('the dev sign-up reset and the delete-account count cover the six newer tables');

// --- wave96: the Divecore cloud save (kept on reset, counted and cleared everywhere else) -------
{
  const w96 = read('supabase/migrations/wave96_play_saves.sql');
  const dev96 = w96.slice(w96.indexOf('create or replace function public.reset_dev_test_user()'), w96.indexOf('create or replace function public.count_user_rows'));
  const count96 = w96.slice(w96.indexOf('create or replace function public.count_user_rows'));
  assert.match(dev96, /delete from public\.play_saves where user_id = v_dev_id;/, 'the dev sign-up reset clears play_saves');
  assert.match(count96, /from public\.play_saves where user_id = p_user_id/, 'delete-account counts play_saves');
  for (const t of six) assert.match(count96, new RegExp(`from public\.${t} where user_id = p_user_id`), `wave96 count_user_rows still counts ${t}`);
  assert.match(count96, /grant execute on function public\.count_user_rows\(uuid\) to service_role;/);
  assert.doesNotMatch(w96, /create or replace function public\.reset_my_account/, 'reset_my_account is not restated: a reset keeps the Divecore save');
  ok('wave96: play_saves is cleared by the dev reset, counted for delete-account, kept by Reset account');
}

// --- wave97: Divecore Circle visits (wiped by Reset both ways, counted and cleared everywhere else) ---
{
  const w97 = read('supabase/migrations/wave97_circle_visits.sql');
  const reset97 = w97.slice(w97.indexOf('create or replace function public.reset_my_account()'), w97.indexOf('create or replace function public.reset_dev_test_user()'));
  const dev97 = w97.slice(w97.indexOf('create or replace function public.reset_dev_test_user()'), w97.indexOf('create or replace function public.count_user_rows'));
  const count97 = w97.slice(w97.indexOf('create or replace function public.count_user_rows'));
  assert.deepEqual(resetFiles.slice(-3), ['wave97_circle_visits.sql', 'wave103_drop_crisis_plumbing.sql', 'wave116_quest_runs.sql'], 'wave97 holds the reset_my_account that wave103 restates; wave116 (PHASE-17, not applied) is the newest');
  const reset97Full = reset97.slice(0, reset97.indexOf('$$;'));
  for (const t of ['circle_gifts', 'circle_visit_share']) {
    assert.match(reset97, new RegExp(`delete from public\\.${t} where user_id = uid or peer_id = uid;`), `Reset account wipes ${t} both ways (everything shared)`);
    assert.match(dev97, new RegExp(`delete from public\\.${t} where user_id = v_dev_id or peer_id = v_dev_id;`), `the dev sign-up reset clears ${t}`);
    assert.match(count97, new RegExp(`from public\\.${t} where user_id = p_user_id or peer_id = p_user_id`), `delete-account counts ${t}`);
    assert.match(w97, new RegExp(`create table public\\.${t} \\([\\s\\S]*?user_id uuid not null references auth\\.users \\(id\\) on delete cascade,\\s*peer_id uuid not null references auth\\.users \\(id\\) on delete cascade`), `${t}: both sides cascade with the account`);
    assert.ok(!(t in KEEP), `${t} is never on the KEEP list`);
  }
  assert.match(dev97, /delete from public\.play_saves where user_id = v_dev_id;/, 'wave97 dev reset still clears play_saves');
  assert.match(count97, /from public\.play_saves where user_id = p_user_id/, 'wave97 count still counts play_saves');
  assert.doesNotMatch(reset97, /delete from public\.play_saves/, 'Reset account still keeps the Divecore save');
  for (const t of six) assert.match(count97, new RegExp(`from public\\.${t} where user_id = p_user_id`), `wave97 count_user_rows still counts ${t}`);
  // The wave90 body is carried over line for line (only the two Circle lines are new).
  const reset90 = read('supabase/migrations/wave90_category_deep_dive.sql');
  const body90 = reset90.slice(reset90.indexOf('create or replace function public.reset_my_account()'), reset90.indexOf('$$;', reset90.indexOf('create or replace function public.reset_my_account()')));
  const strip = (s: string) => s.split('\n').filter((l) => !/circle_|Divecore Circle visits|friends' switches/.test(l)).join('\n');
  assert.equal(strip(reset97Full), body90, 'reset_my_account = wave90 + the two Circle deletes, nothing else changed');
  // wave103 (not applied) = wave97 minus the one crisis_flags delete, nothing else.
  const w103 = read('supabase/migrations/wave103_drop_crisis_plumbing.sql');
  const at103 = w103.indexOf('create or replace function public.reset_my_account()');
  const reset103 = w103.slice(at103, w103.indexOf('$$;', at103));
  assert.match(reset97Full, /delete from public\.crisis_flags where user_id = uid;/, 'wave97 still deletes crisis_flags (the table is live until wave103)');
  assert.doesNotMatch(reset103, /crisis_flags/, 'wave103 reset_my_account no longer touches the dropped table');
  assert.doesNotMatch(resetFn, /crisis_flags/, 'the newest reset_my_account does not either');
  const noCrisisLine = (s: string) => s.split('\n').filter((l) => !/crisis_flags/.test(l)).join('\n');
  assert.equal(reset103, noCrisisLine(reset97Full), 'wave103 reset_my_account = wave97 minus the crisis_flags line');
  ok('wave97: circle_gifts + circle_visit_share wiped by Reset (both ways), cleared by the dev reset, counted for delete-account');
}

// --- wave116: Quests runs (PHASE-17, R12): wiped by Reset, cleared by the dev reset, counted for delete-account ---
{
  const w116 = read('supabase/migrations/wave116_quest_runs.sql');
  const fnBody = (src: string, head: string) => {
    const s = src.indexOf(head);
    assert.ok(s >= 0, `${head} found`);
    return src.slice(s, src.indexOf('$$;', s));
  };
  const noQuestLine = (s: string) => s.split('\n').filter((l) => !/quest_runs/.test(l)).join('\n');
  const w103 = read('supabase/migrations/wave103_drop_crisis_plumbing.sql');
  const w104 = read('supabase/migrations/wave104_circle_safety.sql');
  const w108 = read('supabase/migrations/wave108_circle_chat.sql');
  const reset116 = fnBody(w116, 'create or replace function public.reset_my_account()');
  const dev116 = fnBody(w116, 'create or replace function public.reset_dev_test_user()');
  const count116 = fnBody(w116, 'create or replace function public.count_user_rows(');
  assert.match(reset116, /delete from public\.quest_runs where user_id = uid; get diagnostics n = row_count; v_rows := v_rows \+ n;/, 'Reset account wipes quest_runs');
  assert.match(dev116, /delete from public\.quest_runs where user_id = v_dev_id;/, 'the dev sign-up reset clears quest_runs');
  assert.match(count116, /from public\.quest_runs where user_id = p_user_id/, 'delete-account counts quest_runs');
  assert.ok(!('quest_runs' in KEEP), 'quest_runs is never on the KEEP list');
  assert.match(w116, /create table public\.quest_runs \([\s\S]*?user_id uuid not null references auth\.users \(id\) on delete cascade,/, 'quest_runs cascades with the account');
  // Each body = its source + the one quest_runs line, nothing else changed.
  assert.equal(noQuestLine(reset116), fnBody(w103, 'create or replace function public.reset_my_account()'), 'reset_my_account = wave103 + quest_runs');
  assert.equal(noQuestLine(dev116), fnBody(w104, 'create or replace function public.reset_dev_test_user()'), 'reset_dev_test_user = wave104 + quest_runs');
  assert.equal(noQuestLine(count116), fnBody(w108, 'create or replace function public.count_user_rows('), 'count_user_rows = wave108 + quest_runs');
  ok('wave116: quest_runs wiped by Reset, cleared by the dev reset, counted for delete-account; bodies = sources + one line');
}

// --- client -------------------------------------------------------------------------------
const lib = read('src/lib/dev-test-user.ts');
const fn = lib.slice(lib.indexOf('export async function resetMyAccount'));
assert.ok(fn.startsWith('export async function resetMyAccount'), 'resetMyAccount exists');
assert.match(fn.slice(0, 200), /if \(!PRE_LAUNCH_DEV\) throw new Error/, 'pre-launch only on the client');
assert.ok(fn.indexOf('isPreviewing()') < fn.indexOf("supabase.rpc('reset_my_account')"), 'refuses during preview, before the call');
assert.match(fn, /supabase\.rpc\('reset_my_account'\)/, 'no id is sent: the server uses the caller');
assert.ok(fn.indexOf("rpc('reset_my_account')") < fn.indexOf("clearLocalAccountData({ keepPrefixes: ['ato.play.'] })"), 'then this phone forgets the account (name-style unlocks included), keeping the Divecore save');
assert.match(lib, /export const RESET_ACCOUNT_CONFIRM_WORD = 'RESET';/);
assert.doesNotMatch(lib, /startOverMyTestData/, 'Start over is replaced on the client');
ok('client: pre-launch only, refuses during preview, no id sent, then a full phone wipe');

const hub = read('src/app/dev-lab.tsx');
const panel = hub.slice(hub.indexOf('function ResetAccount() {'), hub.indexOf('\nfunction ', hub.indexOf('function ResetAccount() {') + 10));
assert.ok(panel.length > 0, 'ResetAccount panel exists');
assert.match(panel, /if \(!devAccess\.isRoot\) \{/, 'only root sees the button');
assert.match(panel, /if \(busy \|\| confirm !== RESET_ACCOUNT_CONFIRM_WORD\) return;/, 'RESET must be typed');
assert.match(panel, /disabled=\{busy \|\| !ready\}/);
assert.ok(panel.indexOf('confirm !== RESET_ACCOUNT_CONFIRM_WORD') < panel.indexOf('resetMyAccount()'), 'the typed check comes before the call');
const danger = hub.slice(hub.indexOf('<HubSection id="danger">'), hub.indexOf('</HubSection>', hub.indexOf('<HubSection id="danger">')));
assert.match(danger, /<HubTool id="reset-account"><ResetAccount \/><\/HubTool>/, 'Reset account lives in the Danger zone');
assert.ok(hub.indexOf('{tools && !previewing ? (') < hub.indexOf('<HubSection id="danger">'), 'the Danger zone hides while previewing and in release builds');
ok('the button: root only, RESET typed first, in the Danger zone, hidden while previewing');

console.log(`\n${passed} reset-account checks passed`);
