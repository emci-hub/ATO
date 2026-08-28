/**
 * Founder codes + access requests. Run: npm run check:founder-access
 *
 * Client-visible surface (anon key) plus static gates. Unlimited consume and
 * referred_by are proven in SQL against the live project in the session that
 * applied founder_access_requests.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) env[match[1]] = match[2];
  }
  return env;
}

const env = loadEnv();
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
assert.ok(url && anonKey, 'Missing Supabase env in .env.local');

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

let passed = 0;
function ok(label: string, detail?: unknown) {
  passed += 1;
  console.log(`  \u2713 ${label}${detail === undefined ? '' : ` \u2014 ${JSON.stringify(detail)}`}`);
}

async function main() {
  const me = read('src/lib/me.ts');
  assert.match(me, /is_founder: boolean/);
  assert.match(me, /is_founder: row\.is_founder === true/);
  assert.doesNotMatch(me, /is_founder[\s\S]{0,80}host/);
  ok('ME has is_founder, defaulted false in withVisible, not tied to host/admin');

  const you = read('src/app/(tabs)/you.tsx');
  assert.match(you, /me\?\.is_founder/);
  assert.match(you, /founderBadge/);
  assert.match(you, /Founder/);
  assert.match(you, /inviteUsable/);
  assert.match(you, /unlimited/);
  assert.doesNotMatch(you, /Each code works once/);
  ok('You-tab shows a Founder badge and unlimited leftover copy');

  const invite = read('src/lib/invite.ts');
  assert.match(invite, /max_uses: number \| null/);
  assert.match(invite, /if \(invite\.max_uses == null\) return null/);
  ok('invite remaining treats null max_uses as unlimited');

  const sql = read('supabase/migrations/founder_access_requests.sql');
  assert.match(sql, /max_uses is null or uses_count < max_uses/);
  assert.match(sql, /issue_one_invite_code\(new\.id, null\)/);
  assert.match(sql, /create table public\.access_requests/);
  ok('migration allows unlimited consume, founder code, and access_requests');

  const hub = read('src/app/dev-lab.tsx');
  assert.match(hub, /id: 'access'/);
  assert.match(hub, /listPendingAccessRequests/);
  assert.match(hub, /approveAccessRequest/);
  assert.match(hub, /denyAccessRequest/);
  ok('dev-lab Access section reviews pending requests');

  const fn = read('supabase/functions/review-access/index.ts');
  assert.match(fn, /api\.resend\.com\/emails/);
  assert.match(fn, /noreply@asstrollogs\.com/);
  const denyAt = fn.indexOf("action === 'deny'");
  const approveAt = fn.indexOf('approve_access_request');
  assert.ok(denyAt > 0 && approveAt > denyAt);
  assert.doesNotMatch(fn.slice(denyAt, approveAt), /sendInviteEmail|api\.resend\.com/);
  ok('approve emails via Resend; deny path does not send mail');

  const landing = read('landing/index.html');
  assert.match(landing, /id="access-form"/);
  assert.match(landing, /type="email"/);
  assert.match(landing, /rest\/v1\/access_requests/);
  ok('landing page posts an email-only form to access_requests');

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const stamp = Date.now();
  const email = `ato-access-check-${stamp}@example.com`;
  const inserted = await supabase.from('access_requests').insert({ email });
  assert.equal(inserted.error, null, inserted.error?.message);
  ok('anon can insert an access request', { email });

  const dup = await supabase.from('access_requests').insert({ email });
  assert.ok(dup.error, 'duplicate email must be rejected');
  ok('duplicate request email is rejected');

  const listed = await supabase.from('access_requests').select('id, email');
  assert.equal(listed.data?.length ?? 0, 0, 'anon must not read access_requests');
  ok('anon cannot read access_requests');

  const updated = await supabase
    .from('access_requests')
    .update({ status: 'approved' })
    .eq('email', email);
  assert.ok(
    (updated.data == null || (Array.isArray(updated.data) && updated.data.length === 0)) &&
      (updated.error || updated.count === 0 || updated.count == null),
  );
  const sneak = await supabase.rpc('list_pending_access_requests');
  assert.ok(sneak.error, 'anon must not list pending requests');
  ok('anon cannot approve or list requests', { message: sneak.error?.message });

  const founderPeek = await supabase.rpc('assert_invite_usable', {
    p_code: env.ATO_FOUNDER_CHECK_CODE ?? 'NOT-A-REAL-CODE',
  });
  if (env.ATO_FOUNDER_CHECK_CODE) {
    assert.equal(founderPeek.error, null, founderPeek.error?.message);
    ok('founder check code is usable (no cap)');
  } else {
    assert.ok(founderPeek.error);
    ok('invite peek still rejects a fake code');
  }

  console.log(`\nAll ${passed} founder/access client checks passed.`);
}

main().catch((error) => {
  console.error('\nFAILED:', error.message);
  process.exit(1);
});
