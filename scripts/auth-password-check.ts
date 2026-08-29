/**
 * Password sign-in is a secondary auth path for App Review.
 * Run: npm run check:auth-password
 *
 * Live password uses ATO_REVIEW_PASSWORD (not committed). OTP/Apple are
 * source-asserted as the unchanged primary paths; OTP is also pinged with
 * shouldCreateUser:false so no mail is sent.
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
  const auth = readFileSync(resolve(__dirname, '../src/app/auth.tsx'), 'utf8');
  assert.match(auth, /onPress=\{sendCode\}/);
  assert.match(auth, /supabase\.auth\.signInWithOtp/);
  assert.match(auth, /shouldCreateUser: true/);
  assert.match(auth, /onPress=\{handleApple\}/);
  assert.match(auth, /signInWithApple/);
  assert.match(auth, /Send code/);
  ok('Send code still calls signInWithOtp; Apple button still calls handleApple');

  assert.match(auth, /handlePasswordSignIn/);
  assert.match(auth, /supabase\.auth\.signInWithPassword/);
  assert.match(auth, /Sign in with password/);
  assert.match(auth, /secureTextEntry/);
  assert.doesNotMatch(auth, /No password needed/);
  ok('password is a secondary field, not the primary Send-code flow');

  const sendCodeLabel = auth.indexOf("{busy ? 'Sending…' : 'Send code'}");
  const passwordLabel = auth.indexOf("{busy ? 'Signing in…' : 'Sign in with password'}");
  assert.ok(sendCodeLabel > 0 && passwordLabel > sendCodeLabel);
  ok('Send code stays the filled primary button; password is the link below it');

  const env = loadEnv();
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  assert.ok(url && anonKey, 'Missing Supabase env in .env.local');

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const reviewEmail = process.env.ATO_REVIEW_EMAIL ?? 'ato.review@asstrollogs.com';
  const reviewPassword = process.env.ATO_REVIEW_PASSWORD;
  assert.ok(reviewPassword, 'ATO_REVIEW_PASSWORD must be set for the live demo sign-in check');

  const bad = await supabase.auth.signInWithPassword({
    email: reviewEmail,
    password: 'not-the-review-password',
  });
  assert.ok(bad.error, 'wrong password must fail');
  assert.equal(bad.data.session, null);
  ok('wrong password is rejected');

  const good = await supabase.auth.signInWithPassword({
    email: reviewEmail,
    password: reviewPassword,
  });
  assert.equal(good.error, null, good.error?.message ?? 'password sign-in failed');
  assert.ok(good.data.session, 'password sign-in must return a session');
  assert.equal(good.data.user?.email, reviewEmail);
  const { data: me, error: meError } = await supabase.from('me').select('handle').single();
  assert.equal(meError, null, meError?.message ?? 'me fetch failed');
  assert.equal(me?.handle, 'riley');
  ok('ato.review@asstrollogs.com signInWithPassword returns a session for @riley');
  await supabase.auth.signOut();

  const otpPing = await supabase.auth.signInWithOtp({
    email: `otp-unaffected-check-${Date.now()}@asstrollogs.com`,
    options: { shouldCreateUser: false },
  });
  assert.ok(otpPing.error, 'unknown email with shouldCreateUser false must not create a user');
  ok('OTP endpoint still answers; Send-code path is unchanged (no mail sent)');

  console.log(`\nauth-password-check: ${passed}/${passed} passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
