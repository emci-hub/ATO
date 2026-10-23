/**
 * Server hardening before public signup (wave98, ato-finish-roadmap step 1).
 * Run: npm run check:server-hardening
 *
 * Offline: source assertions on the migration and Edge Functions, plus the Sentry
 * scrubber run as real code. The live side (advisors, limiter behaviour) is by hand.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { scrubBreadcrumb, scrubEvent, scrubString, scrubUrl } from '../src/lib/sentry-scrub';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');
const sql = read('supabase/migrations/wave98_server_hardening.sql');

// --- Rate-limit mechanism ----------------------------------------------------
assert.match(sql, /create table if not exists public\.rate_limit_hits/);
assert.match(sql, /alter table public\.rate_limit_hits enable row level security/);
assert.match(sql, /revoke all on table public\.rate_limit_hits from public, anon, authenticated/);
assert.match(sql, /pg_advisory_xact_lock\(hashtext\('rl:'/);
for (const fn of ['_client_key()', '_rate_limit_check(text, text, integer, integer)', '_rate_limit_caller(text, integer, integer)']) {
  assert.ok(
    sql.includes(`revoke all on function public.${fn} from public, anon, authenticated`),
    `${fn} must not be callable from the client`,
  );
}
assert.match(sql, /grant execute on function public\.rate_limit_hit\(text, text, integer, integer\) to service_role/);
assert.doesNotMatch(sql, /grant execute on function public\.rate_limit_hit[^;]*(anon|authenticated)/);
ok('rate_limit_hits is deny-all; the helpers are internal; rate_limit_hit is service_role only');

assert.match(sql, /_rate_limit_caller\('public_profile', 60, 600\)/);
assert.match(sql, /_rate_limit_caller\('handle_taken', 30, 600\)/);
assert.match(sql, /revoke execute on function public\.handle_taken\(text\) from public, anon/);
ok('public_profile and handle_taken are rate limited; handle_taken is not anon-callable');

// A function that raises rolls its own counter back; the limited RPCs must not rely on that
// for anything but the final refusal.
assert.match(sql, /raise exception 'rate_limited'/);

// --- Anon grants -------------------------------------------------------------
for (const fn of [
  'peer_profile(uuid)',
  'get_or_create_thread(uuid)',
  'delete_message_for_me(uuid)',
  'is_message_party(uuid)',
]) {
  assert.ok(sql.includes(`revoke execute on function public.${fn} from public, anon`), `${fn} anon revoke`);
  assert.ok(sql.includes(`grant execute on function public.${fn} to authenticated`), `${fn} authenticated grant`);
}
assert.match(sql, /revoke execute on function public\.mirror_connection\(\) from public, anon, authenticated/);
assert.match(sql, /revoke execute on function public\.unmirror_connection\(\) from public, anon, authenticated/);
ok('chat / connection definer functions are not anon-callable');

// --- play_dev_logs -----------------------------------------------------------
assert.match(sql, /drop policy if exists play_dev_logs_select on public\.play_dev_logs/);
assert.match(sql, /revoke select on public\.play_dev_logs from anon, authenticated/);
assert.doesNotMatch(read('src/play/dev-log.ts'), /\.select\(/, 'dev-log only inserts');
ok('play_dev_logs has no anon / authenticated read');

// --- A3 cleanup (wave112, roadmap v2 S5; D13 + D15, emci OK 2026-10-22) ---------
{
  const w112 = read('supabase/migrations/wave112_a3_cleanup.sql');
  const code = w112.replace(/--[^\n]*/g, '');
  const statements = code.split(';').map((s) => s.trim().replace(/\s+/g, ' ')).filter((s) => s && s !== 'begin' && s !== 'commit');
  const expected = [
    'drop table if exists public.play_dev_logs',
    'drop policy if exists trait_tracks_adult_insert on public.trait_tracks',
    'drop policy if exists trait_tracks_adult_update on public.trait_tracks',
    'drop policy if exists trait_history_adult_insert on public.trait_history',
  ];
  assert.deepEqual(statements, expected, 'wave112 does exactly the four approved drops, nothing else');
  // Pairs: the approved list passes; a drop of a policy that still guards a client write fails.
  const onlyApproved = (list: string[]) => list.every((s) => expected.includes(s));
  assert.equal(onlyApproved(statements), true, 'pass: only the approved drops');
  assert.equal(onlyApproved([...statements, 'drop policy if exists messages_adult_insert on public.messages']), false, 'fail case: a live chat guard is never dropped here');
  assert.match(read('src/play/dev-log.ts'), /if \(!PRE_LAUNCH_DEV\) return false;/, 'the only writer is off in public builds');
  ok('wave112: drops play_dev_logs + the three inert trait policies only');
}

// --- Timezone farming (S1) ---------------------------------------------------
assert.match(sql, /create trigger me_timezone_guard\s+before insert or update of timezone on public\.me/);
assert.match(sql, /pg_timezone_names/);
assert.match(sql, /local_today > utc_today \+ 1 or local_today < utc_today - 1/);
assert.match(sql, /exception when others then\s+local_today := utc_today/);
ok('me.timezone must be a real zone; claim_daily_checkin clamps the local day to UTC ±1');

