/**
 * Live end-to-end check for the in-app delete-account flow.
 * Run: npx tsx scripts/delete-account-check.ts
 *
 * Signs in as a throwaway account on the real project, gives it real rows, then
 * deletes it through the DEPLOYED `delete-account` edge function using a real
 * user JWT — the same path the app takes. Asserts the guards reject
 * unconfirmed/unauthenticated calls, and that the delete reports zero remaining
 * rows.
 *
 * The project has email confirmation enabled with no SMTP configured, so the
 * test account cannot be created by signUp from a script. Seed it once:
 *
 *   insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
 *     email_confirmed_at, created_at, updated_at, raw_app_meta_data,
 *     raw_user_meta_data, confirmation_token, recovery_token,
 *     email_change_token_new, email_change)
 *   values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
 *     'authenticated', 'authenticated', 'ato-delete-check@example.com',
 *     extensions.crypt('DeleteCheck-123!', extensions.gen_salt('bf')),
 *     now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb,
 *     '{}'::jsonb, '', '', '', '');
 *   -- plus a matching auth.identities row (provider 'email').
 *
 * This proves the flow end to end. It does NOT prove Apple revocation against a
 * real Apple token, which needs Apple credentials and a device sign-in — see
 * apple-revoke-check.ts.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
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

let passed = 0;
function ok(label: string, detail?: unknown) {
  passed += 1;
  console.log(`  \u2713 ${label}${detail === undefined ? '' : ` \u2014 ${JSON.stringify(detail)}`}`);
}

const stamp = Date.now();
const email = 'ato-delete-check@example.com';
const password = 'DeleteCheck-123!';

async function main() {
  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Sign in as the seeded throwaway account.
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) throw new Error(`signIn failed: ${signInError.message} (seed the user first)`);

  const session = signInData.session!;
  const userId = signInData.user!.id;
  ok('signed in as throwaway account', { userId });

  const authed = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });

  // 2. Give it real owned rows the same way the app does (complete_signup).
  //    Direct inserts are rejected in invite_only. Seed a one-use code owned
  //    by emci if ATO_INVITE_CODE is not set:
  //      insert into invite_codes (code, owner_id)
  //      select 'DELCHECK1', id from me where handle = 'emci';
  const { error: meError } = await authed.rpc('complete_signup', {
    p_name: 'Delete Check',
    p_handle: `zdel${stamp}`.slice(0, 20),
    p_show_up: 'verifying deletes',
    p_talk_style: 'even',
    p_knocks_you_off: 'nothing',
    p_morning_cue: 'coffee',
    p_timezone: 'America/Edmonton',
    p_invite_code: env.ATO_INVITE_CODE ?? null,
    p_born_on: '2000-01-15',
    p_evening_wind_down: 'put my phone down',
    p_energy_pattern: 'morning',
    p_recovery_style: 'sleep',
    p_support_style: 'nudge',
    p_current_focus: 'habit',
  });
  if (meError) throw new Error(`me insert failed: ${meError.message}`);

  const loggedOn = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Edmonton',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const { error: checkInsertError } = await authed.rpc('record_check', {
    p_day: 1,
    p_logged_on: loggedOn,
    p_read_text: 'read',
    p_do_text: 'do',
    p_source: 'bank',
    p_status: 'done',
  });
  if (checkInsertError) throw new Error(`check insert failed: ${checkInsertError.message}`);
  await authed.from('sage_messages').insert({ user_id: userId, role: 'user', text: 'hi' });

  const { count: meCountBefore } = await authed
    .from('me')
    .select('*', { count: 'exact', head: true })
    .eq('id', userId);
  assert.equal(meCountBefore, 1, 'ME row should exist before delete');
  ok('ME row + checks + sage_messages exist before delete', { meCountBefore });

  // The client must never be able to read Apple refresh tokens. RLS is enabled
  // on apple_credentials with zero policies, so an authenticated select returns
  // nothing even though a row exists for this user (seeded out of band).
  const { data: credPeek } = await authed.from('apple_credentials').select('refresh_token');
  assert.equal(credPeek?.length ?? 0, 0, 'client must not read Apple tokens');
  ok('apple_credentials unreadable by an authenticated client', {
    rows: credPeek?.length ?? 0,
  });

  // 3. Guard: unauthenticated call is rejected.
  const anonInvoke = await fetch(`${url}/functions/v1/delete-account`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: anonKey },
    body: JSON.stringify({ confirm: 'DELETE MY ACCOUNT' }),
  });
  assert.equal(anonInvoke.status, 401, 'unauthenticated delete must be 401');
  ok('unauthenticated delete rejected', { status: anonInvoke.status });

  // 4. Guard: missing/!wrong confirmation is rejected server-side.
  const noConfirm = await fetch(`${url}/functions/v1/delete-account`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({}),
  });
  const noConfirmBody = await noConfirm.json();
  assert.equal(noConfirm.status, 400);
  assert.equal(noConfirmBody.error, 'confirmation_required');
  ok('delete without confirmation rejected server-side', noConfirmBody);

  const wrongConfirm = await fetch(`${url}/functions/v1/delete-account`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ confirm: 'yes' }),
  });
  assert.equal(wrongConfirm.status, 400);
  ok('delete with wrong confirmation phrase rejected', await wrongConfirm.json());

  // Row must still be there after the rejected attempts.
  const { count: meStillThere } = await authed
    .from('me')
    .select('*', { count: 'exact', head: true })
    .eq('id', userId);
  assert.equal(meStillThere, 1, 'rejected attempts must not delete anything');
  ok('rejected attempts left the account intact', { meCount: meStillThere });

  // 5. The real delete.
  const deleteResponse = await fetch(`${url}/functions/v1/delete-account`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ confirm: 'DELETE MY ACCOUNT' }),
  });
  const deleteBody = await deleteResponse.json();
  assert.equal(deleteResponse.status, 200, `delete failed: ${JSON.stringify(deleteBody)}`);
  assert.equal(deleteBody.deleted, true);
  assert.equal(deleteBody.rows_remaining, 0, 'cascade left rows behind');
  ok('delete succeeded and reported zero remaining rows', deleteBody);

  // Honesty check: a stored Apple token that could not actually be revoked must
  // never be reported as revoked. This account has a fake Apple credential, so
  // the revoke attempt must fail loudly and still not block the deletion.
  if (deleteBody.had_apple_identity) {
    assert.notEqual(
      deleteBody.apple_revocation_confirmed,
      true,
      'must not claim revocation was confirmed with a fake token',
    );
    assert.ok(deleteBody.apple_revoke_error, 'a failed revoke must record why');
    ok('failed Apple revocation reported honestly, deletion still completed', {
      apple_revoke_status: deleteBody.apple_revoke_status,
      apple_revoke_accepted: deleteBody.apple_revoke_accepted,
      apple_revocation_confirmed: deleteBody.apple_revocation_confirmed,
      apple_revoke_error: String(deleteBody.apple_revoke_error).slice(0, 120),
    });
  }

  // 6. Independent confirmation: the old JWT can no longer read the ME row,
  //    and a fresh sign-in with the same credentials is refused.
  const { data: afterRows } = await authed.from('me').select('id').eq('id', userId);
  assert.equal(afterRows?.length ?? 0, 0, 'ME row still readable after delete');
  ok('ME row is unreadable with the deleted user JWT', { rows: afterRows?.length ?? 0 });

  const { data: reSignIn, error: reSignInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  assert.ok(!reSignIn?.session, 'deleted account should not sign in again');
  ok('deleted account can no longer sign in', { error: reSignInError?.message });

  console.log(`\nAll ${passed} delete-account checks passed.`);
  console.log(`\nDeleted user id for independent DB verification: ${userId}`);
}

main().catch((error) => {
  console.error('\nFAILED:', error.message);
  process.exit(1);
});
