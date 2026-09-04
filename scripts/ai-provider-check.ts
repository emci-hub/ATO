/**
 * Unified AI provider layer. Run: npm run check:ai
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { buildAiConfig, DEFAULT_MODELS } from '../src/lib/ai/config';
import { PROVIDER_LIMITS } from '../src/lib/ai/limits';
import { AI_PROVIDER_IDS, isAiProviderId } from '../src/lib/ai/types';
import type { AiCallMetadata } from '../src/lib/ai/types';
import { AI_CALL_SITES } from '../src/lib/ai/call-sites';
import { isQuotaLimitError } from '../src/lib/ai/generate';
import { buildVoiceConfig } from '../src/lib/voice/config';

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

assert.equal(buildAiConfig({}).provider, 'gemini');
assert.equal(buildAiConfig({ MODEL_PROVIDER: 'local' }).provider, 'local');
assert.equal(buildAiConfig({ AI_PROVIDER: 'nvidia' }).provider, 'nvidia');
assert.equal(buildAiConfig({ AI_PROVIDER: 'nvidia', MODEL_PROVIDER: 'local' }).provider, 'local');
assert.equal(buildAiConfig({ AI_PROVIDER: 'claude' }).provider, 'claude');
assert.equal(buildVoiceConfig({ MODEL_PROVIDER: 'local' }).provider, 'local');
assert.ok(!isAiProviderId('groq'));
ok('AI_PROVIDER selects the vendor; MODEL_PROVIDER=local still forces the fallback');

assert.equal(DEFAULT_MODELS.gemini, 'gemini-3.7-flash');
assert.equal(PROVIDER_LIMITS.gemini.rpm, 12);
assert.equal(PROVIDER_LIMITS.nvidia.rpm, 40);
assert.equal(PROVIDER_LIMITS.perplexity.rpm, null);
assert.equal(PROVIDER_LIMITS.claude.rpm, null);
assert.equal(PROVIDER_LIMITS.grok.rpm, null);
assert.ok(AI_PROVIDER_IDS.includes('local'));
ok('seeded reference limits match the known free-tier baselines');

const generate = read('src/lib/ai/generate.ts');
assert.match(generate, /export async function generateText/);
assert.match(read('src/lib/ai/types.ts'), /responseFormat/);
assert.match(generate, /completeViaEdge/);
assert.doesNotMatch(generate, /completeGemini|completeNvidia|completePerplexity/);
assert.match(read('src/lib/ai/edge.ts'), /functions\.invoke\('ai-generate'/);
assert.match(read('src/lib/ai/edge.ts'), /isRemoteAiProviderId\(id\)/);
ok('shared generateText sends every remote vendor through the Edge Function');

// No vendor key may be inlined into the bundle: only statically referenced
// EXPO_PUBLIC_* vars are inlined, so the reference itself is the leak.
const keyLeaks = walk(resolve(root, 'src')).filter((file) =>
  /EXPO_PUBLIC_[A-Z_]*API_KEY/.test(readFileSync(file, 'utf8')),
);
assert.deepEqual(keyLeaks, []);
ok('no EXPO_PUBLIC_*_API_KEY reference anywhere in src');

const edge = read('supabase/functions/ai-generate/index.ts');
for (const secret of [
  'GEMINI_API_KEY',
  'NVIDIA_API_KEY',
  'PERPLEXITY_API_KEY',
  'ANTHROPIC_API_KEY',
  'XAI_API_KEY',
  'DEEPSEEK_API_KEY',
]) {
  assert.match(edge, new RegExp(secret));
}
assert.doesNotMatch(edge, /process\.env\.EXPO_PUBLIC_/);
assert.match(edge, /PROVIDERS as readonly string\[\]\)\.includes\(provider\)/);
assert.match(edge, /generativelanguage\.googleapis\.com/);
assert.match(edge, /thinkingConfig/);
assert.match(edge, /integrate\.api\.nvidia\.com/);
assert.match(edge, /disable_search: true/);
assert.match(edge, /api\.anthropic\.com\/v1\/messages/);
assert.match(edge, /api\.x\.ai\/v1\/chat\/completions/);
assert.match(edge, /api\.deepseek\.com\/chat\/completions/);
assert.match(edge, /auth\.getUser\(\)/);
assert.match(edge, /claim_ai_call/);
assert.match(edge, /MAX_OUTPUT_TOKENS = 1024/);
assert.equal(PROVIDER_LIMITS.deepseek.rpm, null);
assert.ok(AI_PROVIDER_IDS.includes('deepseek'));
ok('Edge Function holds every vendor key, verifies the JWT, claims quota, caps tokens');

// ping used to reach a real vendor with no quota claim at all (a free paid
// call outside the quota system). It must now return before both `complete(`
// and `claim_ai_call` — key-presence only, never the vendor.
const pingBranch = edge.slice(edge.indexOf('if (payload.ping === true)'), edge.indexOf('const prompt ='));
assert.notEqual(pingBranch, '');
assert.match(pingBranch, /keyFor\(provider as ProviderId\)/);
assert.match(pingBranch, /text: 'ready'/);
assert.doesNotMatch(pingBranch, /complete\(/);
assert.doesNotMatch(pingBranch, /claim_ai_call/);
const afterPing = edge.slice(edge.indexOf('const prompt ='));
assert.doesNotMatch(afterPing, /if \(!ping\)/);
ok('ping never reaches a vendor or claims quota; every remaining path always claims before completing');

// A real call's prompt length and temperature are both bounded server-side —
// output tokens were already clamped, but neither of these was.
assert.match(edge, /const MAX_PROMPT_CHARS = 24_000/);
assert.match(edge, /prompt\.length > MAX_PROMPT_CHARS \? prompt\.slice\(0, MAX_PROMPT_CHARS\) : prompt/);
assert.match(edge, /const MAX_TEMPERATURE = 1/);
assert.match(edge, /Math\.min\(MAX_TEMPERATURE, Math\.max\(0, requestedTemperature\)\)/);
ok('prompt length and temperature are clamped server-side, not just output tokens');

const srcFiles = walk(resolve(root, 'src'));
// No client-side vendor transport survives: the script-only Gemini adapter
// (src/lib/ai/gemini.ts) was deleted 2026-09-03; live checks now go through
// scripts/live-ai.ts → ai-generate like the app does.
const generateContentHits = srcFiles.filter((file) =>
  readFileSync(file, 'utf8').includes(':generateContent'),
);
assert.deepEqual(generateContentHits, []);
assert.ok(!existsSync(resolve(root, 'src/lib/ai/gemini.ts')), 'src/lib/ai/gemini.ts must stay deleted');
assert.doesNotMatch(read('src/lib/voice/providers/gemini.ts'), /createGeminiProvider|apiKey|fetch\(/);
assert.doesNotMatch(read('src/lib/ai/http.ts'), /extract(Gemini|OpenAi|Claude)Text|fetch\(/);
ok('no vendor HTTP transport anywhere under src (Edge Function only)');

// The model is chosen server-side. A stale EXPO_PUBLIC_*_MODEL in an EAS
// environment must not be able to influence the bundle, so nothing under src
// may reference one; AiEnv/AiConfig carry only the provider selection.
const modelLeaks = srcFiles.filter((file) =>
  /EXPO_PUBLIC_[A-Z_]*_MODEL\b/.test(readFileSync(file, 'utf8')),
);
assert.deepEqual(modelLeaks, []);
const aiConfigSrc = read('src/lib/ai/config.ts');
assert.doesNotMatch(aiConfigSrc, /geminiModel|geminiApiKey|GEMINI_API_KEY|GEMINI_MODEL\?/);
assert.deepEqual(Object.keys(buildAiConfig({ AI_PROVIDER: 'grok' })), ['provider']);
ok('no EXPO_PUBLIC_*_MODEL reference in src; client config is provider-only');

// DEFAULT_MODELS is a documented mirror of the Edge Function's table; the
// two must agree or the reference copy lies.
const edgeModels = /const DEFAULT_MODELS: Record<ProviderId, string> = \{([\s\S]*?)\};/.exec(edge)?.[1] ?? '';
for (const [id, model] of Object.entries(DEFAULT_MODELS)) {
  assert.match(edgeModels, new RegExp(`${id}: '${model.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}'`), `edge default for ${id}`);
}
ok('client DEFAULT_MODELS mirrors the Edge Function defaults');

assert.match(read('src/lib/explore/generate.ts'), /generateText/);
assert.match(read('src/lib/questions/generate.ts'), /generateText/);
assert.doesNotMatch(read('src/lib/questions/sweep.ts'), /generateText/);
assert.match(read('src/lib/voice/providers/remote.ts'), /generateText/);
assert.doesNotMatch(read('src/lib/explore/prompt.ts'), /generateText/);
assert.doesNotMatch(read('src/lib/voice/providers/prompt.ts'), /generateText/);
assert.doesNotMatch(read('src/lib/sage-title.ts'), /generateText/);
assert.doesNotMatch(read('src/lib/sage-story.ts'), /generateText/);
ok('call sites use generateText; prompt builders are untouched; the sweep now serves the static bank with no model call');

// --- Required call-site metadata ------------------------------------------
// generateText(request, meta) — meta is mandatory. Any src file that invokes
// generateText must be a registered call site and pass the metadata argument;
// this is what forces a new AI feature to declare its sharing model up front.
const METADATA_CALL_FILES = new Set([
  'src/lib/ai/generate.ts', // the dispatcher itself (definition, no self-calls)
  'src/lib/voice/providers/remote.ts',
  'src/lib/questions/generate.ts',
  'src/lib/explore/generate.ts',
]);
const CALL_WITH_META =
  /generateText\(\s*\{[\s\S]*?\}\s*,\s*[A-Za-z0-9_$.[\]]+\s*\)/g;
const relRoot = root.split('\\').join('/') + '/';
const unregisteredSites: string[] = [];
const callsMissingMeta: string[] = [];
for (const file of srcFiles) {
  const text = readFileSync(file, 'utf8');
  if (!text.includes('generateText(')) continue;
  const rel = file.split('\\').join('/').replace(relRoot, '');
  if (!METADATA_CALL_FILES.has(rel)) {
    unregisteredSites.push(rel);
    continue;
  }
  if (rel === 'src/lib/ai/generate.ts') continue;
  const callCount = text.split('generateText(').length - 1;
  const withMetaCount = (text.match(CALL_WITH_META) ?? []).length;
  if (callCount !== withMetaCount) {
    callsMissingMeta.push(`${rel}: ${callCount - withMetaCount} generateText call(s) missing metadata`);
  }
}
assert.deepEqual(
  unregisteredSites,
  [],
  `generateText call site without declared metadata: ${unregisteredSites.join(', ')}`,
);
assert.deepEqual(
  callsMissingMeta,
  [],
  `generateText call site missing the metadata argument: ${callsMissingMeta.join(', ')}`,
);
ok('every generateText call site passes the required metadata argument');

const META_FLAGS: readonly (keyof AiCallMetadata)[] = [
  'personalized',
  'cohortShareable',
  'bucketShareable',
  'latencySensitive',
];
assert.equal(AI_CALL_SITES.length, 7, 'one catalog entry per AI call site');
const features = new Set<string>();
for (const site of AI_CALL_SITES) {
  assert.ok(!features.has(site.feature), `duplicate call-site feature: ${site.feature}`);
  features.add(site.feature);
  for (const flag of META_FLAGS) {
    assert.equal(
      typeof site.meta[flag],
      'boolean',
      `${site.feature} metadata.${flag} must be a boolean`,
    );
  }
}
ok('metadata catalog covers all 8 call sites with boolean flags');

// --- Gemini -> DeepSeek fallback ------------------------------------------
// Any Gemini failure falls back (not only quota); isQuotaLimitError only
// classifies the log line.
const generateSrc = read('src/lib/ai/generate.ts');
assert.match(generateSrc, /if \(provider === 'gemini'\) \{[\s\S]*completeFor\('deepseek'/);
assert.doesNotMatch(generateSrc, /provider === 'gemini' && isQuotaLimitError/);
ok('every Gemini failure retries once on DeepSeek before the error state');
assert.equal(isQuotaLimitError(new Error('Gemini 429: Resource has been exhausted')), true);
assert.equal(isQuotaLimitError(new Error('Gemini 429: {"status":"RESOURCE_EXHAUSTED"}')), true);
assert.equal(isQuotaLimitError(new Error('Gemini 429: RATE_LIMIT_EXCEEDED')), true);
assert.equal(isQuotaLimitError(new Error('Gemini 400: prompt and maxOutputTokens are too long')), true);
assert.equal(isQuotaLimitError(new Error('Gemini 400: INVALID_ARGUMENT')), false);
assert.equal(isQuotaLimitError(new Error('Gemini 500: internal error')), false);
assert.equal(isQuotaLimitError(new Error('Gemini 403: API key not valid')), false);
assert.equal(isQuotaLimitError(new Error('network unreachable')), false);
assert.equal(isQuotaLimitError(null), false);
ok('isQuotaLimitError classifies quota / token-limit vs other Gemini failures');

const lab = read('src/app/ai-lab.tsx');
assert.match(lab, /self-tracked call counts/);
assert.match(lab, /not the provider(&apos;|')s/);
assert.match(lab, /Refresh counts/);
assert.match(lab, /This device only/);
assert.match(read('src/components/running-update-line.tsx'), /secret\.current\.n >= 5/);
assert.match(read('src/components/running-update-line.tsx'), /router\.push\('\/ai-lab'\)/);
assert.match(read('src/app/_layout.tsx'), /name="ai-lab"/);
assert.match(read('src/app/+native-intent.ts'), /voice\|ai\)-lab/);
ok('hidden 5-tap switcher lists providers and self-tracked counts');

const migration = read('supabase/migrations/ai_provider_layer.sql');
assert.match(migration, /create table public.ai_provider_log/);
assert.match(migration, /ai_provider_counts/);
assert.doesNotMatch(migration, /prompt/);
ok('usage log stores provider + timestamp, not the response');

console.log(`\n${passed} ai-provider checks passed`);
