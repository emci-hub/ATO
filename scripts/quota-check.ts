/**
 * Server-side AI quota checks. Run: npx tsx scripts/quota-check.ts
 *
 * Client-visible surface (anon key): unauthenticated claim is rejected, and
 * ai_usage cannot be written from the client. The authenticated atomic cap is
 * verified in SQL against the live project (see Stage 8 floor sweep).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createClient } from '@supabase/supabase-js';

import { QUOTA_EMPTY_MESSAGE } from '../src/lib/voice/quota';

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
  assert.equal(
    QUOTA_EMPTY_MESSAGE,
    "Sage's out of things to say for today, back tomorrow",
  );
  ok('honest-empty copy is the planned string');

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: config, error: configError } = await supabase
    .from('app_config')
    .select('ai_daily_cap, ai_monthly_cap')
    .eq('id', 1)
    .single();
  if (configError) throw configError;
  assert.ok((config.ai_daily_cap as number) >= 1);
  assert.ok((config.ai_monthly_cap as number) >= (config.ai_daily_cap as number));
  ok('app_config exposes daily/monthly caps', config);

  const claim = await supabase.rpc('claim_ai_call');
  assert.ok(claim.error, 'anon claim_ai_call must fail');
  ok('anon cannot claim a model call', { message: claim.error?.message });

  const leaked = await supabase.from('ai_usage').select('user_id, day, calls');
  assert.equal(leaked.data?.length ?? 0, 0, 'anon must not read ai_usage');
  ok('anon cannot read ai_usage', { rows: leaked.data?.length ?? 0 });

  const write = await supabase.from('ai_usage').insert({
    user_id: '00000000-0000-0000-0000-000000000000',
    day: '2099-01-01',
    calls: 0,
  });
  assert.ok(write.error, 'anon insert into ai_usage must fail');
  ok('anon cannot write ai_usage', { message: write.error?.message });

  console.log(`\n${passed} checks passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
