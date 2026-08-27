/**
 * Live Wave 2 Stage 2 going check. Run: npm run check:around-going-live
 *
 * Signs in as the seeded throwaway `ato-intake-check@example.com` and marks
 * going on the fixture warehouse show via set_going — the same RPC the app uses.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = loadEnv();
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
assert.ok(url && anonKey, 'Missing Supabase env in .env.local');

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

async function main() {
  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: 'ato-intake-check@example.com',
    password: 'IntakeCheck-123!',
  });
  if (signInError) throw new Error(`signIn failed: ${signInError.message} (seed the user first)`);

  const session = signInData.session!;
  const authed = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });

  const { data: going, error: goingError } = await authed.rpc('set_going', {
    p_show_id: 'ato:test-warehouse',
    p_going: true,
    p_ages: 'All Ages',
  });
  if (goingError) throw goingError;
  assert.equal(going.going, true);
  assert.ok(Array.isArray(going.colors));
  assert.equal(going.colors.length, 0);
  ok('adult test account marks going on seeded all-ages show; color hidden below 3');

  const { error: plusError } = await authed.rpc('set_going', {
    p_show_id: 'ato:test-18plus',
    p_going: true,
    p_ages: '18+',
  });
  if (plusError) throw plusError;
  ok('same adult can mark going on the seeded 18+ show');

  await authed.rpc('set_going', { p_show_id: 'ato:test-warehouse', p_going: false, p_ages: 'All Ages' });
  await authed.rpc('set_going', { p_show_id: 'ato:test-18plus', p_going: false, p_ages: '18+' });
  const { data: cleared } = await authed.rpc('night_snapshot', { p_show_id: 'ato:test-warehouse' });
  assert.equal(cleared.going, false);
  ok('unmark clears the row');

  console.log(`\naround-going-live-check: ${passed}/${passed} passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
