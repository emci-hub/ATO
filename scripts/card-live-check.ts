/**
 * LIVE card generation check against the real Gemini provider — proves the
 * generate path (with the new thinkingConfig) returns a usable full card.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const envRaw = fs.readFileSync(path.resolve(__dirname, '../.env.local'), 'utf8');
for (const line of envRaw.split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq === -1) continue;
  process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
}

async function main() {
  const { routeVoiceCard } = await import('../src/lib/voice/router');
  const { buildVoiceConfig } = await import('../src/lib/voice/config');
  const { createGeminiProvider } = await import('../src/lib/voice/providers/gemini');

  const config = buildVoiceConfig({
    MODEL_PROVIDER: 'gemini',
    GEMINI_MODEL: process.env.EXPO_PUBLIC_GEMINI_MODEL,
    GEMINI_API_KEY: process.env.EXPO_PUBLIC_GEMINI_API_KEY,
  });

  const providers = {
    gemini: createGeminiProvider({ model: config.geminiModel, apiKey: config.geminiApiKey! }),
    local: createGeminiProvider({ model: config.geminiModel, apiKey: config.geminiApiKey! }),
  };

  const result = await routeVoiceCard(
    {
      me: { name: 'Emci', show_up: 'finishing my resume', talk_style: 'even', knocks_you_off: 'bad sleep', morning_cue: 'making coffee' },
      checkCount: 4,
      history: [
        { day: 1, status: 'done' }, { day: 2, status: 'done' },
        { day: 3, status: 'done' }, { day: 4, status: 'done' },
      ],
      aiConsent: true,
    },
    { config, providers, isDev: true },
  );

  assert.equal(result.kind, 'card');
  assert.equal(result.provider, 'gemini', `expected real gemini provider, got ${result.provider}`);
  assert.ok(result.card?.read && result.card?.read.length > 0, 'read must be non-empty');
  assert.ok(result.card?.do && result.card?.do.length > 0, 'do must be non-empty');
  assert.ok(
    /[.!?]["']?$/.test(result.card.read.trim()),
    `read looks truncated: ${JSON.stringify(result.card.read.slice(-80))}`,
  );

  console.log('kind    :', result.kind);
  console.log('provider:', result.provider);
  console.log('day     :', result.day);
  console.log('read    :', result.card.read);
  console.log('do      :', result.card.do);
  console.log('\nLive card generation PASSED — full card from real Gemini path.');
}

main().catch((err) => { console.error(err); process.exit(1); });
