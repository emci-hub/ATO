/**
 * AI provider layer, after roadmap A5 (2026-10-23). Run: npm run check:ai
 *
 * Every model call runs in the `ai-library` Edge Function. The phone has no model client:
 * the old `ai-generate` client path (edge.ts, generate.ts, generateText, pingProvider,
 * call-sites.ts, the status dot) is gone and must stay gone. What is left on the phone is
 * the developer AI lab's provider labels and self-tracked usage counts.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { AI_CONFIG } from '../src/lib/ai/config';
import { AI_TAP_TIMEOUT_MS } from '../src/lib/ai/timeouts';
import { PROVIDER_LIMITS } from '../src/lib/ai/limits';
import { AI_PROVIDER_IDS, isAiProviderId } from '../src/lib/ai/types';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const next = resolve(dir, name.name);
    if (name.isDirectory()) {
      if (name.name === 'node_modules' || name.name === '.git') continue;
      walk(next, acc);
    } else if (/\.(ts|tsx)$/.test(name.name)) {
      acc.push(next);
    }
  }
  return acc;
}

/** Source text without comments, so a note about a removed function is not a call. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const srcFiles = walk(resolve(root, 'src'));

// --- Config: nothing is read from the build environment -------------------------
assert.equal(AI_CONFIG.provider, 'gemini');
assert.deepEqual(Object.keys(AI_CONFIG), ['provider']);
assert.ok(isAiProviderId('gemini') && isAiProviderId('deepseek'));
assert.ok(!isAiProviderId('groq'), 'fail case: an unknown vendor id is refused');
assert.doesNotMatch(code(read('src/lib/ai/config.ts')), /process\.env/, 'config.ts reads no environment variable');
const envReaders = srcFiles.filter((file) => /EXPO_PUBLIC_(AI_PROVIDER|MODEL_PROVIDER)/.test(code(readFileSync(file, 'utf8'))));
assert.deepEqual(envReaders, [], 'nothing under src reads EXPO_PUBLIC_AI_PROVIDER or EXPO_PUBLIC_MODEL_PROVIDER');
ok('the live vendor is a constant (Gemini, server-side); EXPO_PUBLIC_AI_PROVIDER / MODEL_PROVIDER are not read');

assert.equal(PROVIDER_LIMITS.gemini.rpm, 12);
assert.equal(PROVIDER_LIMITS.nvidia.rpm, 40);
assert.equal(PROVIDER_LIMITS.perplexity.rpm, null);
assert.equal(PROVIDER_LIMITS.claude.rpm, null);
assert.equal(PROVIDER_LIMITS.grok.rpm, null);
assert.equal(PROVIDER_LIMITS.deepseek.rpm, null);
assert.ok(AI_PROVIDER_IDS.includes('local') && AI_PROVIDER_IDS.includes('deepseek'));
ok('seeded reference limits match the known free-tier baselines');

// --- The old client path stays deleted --------------------------------------------
for (const gone of [
  'src/lib/ai/edge.ts',
  'src/lib/ai/generate.ts',
  'src/lib/ai/http.ts',
  'src/lib/ai/call-sites.ts',
  'src/lib/ai/reject-log.ts',
  'src/lib/ai/gemini.ts',
  'src/lib/category-deep-dive/generate.ts',
  'src/components/provider-status-dot.tsx',
  'scripts/live-ai.ts',
  'scripts/ai-call-sites-report.ts',
]) {
  assert.ok(!existsSync(resolve(root, gone)), `${gone} must stay deleted (the ai-generate client path is gone)`);
}
const callers = srcFiles.filter((file) => /\b(generateText|pingProvider|completeViaEdge)\s*\(/.test(code(readFileSync(file, 'utf8'))));
assert.deepEqual(callers, [], 'no model call or provider ping anywhere under src');
// The client-side claim helper (voice/quota-server.ts) is gone: nothing defines or imports it. (explore/route.ts
// still takes an injectable `claimAiCall` dependency for its offline check; that is a parameter name, not the helper.)
assert.doesNotMatch(read('src/lib/voice/quota-server.ts'), /export async function claimAiCall/);
const claimImporters = srcFiles.filter((file) => /import[^;]*\bclaimAiCall\b[^;]*from\s+'@\/lib\/voice\/quota-server'/.test(readFileSync(file, 'utf8')));
assert.deepEqual(claimImporters, [], 'nothing imports a client-side AI claim');
const invokers = srcFiles.filter((file) => /functions\.invoke\(\s*'ai-generate'/.test(code(readFileSync(file, 'utf8'))));
assert.deepEqual(invokers, [], 'nothing under src calls the ai-generate Edge Function');
assert.equal(AI_TAP_TIMEOUT_MS, 45000, 'the one live constant moved to timeouts.ts');
// Pairs on the rule itself: a call is caught, a comment about the removed function is not.
const callRule = /\b(generateText|pingProvider|completeViaEdge)\s*\(/;
assert.equal(callRule.test(code('const t = await generateText({ prompt }, META);')), true, 'fail case: a generateText call is caught');
assert.equal(callRule.test(code('// generateText( was removed in A5\nconst x = 1;')), false, 'pass: a comment is not a call');
const aiIndex = read('src/lib/ai/index.ts');
assert.doesNotMatch(aiIndex, /generateText|pingProvider|buildAiConfig|DEFAULT_MODELS|isRemoteReady/, 'the ai index exports no model client');
ok('the ai-generate client path stays deleted: no generateText, ping, edge client, call-site registry or status dot');

// No vendor key may be inlined into the bundle: only statically referenced
// EXPO_PUBLIC_* vars are inlined, so the reference itself is the leak.
const keyLeaks = srcFiles.filter((file) => /EXPO_PUBLIC_[A-Z_]*API_KEY/.test(readFileSync(file, 'utf8')));
assert.deepEqual(keyLeaks, []);
ok('no EXPO_PUBLIC_*_API_KEY reference anywhere in src');

// The model is chosen server-side. A stale EXPO_PUBLIC_*_MODEL in an EAS environment must not be able
// to influence the bundle, so nothing under src may reference one.
const modelLeaks = srcFiles.filter((file) => /EXPO_PUBLIC_[A-Z_]*_MODEL\b/.test(readFileSync(file, 'utf8')));
assert.deepEqual(modelLeaks, []);
assert.doesNotMatch(read('src/lib/ai/config.ts'), /geminiModel|geminiApiKey|GEMINI_API_KEY|GEMINI_MODEL\?/);
ok('no EXPO_PUBLIC_*_MODEL reference in src; client config is provider-only');

// No client-side vendor transport survives (Edge Function only).
const generateContentHits = srcFiles.filter((file) => readFileSync(file, 'utf8').includes(':generateContent'));
assert.deepEqual(generateContentHits, []);
ok('no vendor HTTP transport anywhere under src (Edge Function only)');

// --- The server side: ai-generate stays closed; the live model table is ai-vendors ---
// While the deployed function or its folder exists it must stay a 410 stub with no vendor key, no vendor
// URL, no prompt field and no call into the shared vendor code (wave98). Once emci deletes it (roadmap
// A5 / D14) the folder is gone and this part is vacuous; the invariant is "never an open proxy".
if (existsSync(resolve(root, 'supabase/functions/ai-generate/index.ts'))) {
  const edgeCode = code(read('supabase/functions/ai-generate/index.ts'));
  assert.match(edgeCode, /status: 410/);
  assert.doesNotMatch(edgeCode, /_API_KEY|Deno\.env|createClient|ai-vendors|claim_ai_call|\bprompt\b|fetch\(/);
  assert.doesNotMatch(edgeCode, /googleapis|nvidia\.com|perplexity|anthropic\.com|x\.ai|deepseek\.com/);
}
const vendorsSrc = read('supabase/functions/_shared/ai-vendors.ts');
assert.match(vendorsSrc, /gemini-3\.7-flash/, 'the live Gemini default model is the one in _shared/ai-vendors.ts');
for (const file of ['supabase/functions/ai-library/index.ts', 'supabase/functions/ai-library-fill/index.ts']) {
  assert.doesNotMatch(code(read(file)), /ai-generate/, `${file} must not depend on ai-generate`);
}
ok('ai-generate is never an open proxy; the live Gemini model is in _shared/ai-vendors.ts; ai-library does not use it');

// --- Questions and Sage-era writers stay deleted -----------------------------------
assert.ok(!existsSync(resolve(root, 'src/lib/explore/generate.ts')), 'the app-side Story writer stays deleted');
for (const gone of [
  'src/lib/questions/generate.ts',
  'src/lib/questions/prompt.ts',
  'src/lib/questions/ongoing-round.ts',
  'src/lib/questions/chunked-generate.ts',
  'src/lib/questions/prewarm.ts',
  'src/lib/questions/run-prewarm.ts',
  'src/lib/questions/question-lab.ts',
  'src/lib/questions/sweep.ts',
  'src/lib/questions/reroll.ts',
  'src/lib/rolls/run.ts',
  'src/lib/rolls/generate.ts',
  'src/lib/legends64/generate-story.ts',
]) {
  assert.ok(!existsSync(resolve(root, gone)), `${gone} must stay deleted (no runtime AI writers on the phone)`);
}
assert.doesNotMatch(read('src/lib/category-statements/generate-statements.ts'), /generateText|generateCategoryStatements/);
assert.doesNotMatch(read('src/lib/explore/prompt.ts'), /generateText/);
ok('questions come from the fixed bank; the Sage-era client writers stay deleted');

// --- The developer AI lab ------------------------------------------------------------
const lab = read('src/app/ai-lab.tsx');
assert.match(lab, /self-tracked call counts/);
assert.match(lab, /not the provider(&apos;|')s/);
assert.match(lab, /Refresh counts/);
assert.match(lab, /This device only/);
assert.doesNotMatch(lab, /ProviderStatusDot|pingProvider/, 'the lab no longer pings a provider');
assert.match(read('src/components/running-update-line.tsx'), /secret\.current\.n >= 5/);
assert.match(read('src/components/running-update-line.tsx'), /router\.push\('\/ai-lab'\)/);
assert.match(read('src/app/_layout.tsx'), /name="ai-lab"/);
assert.match(read('src/app/+native-intent.ts'), /voice\|ai\)-lab/);
ok('hidden 5-tap lab lists providers and self-tracked counts (no connectivity ping)');

const migration = read('supabase/migrations/ai_provider_layer.sql');
assert.match(migration, /create table public.ai_provider_log/);
assert.match(migration, /ai_provider_counts/);
assert.doesNotMatch(migration, /prompt/);
ok('usage log stores provider + timestamp, not the response');

console.log(`\n${passed} ai-provider checks passed`);
