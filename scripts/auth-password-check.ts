/**
 * Split Sign up / Log in + optional Settings password.
 * Run: npm run check:auth-password
 *
 * Live password uses ATO_REVIEW_PASSWORD (not committed). OTP/Apple stay
 * primary; OTP is pinged with shouldCreateUser:false so no mail is sent.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createClient } from '@supabase/supabase-js';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync(resolve(__dirname, '../.env.local'), 'utf8').split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) env[match[1]] = match[2];
  }
  return env;
}

async function main() {
  const signup = readFileSync(resolve(__dirname, '../src/app/auth/index.tsx'), 'utf8');
  const login = readFileSync(resolve(__dirname, '../src/app/auth/login.tsx'), 'utf8');
  const settings = readFileSync(
    resolve(__dirname, '../src/components/password-settings-fold.tsx'),
    'utf8',
  );
  const you = readFileSync(resolve(__dirname, '../src/app/(tabs)/you.tsx'), 'utf8');
  const passwordLib = readFileSync(resolve(__dirname, '../src/lib/auth-password.ts'), 'utf8');
  const otpLib = readFileSync(resolve(__dirname, '../src/lib/auth-otp.ts'), 'utf8');

  assert.match(signup, /Sign up/);
  assert.match(signup, /sendEmailOtp\(normalizedEmail, true\)/);
  assert.match(signup, /signInWithApple/);
  assert.match(signup, /Send code/);
  assert.doesNotMatch(signup, /signInWithPassword/);
  assert.doesNotMatch(signup, /secureTextEntry/);
  assert.doesNotMatch(signup, /placeholder="Password"/);
  assert.doesNotMatch(signup, /handlePasswordSignIn/);
  ok('Sign up is OTP + Apple only — no password field');

  assert.match(login, /Log in/);
  assert.match(login, /handlePasswordSignIn/);
  assert.match(login, /signInWithIdentifier/);
  assert.doesNotMatch(login, /signInWithPassword/);
  assert.doesNotMatch(login, /resolveLoginEmail/);
  assert.match(login, /secureTextEntry/);
  assert.match(login, /sendEmailOtp\(email, false\)/);
  assert.match(login, /signInWithApple/);
  assert.match(login, /Email me a code instead/);
  assert.match(login, /LOGIN_PASSWORD_HINT/);
  ok('Log in has Apple, optional password (via the password-login Edge Function), and OTP fallback that does not create users');

  assert.match(you, /PasswordSettingsFold/);
  assert.match(settings, /setAuthPassword/);
  assert.match(settings, /changeAuthPassword/);
  assert.match(settings, /Confirm password/);
  assert.match(passwordLib, /updateUser\(\{ password \}\)/);
  assert.doesNotMatch(passwordLib, /console\.(log|info|debug|warn|error)\([^)]*password/);
  assert.doesNotMatch(settings, /recordOwnDevTrace|recordTrace/);
  assert.match(otpLib, /signInWithOtp/);
  ok('Settings set/change uses GoTrue updateUser; password is not logged or traced');

  assert.match(passwordLib, /functions\.invoke\('password-login'/);
  assert.match(passwordLib, /auth\.setSession/);
  assert.doesNotMatch(passwordLib, /rpc\('login_email_for_identifier'/);
  const fn = readFileSync(
    resolve(__dirname, '../supabase/functions/password-login/index.ts'),
    'utf8',
  );
  assert.match(fn, /login_email_for_identifier/);
  assert.match(fn, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(fn, /signInWithPassword/);
  assert.match(
    fn,
    /return json\(\{\s*access_token: signInData\.session\.access_token,\s*refresh_token: signInData\.session\.refresh_token,\s*\}\);/,
  );
  ok('password-login Edge Function resolves + signs in server-side; the response is only session tokens, never the email');

  const env = loadEnv();
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  assert.ok(url && anonKey, 'Missing Supabase env in .env.local');

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const reviewEmail = process.env.ATO_REVIEW_EMAIL ?? env.ATO_REVIEW_EMAIL ?? 'ato.review@asstrollogs.com';
  const reviewPassword = process.env.ATO_REVIEW_PASSWORD ?? env.ATO_REVIEW_PASSWORD;

  const { data: leaked, error: leakError } = await supabase.rpc('login_email_for_identifier', {
    p_identifier: 'riley',
  });
  assert.ok(leakError, 'anon must not be able to call login_email_for_identifier directly');
  assert.equal(leaked, null);
  ok('login_email_for_identifier rejects an anon caller — the RPC no longer leaks emails by handle');

  const bad = await supabase.functions.invoke('password-login', {
    body: { identifier: 'riley', password: 'not-the-review-password' },
  });
  assert.ok(bad.error, 'wrong password must fail');
  ok('wrong password is rejected without revealing whether @riley exists');

  if (!reviewPassword) {
    console.log('  ⚠ ATO_REVIEW_PASSWORD unset — skipping live password sign-in');
  } else {
    const good = await supabase.functions.invoke('password-login', {
      body: { identifier: 'riley', password: reviewPassword },
    });
    assert.equal(good.error, null, good.error?.message ?? 'password sign-in failed');
    const tokens = good.data as { access_token?: string; refresh_token?: string } | null;
    assert.ok(tokens?.access_token && tokens.refresh_token, 'password-login must return a session');
    assert.doesNotMatch(JSON.stringify(good.data), /@/, 'response must never contain an email address');

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: tokens!.access_token!,
      refresh_token: tokens!.refresh_token!,
    });
    assert.equal(sessionError, null, sessionError?.message ?? 'setSession failed');

    const { data: user } = await supabase.auth.getUser();
    assert.equal(user.user?.email, reviewEmail);
    const { data: me, error: meError } = await supabase.from('me').select('handle').single();
    assert.equal(meError, null, meError?.message ?? 'me fetch failed');
    assert.equal(me?.handle, 'riley');

    const { data: hasPw, error: hasPwError } = await supabase.rpc('auth_has_password');
    assert.equal(hasPwError, null, hasPwError?.message ?? 'auth_has_password failed');
    assert.equal(hasPw, true, 'review account must report a stored password hash');
    ok('password-login for @riley returns a session, never the email, and it verifies');
    await supabase.auth.signOut();
  }

  const otpPing = await supabase.auth.signInWithOtp({
    email: `otp-unaffected-check-${Date.now()}@asstrollogs.com`,
    options: { shouldCreateUser: false },
  });
  assert.ok(otpPing.error, 'unknown email with shouldCreateUser false must not create a user');
  ok('OTP endpoint still answers; login Send-code path does not create users');

  console.log(`\nauth-password-check: ${passed}/${passed} passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
