/**
 * Invite / referral done-bar checks (Auth + ME).
 * Run: npx tsx scripts/invite-check.ts
 *
 * Client-visible surface only (anon key). Branch pause/delete and atomic
 * consume are verified in SQL against the live project — see the session
 * that applied stage8_invite_referral.
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

async function main() {
  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: config, error: configError } = await supabase
    .from('app_config')
    .select('signup_mode')
    .eq('id', 1)
    .single();
  if (configError) throw configError;
  assert.equal(config.signup_mode, 'invite_only', 'default signup_mode must be invite_only');
  ok('signup_mode is invite_only', config);

  const missing = await supabase.rpc('assert_invite_usable', { p_code: '' });
  assert.ok(missing.error, 'blank code must be rejected');
  assert.match(missing.error.message, /invite_required|invite_invalid/i);
  ok('invite-only rejects a missing code', { message: missing.error.message });

  const invalid = await supabase.rpc('assert_invite_usable', { p_code: 'NOT-A-REAL-CODE' });
  assert.ok(invalid.error, 'invalid code must be rejected');
  assert.match(invalid.error.message, /invite_invalid/i);
  ok('invite-only rejects an invalid code', { message: invalid.error.message });

  const { data: leakedCodes, error: leakError } = await supabase
    .from('invite_codes')
    .select('code');
  assert.equal(leakError ? leakError.code : undefined, undefined);
  assert.equal(leakedCodes?.length ?? 0, 0, 'anon must not read invite codes');
  ok('anon cannot read invite_codes', { rows: leakedCodes?.length ?? 0 });

  const { data: leakedMe } = await supabase.from('me').select('id, referred_by');
  assert.equal(leakedMe?.length ?? 0, 0, 'anon must not read me.referred_by');
  ok('anon cannot read referred_by', { rows: leakedMe?.length ?? 0 });

  const unauthedSignup = await supabase.rpc('complete_signup', {
    p_name: 'Nope',
    p_handle: 'nopehandle',
    p_show_up: 'no',
    p_talk_style: 'even',
    p_knocks_you_off: 'no',
    p_morning_cue: 'no',
    p_timezone: 'UTC',
    p_invite_code: null,
  });
  assert.ok(unauthedSignup.error, 'anon complete_signup must fail');
  ok('anon cannot complete_signup', { message: unauthedSignup.error?.message });

  const pause = await supabase.rpc('pause_branch', {
    p_user_id: '00000000-0000-0000-0000-000000000000',
  });
  assert.ok(pause.error, 'client must not call pause_branch');
  ok('pause_branch is not client-callable', { message: pause.error?.message });

  console.log(`\nAll ${passed} invite client checks passed.`);
}

main().catch((error) => {
  console.error('\nFAILED:', error.message);
  process.exit(1);
});
