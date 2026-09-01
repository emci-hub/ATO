/**
 * Unified AI provider layer. Run: npm run check:ai
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { buildAiConfig, DEFAULT_MODELS } from '../src/lib/ai/config';
import { PROVIDER_LIMITS } from '../src/lib/ai/limits';
import { AI_PROVIDER_IDS, isAiProviderId } from '../src/lib/ai/types';
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
assert.doesNotMatch(edge, /process\.env\.EXPO_PUBLIC_/);
assert.match(edge, /provider !== 'claude' && provider !== 'grok'/);
assert.match(edge, /api\.anthropic\.com\/v1\/messages/);
assert.match(edge, /api\.x\.ai\/v1\/chat\/completions/);
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
