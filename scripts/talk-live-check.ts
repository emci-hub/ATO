/**
 * LIVE Talk exchange check against the real Gemini provider.
 *
 * Proves the thinkingConfig fix: a full, untruncated reply comes back from the
 * actual Gemini path (gemini-3.7-flash, real key from .env.local) via
 * routeTalkReply → createGeminiProvider.generateTalk — not the local fallback.
 *
 * Run: npx tsx scripts/talk-live-check.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Load .env.local before importing the app modules (they read env at import).
const envRaw = fs.readFileSync(path.resolve(__dirname, '../.env.local'), 'utf8');
for (const line of envRaw.split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq === -1) continue;
  process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
}

async function main() {
  const { routeTalkReply } = await import('../src/lib/voice/talk');
  const { buildVoiceConfig } = await import('../src/lib/voice/config');
  const { createGeminiProvider } = await import('../src/lib/voice/providers/gemini');

  const config = buildVoiceConfig({
    MODEL_PROVIDER: 'gemini',
    GEMINI_MODEL: process.env.EXPO_PUBLIC_GEMINI_MODEL,
    GEMINI_API_KEY: process.env.EXPO_PUBLIC_GEMINI_API_KEY,
  });
  assert.ok(config.geminiApiKey, 'real key must be present in .env.local');

  const providers = {
    gemini: createGeminiProvider({ model: config.geminiModel, apiKey: config.geminiApiKey! }),
    local: createGeminiProvider({ model: config.geminiModel, apiKey: config.geminiApiKey! }),
  };

  const me = {
    name: 'Emci',
    show_up: 'finishing my resume',
    talk_style: 'even' as const,
    knocks_you_off: 'bad sleep',
    morning_cue: 'making coffee',
  };
  const history = [
    { day: 1, status: 'done' as const },
    { day: 2, status: 'done' as const },
    { day: 3, status: 'done' as const },
    { day: 4, status: 'done' as const },
  ];

  const result = await routeTalkReply(
    {
      me,
      message: "How's my week going?",
      checkCount: 4,
      history,
      aiConsent: true,
    },
    { config, providers, isDev: true },
  );

  assert.equal(result.kind, 'reply', `expected a reply, got kind=${result.kind}`);
  assert.equal(result.provider, 'gemini', `expected the REAL gemini provider, got ${result.provider}`);
  assert.ok(result.reply && result.reply.length > 0, 'reply must not be empty');
  assert.ok(
    !result.reply!.includes('\u0000') && !result.reply!.includes('* *'),
    'reply must not be garbled',
  );

  // The prompt demands "~4 sentences max"; a truncated reply would be cut
  // mid-word or end abruptly on a fragment. A full reply ends with sentence
  // punctuation.
  const trimmed = result.reply!.trim();
  assert.ok(
    /[.!?]["']?$/.test(trimmed),
    `reply looks truncated (no terminal punctuation): ${JSON.stringify(trimmed.slice(-80))}`,
  );
  assert.ok(
    trimmed.split(/(?<=[.!?])\s+/).length <= 6,
    `reply exceeds the ~4-sentence budget: ${JSON.stringify(trimmed)}`,
  );

  console.log('kind     :', result.kind);
  console.log('provider :', result.provider);
  console.log('dev trace:', JSON.stringify(result.dev));
  console.log('reply    :', result.reply);
  console.log('\nLive Talk exchange PASSED — full, untruncated reply from real Gemini path.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
