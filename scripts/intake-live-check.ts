/**
 * Live Stage 9 row check. Run: npx tsx scripts/intake-live-check.ts
 *
 * Signs in as the seeded throwaway `ato-intake-check@example.com`, calls
 * complete_signup with all 9 core intake answers, then reads the ME row back
 * from Supabase (not the UI).
 *
 * Seed once (already applied in the Stage 9 session):
 *   auth.users email ato-intake-check@example.com / IntakeCheck-123!
 *   invite code INTAKECHK1 owned by emci
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

import { bankCardForMe } from '../src/lib/voice/bank';
import { voiceMeFrom } from '../src/lib/intake';

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

const ANSWERS = {
  talk_style: 'quiet',
  show_up: 'building something',
  knocks_you_off: 'sleep, workload',
  morning_cue: 'make coffee',
  evening_wind_down: 'put my phone down',
  energy_pattern: 'night_owl',
  recovery_style: 'alone_time',
  support_style: 'space',
  current_focus: 'habit',
} as const;

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

  const { data, error } = await authed.rpc('complete_signup', {
    p_name: 'Intake Check',
    p_handle: 'zintake9',
    p_show_up: ANSWERS.show_up,
    p_talk_style: ANSWERS.talk_style,
    p_knocks_you_off: ANSWERS.knocks_you_off,
    p_morning_cue: ANSWERS.morning_cue,
    p_timezone: 'America/Edmonton',
    p_invite_code: 'INTAKECHK1',
    p_born_on: '2000-01-15',
    p_evening_wind_down: ANSWERS.evening_wind_down,
    p_energy_pattern: ANSWERS.energy_pattern,
    p_recovery_style: ANSWERS.recovery_style,
    p_support_style: ANSWERS.support_style,
    p_current_focus: ANSWERS.current_focus,
  });
  if (error) throw new Error(`complete_signup failed: ${error.message}`);

  const { data: row, error: readError } = await authed
    .from('me')
    .select(
      'handle, talk_style, show_up, knocks_you_off, morning_cue, evening_wind_down, energy_pattern, recovery_style, support_style, current_focus',
    )
    .eq('id', session.user.id)
    .single();
  if (readError) throw new Error(`row read failed: ${readError.message}`);

  assert.equal(row.handle, 'zintake9');
  assert.equal(row.talk_style, ANSWERS.talk_style);
  assert.equal(row.show_up, ANSWERS.show_up);
  assert.equal(row.knocks_you_off, ANSWERS.knocks_you_off);
  assert.equal(row.morning_cue, ANSWERS.morning_cue);
  assert.equal(row.evening_wind_down, ANSWERS.evening_wind_down);
  assert.equal(row.energy_pattern, ANSWERS.energy_pattern);
  assert.equal(row.recovery_style, ANSWERS.recovery_style);
  assert.equal(row.support_style, ANSWERS.support_style);
  assert.equal(row.current_focus, ANSWERS.current_focus);

  const day1 = bankCardForMe(1, voiceMeFrom({ name: 'Intake Check', ...row }));
  assert.ok(day1?.do.includes(ANSWERS.morning_cue), `Do missing cue: ${day1?.do}`);
  assert.ok(!day1?.do.includes('{morning_cue}'));

  console.log('ME row:', row);
  console.log('Day 1 Do:', day1?.do);
  console.log('\nLive intake row check PASSED — all 9 fields on ME, cue in Day 1 Do.');
  void data;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