// --- Edge Functions ----------------------------------------------------------
const login = read('supabase/functions/password-login/index.ts');
assert.match(login, /allowRate\('pwlogin_ip'/);
assert.match(login, /allowRate\('pwlogin_id'/);
assert.match(login, /sha256Hex\(identifier\.replace\(\/\^@\/, ''\)\.toLowerCase\(\)\)/);
assert.match(login, /status|429/);
const unlock = read('supabase/functions/dev-unlock/index.ts');
assert.match(unlock, /allowRate\('dev_unlock', user\.id, 5, 900\)/);
assert.match(unlock, /auth\.getUser\(\)/);
const shared = read('supabase/functions/_shared/rate-limit.ts');
assert.match(shared, /rpc\('rate_limit_hit'/);
assert.doesNotMatch(shared, /console\.(log|error)\([^)]*(key|identifier)[^)]*\)/, 'never log the limiter key');
ok('password-login and dev-unlock are throttled through rate_limit_hit; the key is never logged');

// --- Sentry scrubber (S2) ----------------------------------------------------
assert.match(read('src/lib/sentry.ts'), /beforeSend: \(event\) => scrubEvent\(event\)/);
assert.match(read('src/lib/sentry.ts'), /beforeBreadcrumb: \(crumb\) => scrubBreadcrumb\(crumb\)/);
assert.match(read('src/lib/sentry.ts'), /sendDefaultPii: false/);

const email = 'someone.private@example.com';
const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.abcdefghijk';
const uuid = '123e4567-e89b-12d3-a456-426614174000';
assert.ok(!scrubString(`login failed for ${email}`).includes('private'));
assert.ok(!scrubString(`token ${jwt}`).includes('eyJ'));
assert.ok(!scrubString(`Authorization: Bearer abcdefghijklmnop`).includes('abcdefghijklmnop'));
assert.ok(!scrubString(`GET /rest/v1/me?handle=eq.emci&select=*`).includes('emci'));
assert.ok(!scrubString(`user ${uuid} failed`).includes(uuid));
assert.ok(!scrubString('hi @emci how are you').includes('emci'));
assert.ok(scrubString('x'.repeat(1000)).length <= 200);
assert.equal(scrubUrl('https://x.supabase.co/rest/v1/me?handle=eq.emci'), 'https://x.supabase.co/rest/v1/me');
ok('scrubString removes emails, tokens, uuids, @handles and filter values; strings are capped');

const event = scrubEvent({
  user: { id: 'abc', email, ip_address: '1.2.3.4', username: 'emci' },
  request: { url: `https://x.supabase.co/rest/v1/me?handle=eq.emci`, method: 'GET', headers: { Authorization: `Bearer ${jwt}` }, data: { answer: 'private text' } },
  message: `failed for ${email}`,
  exception: { values: [{ value: `bad ${email}` }] },
  extra: { prompt: 'secret prompt', packId: 'p1', nested: { note: 'typed text', n: 3 } },
  tags: { handle: 'emci', feature: 'deep-dive' },
  breadcrumbs: [
    { category: 'console', message: `logged ${email}` },
    { category: 'ui.input', message: 'typing' },
    { category: 'fetch', data: { method: 'GET', status_code: 200, url: 'https://x/rest/v1/me?handle=eq.emci', body: 'x' } },
  ],
});
const dumped = JSON.stringify(event);
assert.equal(event.user, undefined);
assert.ok(!dumped.includes('private'), 'no email left');
assert.ok(!dumped.includes('emci'), 'no handle left');
assert.ok(!dumped.includes('secret prompt') && !dumped.includes('typed text'), 'no free text left');
assert.ok(!dumped.includes('eyJ') && !dumped.includes('Bearer'), 'no token left');
assert.equal(event.breadcrumbs?.length, 1, 'console and input breadcrumbs dropped');
assert.deepEqual(event.breadcrumbs?.[0].data, {
  method: 'GET',
  status_code: 200,
  url: 'https://x/rest/v1/me',
});
assert.equal(scrubBreadcrumb({ category: 'console', message: 'x' }), null);
// SDK contexts keep their keys and the OTA id; the device's own name goes.
const ctx = scrubEvent({
  contexts: {
    device: { name: "Pat's iPhone", model: 'iPhone15,2' },
    os: { name: 'iOS', version: '18' },
    react_native_context: { js_engine: 'hermes' },
    expo_updates: { update_id: '123e4567-e89b-12d3-a456-426614174000' },
  },
}).contexts as Record<string, Record<string, string>>;
assert.equal(ctx.device.name, undefined);
assert.equal(ctx.device.model, 'iPhone15,2');
assert.equal(ctx.os.name, 'iOS');
assert.equal(ctx.react_native_context.js_engine, 'hermes');
assert.equal(ctx.expo_updates.update_id, '123e4567-e89b-12d3-a456-426614174000');
// A malformed event never throws out of the hook.
assert.doesNotThrow(() => scrubEvent({ exception: { values: 5 }, breadcrumbs: 'x' } as unknown as object));
assert.match(JSON.stringify(event.extra), /p1/, 'non-sensitive debug values survive');
ok('scrubEvent drops the user, request body and headers, free text, console and input breadcrumbs');

// --- Baseline schema ---------------------------------------------------------
assert.ok(existsSync(resolve(root, 'supabase/baseline/README.md')));
const baseline = read('supabase/baseline/me_connections_public_profile.sql');
assert.match(baseline, /create table public\.me \(/);
assert.match(baseline, /create table public\.connections \(/);
assert.match(baseline, /FUNCTION public\.public_profile/);
assert.ok(!existsSync(resolve(root, 'supabase/migrations/me_connections_public_profile.sql')), 'baseline is not a migration');
ok('a dated baseline of me / connections / public_profile is committed, outside migrations');

console.log(`\n${passed} server-hardening checks passed`);
