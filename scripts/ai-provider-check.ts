/**
 * Unified AI provider layer. Run: npm run check:ai
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
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
assert.equal(buildAiConfig({ MODEL_PROVIDER: 'gemini' }).geminiApiKey, undefined);
assert.equal(buildVoiceConfig({ MODEL_PROVIDER: 'local' }).provider, 'local');
assert.ok(!isAiProviderId('groq'));
ok('AI_PROVIDER selects the vendor; MODEL_PROVIDER=local still forces the fallback');

assert.equal(DEFAULT_MODELS.gemini, 'gemini-2.5-flash');
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
assert.match(generate, /completeGemini/);
assert.match(generate, /completeNvidia/);
assert.match(generate, /completePerplexity/);
assert.match(generate, /completeViaEdge/);
assert.match(read('src/lib/ai/gemini.ts'), /thinkingConfig/);
assert.match(read('src/lib/ai/openai-compat.ts'), /integrate\.api\.nvidia\.com/);
assert.match(read('src/lib/ai/openai-compat.ts'), /disable_search: true/);
assert.match(read('src/lib/ai/edge.ts'), /functions\.invoke\('ai-generate'/);
ok('shared generateText dispatches Gemini / NVIDIA / Perplexity / Edge');

const edge = read('supabase/functions/ai-generate/index.ts');
assert.match(edge, /ANTHROPIC_API_KEY/);
assert.match(edge, /XAI_API_KEY/);
assert.match(edge, /DEEPSEEK_API_KEY/);
assert.doesNotMatch(edge, /process\.env\.EXPO_PUBLIC_/);
assert.match(edge, /provider !== 'claude' && provider !== 'grok' && provider !== 'deepseek'/);
assert.match(edge, /api\.anthropic\.com\/v1\/messages/);
assert.match(edge, /api\.x\.ai\/v1\/chat\/completions/);
assert.match(edge, /api\.deepseek\.com\/chat\/completions/);
assert.equal(PROVIDER_LIMITS.deepseek.rpm, null);
assert.ok(AI_PROVIDER_IDS.includes('deepseek'));
ok('Edge Function holds Claude and Grok keys server-side');

const srcFiles = walk(resolve(root, 'src'));
const generateContentHits = srcFiles.filter((file) => {
  const text = readFileSync(file, 'utf8');
  return text.includes(':generateContent') && !file.endsWith('src\\lib\\ai\\gemini.ts') && !file.endsWith('src/lib/ai/gemini.ts');
});
assert.deepEqual(generateContentHits, []);
ok('only the Gemini adapter hits generateContent');

assert.match(read('src/lib/explore/generate.ts'), /generateText/);
assert.match(read('src/lib/questions/generate.ts'), /generateText/);
assert.match(read('src/lib/questions/sweep.ts'), /generateText/);
assert.match(read('src/lib/voice/providers/remote.ts'), /generateText/);
assert.doesNotMatch(read('src/lib/explore/prompt.ts'), /generateText/);
assert.doesNotMatch(read('src/lib/voice/providers/prompt.ts'), /generateText/);
assert.doesNotMatch(read('src/lib/sage-title.ts'), /generateText/);
assert.doesNotMatch(read('src/lib/sage-story.ts'), /generateText/);
ok('call sites use generateText; prompt builders are untouched');

// --- Required call-site metadata ------------------------------------------
// generateText(request, meta) — meta is mandatory. Any src file that invokes
// generateText must be a registered call site and pass the metadata argument;
// this is what forces a new AI feature to declare its sharing model up front.
const METADATA_CALL_FILES = new Set([
  'src/lib/ai/generate.ts', // the dispatcher itself (definition, no self-calls)
  'src/lib/voice/providers/remote.ts',
  'src/lib/questions/generate.ts',
  'src/lib/questions/sweep.ts',
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
assert.equal(AI_CALL_SITES.length, 8, 'one catalog entry per AI call site');
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

// --- Gemini -> DeepSeek quota fallback gate --------------------------------
assert.equal(isQuotaLimitError(new Error('Gemini 429: Resource has been exhausted')), true);
assert.equal(isQuotaLimitError(new Error('Gemini 429: {"status":"RESOURCE_EXHAUSTED"}')), true);
assert.equal(isQuotaLimitError(new Error('Gemini 429: RATE_LIMIT_EXCEEDED')), true);
assert.equal(isQuotaLimitError(new Error('Gemini 400: prompt and maxOutputTokens are too long')), true);
assert.equal(isQuotaLimitError(new Error('Gemini 400: INVALID_ARGUMENT')), false);
assert.equal(isQuotaLimitError(new Error('Gemini 500: internal error')), false);
assert.equal(isQuotaLimitError(new Error('Gemini 403: API key not valid')), false);
assert.equal(isQuotaLimitError(new Error('network unreachable')), false);
assert.equal(isQuotaLimitError(null), false);
ok('fallback fires only on Gemini quota / token-limit errors, never other failures');

const lab = read('src/app/ai-lab.tsx');
assert.match(lab, /self-tracked call counts/);
assert.match(lab, /not the provider's/);
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
